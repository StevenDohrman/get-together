import { randomUUID } from 'node:crypto';
import { prismaClient as prisma } from '../db.js';
import {
  FormationInviteStatus,
  GroupFormationStatus,
  GroupRole,
  GroupSource,
  SwipeDecision,
  type Prisma,
} from '@prisma/client';
import { getMutualYesUserIds } from './matchingDiscovery.js';
import { normalizedWeightedOverlap, weightedVectorForInterestIds } from './matchingScoring.js';
import { ensureProposalGroupChat } from './groupChat.js';

/**
 * Prisma client or transaction client. `maybeFulfillProposal` and other
 * helpers accept this so they can run either standalone or as part of a
 * caller's `$transaction`, keeping invite-status flips and proposal
 * fulfillment atomic.
 */
type DbClient = typeof prisma | Prisma.TransactionClient;

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

  // Dedupe across seekings: if another user's seeking already produced an
  // OPEN proposal with the same exact member set (and target size), reuse
  // that proposal instead of creating a sibling. This is the only way to
  // guarantee a single canonical proposal per pair/set of users — and
  // therefore the only way to guarantee that a group can only form once
  // every member has explicitly accepted.
  const memberIds = [seedUserId, ...chosen];
  const sibling = await findOpenProposalWithMemberSet(memberIds, seeking.targetGroupSize);
  if (sibling) {
    return { ok: true as const, proposalId: sibling.id, reused: true as const };
  }

  const proposal = await prisma.$transaction(async tx => {
    const prop = await tx.groupFormationProposal.create({
      data: {
        userGroupSeekingId,
        status: GroupFormationStatus.OPEN,
      },
    });
    // No auto-acceptance: every member (including the user whose seeking
    // triggered this proposal) must explicitly accept before the group is
    // formed. See `respondFormationInvite`.
    for (const uid of memberIds) {
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

  return { ok: true as const, proposalId: proposal.id, reused: false as const };
}

/**
 * Find an OPEN proposal whose invite member set is exactly `memberIds` and
 * whose underlying seeking has `targetGroupSize === expectedSize`. Used to
 * collapse the dual-proposal case where both A's seeking and B's seeking
 * would otherwise spawn parallel proposals for the same pair.
 */
async function findOpenProposalWithMemberSet(
  memberIds: string[],
  expectedSize: number,
): Promise<{ id: string } | null> {
  if (memberIds.length === 0) return null;
  const candidates = await prisma.groupFormationProposal.findMany({
    where: {
      status: GroupFormationStatus.OPEN,
      userGroupSeeking: { targetGroupSize: expectedSize },
      // `every` is permissive (matches groups with no invites too), so we
      // post-filter on exact membership below.
      invites: { every: { userId: { in: memberIds } } },
    },
    include: { invites: { select: { userId: true } } },
  });
  return (
    candidates.find(p => {
      if (p.invites.length !== memberIds.length) return false;
      const ids = new Set(p.invites.map(i => i.userId));
      return memberIds.every(id => ids.has(id));
    }) ?? null
  );
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

export async function maybeFulfillProposal(proposalId: string, db: DbClient = prisma) {
  const proposal = await db.groupFormationProposal.findUnique({
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

  const acceptedUserIds = accepted.map(inv => inv.userId);

  // Idempotency / legacy-data safety net: if an APP_FORMED group with the
  // exact same member set already exists (e.g. because the historical
  // dual-proposal bug created one via a sibling proposal before this fix,
  // or because two proposals raced past `findOpenProposalWithMemberSet` and
  // both fulfilled concurrently), do NOT try to repoint this proposal's
  // `formedGroupId` to that group — that column is `@unique` and the update
  // would throw P2002 and leave the invite stuck as ACCEPTED with the
  // proposal stuck as OPEN. Mark this proposal CANCELLED instead; the user
  // already has access to the real group via membership.
  const existingGroup = await findAppFormedGroupWithExactMembers(acceptedUserIds, db);
  if (existingGroup) {
    await db.groupFormationProposal.update({
      where: { id: proposalId },
      data: { status: GroupFormationStatus.CANCELLED },
    });
    await deleteShadowSeekings(
      acceptedUserIds,
      proposal.userGroupSeeking.targetGroupSize,
      proposal.userGroupSeeking.interests.map(i => i.interestId),
      db,
    );
    return;
  }

  const interestNames = proposal.userGroupSeeking.interests.map(i => i.interest.name);
  const name =
    interestNames.length <= 2
      ? interestNames.join(' · ') || 'New group'
      : `${interestNames.slice(0, 2).join(' · ')} +${interestNames.length - 2}`;

  let slug = `match-${proposal.id}`;
  for (let i = 0; i < 5; i += 1) {
    const clash = await db.group.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `match-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }

  const group = await db.group.create({
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

  await db.groupFormationProposal.update({
    where: { id: proposalId },
    data: {
      status: GroupFormationStatus.FULFILLED,
      formedGroupId: group.id,
    },
  });

  // Cancel any leftover OPEN sibling proposals between the same members
  // (defensive — `findOpenProposalWithMemberSet` should prevent these from
  // being created in the first place, but legacy data may still have them).
  await cancelSiblingOpenProposals(proposal.id, acceptedUserIds, target, db);

  // Clean up "shadow seekings": other seekings from the same members that
  // share the same size + interest profile and would otherwise keep showing
  // up as "Discovering" on the dashboard now that those users are already
  // grouped together for that exact profile.
  await deleteShadowSeekings(
    acceptedUserIds,
    proposal.userGroupSeeking.targetGroupSize,
    proposal.userGroupSeeking.interests.map(i => i.interestId),
    db,
  );
}

/**
 * Find an APP_FORMED group whose member set is exactly `userIds` (no more, no less).
 *
 * Note: this is a best-effort dedupe and is not fully race-safe under
 * simultaneous concurrent fulfillment. If both proposals fulfill at the same
 * instant they can still race past this check and create two groups. A
 * follow-up could add a unique constraint on a deterministic member-set key
 * to make this race-free, but the sequential case (two users accepting
 * invites at different times) is the realistic scenario and is fully handled.
 */
async function findAppFormedGroupWithExactMembers(
  userIds: string[],
  db: DbClient = prisma,
): Promise<{ id: string } | null> {
  if (userIds.length === 0) return null;
  const groups = await db.group.findMany({
    where: {
      source: GroupSource.APP_FORMED,
      members: { every: { userId: { in: userIds } } },
    },
    select: {
      id: true,
      _count: { select: { members: true } },
    },
  });
  return groups.find(g => g._count.members === userIds.length) ?? null;
}

/**
 * Cancel any OTHER OPEN proposals whose invite member set equals `memberIds`
 * (and matching target size). These would be from sibling seekings that
 * shadow the just-fulfilled proposal; leaving them OPEN would leave stuck
 * cards on members' dashboards and re-introduce the dual-proposal hazard.
 */
async function cancelSiblingOpenProposals(
  fulfilledProposalId: string,
  memberIds: string[],
  expectedSize: number,
  db: DbClient,
): Promise<void> {
  if (memberIds.length === 0) return;
  const siblings = await db.groupFormationProposal.findMany({
    where: {
      id: { not: fulfilledProposalId },
      status: GroupFormationStatus.OPEN,
      userGroupSeeking: { targetGroupSize: expectedSize },
      invites: { every: { userId: { in: memberIds } } },
    },
    include: { invites: { select: { userId: true } } },
  });
  const exact = siblings.filter(
    p =>
      p.invites.length === memberIds.length &&
      memberIds.every(id => p.invites.some(i => i.userId === id)),
  );
  for (const p of exact) {
    await db.groupFormationProposal.update({
      where: { id: p.id },
      data: { status: GroupFormationStatus.CANCELLED },
    });
  }
}

/**
 * Delete seekings owned by any of `userIds` that share the same target
 * group size and interest set as the just-formed group. These "shadow
 * seekings" would otherwise sit on the dashboard as "Discovering" even
 * though the user has already been placed into a group matching that
 * exact profile.
 *
 * Matching seekings whose own proposal already drove this fulfillment are
 * preserved by the FULFILLED-status filter (their `proposals: { some: { status: FULFILLED } }`
 * branch is hidden by the existing dashboard query), so we only need to
 * remove the other-seekings-that-never-fulfilled.
 */
async function deleteShadowSeekings(
  userIds: string[],
  targetGroupSize: number,
  interestIds: string[],
  db: DbClient,
): Promise<void> {
  if (userIds.length === 0 || interestIds.length === 0) return;
  const expectedInterestSetSize = interestIds.length;

  // Find candidate seekings owned by these users with matching size and a
  // matching interest count, then verify exact interest set in JS.
  const candidates = await db.userGroupSeeking.findMany({
    where: {
      userId: { in: userIds },
      targetGroupSize,
      // No FULFILLED proposal (those are the canonical post-fulfill seekings
      // already hidden by the dashboard filter).
      proposals: { none: { status: GroupFormationStatus.FULFILLED } },
      interests: { every: { interestId: { in: interestIds } } },
    },
    include: { interests: { select: { interestId: true } } },
  });

  const interestSet = new Set(interestIds);
  const toDelete = candidates.filter(
    s =>
      s.interests.length === expectedInterestSetSize &&
      s.interests.every(i => interestSet.has(i.interestId)),
  );

  for (const s of toDelete) {
    await db.userGroupSeeking.delete({ where: { id: s.id } });
  }
}

/**
 * Opportunistically heal proposals that are stuck OPEN with all invites
 * ACCEPTED — e.g. from legacy data created before the dedupe/auto-accept
 * fixes landed. Called from the dashboard endpoint so users naturally
 * get unstuck on next page load without a separate migration.
 */
export async function healStuckProposalsForUser(userId: string): Promise<void> {
  const candidateInvites = await prisma.groupFormationInvite.findMany({
    where: {
      userId,
      proposal: { status: GroupFormationStatus.OPEN },
    },
    select: { proposalId: true },
  });
  const proposalIds = [...new Set(candidateInvites.map(i => i.proposalId))];
  for (const proposalId of proposalIds) {
    try {
      await maybeFulfillProposal(proposalId);
    } catch {
      // Best-effort heal; swallow per-proposal errors so a single bad row
      // can't break the entire dashboard load. The bug being healed here
      // was originally a P2002 thrown out of this exact path.
    }
  }
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
    // Atomic: invite flip + fulfillment check happen together so we can
    // never end up with `status=ACCEPTED` invites under an `OPEN` proposal
    // (the "2/2 accepted · 0 pending, still waiting" stuck state).
    await prisma.$transaction(async tx => {
      await tx.groupFormationInvite.update({
        where: { id: invite.id },
        data: { status: FormationInviteStatus.ACCEPTED },
      });
      await maybeFulfillProposal(proposalId, tx);
    });
    // Chat side-effect runs outside the txn — if it fails, the accept is
    // still durable and the chat will be lazily ensured on the next
    // interaction with the proposal.
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
