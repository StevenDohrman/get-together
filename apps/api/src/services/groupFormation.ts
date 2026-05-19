import { randomUUID } from 'node:crypto';
import { prismaClient as prisma } from '../db.js';
import {
  FormationInviteStatus,
  GroupFormationStatus,
  GroupRole,
  GroupSource,
  SwipeDecision,
} from '@prisma/client';
import { getMutualYesUserIds } from './matchingDiscovery.js';
import { normalizedWeightedOverlap, weightedVectorForInterestIds } from './matchingScoring.js';
import { ensureProposalGroupChat } from './groupChat.js';

export const MAX_GROUP_SEEKINGS_PER_USER = 10;

type GroupFormationCandidate = {
  userId: string;
  matchScore: number;
  rawMatchScore: number;
  sharedInterestCount: number;
};

function yesKey(swiperId: string, targetUserId: string): string {
  return `${swiperId}:${targetUserId}`;
}

async function getYesSwipeSet(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length < 2) return new Set();

  const swipes = await prisma.userSwipe.findMany({
    where: {
      swiperId: { in: uniqueIds },
      targetUserId: { in: uniqueIds },
      decision: SwipeDecision.YES,
    },
    select: { swiperId: true, targetUserId: true },
  });

  return new Set(swipes.map(s => yesKey(s.swiperId, s.targetUserId)));
}

function hasPairwiseMutualYes(userIds: string[], yesSwipes: Set<string>): boolean {
  for (let i = 0; i < userIds.length; i += 1) {
    for (let j = i + 1; j < userIds.length; j += 1) {
      const a = userIds[i];
      const b = userIds[j];
      if (a === undefined || b === undefined) return false;
      if (!yesSwipes.has(yesKey(a, b)) || !yesSwipes.has(yesKey(b, a))) {
        return false;
      }
    }
  }
  return true;
}

async function selectPairwiseMutualCandidates(
  requiredUserIds: string[],
  rankedCandidates: GroupFormationCandidate[],
  slotsToFill: number,
): Promise<string[]> {
  const yesSwipes = await getYesSwipeSet([
    ...requiredUserIds,
    ...rankedCandidates.map(candidate => candidate.userId),
  ]);
  const selected: string[] = [];

  for (const candidate of rankedCandidates) {
    const nextGroup = [...requiredUserIds, ...selected, candidate.userId];
    if (!hasPairwiseMutualYes(nextGroup, yesSwipes)) continue;
    selected.push(candidate.userId);
    if (selected.length === slotsToFill) break;
  }

  return selected;
}

async function compatibleCandidates(
  seedUserId: string,
  seekingInterestIds: Set<string>,
  targetGroupSize: number,
  mutualIds: string[],
): Promise<GroupFormationCandidate[]> {
  if (mutualIds.length === 0) return [];
  const seekings = await prisma.userGroupSeeking.findMany({
    where: {
      userId: { in: mutualIds },
      targetGroupSize,
    },
    include: { interests: { select: { interestId: true } } },
  });

  const allRelevantInterestIds = new Set<string>(seekingInterestIds);
  for (const seeking of seekings) {
    for (const interest of seeking.interests) allRelevantInterestIds.add(interest.interestId);
  }

  const profileWeights = await prisma.userInterest.findMany({
    where: {
      userId: { in: [seedUserId, ...mutualIds] },
      interestId: { in: [...allRelevantInterestIds] },
    },
    select: { userId: true, interestId: true, weight: true },
  });
  const weightsByUserId = new Map<string, Map<string, number>>();
  for (const row of profileWeights) {
    if (!weightsByUserId.has(row.userId)) weightsByUserId.set(row.userId, new Map());
    weightsByUserId.get(row.userId)!.set(row.interestId, row.weight);
  }

  const seedVector = weightedVectorForInterestIds(
    [...seekingInterestIds],
    weightsByUserId.get(seedUserId) ?? new Map(),
  );

  const candidates: GroupFormationCandidate[] = [];
  const byUser = new Map<string, (typeof seekings)[number][]>();
  for (const s of seekings) {
    if (!byUser.has(s.userId)) byUser.set(s.userId, []);
    byUser.get(s.userId)!.push(s);
  }

  for (const uid of mutualIds) {
    const list = byUser.get(uid) ?? [];
    let best = { sharedInterestCount: 0, rawMatchScore: 0, matchScore: 0 };
    for (const s of list) {
      const candidateVector = weightedVectorForInterestIds(
        s.interests.map(i => i.interestId),
        weightsByUserId.get(uid) ?? new Map(),
      );
      const score = normalizedWeightedOverlap(seedVector, candidateVector);
      if (
        score.matchScore > best.matchScore ||
        (score.matchScore === best.matchScore && score.sharedInterestCount > best.sharedInterestCount)
      ) {
        best = score;
      }
    }
    if (best.sharedInterestCount > 0) candidates.push({ userId: uid, ...best });
  }

  candidates.sort(
    (a, b) =>
      b.matchScore - a.matchScore ||
      b.sharedInterestCount - a.sharedInterestCount ||
      b.rawMatchScore - a.rawMatchScore ||
      a.userId.localeCompare(b.userId),
  );
  return candidates;
}

export async function tryCreateFormationProposal(seedUserId: string, userGroupSeekingId: string) {
  const seeking = await prisma.userGroupSeeking.findFirst({
    where: { id: userGroupSeekingId, userId: seedUserId },
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
  const mutual = await getMutualYesUserIds(seedUserId);
  const ranked = await compatibleCandidates(seedUserId, interestSet, seeking.targetGroupSize, mutual);
  const needed = seeking.targetGroupSize - 1;
  const chosen = await selectPairwiseMutualCandidates([seedUserId], ranked, needed);
  if (chosen.length < needed) {
    return {
      ok: false as const,
      error:
        'Not enough people yet: every proposed group member must mutually swipe yes on every other member and share compatible group-seeking interests.',
    };
  }

  const proposal = await prisma.$transaction(async tx => {
    const prop = await tx.groupFormationProposal.create({
      data: {
        userGroupSeekingId,
        status: GroupFormationStatus.OPEN,
      },
    });
    await tx.groupFormationInvite.create({
      data: {
        proposalId: prop.id,
        userId: seedUserId,
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

export async function tryCreateFormationProposalsForUser(userId: string) {
  const seekings = await prisma.userGroupSeeking.findMany({
    where: { userId },
    select: { id: true },
  });

  const results = [];
  for (const seeking of seekings) {
    try {
      results.push({
        userGroupSeekingId: seeking.id,
        ...(await tryCreateFormationProposal(userId, seeking.id)),
      });
    } catch (error) {
      results.push({
        userGroupSeekingId: seeking.id,
        ok: false as const,
        error: error instanceof Error ? error.message : 'Failed to run group formation',
      });
    }
  }
  return results;
}

export async function tryCreateFormationProposalsForUsers(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const results = [];
  for (const userId of uniqueUserIds) {
    results.push({
      userId,
      results: await tryCreateFormationProposalsForUser(userId),
    });
  }
  return results;
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
        source: GroupSource.APP_FORMED,
        interests: {
          create: proposal.userGroupSeeking.interests.map(ui => ({
            interestId: ui.interestId,
            weight: 7,
          })),
        },
        members: {
          create: accepted.map(inv => ({
            userId: inv.userId,
            role: GroupRole.MEMBER,
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
    await ensureProposalGroupChat(proposalId);
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
  const activeInvites = proposal.invites.filter(
    i => i.status === FormationInviteStatus.ACCEPTED || i.status === FormationInviteStatus.PENDING,
  );
  if (activeInvites.length >= target) {
    return { ok: false as const, error: 'No slot to fill' };
  }

  const usedIds = new Set(proposal.invites.map(i => i.userId));
  const seedUserId = proposal.userGroupSeeking.userId;
  const mutual = (await getMutualYesUserIds(seedUserId)).filter(id => !usedIds.has(id));
  const interestSet = new Set(proposal.userGroupSeeking.interests.map(i => i.interestId));
  const ranked = await compatibleCandidates(
    seedUserId,
    interestSet,
    proposal.userGroupSeeking.targetGroupSize,
    mutual,
  );
  const replacement = await selectPairwiseMutualCandidates(
    activeInvites.map(i => i.userId),
    ranked.filter(r => !usedIds.has(r.userId)),
    1,
  );
  const nextUserId = replacement[0];
  if (!nextUserId) {
    return { ok: false as const, error: 'No replacement candidates' };
  }

  await prisma.groupFormationInvite.create({
    data: {
      proposalId,
      userId: nextUserId,
      status: FormationInviteStatus.PENDING,
    },
  });
  return { ok: true as const, userId: nextUserId };
}
