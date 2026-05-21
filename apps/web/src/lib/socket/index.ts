/**
 * Export all socket-related utilities
 */

export { getSocketURL, SOCKET_EVENTS } from './config';
export { SocketMessageType } from './types';
export type {
  ActivityMessagePayload,
  ChatMessage,
  MessagePayload,
  SocketError,
  TextMessagePayload,
  User,
} from './types';
export { useSocketChat } from './useSocketChat';
export type {
  UseSocketChatOptions,
  UseSocketChatReturn,
} from './useSocketChat';
