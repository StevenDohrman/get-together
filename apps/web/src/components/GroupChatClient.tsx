'use client';

import { apiGet } from '@/lib/api';
import {
  SocketMessageType,
  useSocketChat,
  type ChatMessage,
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

export default function GroupChatClient(props: { groupSlug: string }) {
  const { groupSlug } = props;

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const joinedChatRef = useRef<string | null>(null);

  const groupName = chat?.group?.name ?? groupSlug;

  // Get current user and token.
  // `getSupabaseBrowserClient` touches `window.localStorage`, so it must only
  // run on the client. Calling it during render (e.g. via useMemo) would throw
  // during Next.js's server prerender pass for this client component.
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

  // Initialize socket connection
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
      // Only add if not already in the list (to avoid duplicates)
      setMessages((cur) => {
        const exists = cur.some((m) => m.id === message.id);
        return exists ? cur : [...cur, message];
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

      const res = await apiGet<MessagesResponse>(
        `/me/chats/${found.id}/messages?limit=50`,
      );
      setMessages(res.messages ?? []);
    } catch (e) {
      setChat(null);
      setMessages([]);
      setError(e instanceof Error ? e.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [groupSlug]);
  // Initial load

  useEffect(() => {
    void load();
  }, [load]);
  // Join chat when chat is loaded and socket is connected
  useEffect(() => {
    if (!chat?.id || !socketConnected) {
      // Clear the joined reference if socket is not connected
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
      // Only attempt to leave if we actually joined this chat. The socket may
      // have already been torn down (e.g. when the access token refreshes and
      // the socket effect re-runs); in that case skip the leave RPC because
      // there's no live socket to send it on anyway — the server cleans up
      // membership on disconnect.
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

  // Auto-scroll to bottom when new messages arrive

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
      // Surface this instead of silently dropping the click so the user
      // gets feedback if the button looked enabled but state is stale.
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
      // Optimistically append using the server-confirmed message. The
      // `MESSAGE_RECEIVED` broadcast handler dedupes by `message.id`, so
      // this is safe even when the broadcast also arrives.
      setMessages((cur) =>
        cur.some((m) => m.id === message.id) ? cur : [...cur, message],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [chat, draft, socketConnected, sendSocketMessage]);

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
          </div>

          <div ref={listRef} className="flex-1 overflow-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-400">No messages yet.</div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  const senderName =
                    m.sender.displayName ?? m.sender.username ?? 'Unknown';
                  const body =
                    m.type === SocketMessageType.TEXT && 'body' in m.payload
                      ? m.payload.body
                      : m.type === SocketMessageType.SYSTEM &&
                          'body' in m.payload
                        ? m.payload.body
                        : '[Activity message]';

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
    </DashboardLayout>
  );
}
