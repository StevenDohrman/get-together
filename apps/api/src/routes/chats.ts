import type { Prisma } from '@prisma/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prismaClient as prisma } from '../db.js';
import { requireAppUser } from '../requireAppUser.js';
import { toEventPayload } from '../services/chatEvents.js';
import { isChatMember } from '../services/groupChat.js';
import type { ChatBroadcaster } from '../services/realtimeBroadcast.js';
import {
  ChatMessageType,
  type ChatMessage,
  type TextMessagePayload,
} from '../types/chat.js';

export type ChatsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
  /**
   * Optional broadcaster. When present, persisted messages are pushed to
   * subscribed chat members via Supabase Realtime. Tests may omit it.
   */
  broadcaster?: ChatBroadcaster | null;
};

const limitQuery = z.coerce.number().int().min(1).max(100).default(50);

const textPayload = z.object({
  body: z.string().trim().min(1).max(2000),
});

const systemPayload = z.object({
  body: z.string().trim().min(1).max(2000),
});

const renameChatBody = z.object({
  name: z.string().trim().min(1).max(80),
});

/**
 * Two accepted shapes:
 *  1. `{ messageType, payload }` — preferred; matches the wire `ChatMessage`
 *     shape used by the realtime hook. EVENT messages are not accepted here;
 *     they're created via `POST /me/chats/:chatId/events`.
 *  2. `{ body }` — legacy shortcut equivalent to TEXT with `payload.body`.
 */
const sendMessageBody = z.union([
  z.object({
    messageType: z.literal(ChatMessageType.TEXT),
    payload: textPayload,
  }),
  z.object({
    messageType: z.literal(ChatMessageType.SYSTEM),
    payload: systemPayload,
  }),
  z.object({
    body: z.string().trim().min(1).max(2000),
  }),
]);

export function registerChatsRoutes(
  app: FastifyInstance,
  deps: ChatsRouteDeps,
) {
  const { supabaseAdmin, broadcaster } = deps;

  app.get('/me/chats', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const memberships = await prisma.groupChatMember.findMany({
      where: { userId: row.id },
      orderBy: { joinedAt: 'desc' },
      include: {
        chat: {
          include: {
            group: { select: { id: true, slug: true, name: true } },
            proposal: {
              select: { id: true, status: true, formedGroupId: true },
            },
            _count: { select: { members: true } },
          },
        },
      },
    });

    return reply.send({
      chats: memberships.map((m) => ({
        id: m.chatId,
        memberCount: m.chat._count.members,
        createdAt: m.chat.createdAt,
        group: m.chat.group,
        proposal: m.chat.proposal,
      })),
    });
  });

  app.get('/me/chats/:chatId/messages', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const chatId = z
      .string()
      .uuid()
      .safeParse((req.params as { chatId?: string }).chatId);
    if (!chatId.success)
      return reply.status(400).send({ error: 'Invalid chatId' });

    if (!(await isChatMember(chatId.data, row.id))) {
      return reply.status(403).send({ error: 'Not a chat member' });
    }

    const parsed = z
      .object({ limit: limitQuery.optional() })
      .safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const limit = parsed.data.limit ?? 50;
    const messages = await prisma.groupChatMessage.findMany({
      where: { chatId: chatId.data },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
        event: {
          include: {
            attendees: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });

    const items: ChatMessage[] = [...messages].reverse().map((m) => {
      if (m.kind === 'EVENT' && m.event) {
        return {
          id: m.id,
          chatId: m.chatId,
          sender: m.sender,
          type: ChatMessageType.EVENT,
          payload: toEventPayload(m.event),
          createdAt: m.createdAt.toISOString(),
        };
      }

      if (m.kind === 'SYSTEM') {
        const payload =
          m.payload && typeof m.payload === 'object'
            ? (m.payload as Record<string, unknown>)
            : { body: m.body };
        return {
          id: m.id,
          chatId: m.chatId,
          sender: m.sender,
          type: ChatMessageType.SYSTEM,
          payload: payload as { body: string },
          createdAt: m.createdAt.toISOString(),
        };
      }

      // TEXT (default). Prefer stored payload (which clients set), but fall
      // back to the bare `body` field for messages persisted via REST.
      const textBody: TextMessagePayload =
        m.payload && typeof m.payload === 'object' && 'body' in m.payload
          ? (m.payload as unknown as TextMessagePayload)
          : { body: m.body };

      return {
        id: m.id,
        chatId: m.chatId,
        sender: m.sender,
        type: ChatMessageType.TEXT,
        payload: textBody,
        createdAt: m.createdAt.toISOString(),
      };
    });

    return reply.send({ messages: items });
  });

  app.patch('/me/chats/:chatId', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const chatId = z
      .string()
      .uuid()
      .safeParse((req.params as { chatId?: string }).chatId);
    if (!chatId.success)
      return reply.status(400).send({ error: 'Invalid chatId' });

    if (!(await isChatMember(chatId.data, row.id))) {
      return reply.status(403).send({ error: 'Not a chat member' });
    }

    const parsed = renameChatBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const chat = await prisma.groupChat.findUnique({
      where: { id: chatId.data },
      select: { groupId: true },
    });

    if (!chat) {
      return reply.status(404).send({ error: 'Chat not found' });
    }

    if (!chat.groupId) {
      return reply
        .status(400)
        .send({ error: 'Only formed group chats can be renamed' });
    }

    const group = await prisma.group.update({
      where: { id: chat.groupId },
      data: { name: parsed.data.name },
      select: { id: true, slug: true, name: true },
    });

    return reply.send({ chat: { id: chatId.data, group } });
  });

  app.post('/me/chats/:chatId/messages', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const chatId = z
      .string()
      .uuid()
      .safeParse((req.params as { chatId?: string }).chatId);
    if (!chatId.success)
      return reply.status(400).send({ error: 'Invalid chatId' });

    if (!(await isChatMember(chatId.data, row.id))) {
      return reply.status(403).send({ error: 'Not a chat member' });
    }

    const parsed = sendMessageBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Normalize both accepted shapes into a single internal form.
    const { messageType, payload } =
      'messageType' in parsed.data
        ? parsed.data
        : {
            messageType: ChatMessageType.TEXT,
            payload: { body: parsed.data.body } satisfies TextMessagePayload,
          };

    const dbKind = messageType === ChatMessageType.SYSTEM ? 'SYSTEM' : 'TEXT';

    const created = await prisma.groupChatMessage.create({
      data: {
        chatId: chatId.data,
        senderId: row.id,
        kind: dbKind,
        body: payload.body,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
      },
    });

    const wireMessage: ChatMessage = {
      id: created.id,
      chatId: created.chatId,
      sender: created.sender,
      type: messageType,
      payload,
      createdAt: created.createdAt.toISOString(),
    };

    // Fire-and-forget — a missed broadcast degrades UX (other clients won't
    // see the new message until they refetch) but never fails the write.
    void broadcaster?.broadcastMessage(chatId.data, wireMessage);

    return reply.status(201).send({ message: wireMessage });
  });
}
