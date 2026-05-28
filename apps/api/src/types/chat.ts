/**
 * Wire types for the group-chat realtime channel. These are the payloads
 * persisted on disk (as JSON) and broadcast to clients over Supabase
 * Realtime (private topic `chat:<chatId>`).
 */

import type { RSVPStatus } from '@prisma/client';

/** Text message payload */
export interface TextMessagePayload {
  body: string;
}

/** System message payload */
export interface SystemMessagePayload {
  body: string;
}

/** A single member's RSVP on an event, denormalized for the wire. */
export interface EventRsvpDto {
  user: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
  status: RSVPStatus;
  /** When the attendee first RSVP'd. The DB tracks `createdAt` only. */
  createdAt: string;
}

/**
 * Event message payload — denormalized snapshot of an `Event` plus the
 * current RSVPs, sent to clients alongside the chat message that announced
 * it. Mutations to the underlying event (e.g. someone RSVPing) arrive as
 * separate `chat:event:updated` broadcasts; the canonical store is the DB.
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
  /** Host group for the event. Null when proposed in a chat without a formed group. */
  groupId: string | null;
  rsvps: EventRsvpDto[];
}

/** Unified enum for polymorphic message handling */
export enum ChatMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  EVENT = 'event',
}

/** Union of all message payload types */
export type MessagePayload =
  | TextMessagePayload
  | EventMessagePayload
  | SystemMessagePayload;

/** Base message type with sender and metadata */
export interface ChatMessage {
  id: string;
  chatId: string;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
  };
  type: ChatMessageType;
  payload: MessagePayload;
  createdAt: string;
}

/**
 * Broadcast when an event's mutable state changes (currently: an RSVP was
 * set or cleared). The `event` is the full updated snapshot so clients can
 * replace what they have without further requests.
 */
export interface EventUpdatedPayload {
  chatId: string;
  event: EventMessagePayload;
}

/**
 * Realtime broadcast event names sent on the `chat:<chatId>` topic. Clients
 * subscribe to these via `channel.on('broadcast', { event: ... }, …)`.
 */
export const CHAT_BROADCAST_EVENTS = {
  /** A new chat message was created (text, system, or event-announce). */
  MESSAGE_RECEIVED: 'chat:message:received',
  /** An EVENT message's mutable state (RSVPs) changed. */
  EVENT_UPDATED: 'chat:event:updated',
} as const;

export type ChatBroadcastEvent =
  (typeof CHAT_BROADCAST_EVENTS)[keyof typeof CHAT_BROADCAST_EVENTS];

/** Realtime topic for a given chat. Mirrors the RLS policy in the migration. */
export function chatBroadcastTopic(chatId: string): string {
  return `chat:${chatId}`;
}
