/**
 * Export all socket-related utilities
 */

export { getSocketURL, SOCKET_EVENTS } from './config';
export { SocketMessageType } from './types';
export type {
  ChatMessage,
  EventMessagePayload,
  EventRsvpDto,
  EventUpdatedPayload,
  MessagePayload,
  RsvpStatus,
  SocketError,
  SystemMessagePayload,
  TextMessagePayload,
  User,
} from './types';
export { useSocketChat } from './useSocketChat';
export type {
  UseSocketChatOptions,
  UseSocketChatReturn,
} from './useSocketChat';
