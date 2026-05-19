import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { GroupRole, type Prisma } from '@prisma/client';
import { prismaClient as prisma } from '../db.js';
import { requireAppUser } from '../requireAppUser.js';

export type EventsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

const upcomingQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includePublic: z.coerce.boolean().default(true),
});

const idParam = z.object({
  eventId: z.string().uuid(),
});

const groupSlugParam = z.object({
  slug: z.string().min(1),
});

const groupEventParams = groupSlugParam.merge(idParam);

type EventDto = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  locationAddress: string | null;
  /** "GROUP" if hosted by a group; "PUBLIC" if hosted by UConnect itself. */
  ownerType: 'GROUP' | 'PUBLIC';
  hostGroup: { id: string; slug: string; name: string } | null;
  /**
   * Why this event is showing up for the requesting user. Can be more than
   * one reason at a time (e.g. host group AND I'm attending).
   */
  reasons: Array<'HOST_GROUP' | 'SUBSCRIBED_GROUP' | 'PUBLIC' | 'ATTENDING'>;
  myRsvp: 'GOING' | 'MAYBE' | 'NOT_GOING' | null;
  subscribedGroupIds: string[];
  attendeeCount: number;
};

export function registerEventsRoutes(app: FastifyInstance, deps: EventsRouteDeps) {
  const { supabaseAdmin } = deps;

  app.get('/me/events', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = upcomingQuery.safeParse(req.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid query',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const { limit, includePublic } = parsed.data;

    const myMemberships = await prisma.groupMember.findMany({
      where: { userId: row.id },
      select: { groupId: true },
    });
    const myGroupIds = myMemberships.map(m => m.groupId);

    const now = new Date();

    const orClauses: Prisma.EventWhereInput[] = [
      { attendees: { some: { userId: row.id } } },
    ];
    if (myGroupIds.length > 0) {
      orClauses.push({ groupId: { in: myGroupIds } });
      orClauses.push({
        subscribedByGroups: { some: { groupId: { in: myGroupIds } } },
      });
    }
    if (includePublic) {
      orClauses.push({ groupId: null });
    }

    const events = await prisma.event.findMany({
      where: {
        startsAt: { gte: now },
        OR: orClauses,
      },
      orderBy: { startsAt: 'asc' },
      take: limit,
      include: {
        group: { select: { id: true, slug: true, name: true } },
        subscribedByGroups: {
          where: myGroupIds.length > 0 ? { groupId: { in: myGroupIds } } : undefined,
          select: { groupId: true },
        },
        attendees: {
          where: { userId: row.id },
          select: { status: true },
        },
        _count: { select: { attendees: true } },
      },
    });

    const myGroupIdSet = new Set(myGroupIds);
    const items: EventDto[] = events.map(ev => {
      const reasons: EventDto['reasons'] = [];
      if (ev.groupId && myGroupIdSet.has(ev.groupId)) reasons.push('HOST_GROUP');
      if (ev.subscribedByGroups.length > 0) reasons.push('SUBSCRIBED_GROUP');
      if (ev.attendees.length > 0) reasons.push('ATTENDING');
      if (ev.groupId === null) reasons.push('PUBLIC');

      return {
        id: ev.id,
        title: ev.title,
        description: ev.description,
        startsAt: ev.startsAt.toISOString(),
        endsAt: ev.endsAt?.toISOString() ?? null,
        locationName: ev.locationName,
        locationAddress: ev.locationAddress,
        ownerType: ev.groupId === null ? 'PUBLIC' : 'GROUP',
        hostGroup: ev.group ?? null,
        reasons,
        myRsvp: ev.attendees[0]?.status ?? null,
        subscribedGroupIds: ev.subscribedByGroups.map(s => s.groupId),
        attendeeCount: ev._count.attendees,
      };
    });

    return reply.send({ events: items });
  });

  app.post('/groups/:slug/events/:eventId/subscribe', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = groupEventParams.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid params' });
    }

    const group = await prisma.group.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: row.id } },
      select: { role: true },
    });
    if (!membership) {
      return reply.status(403).send({ error: 'You must be a member of the group to subscribe it' });
    }
    if (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN) {
      return reply.status(403).send({
        error: 'Only group owners or admins can sign the group up for events',
      });
    }

    const event = await prisma.event.findUnique({
      where: { id: parsed.data.eventId },
      select: { id: true },
    });
    if (!event) {
      return reply.status(404).send({ error: 'Event not found' });
    }

    await prisma.groupEventSubscription.upsert({
      where: { groupId_eventId: { groupId: group.id, eventId: event.id } },
      create: { groupId: group.id, eventId: event.id },
      update: {},
    });

    return reply.status(201).send({ ok: true });
  });

  app.delete('/groups/:slug/events/:eventId/subscribe', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = groupEventParams.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid params' });
    }

    const group = await prisma.group.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (!group) {
      return reply.status(404).send({ error: 'Group not found' });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: row.id } },
      select: { role: true },
    });
    if (!membership) {
      return reply.status(403).send({ error: 'You must be a member of the group to manage it' });
    }
    if (membership.role !== GroupRole.OWNER && membership.role !== GroupRole.ADMIN) {
      return reply.status(403).send({
        error: 'Only group owners or admins can manage event subscriptions',
      });
    }

    await prisma.groupEventSubscription
      .delete({
        where: { groupId_eventId: { groupId: group.id, eventId: parsed.data.eventId } },
      })
      .catch(() => undefined);

    return reply.status(204).send();
  });
}
