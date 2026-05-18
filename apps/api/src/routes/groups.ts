import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prismaClient as prisma } from '../db.js';
import { requireAppUser } from '../requireAppUser.js';

export type GroupsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

/**
 * Stable path segments for the web app: `/groups/[slug]/chat` when chat ships.
 * Frontends can join with their router base as needed.
 */
export function groupChatPath(slug: string): string {
  return `/groups/${encodeURIComponent(slug)}/chat`;
}

export function registerGroupsRoutes(app: FastifyInstance, deps: GroupsRouteDeps) {
  const { supabaseAdmin } = deps;

  app.get('/me/groups', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const memberships = await prisma.groupMember.findMany({
      where: { userId: row.id },
      orderBy: { joinedAt: 'desc' },
      include: {
        group: {
          select: {
            id: true,
            slug: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    return reply.send({
      groups: memberships.map(m => ({
        id: m.group.id,
        slug: m.group.slug,
        name: m.group.name,
        memberCount: m.group._count.members,
        myRole: m.role,
        chatPath: groupChatPath(m.group.slug),
      })),
    });
  });
}
