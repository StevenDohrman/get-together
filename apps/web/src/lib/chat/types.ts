/**
 * Client-side wire types for the realtime chat channel. Mirror the server
 * types one-for-one (see `apps/api/src/types/chat.ts`).
 */

export interface User {
  id: string;
  username: string | null;
  displayName: string | null;
}

export interface TextMessagePayload {
  body: string;
}

export interface SystemMessagePayload {
  body: string;
}

export type RsvpStatus = 'GOING' | 'MAYBE' | 'NOT_GOING';

export interface EventRsvpDto {
  user: User;
  status: RsvpStatus;
  createdAt: string;
}

/**
 * Payload carried by EVENT chat messages. Mirrors the server type 1:1.
 * Contains the full event snapshot + current RSVPs (one row per attendee).
 */
export interface EventMessagePayload {
  eventId: string;
  title: string;
  description: string | null;
  locationName: string | null;
  locationAddress: string | null;
  startsAt: string;
  endsAt: string | null;
  createdById: string;
  groupId: string | null;
  rsvps: EventRsvpDto[];
}

export type MessagePayload =
  | TextMessagePayload
  | EventMessagePayload
  | SystemMessagePayload;

export enum ChatMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  EVENT = 'event',
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: User;
  type: ChatMessageType;
  payload: MessagePayload;
  createdAt: string;
}

/**
 * Server-pushed event when an event's RSVPs change. Listeners should
 * replace the rendered copy of the matching event with this snapshot.
 */
export interface EventUpdatedPayload {
  chatId: string;
  event: EventMessagePayload;
}

export interface ChatError {
  code: string;
  message: string;
}

/**
 * Realtime broadcast event names sent on the `chat:<chatId>` topic.
 * Must stay in sync with `apps/api/src/types/chat.ts`.
 */
export const CHAT_BROADCAST_EVENTS = {
  MESSAGE_RECEIVED: 'chat:message:received',
  EVENT_UPDATED: 'chat:event:updated',
} as const;

export function chatBroadcastTopic(chatId: string): string {
  return `chat:${chatId}`;
}
