import { randomUUID } from 'node:crypto';
import { prismaClient as prisma } from '../db.js';
import {
  FormationInviteStatus,
  GroupFormationStatus,
  GroupRole,
  SwipeDecision,
} from '@prisma/client';

export const MAX_GROUP_SEEKINGS_PER_USER = 10;

export async function getDiscoveryUsers(appUserId: string, limit: number) {
  const myRows = await prisma.userInterest.findMany({
    where: { userId: appUserId },
    select: { interestId: true },
  });
  const myInterestIds = myRows.map(r => r.interestId);
  if (myInterestIds.length === 0) {
    return [];
  }

  const swiped = await prisma.userSwipe.findMany({
    where: { swiperId: appUserId },
    select: { targetUserId: true },
  });
  const excludeIds = new Set<string>([appUserId]);
  for (const s of swiped) {
    excludeIds.add(s.targetUserId);
  }

  const others = await prisma.userInterest.findMany({
    where: {
      interestId: { in: myInterestIds },
      userId: { notIn: [...excludeIds] },
    },
    select: { userId: true, interestId: true },
  });

  const overlap = new Map<string, Set<string>>();
  for (const row of others) {
    if (!overlap.has(row.userId)) overlap.set(row.userId, new Set());
    overlap.get(row.userId)!.add(row.interestId);
  }

  const ranked = [...overlap.entries()]
    .map(([userId, set]) => ({ userId, sharedInterestCount: set.size }))
    .sort(
      (a, b) =>
        b.sharedInterestCount - a.sharedInterestCount || a.userId.localeCompare(b.userId),
    );

  const slice = ranked.slice(0, limit);
  if (slice.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: slice.map(s => s.userId) } },
    select: { id: true, username: true, displayName: true },
  });
  const byId = new Map(users.map(u => [u.id, u]));
  return slice.map(s => {
    const u = byId.get(s.userId);
    return {
      id: s.userId,
      username: u?.username ?? null,
      displayName: u?.displayName ?? null,
      sharedInterestCount: s.sharedInterestCount,
    };
  });
}

export async function usersShareProfileInterest(userIdA: string, userIdB: string): Promise<boolean> {
  const bInterests = await prisma.userInterest.findMany({
    where: { userId: userIdB },
    select: { interestId: true },
  });
  if (bInterests.length === 0) return false;
  const shared = await prisma.userInterest.findFirst({
    where: {
      userId: userIdA,
      interestId: { in: bInterests.map(r => r.interestId) },
    },
  });
  return shared != null;
}

export async function upsertSwipe(swiperId: string, targetUserId: string, decision: SwipeDecision) {
  if (swiperId === targetUserId) {
    return { ok: false as const, error: 'Cannot swipe on yourself' };
  }
  const share = await usersShareProfileInterest(swiperId, targetUserId);
  if (!share) {
    return {
      ok: false as const,
      error: 'You can only swipe on users you share at least one profile interest with',
    };
  }
  await prisma.userSwipe.upsert({
    where: {
      swiperId_targetUserId: { swiperId, targetUserId },
    },
    create: { swiperId, targetUserId, decision },
    update: { decision },
  });
  return { ok: true as const };
}

export async function getMutualYesUserIds(anchorId: string): Promise<string[]> {
  const outYes = await prisma.userSwipe.findMany({
    where: { swiperId: anchorId, decision: SwipeDecision.YES },
    select: { targetUserId: true },
  });
  const ids = outYes.map(x => x.targetUserId);
  if (ids.length === 0) return [];
  const back = await prisma.userSwipe.findMany({
    where: { swiperId: { in: ids }, targetUserId: anchorId, decision: SwipeDecision.YES },
    select: { swiperId: true },
  });
  return back.map(b => b.swiperId);
}

async function compatibleCandidates(
  seekingInterestIds: Set<string>,
  targetGroupSize: number,
  mutualIds: string[],
): Promise<{ userId: string; score: number }[]> {
  if (mutualIds.length === 0) return [];
  const seekings = await prisma.userGroupSeeking.findMany({
    where: {
      userId: { in: mutualIds },
      targetGroupSize,
    },
    include: { interests: { select: { interestId: true } } },
  });

  const candidates: { userId: string; score: number }[] = [];
  const byUser = new Map<string, (typeof seekings)[number][]>();
  for (const s of seekings) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId)!.push(s);
  }

  for (const uid of mutualIds) {
    const list = byUser.get(uid) ?? [];
    let best = 0;
    for (const s of list) {
      let inter = 0;
      for (const iid of s.interests) {
        if (seekingInterestIds.has(iid.interestId)) inter += 1;
      }
      if (inter > best) best = inter;
    }
    if (best > 0) candidates.push({ userId: uid, score: best });
  }

  candidates.sort(
    (a, b) => b.score - a.score || a.userId.localeCompare(b.userId),
  );
  return candidates;
}

export async function tryCreateFormationProposal(anchorUserId: string, userGroupSeekingId: string) {
  const seeking = await prisma.userGroupSeeking.findFirst({
    where: { id: userGroupSeekingId, userId: anchorUserId },
    include: { interests: true },
  });
  if (!seeking) {
    return { ok: false as const, error: 'Group seeking not found' };
  }
  if (seeking.interests.length === 0) {
    return {
      ok: false as const,
      error: 'Add at least one interest to this group seeking before forming a group',
    };
  }
  if (seeking.targetGroupSize < 2) {
    return { ok: false as const, error: 'targetGroupSize must be at least 2' };
  }

  const existing = await prisma.groupFormationProposal.findFirst({
    where: { userGroupSeekingId, status: GroupFormationStatus.OPEN },
  });
  if (existing) {
    return { ok: true as const, proposalId: existing.id, reused: true as const };
  }

  const interestSet = new Set(seeking.interests.map(i => i.interestId));
  const mutual = await getMutualYesUserIds(anchorUserId);
  const ranked = await compatibleCandidates(interestSet, seeking.targetGroupSize, mutual);
  const needed = seeking.targetGroupSize - 1;
  if (ranked.length < needed) {
    return {
      ok: false as const,
      error:
        'Not enough people yet: need mutual yes swipes with at least one overlapping group-seeking interest and the same target group size.',
    };
  }

  const chosen = ranked.slice(0, needed).map(r => r.userId);

  const proposal = await prisma.$transaction(async tx => {
    const prop = await tx.groupFormationProposal.create({
      data: {
        anchorUserId,
        userGroupSeekingId,
        status: GroupFormationStatus.OPEN,
      },
    });
    await tx.groupFormationInvite.create({
      data: {
        proposalId: prop.id,
        userId: anchorUserId,
        status: FormationInviteStatus.ACCEPTED,
      },
    });
    for (const uid of chosen) {
      await tx.groupFormationInvite.create({
        data: {
          proposalId: prop.id,
          userId: uid,
          status: FormationInviteStatus.PENDING,
        },
      });
    }
    return prop;
  });

  await maybeFulfillProposal(proposal.id);
  return { ok: true as const, proposalId: proposal.id, reused: false as const };
}

async function maybeFulfillProposal(proposalId: string) {
  const proposal = await prisma.groupFormationProposal.findUnique({
    where: { id: proposalId },
    include: {
      invites: true,
      userGroupSeeking: {
        include: {
          interests: {
            include: { interest: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!proposal || proposal.status !== GroupFormationStatus.OPEN) return;

  const target = proposal.userGroupSeeking.targetGroupSize;
  const accepted = proposal.invites.filter(i => i.status === FormationInviteStatus.ACCEPTED);
  if (accepted.length !== target) return;

  const interestNames = proposal.userGroupSeeking.interests.map(i => i.interest.name);
  const name =
    interestNames.length <= 2
      ? interestNames.join(' · ') || 'New group'
      : `${interestNames.slice(0, 2).join(' · ')} +${interestNames.length - 2}`;

  await prisma.$transaction(async tx => {
    let slug = `match-${proposal.id}`;
    for (let i = 0; i < 5; i += 1) {
      const clash = await tx.group.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `match-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    }

    const group = await tx.group.create({
      data: {
        slug,
        name,
        description: 'Formed from mutual matches',
        createdById: proposal.anchorUserId,
        interests: {
          create: proposal.userGroupSeeking.interests.map(ui => ({
            interestId: ui.interestId,
            weight: 7,
          })),
        },
        members: {
          create: accepted.map(inv => ({
            userId: inv.userId,
            role: inv.userId === proposal.anchorUserId ? GroupRole.OWNER : GroupRole.MEMBER,
          })),
        },
      },
    });

    await tx.groupFormationProposal.update({
      where: { id: proposalId },
      data: {
        status: GroupFormationStatus.FULFILLED,
        formedGroupId: group.id,
      },
    });
  });
}

export async function respondFormationInvite(
  appUserId: string,
  proposalId: string,
  accept: boolean,
) {
  const invite = await prisma.groupFormationInvite.findFirst({
    where: { proposalId, userId: appUserId },
    include: { proposal: true },
  });
  if (!invite) {
    return { ok: false as const, error: 'Invite not found' };
  }
  if (invite.proposal.status !== GroupFormationStatus.OPEN) {
    return { ok: false as const, error: 'This proposal is no longer open' };
  }
  if (invite.status !== FormationInviteStatus.PENDING) {
    return { ok: false as const, error: 'Invite already handled' };
  }

  if (accept) {
    await prisma.groupFormationInvite.update({
      where: { id: invite.id },
      data: { status: FormationInviteStatus.ACCEPTED },
    });
    await maybeFulfillProposal(proposalId);
    return { ok: true as const };
  }

  await prisma.groupFormationInvite.update({
    where: { id: invite.id },
    data: { status: FormationInviteStatus.DECLINED },
  });

  await tryAddReplacementInvite(proposalId);
  return { ok: true as const };
}

async function tryAddReplacementInvite(proposalId: string) {
  const proposal = await prisma.groupFormationProposal.findUnique({
    where: { id: proposalId },
    include: {
      invites: true,
      userGroupSeeking: { include: { interests: true } },
    },
  });
  if (!proposal || proposal.status !== GroupFormationStatus.OPEN) {
    return { ok: false as const, error: 'Proposal not open' };
  }

  const target = proposal.userGroupSeeking.targetGroupSize;
  const accepted = proposal.invites.filter(i => i.status === FormationInviteStatus.ACCEPTED).length;
  const pending = proposal.invites.filter(i => i.status === FormationInviteStatus.PENDING).length;
  if (accepted + pending >= target) {
    return { ok: false as const, error: 'No slot to fill' };
  }

  const usedIds = new Set(proposal.invites.map(i => i.userId));
  const mutual = (await getMutualYesUserIds(proposal.anchorUserId)).filter(id => !usedIds.has(id));
  const interestSet = new Set(proposal.userGroupSeeking.interests.map(i => i.interestId));
  const ranked = await compatibleCandidates(
    interestSet,
    proposal.userGroupSeeking.targetGroupSize,
    mutual,
  );
  const next = ranked.find(r => !usedIds.has(r.userId));
  if (!next) {
    return { ok: false as const, error: 'No replacement candidates' };
  }

  await prisma.groupFormationInvite.create({
    data: {
      proposalId,
      userId: next.userId,
      status: FormationInviteStatus.PENDING,
    },
  });
  return { ok: true as const, userId: next.userId };
}
