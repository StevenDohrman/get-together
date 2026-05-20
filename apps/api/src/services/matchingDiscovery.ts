import { SwipeDecision } from '@prisma/client';
import { prismaClient as prisma } from '../db.js';
import { normalizedWeightedOverlap } from './matchingScoring.js';
import { bucketDistanceMeters, type DistanceBucket } from './distanceBuckets.js';

export type DiscoveryReason =
  | 'NO_SEEKINGS'
  | 'COMPATIBLE_SEEKINGS'
  | 'PROFILE_FALLBACK'
  | 'EMPTY';

export type DiscoveryInterestDto = {
  id: string;
  slug: string;
  name: string;
  weight: number;
};

export type DiscoveryPhotoDto = {
  id: string;
  url: string;
  position: number;
};

export type DiscoveryUserDto = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  photos: DiscoveryPhotoDto[];
  city: string | null;
  /**
   * Coarse distance bucket. Precise meters are never returned to clients to
   * prevent trilateration attacks. See {@link DistanceBucket}.
   */
  distanceBucket: DistanceBucket | null;
  interests: DiscoveryInterestDto[];
  sharedInterestNames: string[];
  matchedGroupSize: number | null;
  sharedInterestCount: number;
  matchScore: number;
  rawMatchScore: number;
};

export type DiscoveryResult = {
  users: DiscoveryUserDto[];
  reason: DiscoveryReason;
};

type MyProfileRow = { interestId: string; weight: number };

type RankedCandidate = {
  userId: string;
  matchedGroupSize: number | null;
  sharedInterestIds: string[];
  sharedInterestCount: number;
  matchScore: number;
  rawMatchScore: number;
};

function sharedInterestIds(
  left: MyProfileRow[],
  right: MyProfileRow[],
): string[] {
  const rightIds = new Set(right.map((row) => row.interestId));
  return [
    ...new Set(
      left
        .map((row) => row.interestId)
        .filter((interestId) => rightIds.has(interestId)),
    ),
  ];
}

export async function getDiscoveryUsers(
  appUserId: string,
  limit: number,
): Promise<DiscoveryResult> {
  const mySeekings = await prisma.userGroupSeeking.findMany({
    where: { userId: appUserId },
    include: { interests: { select: { interestId: true } } },
  });

  if (mySeekings.length === 0) {
    return { users: [], reason: 'NO_SEEKINGS' };
  }

  const myProfileRows: MyProfileRow[] = await prisma.userInterest.findMany({
    where: { userId: appUserId },
    select: { interestId: true, weight: true },
  });

  const swiped = await prisma.userSwipe.findMany({
    where: { swiperId: appUserId },
    select: { targetUserId: true },
  });
  const excludeIds = new Set<string>([appUserId, ...swiped.map(s => s.targetUserId)]);

  const mySeekingInterestsBySize = new Map<number, Set<string>>();
  const myAllSeekingInterestIds = new Set<string>();
  for (const s of mySeekings) {
    const set = mySeekingInterestsBySize.get(s.targetGroupSize) ?? new Set<string>();
    for (const i of s.interests) {
      set.add(i.interestId);
      myAllSeekingInterestIds.add(i.interestId);
    }
    mySeekingInterestsBySize.set(s.targetGroupSize, set);
  }

  const seekingSizes = [...mySeekingInterestsBySize.keys()];
  const compatibleHits = await collectCompatibleSeekingHits(
    excludeIds,
    seekingSizes,
    mySeekingInterestsBySize,
  );

  let reason: DiscoveryReason;
  let ranked: RankedCandidate[];

  if (compatibleHits.size > 0) {
    const compatible = await rankCompatibleCandidates(
      myProfileRows,
      compatibleHits,
    );
    if (compatible.length > 0) {
    reason = 'COMPATIBLE_SEEKINGS';
      ranked = compatible;
    } else {
      const fallback = await rankProfileInterestFallback(
        appUserId,
        myProfileRows,
        excludeIds,
      );
      reason = fallback.length > 0 ? 'PROFILE_FALLBACK' : 'EMPTY';
      ranked = fallback;
    }
  } else {
    const fallback = await rankProfileInterestFallback(appUserId, myProfileRows, excludeIds);
    reason = fallback.length > 0 ? 'PROFILE_FALLBACK' : 'EMPTY';
    ranked = fallback;
  }

  const slice = ranked.slice(0, limit);
  if (slice.length === 0) {
    return { users: [], reason };
  }

  const users = await hydrateDiscoveryUsers(appUserId, slice);
  return { users, reason };
}

type SeekingHit = {
  userId: string;
  matchedGroupSize: number;
  sharedSeekingInterestIds: Set<string>;
};

async function collectCompatibleSeekingHits(
  excludeIds: Set<string>,
  seekingSizes: number[],
  mySeekingInterestsBySize: Map<number, Set<string>>,
): Promise<Map<string, SeekingHit>> {
  const excludeList = [...excludeIds];
  const candidateSeekings = await prisma.userGroupSeeking.findMany({
    where: {
      userId: { notIn: excludeList },
      targetGroupSize: { in: seekingSizes },
    },
    include: { interests: { select: { interestId: true } } },
  });

  const hitsByUser = new Map<string, SeekingHit>();
  for (const cs of candidateSeekings) {
    const mySetForSize = mySeekingInterestsBySize.get(cs.targetGroupSize);
    if (!mySetForSize) continue;
    const shared = new Set<string>();
    for (const i of cs.interests) {
      if (mySetForSize.has(i.interestId)) shared.add(i.interestId);
    }
    if (shared.size === 0) continue;

    const existing = hitsByUser.get(cs.userId);
    if (!existing || existing.sharedSeekingInterestIds.size < shared.size) {
      hitsByUser.set(cs.userId, {
        userId: cs.userId,
        matchedGroupSize: cs.targetGroupSize,
        sharedSeekingInterestIds: shared,
      });
    }
  }
  return hitsByUser;
}

async function rankCompatibleCandidates(
  myProfileRows: MyProfileRow[],
  hits: Map<string, SeekingHit>,
): Promise<RankedCandidate[]> {
  const candidateUserIds = [...hits.keys()];
  const candidateRows = await prisma.userInterest.findMany({
    where: { userId: { in: candidateUserIds } },
    select: { userId: true, interestId: true, weight: true },
  });
  const rowsByUserId = new Map<string, MyProfileRow[]>();
  for (const row of candidateRows) {
    const list = rowsByUserId.get(row.userId) ?? [];
    list.push({ interestId: row.interestId, weight: row.weight });
    rowsByUserId.set(row.userId, list);
  }

  return candidateUserIds
    .map(userId => {
      const hit = hits.get(userId)!;
      const candidateRows = rowsByUserId.get(userId) ?? [];
      const score = normalizedWeightedOverlap(myProfileRows, candidateRows);
      return {
        userId,
        matchedGroupSize: hit.matchedGroupSize,
        sharedInterestIds: sharedInterestIds(myProfileRows, candidateRows),
        sharedInterestCount: score.sharedInterestCount,
        matchScore: score.matchScore,
        rawMatchScore: score.rawMatchScore,
      };
    })
    .filter((row) => row.sharedInterestCount > 0)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.sharedInterestCount - a.sharedInterestCount ||
        a.userId.localeCompare(b.userId),
    );
}

async function rankProfileInterestFallback(
  appUserId: string,
  myProfileRows: MyProfileRow[],
  excludeIds: Set<string>,
): Promise<RankedCandidate[]> {
  if (myProfileRows.length === 0) return [];

  const sharedRows = await prisma.userInterest.findMany({
    where: {
      interestId: { in: myProfileRows.map(r => r.interestId) },
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
  const rowsByUserId = new Map<string, MyProfileRow[]>();
  for (const row of candidateRows) {
    const list = rowsByUserId.get(row.userId) ?? [];
    list.push({ interestId: row.interestId, weight: row.weight });
    rowsByUserId.set(row.userId, list);
  }

  return candidateIds
    .map((userId) => {
      const candidateRows = rowsByUserId.get(userId) ?? [];
      const score = normalizedWeightedOverlap(myProfileRows, candidateRows);
      return {
        userId,
        matchedGroupSize: null,
        sharedInterestIds: sharedInterestIds(myProfileRows, candidateRows),
        sharedInterestCount: score.sharedInterestCount,
        matchScore: score.matchScore,
        rawMatchScore: score.rawMatchScore,
      };
    })
    .filter(row => row.sharedInterestCount > 0)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        b.sharedInterestCount - a.sharedInterestCount ||
        a.userId.localeCompare(b.userId),
    );
}

type LocationRow = {
  userId: string;
  friendlyName: string | null;
  meters: number | null;
};

async function loadLocationsForUsers(
  appUserId: string,
  userIds: string[],
): Promise<Map<string, LocationRow>> {
  const result = new Map<string, LocationRow>();
  if (userIds.length === 0) return result;

  try {
    const rows = (await prisma.$queryRaw`
      WITH me AS (
        SELECT location FROM "UserLocation" WHERE "userId" = ${appUserId}::uuid
      )
      SELECT
        ul."userId"::text AS "userId",
        ul."friendlyName" AS "friendlyName",
        CASE
          WHEN (SELECT location FROM me) IS NOT NULL
            THEN ST_Distance(ul.location, (SELECT location FROM me))
          ELSE NULL
        END AS meters
      FROM "UserLocation" ul
      WHERE ul."userId" = ANY(${userIds}::uuid[])
    `) as { userId: string; friendlyName: string | null; meters: number | null }[];

    for (const row of rows) {
      result.set(row.userId, {
        userId: row.userId,
        friendlyName: row.friendlyName,
        meters: row.meters == null ? null : Number(row.meters),
      });
    }
  } catch {
    // Best-effort: if PostGIS / raw queries aren't available (e.g. in tests),
    // we just return no location data instead of failing the whole request.
  }

  return result;
}

async function hydrateDiscoveryUsers(
  appUserId: string,
  ranked: RankedCandidate[],
): Promise<DiscoveryUserDto[]> {
  const ids = ranked.map(r => r.userId);

  const [users, profileInterestRows, photoRows, locations] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, username: true, displayName: true, bio: true },
    }),
    prisma.userInterest.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, interestId: true, weight: true },
    }),
    prisma.userPhoto.findMany({
      where: { userId: { in: ids } },
      orderBy: { position: 'asc' },
      select: { id: true, userId: true, url: true, position: true },
    }),
    loadLocationsForUsers(appUserId, ids),
  ]);

  const photosByUser = new Map<string, DiscoveryPhotoDto[]>();
  for (const row of photoRows) {
    const list = photosByUser.get(row.userId) ?? [];
    list.push({ id: row.id, url: row.url, position: row.position });
    photosByUser.set(row.userId, list);
  }

  const interestIdSet = new Set<string>();
  for (const row of profileInterestRows) interestIdSet.add(row.interestId);
  for (const r of ranked)
    for (const i of r.sharedInterestIds) interestIdSet.add(i);

  const interestRows =
    interestIdSet.size === 0
      ? []
      : await prisma.interest.findMany({
          where: { id: { in: [...interestIdSet] } },
          select: { id: true, slug: true, name: true },
        });
  const interestById = new Map(interestRows.map(i => [i.id, i]));

  const userById = new Map(users.map(u => [u.id, u]));

  const interestsByUser = new Map<string, DiscoveryInterestDto[]>();
  for (const row of profileInterestRows) {
    const interest = interestById.get(row.interestId);
    if (!interest) continue;
    const list = interestsByUser.get(row.userId) ?? [];
    list.push({
      id: interest.id,
      slug: interest.slug,
      name: interest.name,
      weight: row.weight,
    });
    interestsByUser.set(row.userId, list);
  }

  return ranked.map(r => {
    const u = userById.get(r.userId);
    const interests = (interestsByUser.get(r.userId) ?? []).sort(
      (a, b) => b.weight - a.weight || a.name.localeCompare(b.name),
    );
    const sharedInterestNames = r.sharedInterestIds
      .map((id) => interestById.get(id)?.name)
      .filter((name): name is string => !!name);
    const loc = locations.get(r.userId);
    const photos = photosByUser.get(r.userId) ?? [];
    const primaryPhoto = photos[0];

    return {
      id: r.userId,
      username: u?.username ?? null,
      displayName: u?.displayName ?? null,
      bio: u?.bio ?? null,
      avatarUrl: primaryPhoto?.url ?? null,
      photos,
      city: loc?.friendlyName ?? null,
      distanceBucket: bucketDistanceMeters(loc?.meters ?? null),
      interests,
      sharedInterestNames,
      matchedGroupSize: r.matchedGroupSize,
      sharedInterestCount: r.sharedInterestCount,
      matchScore: r.matchScore,
      rawMatchScore: r.rawMatchScore,
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
