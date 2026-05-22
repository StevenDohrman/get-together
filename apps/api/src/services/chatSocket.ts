import type { Prisma } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import type { Socket, Server as SocketIOServer } from 'socket.io';
import { Server as SocketIOServerConstructor } from 'socket.io';
import { prismaClient as prisma } from '../db.js';
import { resolveAppUser } from '../routes/profile.js';
import {
  SOCKET_EVENTS,
  SocketMessageType,
  type ChatMessage,
  type EventMessagePayload,
  type EventUpdatedPayload,
  type MessagePayload,
  type TextMessagePayload,
} from '../types/socket.js';
import { getEventById, toEventPayload } from './chatEvents.js';
import { isChatMember } from './groupChat.js';

/**
 * Wire format for ack errors. Plain objects survive Socket.IO's JSON
 * serialization (unlike `Error` instances whose `message` is non-enumerable).
 */
export interface SocketAckError {
  message: string;
}

function ackError(message: string): SocketAckError {
  return { message };
}

/**
 * Socket.IO service for managing real-time group chat connections and messaging.
 * Handles authentication, chat subscriptions, and message broadcasting.
 */
export class ChatSocketService {
  private io: SocketIOServer;
  private supabaseAdmin: SupabaseClient | null;

  /** Tracks which userId is connected to which chatIds */
  private userChatSubscriptions: Map<string, Set<string>> = new Map();

  constructor(io: SocketIOServer, supabaseAdmin: SupabaseClient | null) {
    this.io = io;
    this.supabaseAdmin = supabaseAdmin;
  }

  /**
   * Initialize socket handlers
   */
  public initialize(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);

      socket.on(SOCKET_EVENTS.JOIN_CHAT, (data, callback) => {
        this.handleJoinChat(socket, data, callback);
      });

      socket.on(SOCKET_EVENTS.LEAVE_CHAT, (data, callback) => {
        this.handleLeaveChat(socket, data, callback);
      });

      socket.on(SOCKET_EVENTS.SEND_MESSAGE, (data, callback) => {
        this.handleSendMessage(socket, data, callback);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle initial socket connection.
   * The auth middleware has already validated the token and stored the
   * resolved Prisma app user id on `socket.data.userId`.
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;
    if (!userId) {
      socket.disconnect(true);
      return;
    }
  }

  /**
   * Handle user joining a chat room
   */
  private async handleJoinChat(
    socket: Socket,
    data: unknown,
    callback?: (err: SocketAckError | null) => void,
  ): Promise<void> {
    try {
      const userId = socket.data.userId as string;
      const chatId =
        data && typeof data === 'object' && 'chatId' in data
          ? (data.chatId as string)
          : null;

      if (!chatId) {
        callback?.(ackError('Invalid chatId'));
        return;
      }

      const isMember = await isChatMember(chatId, userId);
      if (!isMember) {
        callback?.(ackError('Not a chat member'));
        return;
      }

      if (!this.userChatSubscriptions.has(userId)) {
        this.userChatSubscriptions.set(userId, new Set());
      }
      this.userChatSubscriptions.get(userId)!.add(chatId);

      socket.join(chatId);

      socket.to(chatId).emit(SOCKET_EVENTS.USER_JOINED, {
        userId,
        timestamp: new Date().toISOString(),
      });

      callback?.(null);
    } catch (error) {
      callback?.(
        ackError(error instanceof Error ? error.message : 'Failed to join chat'),
      );
    }
  }

  /**
   * Handle user leaving a chat room
   */
  private handleLeaveChat(
    socket: Socket,
    data: unknown,
    callback?: (err: SocketAckError | null) => void,
  ): void {
    try {
      const userId = socket.data.userId as string;
      const chatId =
        data && typeof data === 'object' && 'chatId' in data
          ? (data.chatId as string)
          : null;

      if (!chatId) {
        callback?.(ackError('Invalid chatId'));
        return;
      }

      this.userChatSubscriptions.get(userId)?.delete(chatId);
      socket.leave(chatId);

      socket.to(chatId).emit(SOCKET_EVENTS.USER_LEFT, {
        userId,
        timestamp: new Date().toISOString(),
      });

      callback?.(null);
    } catch (error) {
      callback?.(
        ackError(error instanceof Error ? error.message : 'Failed to leave chat'),
      );
    }
  }

  /**
   * Handle sending a message.
   *
   * Text messages persist their `body` in the message row. Event messages
   * are not created through this path — clients call `POST /me/chats/:id/
   * events` so the server can validate the proposal payload, persist the
   * `Event` row, and broadcast a hydrated wire message. Attempting to send
   * an EVENT through here is rejected with a helpful error.
   */
  private async handleSendMessage(
    socket: Socket,
    data: unknown,
    callback?: (err: SocketAckError | null, response?: ChatMessage) => void,
  ): Promise<void> {
    try {
      const userId = socket.data.userId as string;

      if (!data || typeof data !== 'object') {
        callback?.(ackError('Invalid message data'));
        return;
      }

      const { chatId, messageType, payload } = data as Record<string, unknown>;

      if (!chatId || typeof chatId !== 'string') {
        callback?.(ackError('Invalid chatId'));
        return;
      }

      if (
        !messageType ||
        !Object.values(SocketMessageType).includes(
          messageType as SocketMessageType,
        )
      ) {
        callback?.(ackError('Invalid messageType'));
        return;
      }

      if (!payload || typeof payload !== 'object') {
        callback?.(ackError('Invalid payload'));
        return;
      }

      const isMember = await isChatMember(chatId, userId);
      if (!isMember) {
        callback?.(ackError('Not a chat member'));
        return;
      }

      if (messageType === SocketMessageType.EVENT) {
        callback?.(
          ackError(
            'Event messages must be created via POST /me/chats/:chatId/events',
          ),
        );
        return;
      }

      // Ensure the sender's socket is in the room before we broadcast.
      if (!socket.rooms.has(chatId)) {
        socket.join(chatId);
        if (!this.userChatSubscriptions.has(userId)) {
          this.userChatSubscriptions.set(userId, new Set());
        }
        this.userChatSubscriptions.get(userId)!.add(chatId);
      }

      const dbKind = messageType === SocketMessageType.SYSTEM ? 'SYSTEM' : 'TEXT';
      const body =
        messageType === SocketMessageType.TEXT
          ? (payload as TextMessagePayload).body
          : '';

      const message = await prisma.groupChatMessage.create({
        data: {
          chatId,
          senderId: userId,
          kind: dbKind,
          body,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true } },
        },
      });

      const socketMessage: ChatMessage = {
        id: message.id,
        chatId: message.chatId,
        sender: message.sender,
        type: messageType as SocketMessageType,
        payload: payload as MessagePayload,
        createdAt: message.createdAt.toISOString(),
      };

      this.io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_RECEIVED, socketMessage);

      callback?.(null, socketMessage);
    } catch (error) {
      callback?.(
        ackError(
          error instanceof Error ? error.message : 'Failed to send message',
        ),
      );
    }
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;
    if (!userId) return;

    const subscriptions = this.userChatSubscriptions.get(userId);
    if (subscriptions) {
      subscriptions.forEach((chatId) => {
        socket.to(chatId).emit(SOCKET_EVENTS.USER_LEFT, {
          userId,
          timestamp: new Date().toISOString(),
        });
      });

      this.userChatSubscriptions.delete(userId);
    }
  }

  /**
   * Broadcast a fully-formed chat message to everyone in a chat. Used by
   * REST routes (e.g. event creation) that persist messages outside the
   * socket pipeline but still want every connected client to receive them.
   */
  public broadcastMessage(chatId: string, message: ChatMessage): void {
    this.io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_RECEIVED, message);
  }

  /**
   * Broadcast that an event's mutable state changed (e.g. someone RSVP'd).
   * Clients should replace any cached copy of this event with the snapshot
   * carried in the payload.
   */
  public broadcastEventUpdated(
    chatId: string,
    payload: EventMessagePayload,
  ): void {
    const update: EventUpdatedPayload = { chatId, event: payload };
    this.io.to(chatId).emit(SOCKET_EVENTS.EVENT_UPDATED, update);
  }

  /**
   * Re-fetch an event from the DB and broadcast it. Convenience wrapper
   * so callers don't need to know about the wire shape.
   */
  public async refreshAndBroadcastEvent(
    chatId: string,
    eventId: string,
  ): Promise<void> {
    const event = await getEventById(eventId);
    if (!event) return;
    this.broadcastEventUpdated(chatId, toEventPayload(event));
  }

  /**
   * Get active users in a chat
   */
  public getActiveUsersInChat(chatId: string): string[] {
    const users: string[] = [];
    this.userChatSubscriptions.forEach((chats, userId) => {
      if (chats.has(chatId)) {
        users.push(userId);
      }
    });
    return users;
  }
}

/**
 * Create and initialize Socket.IO server
 */
export function createSocketServer(
  fastifyInstance: FastifyInstance,
  supabaseAdmin: SupabaseClient | null,
): { io: SocketIOServer; service: ChatSocketService } {
  const corsOrigins = process.env.API_CORS_ORIGINS
    ? process.env.API_CORS_ORIGINS.split(',').map((s: string) => s.trim())
    : process.env.NODE_ENV === 'production'
      ? []
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
        ];

  const io = new SocketIOServerConstructor(fastifyInstance.server, {
    cors: {
      origin: corsOrigins.length === 0 ? true : corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Authentication middleware: validate the Supabase access token and
  // resolve it to the Prisma `User.id`. The chat membership tables key
  // off the Prisma id (NOT the Supabase auth id), so we must translate
  // before storing on `socket.data.userId`.
  io.use(async (socket: Socket, next: (err?: Error) => void) => {
    try {
      if (!supabaseAdmin) {
        next(new Error('Auth not configured on server'));
        return;
      }

      const token = socket.handshake.auth.token as string | undefined;
      if (!token) {
        next(new Error('Missing auth token'));
        return;
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        next(new Error('Invalid auth token'));
        return;
      }

      const appUser = await resolveAppUser(data.user);
      if (!appUser) {
        next(new Error('App profile not found'));
        return;
      }

      socket.data.userId = appUser.id;
      next();
    } catch (err) {
      next(
        err instanceof Error ? err : new Error('Socket auth failed'),
      );
    }
  });

  const service = new ChatSocketService(io, supabaseAdmin);
  service.initialize();

  return { io, service };
}
