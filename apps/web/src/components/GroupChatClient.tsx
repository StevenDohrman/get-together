'use client';

import CreateEventDialog from '@/components/chat/CreateEventDialog';
import EventMessageCard from '@/components/chat/EventMessageCard';
import { apiGet } from '@/lib/api';
import {
  SocketMessageType,
  useSocketChat,
  type ChatMessage,
  type EventMessagePayload,
} from '@/lib/socket';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
      m.type !== SocketMessageType.EVENT ||
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

export default function GroupChatClient(props: { groupSlug: string }) {
  const { groupSlug } = props;

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const joinedChatRef = useRef<string | null>(null);

  const groupName = chat?.group?.name ?? groupSlug;

  // Get current user and token.
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

      setUserId(session.user.id);
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

  const {
    connected: socketConnected,
    isConnecting,
    joinChat,
    leaveChat,
    sendMessage: sendSocketMessage,
    error: socketError,
  } = useSocketChat({
    userId,
    token,
    onMessageReceived: (message: ChatMessage) => {
      setMessages((cur) => {
        const exists = cur.some((m) => m.id === message.id);
        return exists ? cur : [...cur, message];
      });
    },
    onEventUpdated: (payload) => {
      setMessages((cur) => applyEventUpdate(cur, payload.event));
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

      const res = await apiGet<MessagesResponse>(
        `/me/chats/${found.id}/messages?limit=50`,
      );
      setMessages((cur) => {
        const fetchedMessages = res.messages ?? [];
        const merged = [...fetchedMessages];

        for (const message of cur) {
          if (!merged.some((existing) => existing.id === message.id)) {
            merged.push(message);
          }
        }

        return merged;
      });
    } catch (e) {
      setChat(null);
      setMessages([]);
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [groupSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!chat?.id || !socketConnected) {
      if (!socketConnected && joinedChatRef.current) {
        joinedChatRef.current = null;
      }
      return;
    }

    void joinChat(chat.id)
      .then(() => {
        joinedChatRef.current = chat.id;
      })
      .catch((err) => {
        console.error('Failed to join chat:', err);
        setError(err instanceof Error ? err.message : 'Failed to join chat');
      });

    return () => {
      if (joinedChatRef.current === chat.id) {
        joinedChatRef.current = null;
        if (socketConnected) {
          void leaveChat(chat.id).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg !== 'Socket not connected') {
              console.error('Failed to leave chat:', err);
            }
          });
        }
      }
    };
  }, [chat?.id, socketConnected, joinChat, leaveChat]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const canSend = useMemo(
    () => draft.trim().length > 0 && !sending && !!chat && socketConnected,
    [draft, sending, chat, socketConnected],
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
    if (!socketConnected) {
      setError('Not connected to chat server');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const message = await sendSocketMessage(chat.id, SocketMessageType.TEXT, {
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
  }, [chat, draft, socketConnected, sendSocketMessage]);

  const handleEventCreated = useCallback((message: ChatMessage) => {
    setMessages((cur) =>
      cur.some((m) => m.id === message.id) ? cur : [...cur, message],
    );
  }, []);

  const handleEventUpdated = useCallback((next: EventMessagePayload) => {
    setMessages((cur) => applyEventUpdate(cur, next));
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            <Link className="hover:underline" href="/groups">
              Groups
            </Link>
            <span className="mx-2">/</span>
            <span className="text-slate-300">{groupName}</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Group chat</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded bg-slate-800 px-3 py-2">
            <div
              className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`}
            />
            <span className="text-xs text-slate-300">
              {socketConnected
                ? 'Connected'
                : isConnecting
                  ? 'Connecting…'
                  : 'Disconnected'}
            </span>
          </div>

          <button
            type="button"
            className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? <Loading /> : null}
      {error || socketError ? (
        <ErrorMessage message={error || socketError?.message || ''} />
      ) : null}

      {!loading && chat ? (
        <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {groupName}
              </p>
              <p className="text-xs text-slate-400">
                {chat.memberCount} members
              </p>
            </div>

            <button
              type="button"
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-60"
              disabled={!chat}
              onClick={() => setEventDialogOpen(true)}
            >
              + Propose event
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-400">No messages yet.</div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  if (
                    m.type === SocketMessageType.EVENT &&
                    'eventId' in m.payload
                  ) {
                    return (
                      <div key={m.id}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 px-1">
                          <p className="truncate text-xs text-slate-400">
                            {m.sender.displayName ??
                              m.sender.username ??
                              'Unknown'}
                          </p>
                          <p className="shrink-0 text-[11px] text-slate-500">
                            {new Date(m.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <EventMessageCard
                          chatId={m.chatId}
                          event={m.payload}
                          proposer={m.sender}
                          currentUserId={appUserId}
                          onEventUpdated={handleEventUpdated}
                        />
                      </div>
                    );
                  }

                  const senderName =
                    m.sender.displayName ?? m.sender.username ?? 'Unknown';
                  const body =
                    'body' in m.payload ? m.payload.body : '';

                  return (
                    <div
                      key={m.id}
                      className="rounded-lg bg-slate-800/60 px-3 py-2"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium text-white">
                          {senderName}
                        </p>
                        <p className="shrink-0 text-[11px] text-slate-400">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">
                        {body}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 p-3">
            <div className="flex items-end gap-3">
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-700"
                placeholder="Write a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={sending || !socketConnected}
                rows={2}
              />
              <button
                type="button"
                className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => void send()}
                disabled={!canSend}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
