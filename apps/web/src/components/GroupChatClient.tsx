'use client';

import CreateEventDialog from '@/components/chat/CreateEventDialog';
import EventMessageCard from '@/components/chat/EventMessageCard';
import { apiGet } from '@/lib/api';
import {
  ChatMessageType,
  useChatRealtime,
  type ChatMessage,
  type EventMessagePayload,
} from '@/lib/chat';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import Link from 'next/link';
import { initialsFor, pickGradient } from '@/lib/avatarUtils';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import DashboardLayout from './DashboardLayout';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';

type ChatSummary = {
  id: string;
  memberCount: number;
  createdAt: string;
  group: { id: string; slug: string; name: string } | null;
  proposal: { id: string; status: string; formedGroupId: string | null } | null;
};

type ChatsResponse = { chats: ChatSummary[] };

type MessagesResponse = { messages: ChatMessage[] };

type ProfileResponse = { appUserId: string | null };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDayHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';

  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Replace the payload of any message in `messages` whose event matches
 * `next.eventId`. Returns the same array reference when nothing changes.
 */
function applyEventUpdate(
  messages: ChatMessage[],
  next: EventMessagePayload,
): ChatMessage[] {
  let mutated = false;
  const out = messages.map((m) => {
    if (
      m.type !== ChatMessageType.EVENT ||
      !('eventId' in m.payload) ||
      m.payload.eventId !== next.eventId
    ) {
      return m;
    }
    mutated = true;
    return { ...m, payload: next };
  });
  return mutated ? out : messages;
}

/**
 * Combine `fetched` (from REST) with `current` (which may include realtime
 * messages that arrived mid-fetch or while disconnected) into a single
 * deduped, chronological list. Used by both the initial load and the
 * post-reconnect backfill so neither path clobbers the other.
 */
function mergeMessages(
  current: ChatMessage[],
  fetched: ChatMessage[],
): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of fetched) byId.set(m.id, m);
  for (const m of current) if (!byId.has(m.id)) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

function Avatar({
  name,
  seed,
  size = 'md',
}: {
  name: string;
  seed: string;
  size?: 'sm' | 'md';
}) {
  const gradient = pickGradient(seed);
  const initials = initialsFor(name);
  const sizeClass =
    size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-md shadow-black/30 ring-1 ring-white/10 ${gradient} ${sizeClass}`}
    >
      {initials}
    </div>
  );
}

function StatusPill({
  connected,
  isConnecting,
}: {
  connected: boolean;
  isConnecting: boolean;
}) {
  const dotClass = connected
    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]'
    : isConnecting
      ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]';
  const label = connected
    ? 'Connected'
    : isConnecting
      ? 'Connecting…'
      : 'Disconnected';

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 backdrop-blur-sm">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}

export default function GroupChatClient(props: { groupSlug: string }) {
  const { groupSlug } = props;

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const groupName = chat?.group?.name ?? groupSlug;

  // Get the current session's access token. The realtime hook needs it to
  // authenticate the broadcast subscription against the channel-auth RLS.
  useEffect(() => {
    let cancelled = false;
    async function getAuthInfo() {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setError('Not signed in');
        return;
      }

      setToken(session.access_token);
    }

    void getAuthInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  // RSVPs are keyed by Prisma User.id (not Supabase auth id). Resolve the
  // app user id so the RSVP buttons can highlight my own current choice.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function resolveAppUserId() {
      try {
        const profile = await apiGet<ProfileResponse>('/profile');
        if (cancelled) return;
        if (profile.appUserId) setAppUserId(profile.appUserId);
      } catch {
        // Best-effort. Without it, RSVP highlighting won't work but RSVPing
        // itself still succeeds because the server keys off the auth token.
      }
    }
    void resolveAppUserId();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Backfill recent messages from REST. Used both on initial load and after
  // a realtime reconnect (broadcasts dropped during the gap aren't replayed).
  // Always merges into current state so messages that arrived mid-fetch via
  // the realtime channel aren't clobbered.
  const backfill = useCallback(async (chatId: string): Promise<void> => {
    const res = await apiGet<MessagesResponse>(
      `/me/chats/${chatId}/messages?limit=50`,
    );
    const fresh = res.messages ?? [];
    setMessages((cur) => mergeMessages(cur, fresh));
  }, []);

  const {
    connected: realtimeConnected,
    isConnecting,
    sendMessage: sendChatMessage,
    error: realtimeError,
  } = useChatRealtime({
    chatId: chat?.id ?? null,
    token,
    onMessageReceived: (message) => {
      setMessages((cur) => {
        const exists = cur.some((m) => m.id === message.id);
        return exists ? cur : [...cur, message];
      });
    },
    onEventUpdated: (payload) => {
      setMessages((cur) => applyEventUpdate(cur, payload.event));
    },
    onResubscribed: (chatId) => {
      void backfill(chatId).catch((err) => {
        console.error('Failed to backfill after reconnect:', err);
      });
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { chats } = await apiGet<ChatsResponse>('/me/chats');
      const found = chats.find((c) => c.group?.slug === groupSlug) ?? null;
      if (!found) {
        throw new Error('Chat not found for this group (are you a member?)');
      }
      setChat(found);

      await backfill(found.id);
    } catch (e) {
      setChat(null);
      setMessages([]);
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [groupSlug, backfill]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const canSend = useMemo(
    () => draft.trim().length > 0 && !sending && !!chat && realtimeConnected,
    [draft, sending, chat, realtimeConnected],
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body) {
      setError('Type a message before sending');
      return;
    }
    if (!chat) {
      setError('Chat is not loaded yet');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const message = await sendChatMessage(chat.id, ChatMessageType.TEXT, {
        body,
      });
      setDraft('');
      setMessages((cur) =>
        cur.some((m) => m.id === message.id) ? cur : [...cur, message],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [chat, draft, sendChatMessage]);

  const handleEventCreated = useCallback((message: ChatMessage) => {
    setMessages((cur) =>
      cur.some((m) => m.id === message.id) ? cur : [...cur, message],
    );
  }, []);

  const handleEventUpdated = useCallback((next: EventMessagePayload) => {
    setMessages((cur) => applyEventUpdate(cur, next));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSend) void send();
      }
    },
    [canSend, send],
  );

  // Group avatar gradient (used for the hero icon).
  const heroGradient = useMemo(
    () => pickGradient(chat?.group?.id ?? groupSlug),
    [chat?.group?.id, groupSlug],
  );
  const heroInitials = useMemo(() => initialsFor(groupName), [groupName]);

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 px-6 py-6 text-white shadow-xl">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-400 opacity-40 blur-3xl" />
          <div className="pointer-events-none absolute right-1/3 top-8 h-56 w-56 rounded-full bg-pink-500 opacity-30 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-16 h-56 w-56 rounded-full bg-indigo-500 opacity-40 blur-3xl" />

          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-base font-bold tracking-tight text-white shadow-lg ring-1 ring-white/20 ${heroGradient}`}
              >
                {heroInitials}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-purple-100/80">
                  <Link
                    className="transition-colors hover:text-white"
                    href="/groups"
                  >
                    Groups
                  </Link>
                  <span className="mx-1.5 text-purple-200/60">/</span>
                  <span className="text-purple-100">{groupName}</span>
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight md:text-3xl">
                  {groupName}
                </h1>
                {chat ? (
                  <p className="mt-1 text-sm text-purple-100/90">
                    {chat.memberCount} member{chat.memberCount === 1 ? '' : 's'} · Group chat
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                connected={realtimeConnected}
                isConnecting={isConnecting}
              />
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void load()}
                disabled={loading}
              >
                <span aria-hidden>↻</span>
                Refresh
              </button>
              <button
                type="button"
                className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-purple-700 shadow-lg shadow-purple-900/30 transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!chat}
                onClick={() => setEventDialogOpen(true)}
              >
                <span aria-hidden>＋</span>
                Propose event
              </button>
            </div>
          </div>
        </div>

        {error || realtimeError ? (
          <ErrorMessage message={error || realtimeError?.message || ''} />
        ) : null}

        {loading && !chat ? (
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-10 backdrop-blur-xl">
            <Loading />
          </div>
        ) : null}

        {/* Chat surface */}
        {!loading && chat ? (
          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 opacity-50 blur-xl"
            />

            <div className="relative flex h-[70vh] min-h-[28rem] flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/80 shadow-2xl backdrop-blur-xl">
              {/* Message list */}
              <div
                ref={listRef}
                className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-3xl shadow-lg shadow-purple-900/40">
                      💬
                    </div>
                    <p className="mt-4 text-base font-semibold text-white">
                      No messages yet
                    </p>
                    <p className="mt-1 max-w-xs text-sm text-slate-400">
                      Say hi or propose an event to get the group going.
                    </p>
                  </div>
                ) : (
                  <MessageList
                    messages={messages}
                    appUserId={appUserId}
                    onEventUpdated={handleEventUpdated}
                  />
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-slate-800/80 bg-slate-950/60 p-3 sm:p-4">
                <div className="flex items-end gap-2 sm:gap-3">
                  <div className="relative flex-1">
                    <textarea
                      className="block max-h-40 min-h-[44px] w-full resize-none rounded-2xl border border-slate-700/80 bg-slate-800/60 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                      placeholder={
                        realtimeConnected
                          ? `Message ${groupName}…`
                          : 'Connecting to chat…'
                      }
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={sending || !realtimeConnected}
                      rows={1}
                    />
                  </div>
                  <button
                    type="button"
                    className="group relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-900/40 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100 sm:h-11 sm:w-auto sm:px-5"
                    onClick={() => void send()}
                    disabled={!canSend}
                    aria-label="Send message"
                  >
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    {sending ? (
                      <span className="relative flex items-center gap-2 text-sm font-semibold">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        <span className="hidden sm:inline">Sending…</span>
                      </span>
                    ) : (
                      <span className="relative flex items-center gap-2 text-sm font-semibold">
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="currentColor"
                        >
                          <path d="M3 11.5 21 3l-8.5 18-2-7.5L3 11.5z" />
                        </svg>
                        <span className="hidden sm:inline">Send</span>
                      </span>
                    )}
                  </button>
                </div>
                <p className="mt-2 hidden px-1 text-[11px] text-slate-500 sm:block">
                  Enter to send · Shift + Enter for a new line
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {chat ? (
        <CreateEventDialog
          chatId={chat.id}
          open={eventDialogOpen}
          onClose={() => setEventDialogOpen(false)}
          onCreated={handleEventCreated}
        />
      ) : null}
    </DashboardLayout>
  );
}

/**
 * Render the message stream with day separators, system pills, event cards,
 * and chat bubbles that distinguish "me" vs "them". Consecutive messages
 * from the same sender within ~5 minutes are grouped to avoid repeated
 * avatars and headers.
 */
function MessageList({
  messages,
  appUserId,
  onEventUpdated,
}: {
  messages: ChatMessage[];
  appUserId: string | null;
  onEventUpdated: (next: EventMessagePayload) => void;
}) {
  const items: ReactElement[] = [];
  let lastDayKey: string | null = null;
  let lastSenderId: string | null = null;
  let lastTimestamp = 0;

  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    const ts = new Date(m.createdAt).getTime();
    const dayKey = new Date(m.createdAt).toDateString();

    if (dayKey !== lastDayKey) {
      items.push(
        <div
          key={`day-${m.id}`}
          className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
        >
          <div className="h-px flex-1 bg-slate-800" />
          <span>{formatDayHeading(m.createdAt)}</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>,
      );
      lastDayKey = dayKey;
      lastSenderId = null;
    }

    const sameSender =
      lastSenderId === m.sender.id && ts - lastTimestamp < 5 * 60 * 1000;

    if (m.type === ChatMessageType.SYSTEM && 'body' in m.payload) {
      items.push(
        <div key={m.id} className="my-2 flex justify-center">
          <span className="rounded-full border border-slate-700/80 bg-slate-800/60 px-3 py-1 text-[11px] text-slate-300">
            {m.payload.body}
          </span>
        </div>,
      );
      lastSenderId = null;
      lastTimestamp = ts;
      continue;
    }

    if (m.type === ChatMessageType.EVENT && 'eventId' in m.payload) {
      items.push(
        <div key={m.id} className="my-3">
          <EventMessageCard
            chatId={m.chatId}
            event={m.payload}
            proposer={m.sender}
            currentUserId={appUserId}
            onEventUpdated={onEventUpdated}
          />
        </div>,
      );
      lastSenderId = null;
      lastTimestamp = ts;
      continue;
    }

    const body = 'body' in m.payload ? m.payload.body : '';
    const senderName =
      m.sender.displayName ?? m.sender.username ?? 'Unknown';
    const isMe = appUserId !== null && m.sender.id === appUserId;
    const showHeader = !sameSender;

    items.push(
      <div
        key={m.id}
        className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'} ${
          showHeader ? 'mt-3' : 'mt-1'
        }`}
      >
        {!isMe ? (
          showHeader ? (
            <Avatar name={senderName} seed={m.sender.id} size="sm" />
          ) : (
            <div className="w-7 shrink-0" aria-hidden />
          )
        ) : null}

        <div
          className={`flex max-w-[78%] flex-col ${
            isMe ? 'items-end' : 'items-start'
          }`}
        >
          {showHeader && !isMe ? (
            <p className="mb-1 px-1 text-xs font-semibold text-slate-300">
              {senderName}
            </p>
          ) : null}

          <div
            className={`group relative rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
              isMe
                ? 'rounded-br-md bg-purple-600 text-white shadow-purple-900/30'
                : 'rounded-bl-md border border-slate-700/60 bg-slate-800/70 text-slate-100'
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{body}</p>
            <span
              className={`mt-1 block text-[10px] tracking-wide ${
                isMe ? 'text-purple-200/80' : 'text-slate-500'
              }`}
            >
              {formatTime(m.createdAt)}
            </span>
          </div>
        </div>
      </div>,
    );

    lastSenderId = m.sender.id;
    lastTimestamp = ts;
  }

  return <div>{items}</div>;
}
