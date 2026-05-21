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
  type MessagePayload,
  type TextMessagePayload,
} from '../types/socket.js';
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
    // logger.debug(`User ${userId} connected (socket: ${socket.id})`);
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

      // Verify user is a member of this chat
      const isMember = await isChatMember(chatId, userId);
      if (!isMember) {
        callback?.(ackError('Not a chat member'));
        return;
      }

      // Track subscription
      if (!this.userChatSubscriptions.has(userId)) {
        this.userChatSubscriptions.set(userId, new Set());
      }
      this.userChatSubscriptions.get(userId)!.add(chatId);

      // Join socket room named after chatId
      socket.join(chatId);

      // Notify others in the chat
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

      // Remove subscription
      this.userChatSubscriptions.get(userId)?.delete(chatId);
      socket.leave(chatId);

      // Notify others in the chat
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
   * Handle sending a message
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

      // Verify user is a member of this chat
      const isMember = await isChatMember(chatId, userId);
      if (!isMember) {
        callback?.(ackError('Not a chat member'));
        return;
      }

      // Ensure the sender's socket is in the room before we broadcast.
      // Normally the client emits `chat:join` first, but if that never
      // landed (e.g. raced with reconnect/auth refresh) the broadcast
      // below would otherwise skip the sender and their own message
      // wouldn't appear in their UI.
      if (!socket.rooms.has(chatId)) {
        socket.join(chatId);
        if (!this.userChatSubscriptions.has(userId)) {
          this.userChatSubscriptions.set(userId, new Set());
        }
        this.userChatSubscriptions.get(userId)!.add(chatId);
      }

      // Save message to database
      // Temporary mapping until ACTIVITY is added to Prisma ChatMessageKind
      let dbKind: 'TEXT' | 'SYSTEM' = 'TEXT';
      if (messageType === SocketMessageType.SYSTEM) dbKind = 'SYSTEM';
      // If messageType is 'activity', map it to 'SYSTEM' as a fallback for now.
      // TODO: Change this to 'ACTIVITY' once ChatMessageKind is updated in Prisma
      else if (messageType === SocketMessageType.ACTIVITY) dbKind = 'SYSTEM';

      const message = await prisma.groupChatMessage.create({
        data: {
          chatId,
          senderId: userId,
          kind: dbKind,
          body:
            messageType === SocketMessageType.TEXT
              ? (payload as TextMessagePayload).body
              : '',
          payload: payload,
        },
        include: {
          sender: { select: { id: true, username: true, displayName: true } },
        },
      });

      // Transform to socket message format
      const socketMessage: ChatMessage = {
        id: message.id,
        chatId: message.chatId,
        sender: message.sender,
        type: messageType as SocketMessageType,
        payload: payload as MessagePayload,
        createdAt: message.createdAt.toISOString(),
      };

      // Broadcast to all users in the chat (including sender)
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
      // Notify all chats this user was in
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
   * Broadcast message to specific chat (for server-initiated messages)
   */
  public broadcastMessage(chatId: string, message: ChatMessage): void {
    this.io.to(chatId).emit(SOCKET_EVENTS.MESSAGE_RECEIVED, message);
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
  // Determine CORS origins
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
      allowEIO3: true,
    },
    transports: ['websocket', 'polling'],
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
