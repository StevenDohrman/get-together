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

export interface ActivityMessagePayload {
  location?: {
    name: string;
    lat?: number;
    lng?: number;
  };
  time?: {
    startTime: string;
    endTime?: string;
  };
  acceptedCount?: number;
  description?: string;
}

export interface SystemMessagePayload {
  body: string;
}

export type MessagePayload =
  | TextMessagePayload
  | ActivityMessagePayload
  | SystemMessagePayload;

export enum SocketMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  ACTIVITY = 'activity',
}

export interface ChatMessage {
  id: string;
  chatId: string;
  sender: User;
  type: SocketMessageType;
  payload: MessagePayload;
  createdAt: string;
}

export interface SocketError {
  code: string;
  message: string;
}
