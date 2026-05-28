/**
 * React hook around a Supabase Realtime private broadcast channel for one
 * group chat. Subscribes when `chatId` is set, unsubscribes on change or
 * unmount, and exposes a `sendMessage` that posts via the REST API.
 *
 * Lifecycle is keyed off `chatId` directly — there's no global "connected"
 * state distinct from a chat subscription.
 */

import { apiJson } from '@/lib/api';
import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CHAT_BROADCAST_EVENTS,
  chatBroadcastTopic,
  ChatMessageType,
  type ChatError,
  type ChatMessage,
  type EventUpdatedPayload,
} from './types';

export interface UseChatRealtimeOptions {
  /** Null disables the subscription (e.g. before chat data has loaded). */
  chatId: string | null;
  /**
   * Current Supabase access token. The hook calls `realtime.setAuth(token)`
   * whenever this changes so the channel-auth RLS policy can read auth.uid().
   * Pass `null` while the session is loading.
   */
  token: string | null;
  onMessageReceived?: (message: ChatMessage) => void;
  /**
   * Fired when an event message's RSVPs change. The payload carries the
   * full event snapshot so callers can replace any cached copy.
   */
  onEventUpdated?: (payload: EventUpdatedPayload) => void;
  /**
   * Fired after a *re*-subscribe (e.g. recovering from a network blip).
   * NOT fired on the very first SUBSCRIBED — callers do their own initial
   * load. Use this to backfill any messages dropped during the disconnect.
   */
  onResubscribed?: (chatId: string) => void;
  onError?: (error: ChatError) => void;
}

export interface UseChatRealtimeReturn {
  /** Whether the current chat's channel is subscribed. */
  connected: boolean;
  /** Whether a subscribe is in flight (first attempt or reconnect). */
  isConnecting: boolean;
  /**
   * Persist a message via REST. The server broadcasts it on success, so
   * other subscribers receive it via the channel — the local caller can
   * either rely on that or echo the returned message immediately (the
   * existing UI dedupes by id).
   */
  sendMessage: (
    chatId: string,
    messageType: ChatMessageType,
    payload: unknown,
  ) => Promise<ChatMessage>;
  error: ChatError | null;
}

export function useChatRealtime(
  options: UseChatRealtimeOptions,
): UseChatRealtimeReturn {
  const {
    chatId,
    token,
    onMessageReceived,
    onEventUpdated,
    onResubscribed,
    onError,
  } = options;

  // Stash callbacks in refs so the subscribe effect doesn't reset on every
  // render when the parent passes inline arrow functions.
  const onMessageReceivedRef = useRef(onMessageReceived);
  const onEventUpdatedRef = useRef(onEventUpdated);
  const onResubscribedRef = useRef(onResubscribed);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
    onEventUpdatedRef.current = onEventUpdated;
    onResubscribedRef.current = onResubscribed;
    onErrorRef.current = onError;
  }, [onMessageReceived, onEventUpdated, onResubscribed, onError]);

  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);

  // Keep the realtime client's JWT in sync with the user's session so the
  // channel-auth RLS policy on `realtime.messages` can read auth.uid().
  // Lazily resolve the client inside the effect; `getSupabaseBrowserClient`
  // throws when called during SSR.
  useEffect(() => {
    if (!token) return;
    const supabase = getSupabaseBrowserClient();
    supabase.realtime.setAuth(token);
  }, [token]);

  useEffect(() => {
    if (!chatId || !token) {
      setConnected(false);
      setIsConnecting(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    setIsConnecting(true);
    setError(null);

    const channel: RealtimeChannel = supabase.channel(
      chatBroadcastTopic(chatId),
      { config: { private: true } },
    );

    channel.on(
      'broadcast',
      { event: CHAT_BROADCAST_EVENTS.MESSAGE_RECEIVED },
      ({ payload }) => {
        onMessageReceivedRef.current?.(payload as ChatMessage);
      },
    );

    channel.on(
      'broadcast',
      { event: CHAT_BROADCAST_EVENTS.EVENT_UPDATED },
      ({ payload }) => {
        onEventUpdatedRef.current?.(payload as EventUpdatedPayload);
      },
    );

    let hasSubscribedOnce = false;

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
        setIsConnecting(false);
        setError(null);
        if (hasSubscribedOnce) {
          // Reconnect: ask the caller to backfill anything we missed.
          onResubscribedRef.current?.(chatId);
        } else {
          hasSubscribedOnce = true;
        }
        return;
      }

      if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        setConnected(false);
        setIsConnecting(false);
        if (status !== 'CLOSED') {
          const chatError: ChatError = {
            code: status,
            message: err?.message ?? `Channel ${status.toLowerCase()}`,
          };
          setError(chatError);
          onErrorRef.current?.(chatError);
        }
      }
    });

    return () => {
      void supabase.removeChannel(channel);
      setConnected(false);
      setIsConnecting(false);
    };
  }, [chatId, token]);

  const sendMessage = useCallback(
    async (
      targetChatId: string,
      messageType: ChatMessageType,
      payload: unknown,
    ): Promise<ChatMessage> => {
      const res = await apiJson<{ message: ChatMessage }>(
        `/me/chats/${targetChatId}/messages`,
        'POST',
        { messageType, payload: payload as Record<string, unknown> },
      );
      return res.message;
    },
    [],
  );

  return { connected, isConnecting, sendMessage, error };
}
