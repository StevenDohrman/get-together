import {
  CHAT_BROADCAST_EVENTS,
  chatBroadcastTopic,
  type ChatMessage,
  type EventMessagePayload,
  type EventUpdatedPayload,
} from '../types/chat.js';

export interface ChatBroadcaster {
  broadcastMessage(chatId: string, message: ChatMessage): Promise<void>;
  broadcastEventUpdated(
    chatId: string,
    event: EventMessagePayload,
  ): Promise<void>;
}

export interface BroadcastConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  /**
   * Optional error sink. Wire to your app logger (e.g. `app.log.error`).
   * Falls back to `console.error` when omitted.
   */
  onError?: (data: unknown, msg: string) => void;
}

/**
 * Publishes chat events to clients via Supabase Realtime Broadcast on the
 * private `chat:<chatId>` topic.
 *
 * We use the Realtime REST API (`POST /realtime/v1/api/broadcast`) directly
 * rather than `supabase-js` `channel.send()` so the API stays stateless —
 * no persistent realtime connection on the server, no subscribe/teardown
 * lifecycle. The service-role key bypasses RLS on `realtime.messages` so we
 * don't need an INSERT policy.
 *
 * Failures are logged and swallowed: a missed broadcast is a degraded user
 * experience but never a failed write (the message is already persisted by
 * the caller before this runs).
 */
export function createChatBroadcaster(
  config: BroadcastConfig | null,
): ChatBroadcaster | null {
  if (!config) return null;

  const { supabaseUrl, serviceRoleKey, onError } = config;
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/realtime/v1/api/broadcast`;

  const log = (data: unknown, msg: string) => {
    if (onError) onError(data, msg);
    else console.error(`[realtime] ${msg}`, data);
  };

  async function publish(
    topic: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ topic, event, payload, private: true }],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        log(
          { status: res.status, body, topic, event },
          'Broadcast HTTP request failed',
        );
      }
    } catch (err) {
      log({ err, topic, event }, 'Broadcast HTTP request threw');
    }
  }

  return {
    async broadcastMessage(chatId, message) {
      await publish(
        chatBroadcastTopic(chatId),
        CHAT_BROADCAST_EVENTS.MESSAGE_RECEIVED,
        message,
      );
    },
    async broadcastEventUpdated(chatId, event) {
      const update: EventUpdatedPayload = { chatId, event };
      await publish(
        chatBroadcastTopic(chatId),
        CHAT_BROADCAST_EVENTS.EVENT_UPDATED,
        update,
      );
    },
  };
}
