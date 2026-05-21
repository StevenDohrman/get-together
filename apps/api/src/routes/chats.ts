import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prismaClient as prisma } from '../db.js';
import { requireAppUser } from '../requireAppUser.js';
import { isChatMember } from '../services/groupChat.js';
import { SocketMessageType, type TextMessagePayload } from '../types/socket.js';

export type ChatsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

const limitQuery = z.coerce.number().int().min(1).max(100).default(50);

const sendMessageBody = z.object({
  body: z.string().trim().min(1).max(2000),
});

export function registerChatsRoutes(
  app: FastifyInstance,
  deps: ChatsRouteDeps,
) {
  const { supabaseAdmin } = deps;

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
      },
    });

    return reply.send({
      messages: [...messages].reverse().map((m) => {
        // Evaluate db kind to socket type
        // TODO: Map 'ACTIVITY' db kind to 'activity' when added to Prisma ChatMessageKind
        let type: SocketMessageType =
          m.kind === 'TEXT' ? SocketMessageType.TEXT : SocketMessageType.SYSTEM;

        // Attempt to detect if a SYSTEM message was actually storing an activity
        // (Temporary backwards-compatibility heuristic)
        if (
          m.kind === 'SYSTEM' &&
          m.payload &&
          typeof m.payload === 'object' &&
          'activityId' in m.payload
        ) {
          type = SocketMessageType.ACTIVITY;
        }

        return {
          id: m.id,
          chatId: m.chatId,
          sender: m.sender,
          type,
          payload: m.payload ?? (m.kind === 'TEXT' ? { body: m.body } : {}),
          createdAt: m.createdAt.toISOString(),
        };
      }),
    });
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

    const created = await prisma.groupChatMessage.create({
      data: {
        chatId: chatId.data,
        senderId: row.id,
        body: parsed.data.body,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
      },
    });

    return reply.status(201).send({
      message: {
        id: created.id,
        chatId: created.chatId,
        sender: created.sender,
        type: SocketMessageType.TEXT,
        payload: { body: created.body } as TextMessagePayload,
        createdAt: created.createdAt.toISOString(),
      },
    });
  });
}
