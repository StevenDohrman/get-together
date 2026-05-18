import { SwipeDecision } from '@prisma/client';
import { prismaClient as prisma } from '../db.js';
import { normalizedWeightedOverlap } from './matchingScoring.js';

export async function getDiscoveryUsers(appUserId: string, limit: number) {
  const myRows = await prisma.userInterest.findMany({
    where: { userId: appUserId },
    select: { interestId: true, weight: true },
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

  const sharedRows = await prisma.userInterest.findMany({
    where: {
      interestId: { in: myInterestIds },
      userId: { notIn: [...excludeIds] },
    },
    select: { userId: true, interestId: true },
  });

  const candidateIds = [...new Set(sharedRows.map(row => row.userId))];
  if (candidateIds.length === 0) return [];

  const candidateRows = await prisma.userInterest.findMany({
    where: { userId: { in: candidateIds } },
    select: { userId: true, interestId: true, weight: true },
  });

  const rowsByUserId = new Map<string, typeof myRows>();
  for (const row of candidateRows) {
    if (!rowsByUserId.has(row.userId)) rowsByUserId.set(row.userId, []);
    rowsByUserId.get(row.userId)!.push(row);
  }

  const ranked = candidateIds
    .map(userId => ({
      userId,
      ...normalizedWeightedOverlap(myRows, rowsByUserId.get(userId) ?? []),
    }))
    .filter(row => row.sharedInterestCount > 0)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.sharedInterestCount - a.sharedInterestCount ||
        a.userId.localeCompare(b.userId),
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
      matchScore: s.matchScore,
      rawMatchScore: s.rawMatchScore,
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

export async function getMutualYesUserIds(userId: string): Promise<string[]> {
  const outYes = await prisma.userSwipe.findMany({
    where: { swiperId: userId, decision: SwipeDecision.YES },
    select: { targetUserId: true },
  });
  const ids = outYes.map(x => x.targetUserId);
  if (ids.length === 0) return [];
  const back = await prisma.userSwipe.findMany({
    where: { swiperId: { in: ids }, targetUserId: userId, decision: SwipeDecision.YES },
    select: { swiperId: true },
  });
  return back.map(b => b.swiperId);
}
