'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from './DashboardLayout';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { apiGet, apiJson } from '@/lib/api';

type ChatSummary = {
  id: string;
  memberCount: number;
  createdAt: string;
  group: { id: string; slug: string; name: string } | null;
  proposal: { id: string; status: string; formedGroupId: string | null } | null;
};

type ChatsResponse = { chats: ChatSummary[] };

type Message = {
  id: string;
  chatId: string;
  sender: { id: string; username: string | null; displayName: string | null };
  kind: string;
  body: string;
  createdAt: string;
};

type MessagesResponse = { messages: Message[] };

type SendMessageResponse = { message: Message };

export default function GroupChatClient(props: { groupSlug: string }) {
  const { groupSlug } = props;

  const [chat, setChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const groupName = chat?.group?.name ?? groupSlug;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { chats } = await apiGet<ChatsResponse>('/me/chats');
      const found = chats.find(c => c.group?.slug === groupSlug) ?? null;
      if (!found) {
        throw new Error('Chat not found for this group (are you a member?)');
      }
      setChat(found);

      const res = await apiGet<MessagesResponse>(`/me/chats/${found.id}/messages?limit=50`);
      setMessages(res.messages ?? []);
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
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending && !!chat, [draft, sending, chat]);

  const send = useCallback(async () => {
    if (!chat) return;
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);

    try {
      const { message } = await apiJson<SendMessageResponse>(
        `/me/chats/${chat.id}/messages`,
        'POST',
        { body },
      );
      setDraft('');
      setMessages(cur => [...cur, message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [chat, draft]);

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

        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorMessage message={error} /> : null}

      {!loading && chat ? (
        <div className="flex h-[70vh] flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{groupName}</p>
              <p className="text-xs text-slate-400">{chat.memberCount} members</p>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="text-sm text-slate-400">No messages yet.</div>
            ) : (
              <div className="space-y-3">
                {messages.map(m => {
                  const senderName = m.sender.displayName ?? m.sender.username ?? 'Unknown';
                  return (
                    <div key={m.id} className="rounded-lg bg-slate-800/60 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium text-white">{senderName}</p>
                        <p className="shrink-0 text-[11px] text-slate-400">
                          {new Date(m.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-100">{m.body}</p>
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
                onChange={e => setDraft(e.target.value)}
                disabled={sending}
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
