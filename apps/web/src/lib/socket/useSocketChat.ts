/**
 * React hook for managing Socket.IO chat connection
 * Handles connection lifecycle, chat subscriptions, and real-time message receiving
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS, getSocketURL } from './config';
import { SocketMessageType, type ChatMessage, type SocketError } from './types';

export interface UseSocketChatOptions {
  userId: string | null;
  token: string | null;
  onMessageReceived?: (message: ChatMessage) => void;
  onError?: (error: SocketError) => void;
}

export interface UseSocketChatReturn {
  connected: boolean;
  isConnecting: boolean;
  joinChat: (chatId: string) => Promise<void>;
  leaveChat: (chatId: string) => Promise<void>;
  sendMessage: (
    chatId: string,
    messageType: SocketMessageType,
    payload: unknown,
  ) => Promise<ChatMessage>;
  error: SocketError | null;
}

export function useSocketChat(
  options: UseSocketChatOptions,
): UseSocketChatReturn {
  const { userId, token, onMessageReceived, onError } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<SocketError | null>(null);

  // Store callbacks in refs so the socket effect never needs to depend on them.
  // This prevents a reconnect loop when the parent passes inline arrow functions.
  const onMessageReceivedRef = useRef(onMessageReceived);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onMessageReceivedRef.current = onMessageReceived;
    onErrorRef.current = onError;
  }, [onMessageReceived, onError]);

  // Initialize socket connection — only re-runs when credentials actually change
  useEffect(() => {
    if (!userId || !token) return;

    setIsConnecting(true);
    const socketURL = getSocketURL();
    console.log('[Socket] Attempting connection to:', socketURL, { userId });

    const socket = io(socketURL, {
      auth: { userId, token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_attempt', () => {
      console.debug('[Socket] Connection attempt started');
    });

    socket.on('connect', () => {
      setConnected(true);
      setIsConnecting(false);
      console.debug('[Socket] Connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.debug('[Socket] Disconnected');
    });

    socket.on('connect_error', (err: unknown) => {
      const socketError: SocketError = {
        code: 'CONNECT_ERROR',
        message: err instanceof Error ? err.message : String(err),
      };
      setError(socketError);
      setIsConnecting(false);
      onErrorRef.current?.(socketError);
      console.error('[Socket] Connection error:', err);
    });

    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVED, (message: ChatMessage) => {
      console.debug('[Socket] Message received:', message);
      onMessageReceivedRef.current?.(message);
    });

    socket.on(SOCKET_EVENTS.ERROR, (data: unknown) => {
      const socketError = (data as SocketError) || {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred',
      };
      setError(socketError);
      onErrorRef.current?.(socketError);
      console.error('[Socket] Error:', socketError);
    });

    socket.on(
      SOCKET_EVENTS.USER_JOINED,
      (data: { userId: string; timestamp: string }) => {
        console.debug('[Socket] User joined:', data);
      },
    );

    socket.on(
      SOCKET_EVENTS.USER_LEFT,
      (data: { userId: string; timestamp: string }) => {
        console.debug('[Socket] User left:', data);
      },
    );

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, token]); // ✅ Callbacks removed — they're accessed via refs

  // Server sends plain `{ message }` objects in ack callbacks because
  // `Error` instances don't survive Socket.IO's JSON serialization.
  const toError = (
    ack: { message?: string } | null | undefined,
    fallback: string,
  ): Error => new Error(ack?.message?.trim() || fallback);

  const joinChat = useCallback(async (chatId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      socketRef.current.emit(
        SOCKET_EVENTS.JOIN_CHAT,
        { chatId },
        (err: { message?: string } | null) => {
          if (err) {
            const e = toError(err, 'Failed to join chat');
            console.error('[Socket] Join chat error:', e.message);
            reject(e);
          } else {
            console.debug('[Socket] Joined chat:', chatId);
            resolve();
          }
        },
      );
    });
  }, []);

  const leaveChat = useCallback(async (chatId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Socket not connected'));
        return;
      }
      socketRef.current.emit(
        SOCKET_EVENTS.LEAVE_CHAT,
        { chatId },
        (err: { message?: string } | null) => {
          if (err) {
            const e = toError(err, 'Failed to leave chat');
            console.error('[Socket] Leave chat error:', e.message);
            reject(e);
          } else {
            console.debug('[Socket] Left chat:', chatId);
            resolve();
          }
        },
      );
    });
  }, []);

  const sendMessage = useCallback(
    async (
      chatId: string,
      messageType: SocketMessageType,
      payload: unknown,
    ): Promise<ChatMessage> => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error('Socket not connected'));
          return;
        }
        socketRef.current.emit(
          SOCKET_EVENTS.SEND_MESSAGE,
          { chatId, messageType, payload },
          (
            err: { message?: string } | null,
            message?: ChatMessage,
          ) => {
            if (err) {
              const e = toError(err, 'Failed to send message');
              console.error('[Socket] Send message error:', e.message);
              reject(e);
            } else if (message) {
              console.debug('[Socket] Message sent:', message);
              resolve(message);
            } else {
              reject(new Error('No response from server'));
            }
          },
        );
      });
    },
    [],
  );

  return { connected, isConnecting, joinChat, leaveChat, sendMessage, error };
}
