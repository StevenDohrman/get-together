/**
 * Extensible chat message type system supporting both current and future message types.
 * Designed to support polymorphic message handling.
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
 * separate `chat:event:updated` events; the canonical store is the DB.
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
export enum SocketMessageType {
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
  type: SocketMessageType;
  payload: MessagePayload;
  createdAt: string;
}

/**
 * Broadcast when an event's mutable state changes (currently: an RSVP was
 * set or cleared). The `payload` is the full updated snapshot so clients
 * can replace what they have without further requests.
 */
export interface EventUpdatedPayload {
  chatId: string;
  event: EventMessagePayload;
}

/** Server-to-client socket event: new message received */
export interface MessageReceivedEvent {
  type: 'message:received';
  data: ChatMessage;
}

/** Client-to-server socket event: send new message */
export interface SendMessageEvent {
  type: 'message:send';
  data: {
    chatId: string;
    messageType: SocketMessageType;
    payload: MessagePayload;
  };
}

/** Server-to-client socket event: message sent successfully */
export interface MessageSentEvent {
  type: 'message:sent';
  data: ChatMessage;
}

/** Server-to-client socket event: error occurred */
export interface ErrorEvent {
  type: 'error';
  data: {
    code: string;
    message: string;
  };
}

/** Union of all socket events */
export type SocketEvent = MessageReceivedEvent | MessageSentEvent | ErrorEvent;

/** Socket namespace events */
export const SOCKET_EVENTS = {
  // Client to server
  JOIN_CHAT: 'chat:join',
  LEAVE_CHAT: 'chat:leave',
  SEND_MESSAGE: 'chat:message:send',

  // Server to client
  MESSAGE_RECEIVED: 'chat:message:received',
  MESSAGE_SENT: 'chat:message:sent',
  ERROR: 'chat:error',
  USER_JOINED: 'chat:user:joined',
  USER_LEFT: 'chat:user:left',
  /** An EVENT message's mutable state (RSVPs) changed. */
  EVENT_UPDATED: 'chat:event:updated',
} as const;
