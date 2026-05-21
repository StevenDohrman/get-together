/**
 * Extensible chat message type system supporting both current and future message types.
 * Designed to support polymorphic message handling.
 */

/** Text message payload */
export interface TextMessagePayload {
  body: string;
}

/** Activity message payload - for future use (location, time, accepted count) */
export interface ActivityMessagePayload {
  location?: {
    name: string;
    lat?: number;
    lng?: number;
  };
  time?: {
    startTime: string; // ISO 8601
    endTime?: string; // ISO 8601
  };
  acceptedCount?: number;
  description?: string;
}

/** System message payload */
export interface SystemMessagePayload {
  body: string;
}

/** Unified enum for polymorphic message handling */
export enum SocketMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  ACTIVITY = 'activity',
}

/** Union of all message payload types */
export type MessagePayload =
  | TextMessagePayload
  | ActivityMessagePayload
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
  type: SocketMessageType; // Discriminator for polymorphic handling
  payload: MessagePayload;
  createdAt: string;
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

/** Socket namespace events - for internal use */
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
} as const;
