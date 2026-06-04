import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prismaClient as prisma } from '../db.js';
import { SwipeDecision } from '@prisma/client';
import { z } from 'zod';
import { requireAppUser } from '../requireAppUser.js';
import {
  listMyFormationInviteCards,
  listSerializedGroupSeekings,
  loadMatchingDashboard,
  publicInterestFieldSelect,
  validateInterestIdsAllExist,
} from '../services/matchingPresentation.js';
import {
  MAX_GROUP_SEEKINGS_PER_USER,
  respondFormationInvite,
  tryCreateFormationProposal,
  tryCreateFormationProposalsForUsers,
} from '../services/groupFormation.js';
import { getDiscoveryUsers, upsertSwipe } from '../services/matchingDiscovery.js';

export type MatchingRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

const limitQuery = z.coerce.number().int().min(1).max(100).default(30);

const swipeBody = z.object({
  targetUserId: z.string().uuid(),
  decision: z.nativeEnum(SwipeDecision),
});

const groupSeekingCreateBody = z.object({
  targetGroupSize: z.number().int().min(2).max(100),
  interestIds: z.array(z.string().uuid()).min(1).max(50),
});

const groupSeekingUpdateBody = z.object({
  targetGroupSize: z.number().int().min(2).max(100).optional(),
  interestIds: z.array(z.string().uuid()).min(1).max(50).optional(),
});

const formationRunBody = z.object({
  userGroupSeekingId: z.string().uuid(),
});

const inviteRespondBody = z.object({
  accept: z.boolean(),
});

export function registerMatchingRoutes(app: FastifyInstance, deps: MatchingRouteDeps) {
  const { supabaseAdmin } = deps;

  app.get('/me/matching/dashboard', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const dashboard = await loadMatchingDashboard(row.id);
    return reply.send(dashboard);
  });

  app.get('/matching/discovery', async (req, reply) => {
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

    const limit = parsed.data.limit ?? 30;
    const result = await getDiscoveryUsers(row.id, limit);
    return reply.send(result);
  });

  app.get('/matching/liked', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const swipes = await prisma.userSwipe.findMany({
      where: { swiperId: row.id, decision: SwipeDecision.YES },
      orderBy: { updatedAt: 'desc' },
      include: {
        target: {
          select: {
            id: true,
            username: true,
            displayName: true,
            bio: true,
            photos: {
              orderBy: { position: 'asc' },
              select: { id: true, url: true, position: true },
            },
            interests: {
              include: {
                interest: { select: { id: true, slug: true, name: true } },
              },
              orderBy: [{ weight: 'desc' }, { interest: { name: 'asc' } }],
            },
          },
        },
      },
    });

    return reply.send({
      users: swipes.map((swipe) => {
        const photos = swipe.target.photos;
        return {
          id: swipe.target.id,
          username: swipe.target.username,
          displayName: swipe.target.displayName,
          bio: swipe.target.bio,
          avatarUrl: photos[0]?.url ?? null,
          photos,
          likedAt: swipe.updatedAt.toISOString(),
          interests: swipe.target.interests.map((row) => ({
            id: row.interest.id,
            slug: row.interest.slug,
            name: row.interest.name,
            weight: row.weight,
          })),
        };
      }),
    });
  });

  app.post('/matching/swipes', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = swipeBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const target = await prisma.user.findUnique({
      where: { id: parsed.data.targetUserId },
      select: { id: true },
    });
    if (!target) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const result = await upsertSwipe(row.id, parsed.data.targetUserId, parsed.data.decision);
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }
    const formationResults =
      parsed.data.decision === SwipeDecision.YES
        ? await tryCreateFormationProposalsForUsers([row.id, parsed.data.targetUserId])
        : [];

    return reply.send({ ok: true, formationResults });
  });

  app.get('/me/group-seekings', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const seekings = await listSerializedGroupSeekings(row.id);
    return reply.send({ seekings });
  });

  app.post('/me/group-seekings', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = groupSeekingCreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const count = await prisma.userGroupSeeking.count({ where: { userId: row.id } });
    if (count >= MAX_GROUP_SEEKINGS_PER_USER) {
      return reply.status(400).send({
        error: `You can have at most ${MAX_GROUP_SEEKINGS_PER_USER} group seekings`,
      });
    }

    const interestIds = [...new Set(parsed.data.interestIds)];
    if (!(await validateInterestIdsAllExist(interestIds))) {
      return reply.status(400).send({ error: 'One or more interest ids are invalid' });
    }

    const created = await prisma.userGroupSeeking.create({
      data: {
        userId: row.id,
        targetGroupSize: parsed.data.targetGroupSize,
        interests: {
          create: interestIds.map(interestId => ({ interestId })),
        },
      },
      include: {
        interests: {
          include: { interest: { select: publicInterestFieldSelect } },
        },
      },
    });

    return reply.status(201).send({
      seeking: {
        id: created.id,
        targetGroupSize: created.targetGroupSize,
        interests: created.interests.map(i => i.interest),
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  });

  app.put('/me/group-seekings/:id', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const id = z.string().uuid().safeParse((req.params as { id?: string }).id);
    if (!id.success) {
      return reply.status(400).send({ error: 'Invalid id' });
    }

    const parsed = groupSeekingUpdateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    if (parsed.data.targetGroupSize === undefined && parsed.data.interestIds === undefined) {
      return reply.status(400).send({ error: 'Provide targetGroupSize and/or interestIds' });
    }

    const existing = await prisma.userGroupSeeking.findFirst({
      where: { id: id.data, userId: row.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    let interestIds: string[] | undefined;
    if (parsed.data.interestIds) {
      interestIds = [...new Set(parsed.data.interestIds)];
      if (!(await validateInterestIdsAllExist(interestIds))) {
        return reply.status(400).send({ error: 'One or more interest ids are invalid' });
      }
    }

    const updated = await prisma.$transaction(async tx => {
      if (interestIds) {
        await tx.userGroupSeekingInterest.deleteMany({
          where: { userGroupSeekingId: id.data },
        });
        await tx.userGroupSeekingInterest.createMany({
          data: interestIds.map(interestId => ({
            userGroupSeekingId: id.data,
            interestId,
          })),
        });
      }
      return tx.userGroupSeeking.update({
        where: { id: id.data },
        data: {
          ...(parsed.data.targetGroupSize !== undefined && {
            targetGroupSize: parsed.data.targetGroupSize,
          }),
        },
        include: {
          interests: {
            include: { interest: { select: publicInterestFieldSelect } },
          },
        },
      });
    });

    return reply.send({
      seeking: {
        id: updated.id,
        targetGroupSize: updated.targetGroupSize,
        interests: updated.interests.map(i => i.interest),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  });

  app.delete('/me/group-seekings/:id', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const id = z.string().uuid().safeParse((req.params as { id?: string }).id);
    if (!id.success) {
      return reply.status(400).send({ error: 'Invalid id' });
    }

    const existing = await prisma.userGroupSeeking.findFirst({
      where: { id: id.data, userId: row.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    await prisma.userGroupSeeking.delete({ where: { id: id.data } });
    return reply.status(204).send();
  });

  app.post('/matching/formation/run', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = formationRunBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await tryCreateFormationProposal(row.id, parsed.data.userGroupSeekingId);
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({
      proposalId: result.proposalId,
      reused: result.reused,
    });
  });

  app.get('/matching/formation/proposals', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const proposals = await listMyFormationInviteCards(row.id);
    return reply.send({ proposals });
  });

  app.post('/matching/formation/proposals/:proposalId/invites/respond', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const proposalId = z.string().uuid().safeParse((req.params as { proposalId?: string }).proposalId);
    if (!proposalId.success) {
      return reply.status(400).send({ error: 'Invalid proposalId' });
    }

    const parsed = inviteRespondBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await respondFormationInvite(row.id, proposalId.data, parsed.data.accept);
    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.send({ ok: true });
  });
}
