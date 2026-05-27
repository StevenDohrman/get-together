/**
 * Client-side type definitions for socket communication.
 * Mirrors server types but optimized for React usage.
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

export enum SocketMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  EVENT = 'event',
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: User;
  type: SocketMessageType;
  payload: MessagePayload;
  createdAt: string;
}

/**
 * Server-pushed event when an event's RSVPs change. Listeners should replace
 * the rendered copy of the matching event with this snapshot.
 */
export interface EventUpdatedPayload {
  chatId: string;
  event: EventMessagePayload;
}

export interface SocketError {
  code: string;
  message: string;
}
