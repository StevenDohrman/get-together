import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { prismaClient as prisma } from '../db.js';
import { requireAppUser } from '../requireAppUser.js';

export type ActivityRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

const limitQuery = z.coerce.number().int().min(1).max(20).default(3);

export type ActivityItemDto = {
  id: string;
  chatId: string;
  kind: 'GROUP_MESSAGE';
  group: { id: string; slug: string; name: string } | null;
  proposalId: string | null;
  sender: {
    id: string;
    username: string | null;
    displayName: string | null;
    isMe: boolean;
  };
  body: string;
  createdAt: string;
};

export function registerActivityRoutes(app: FastifyInstance, deps: ActivityRouteDeps) {
  const { supabaseAdmin } = deps;

  /**
   * Recent activity feed for the dashboard.
   *
   * Currently sourced from group chat messages: the most recent N messages
   * across all chats the requesting user is a member of. (Messages the user
   * themselves sent are included with `sender.isMe: true` so callers can
   * style them differently if they want.)
   *
   * This endpoint always 200s — the array can be empty.
   */
  app.get('/me/activity', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = z
      .object({ limit: limitQuery.optional() })
      .safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const limit = parsed.data.limit ?? 3;

    const chatMemberships = await prisma.groupChatMember.findMany({
      where: { userId: row.id },
      select: { chatId: true },
    });
    if (chatMemberships.length === 0) {
      return reply.send({ items: [] });
    }
    const chatIds = chatMemberships.map(m => m.chatId);

    const messages = await prisma.groupChatMessage.findMany({
      where: { chatId: { in: chatIds } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: { select: { id: true, username: true, displayName: true } },
        chat: {
          select: {
            id: true,
            proposalId: true,
            group: { select: { id: true, slug: true, name: true } },
          },
        },
      },
    });

    const items: ActivityItemDto[] = messages.map(m => ({
      id: m.id,
      chatId: m.chatId,
      kind: 'GROUP_MESSAGE',
      group: m.chat.group ?? null,
      proposalId: m.chat.proposalId,
      sender: {
        id: m.sender.id,
        username: m.sender.username,
        displayName: m.sender.displayName,
        isMe: m.sender.id === row.id,
      },
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }));

    return reply.send({ items });
  });
}
