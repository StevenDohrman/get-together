import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';
import {
  FormationInviteStatus,
  GroupFormationStatus,
  GroupRole,
  SwipeDecision,
} from '@prisma/client';

const ME = '00000000-0000-4000-8000-000000000001';
const USER_A = '00000000-0000-4000-8000-000000000002';
const USER_B = '00000000-0000-4000-8000-000000000003';
const USER_C = '00000000-0000-4000-8000-000000000004';
const USER_D = '00000000-0000-4000-8000-000000000005';
const INTEREST_A = '10000000-0000-4000-8000-000000000001';
const INTEREST_B = '10000000-0000-4000-8000-000000000002';
const INTEREST_C = '10000000-0000-4000-8000-000000000003';
const SEEKING_ID = '20000000-0000-4000-8000-000000000001';
const PROPOSAL_ID = '30000000-0000-4000-8000-000000000001';
const INVITE_ID = '40000000-0000-4000-8000-000000000001';

type DbUser = {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  supabaseAuthId?: string | null;
};

type State = {
  users: DbUser[];
  interests: { id: string; slug: string; name: string }[];
  userInterests: { userId: string; interestId: string; weight?: number }[];
  swipes: { swiperId: string; targetUserId: string; decision: SwipeDecision }[];
  groupSeekings: {
    id: string;
    userId: string;
    targetGroupSize: number;
    interestIds: string[];
    createdAt: Date;
    updatedAt: Date;
  }[];
  formationProposals: {
    id: string;
    userGroupSeekingId: string;
    status: GroupFormationStatus;
    formedGroupId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  formationInvites: {
    id: string;
    proposalId: string;
    userId: string;
    status: FormationInviteStatus;
    createdAt: Date;
    updatedAt: Date;
  }[];
  groups: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    createdById: string;
    memberIds: string[];
  }[];
  groupMemberships: {
    groupId: string;
    userId: string;
    role: GroupRole;
    joinedAt: Date;
  }[];
  groupChats: {
    id: string;
    proposalId: string | null;
    groupId: string | null;
    createdAt: Date;
  }[];
  groupChatMembers: {
    chatId: string;
    userId: string;
    joinedAt: Date;
  }[];
  calls: {
    swipeUpserts: unknown[];
    seekingCreates: unknown[];
    proposalCreates: unknown[];
    inviteCreates: unknown[];
    groupsCreated: unknown[];
    proposalUpdates: unknown[];
  };
};

let state: State;

function interest(id: string) {
  const found = state.interests.find(i => i.id === id);
  if (!found) throw new Error(`Missing interest ${id}`);
  return found;
}

function user(id: string) {
  const found = state.users.find(u => u.id === id);
  if (!found) throw new Error(`Missing user ${id}`);
  return found;
}

function seekingWithInterests(row: State['groupSeekings'][number]) {
  return {
    id: row.id,
    userId: row.userId,
    targetGroupSize: row.targetGroupSize,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    interests: row.interestIds.map(interestId => ({
      userGroupSeekingId: row.id,
      interestId,
      interest: interest(interestId),
    })),
  };
}

function proposalWithIncludes(row: State['formationProposals'][number]) {
  const seeking = state.groupSeekings.find(s => s.id === row.userGroupSeekingId);
  if (!seeking) throw new Error(`Missing seeking ${row.userGroupSeekingId}`);
  return {
    ...row,
    userGroupSeeking: seekingWithInterests(seeking),
    invites: state.formationInvites
      .filter(inv => inv.proposalId === row.id)
      .map(inv => ({
        ...inv,
        user: {
          id: inv.userId,
          username: user(inv.userId).username,
          displayName: user(inv.userId).displayName,
        },
      })),
  };
}

function resetState() {
  const now = new Date('2026-05-15T12:00:00.000Z');
  state = {
    users: [
      { id: ME, email: 'me@example.com', username: 'me', displayName: 'Me' },
      { id: USER_A, email: 'a@example.com', username: 'user-a', displayName: 'User A' },
      { id: USER_B, email: 'b@example.com', username: 'user-b', displayName: 'User B' },
      { id: USER_C, email: 'c@example.com', username: 'user-c', displayName: 'User C' },
      { id: USER_D, email: 'd@example.com', username: 'user-d', displayName: 'User D' },
    ],
    interests: [
      { id: INTEREST_A, slug: 'hiking', name: 'Hiking' },
      { id: INTEREST_B, slug: 'books', name: 'Books' },
      { id: INTEREST_C, slug: 'music', name: 'Music' },
    ],
    userInterests: [],
    swipes: [],
    groupSeekings: [],
    formationProposals: [],
    formationInvites: [],
    groups: [],
    groupMemberships: [],
    groupChats: [],
    groupChatMembers: [],
    calls: {
      swipeUpserts: [],
      seekingCreates: [],
      proposalCreates: [],
      inviteCreates: [],
      groupsCreated: [],
      proposalUpdates: [],
    },
  };
  state.groupSeekings.push({
    id: SEEKING_ID,
    userId: ME,
    targetGroupSize: 3,
    interestIds: [INTEREST_A, INTEREST_B],
    createdAt: now,
    updatedAt: now,
  });
}

function matchesWhere<T extends Record<string, unknown>>(row: T, where: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(where)) {
    if (key === 'id' && typeof value === 'string' && row.id !== value) return false;
    if (key === 'userId' && typeof value === 'string' && row.userId !== value) return false;
    if (key === 'swiperId' && typeof value === 'string' && row.swiperId !== value) return false;
    if (key === 'swiperId' && typeof value === 'object' && value && 'in' in value) {
      if (!(value.in as string[]).includes(String(row.swiperId))) return false;
    }
    if (key === 'targetUserId' && typeof value === 'string' && row.targetUserId !== value) return false;
    if (key === 'targetUserId' && typeof value === 'object' && value && 'in' in value) {
      if (!(value.in as string[]).includes(String(row.targetUserId))) return false;
    }
    if (key === 'decision' && typeof value === 'string' && row.decision !== value) return false;
    if (key === 'status' && typeof value === 'string' && row.status !== value) return false;
    if (key === 'proposalId' && typeof value === 'string' && row.proposalId !== value) return false;
    if (key === 'userGroupSeekingId' && typeof value === 'string' && row.userGroupSeekingId !== value) {
      return false;
    }
    if (key === 'userId' && typeof value === 'object' && value && 'in' in value) {
      if (!(value.in as string[]).includes(String(row.userId))) return false;
    }
    if (key === 'interestId' && typeof value === 'object' && value && 'in' in value) {
      if (!(value.in as string[]).includes(String(row.interestId))) return false;
    }
    if (key === 'targetGroupSize' && typeof value === 'number' && row.targetGroupSize !== value) return false;
  }
  return true;
}

const prisma = {
  user: {
    findUnique: async ({ where }: { where: { id?: string; email?: string; supabaseAuthId?: string } }) =>
      state.users.find(u => u.id === where.id || u.email === where.email || u.supabaseAuthId === where.supabaseAuthId) ??
      null,
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      state.users
        .filter(u => where.id.in.includes(u.id))
        .map(u => ({ id: u.id, username: u.username, displayName: u.displayName })),
  },
  userInterest: {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      state.userInterests
        .filter(row => {
          if (typeof where.userId === 'string' && row.userId !== where.userId) return false;
          if (where.interestId && typeof where.interestId === 'object' && 'in' in where.interestId) {
            if (!(where.interestId.in as string[]).includes(row.interestId)) return false;
          }
          if (where.userId && typeof where.userId === 'object' && 'notIn' in where.userId) {
            if ((where.userId.notIn as string[]).includes(row.userId)) return false;
          }
          if (where.userId && typeof where.userId === 'object' && 'in' in where.userId) {
            if (!(where.userId.in as string[]).includes(row.userId)) return false;
          }
          return true;
        })
        .map(row => ({ ...row, weight: row.weight ?? 5 })),
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      {
        const row = state.userInterests.find(candidate => matchesWhere(candidate, where));
        return row ? { ...row, weight: row.weight ?? 5 } : null;
      },
  },
  userSwipe: {
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      state.swipes.filter(row => {
        return matchesWhere(row, where);
      }),
    upsert: async (args: {
      where: { swiperId_targetUserId: { swiperId: string; targetUserId: string } };
      create: { swiperId: string; targetUserId: string; decision: SwipeDecision };
      update: { decision: SwipeDecision };
    }) => {
      state.calls.swipeUpserts.push(args);
      const key = args.where.swiperId_targetUserId;
      const existing = state.swipes.find(s => s.swiperId === key.swiperId && s.targetUserId === key.targetUserId);
      if (existing) existing.decision = args.update.decision;
      else state.swipes.push(args.create);
      return existing ?? args.create;
    },
  },
  interest: {
    count: async ({ where }: { where: { id: { in: string[] } } }) =>
      state.interests.filter(i => where.id.in.includes(i.id)).length,
  },
  userGroupSeeking: {
    count: async ({ where }: { where: { userId: string } }) =>
      state.groupSeekings.filter(s => s.userId === where.userId).length,
    create: async (args: {
      data: { userId: string; targetGroupSize: number; interests: { create: { interestId: string }[] } };
    }) => {
      state.calls.seekingCreates.push(args);
      const row = {
        id: `20000000-0000-4000-8000-${String(state.groupSeekings.length + 100).padStart(12, '0')}`,
        userId: args.data.userId,
        targetGroupSize: args.data.targetGroupSize,
        interestIds: args.data.interests.create.map(i => i.interestId),
        createdAt: new Date('2026-05-15T13:00:00.000Z'),
        updatedAt: new Date('2026-05-15T13:00:00.000Z'),
      };
      state.groupSeekings.push(row);
      return seekingWithInterests(row);
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      {
        const row = state.groupSeekings.find(candidate => matchesWhere(candidate, where));
        return row ? seekingWithInterests(row) : null;
      },
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      state.groupSeekings
        .filter(row => {
          if (where.userId && typeof where.userId === 'string' && row.userId !== where.userId) return false;
          if (where.userId && typeof where.userId === 'object' && 'in' in where.userId) {
            if (!(where.userId.in as string[]).includes(row.userId)) return false;
          }
          if (where.targetGroupSize && row.targetGroupSize !== where.targetGroupSize) return false;
          return true;
        })
        .map(seekingWithInterests),
    update: async ({ where, data }: { where: { id: string }; data: { targetGroupSize?: number } }) => {
      const row = state.groupSeekings.find(s => s.id === where.id);
      if (!row) throw new Error(`Missing seeking ${where.id}`);
      if (data.targetGroupSize !== undefined) row.targetGroupSize = data.targetGroupSize;
      row.updatedAt = new Date('2026-05-15T14:00:00.000Z');
      return seekingWithInterests(row);
    },
    delete: async ({ where }: { where: { id: string } }) => {
      state.groupSeekings = state.groupSeekings.filter(s => s.id !== where.id);
    },
  },
  userGroupSeekingInterest: {
    deleteMany: async ({ where }: { where: { userGroupSeekingId: string } }) => {
      const row = state.groupSeekings.find(s => s.id === where.userGroupSeekingId);
      if (row) row.interestIds = [];
    },
    createMany: async ({ data }: { data: { userGroupSeekingId: string; interestId: string }[] }) => {
      const bySeeking = new Map<string, string[]>();
      for (const row of data) bySeeking.set(row.userGroupSeekingId, [...(bySeeking.get(row.userGroupSeekingId) ?? []), row.interestId]);
      for (const [seekingId, interestIds] of bySeeking.entries()) {
        const row = state.groupSeekings.find(s => s.id === seekingId);
        if (row) row.interestIds = interestIds;
      }
    },
  },
  groupFormationProposal: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      state.formationProposals.find(row => matchesWhere(row, where)) ?? null,
    create: async ({ data }: { data: { userGroupSeekingId: string; status: GroupFormationStatus } }) => {
      state.calls.proposalCreates.push(data);
      const proposalNumber = state.formationProposals.length + 1;
      const row = {
        id:
          proposalNumber === 1
            ? PROPOSAL_ID
            : `30000000-0000-4000-8000-${String(proposalNumber).padStart(12, '0')}`,
        userGroupSeekingId: data.userGroupSeekingId,
        status: data.status,
        formedGroupId: null,
        createdAt: new Date('2026-05-15T15:00:00.000Z'),
        updatedAt: new Date('2026-05-15T15:00:00.000Z'),
      };
      state.formationProposals.push(row);
      return row;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = state.formationProposals.find(p => p.id === where.id);
      return row ? proposalWithIncludes(row) : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<State['formationProposals'][number]> }) => {
      state.calls.proposalUpdates.push({ where, data });
      const row = state.formationProposals.find(p => p.id === where.id);
      if (!row) throw new Error(`Missing proposal ${where.id}`);
      Object.assign(row, data);
      return row;
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      state.formationProposals
        .filter(row => {
          if (!matchesWhere(row, where)) return false;
          if (where.userGroupSeeking && typeof where.userGroupSeeking === 'object' && 'is' in where.userGroupSeeking) {
            const seeking = state.groupSeekings.find(s => s.id === row.userGroupSeekingId);
            const relationFilter = where.userGroupSeeking.is as { userId?: string };
            if (relationFilter.userId !== undefined && seeking?.userId !== relationFilter.userId) return false;
          }
          return true;
        })
        .map(proposalWithIncludes),
  },
  groupFormationInvite: {
    create: async ({ data }: { data: { proposalId: string; userId: string; status: FormationInviteStatus } }) => {
      state.calls.inviteCreates.push(data);
      const row = {
        id: `40000000-0000-4000-8000-${String(state.formationInvites.length + 100).padStart(12, '0')}`,
        ...data,
        createdAt: new Date('2026-05-15T15:00:00.000Z'),
        updatedAt: new Date('2026-05-15T15:00:00.000Z'),
      };
      state.formationInvites.push(row);
      return row;
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const row = state.formationInvites.find(inv => matchesWhere(inv, where));
      if (!row) return null;
      const proposal = state.formationProposals.find(p => p.id === row.proposalId);
      return { ...row, proposal };
    },
    update: async ({ where, data }: { where: { id: string }; data: { status: FormationInviteStatus } }) => {
      const row = state.formationInvites.find(inv => inv.id === where.id);
      if (!row) throw new Error(`Missing invite ${where.id}`);
      row.status = data.status;
      return row;
    },
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      state.formationInvites
        .filter(inv => {
          if (!matchesWhere(inv, where)) return false;
          if (where.proposal && typeof where.proposal === 'object' && 'status' in where.proposal) {
            const proposal = state.formationProposals.find(p => p.id === inv.proposalId);
            return proposal?.status === (where.proposal as { status: GroupFormationStatus }).status;
          }
          return true;
        })
        .map(inv => {
          const proposal = state.formationProposals.find(p => p.id === inv.proposalId);
          if (!proposal) throw new Error(`Missing proposal ${inv.proposalId}`);
          return { ...inv, proposal: proposalWithIncludes(proposal) };
        }),
  },
  group: {
    findUnique: async ({ where }: { where: { slug: string } }) => state.groups.find(g => g.slug === where.slug) ?? null,
    create: async ({ data }: { data: { slug: string; name: string; createdById: string; members: { create: { userId: string; role: GroupRole }[] } } }) => {
      state.calls.groupsCreated.push(data);
      const row = {
        id: `50000000-0000-4000-8000-${String(state.groups.length + 100).padStart(12, '0')}`,
        slug: data.slug,
        name: data.name,
        createdById: data.createdById,
        memberIds: data.members.create.map(m => m.userId),
      };
      state.groups.push(row);
      for (const member of data.members.create) {
        state.groupMemberships.push({
          groupId: row.id,
          userId: member.userId,
          role: member.role,
          joinedAt: new Date('2026-05-15T16:00:00.000Z'),
        });
      }
      return row;
    },
  },
  groupChat: {
    upsert: async (args: {
      where: { proposalId: string };
      create: { proposalId: string; groupId?: string };
      update: { groupId?: string };
    }) => {
      const existing = state.groupChats.find(c => c.proposalId === args.where.proposalId) ?? null;
      if (existing) {
        if (args.update.groupId !== undefined) existing.groupId = args.update.groupId;
        return existing;
      }

      const chatNumber = state.groupChats.length + 1;
      const row = {
        id: `60000000-0000-4000-8000-${String(chatNumber).padStart(12, '0')}`,
        proposalId: args.create.proposalId,
        groupId: args.create.groupId ?? null,
        createdAt: new Date('2026-05-15T15:00:00.000Z'),
      };
      state.groupChats.push(row);
      return row;
    },
  },
  groupChatMember: {
    findMany: async ({ where }: { where: { chatId: string } }) =>
      state.groupChatMembers.filter(m => m.chatId === where.chatId),
    findUnique: async ({ where }: { where: { chatId_userId: { chatId: string; userId: string } } }) => {
      const key = where.chatId_userId;
      return state.groupChatMembers.find(m => m.chatId === key.chatId && m.userId === key.userId) ?? null;
    },
    createMany: async ({ data }: { data: { chatId: string; userId: string }[]; skipDuplicates?: boolean }) => {
      for (const row of data) {
        const exists = state.groupChatMembers.some(m => m.chatId === row.chatId && m.userId === row.userId);
        if (exists) continue;
        state.groupChatMembers.push({
          chatId: row.chatId,
          userId: row.userId,
          joinedAt: new Date('2026-05-15T15:00:00.000Z'),
        });
      }
      return { count: data.length };
    },
  },
  groupMember: {
    findMany: async ({ where }: { where: { userId: string } }) =>
      state.groupMemberships
        .filter(m => m.userId === where.userId)
        .map(m => {
          const group = state.groups.find(g => g.id === m.groupId);
          if (!group) throw new Error(`Missing group ${m.groupId}`);
          return {
            ...m,
            group: {
              id: group.id,
              slug: group.slug,
              name: group.name,
              _count: { members: group.memberIds.length },
            },
          };
        }),
  },
  $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>) => fn(prisma),
};

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/uconnect_test';

const { setPrismaClientForTests } = await import('../src/db.js');
const { registerMatchingRoutes } = await import('../src/routes/matching.js');
const { registerGroupsRoutes } = await import('../src/routes/groups.js');

setPrismaClientForTests(prisma as never);

function authHeaders() {
  return { authorization: 'Bearer good-token' };
}

function supabaseAdmin() {
  return {
    auth: {
      getUser: async (token: string) => ({
        data: token === 'good-token' ? { user: { id: ME, email: 'me@example.com' } } : { user: null },
        error: token === 'good-token' ? null : new Error('bad token'),
      }),
    },
  };
}

function makeApp() {
  const app = Fastify({ logger: false });
  registerMatchingRoutes(app, { supabaseAdmin: supabaseAdmin() as never });
  registerGroupsRoutes(app, { supabaseAdmin: supabaseAdmin() as never });
  return app;
}

beforeEach(() => {
  resetState();
});

describe('matching APIs', () => {
  it('returns only unswiped discovery users ranked by normalized shared-interest weights', async () => {
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 3 },
      { userId: ME, interestId: INTEREST_B, weight: 4 },
      { userId: USER_A, interestId: INTEREST_A, weight: 10 },
      { userId: USER_B, interestId: INTEREST_A, weight: 9 },
      { userId: USER_B, interestId: INTEREST_B, weight: 10 },
      { userId: USER_C, interestId: INTEREST_B, weight: 10 },
      { userId: USER_C, interestId: INTEREST_C, weight: 10 },
      { userId: USER_D, interestId: INTEREST_C, weight: 10 },
    );
    state.swipes.push({ swiperId: ME, targetUserId: USER_D, decision: SwipeDecision.NO });

    const response = await makeApp().inject({
      method: 'GET',
      url: '/matching/discovery',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response
        .json()
        .users.map((u: { id: string; sharedInterestCount: number; matchScore: number; rawMatchScore: number }) => [
          u.id,
          u.sharedInterestCount,
          Math.round(u.matchScore * 1000) / 1000,
          u.rawMatchScore,
        ]),
      [
        [USER_B, 2, 0.996, 67],
        [USER_A, 1, 0.6, 30],
        [USER_C, 1, 0.566, 40],
      ],
    );
  });

  it('rejects swipes against users without a shared profile interest', async () => {
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A },
      { userId: USER_A, interestId: INTEREST_C },
    );

    const response = await makeApp().inject({
      method: 'POST',
      url: '/matching/swipes',
      headers: authHeaders(),
      payload: { targetUserId: USER_A, decision: SwipeDecision.YES },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /share at least one profile interest/);
    assert.equal(state.calls.swipeUpserts.length, 0);
  });

  it('creates group-seeking rows with deduped interests', async () => {
    state.groupSeekings = [];

    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/group-seekings',
      headers: authHeaders(),
      payload: {
        targetGroupSize: 4,
        interestIds: [INTEREST_A, INTEREST_A, INTEREST_B],
      },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().seeking.targetGroupSize, 4);
    assert.deepEqual(
      response.json().seeking.interests.map((i: { id: string }) => i.id),
      [INTEREST_A, INTEREST_B],
    );
  });

  it('enforces a maximum of ten group seekings per user', async () => {
    state.groupSeekings = Array.from({ length: 10 }, (_, i) => ({
      id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      userId: ME,
      targetGroupSize: 3,
      interestIds: [INTEREST_A],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/group-seekings',
      headers: authHeaders(),
      payload: { targetGroupSize: 3, interestIds: [INTEREST_A] },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /at most 10/);
  });

  it('creates a formation proposal using weighted group-seeking compatibility', async () => {
    state.groupSeekings[0].targetGroupSize = 2;
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 10 },
      { userId: ME, interestId: INTEREST_B, weight: 1 },
      { userId: USER_A, interestId: INTEREST_A, weight: 1 },
      { userId: USER_A, interestId: INTEREST_B, weight: 1 },
      { userId: USER_B, interestId: INTEREST_A, weight: 10 },
      { userId: USER_C, interestId: INTEREST_C, weight: 10 },
    );
    state.swipes.push(
      { swiperId: ME, targetUserId: USER_A, decision: SwipeDecision.YES },
      { swiperId: USER_A, targetUserId: ME, decision: SwipeDecision.YES },
      { swiperId: ME, targetUserId: USER_B, decision: SwipeDecision.YES },
      { swiperId: USER_B, targetUserId: ME, decision: SwipeDecision.YES },
      { swiperId: ME, targetUserId: USER_C, decision: SwipeDecision.YES },
      { swiperId: USER_C, targetUserId: ME, decision: SwipeDecision.YES },
    );
    state.groupSeekings.push(
      {
        id: '20000000-0000-4000-8000-000000000002',
        userId: USER_A,
        targetGroupSize: 2,
        interestIds: [INTEREST_A, INTEREST_B],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '20000000-0000-4000-8000-000000000003',
        userId: USER_B,
        targetGroupSize: 2,
        interestIds: [INTEREST_A],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '20000000-0000-4000-8000-000000000004',
        userId: USER_C,
        targetGroupSize: 2,
        interestIds: [INTEREST_C],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const response = await makeApp().inject({
      method: 'POST',
      url: '/matching/formation/run',
      headers: authHeaders(),
      payload: { userGroupSeekingId: SEEKING_ID },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { proposalId: PROPOSAL_ID, reused: false });
    assert.deepEqual(
      state.formationInvites.map(inv => [inv.userId, inv.status]),
      [
        [ME, FormationInviteStatus.ACCEPTED],
        [USER_B, FormationInviteStatus.PENDING],
      ],
    );
  });

  it('does not offer a group unless every proposed member mutually swiped yes on every other member', async () => {
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 10 },
      { userId: USER_A, interestId: INTEREST_A, weight: 10 },
      { userId: USER_B, interestId: INTEREST_A, weight: 10 },
    );
    state.swipes.push(
      { swiperId: ME, targetUserId: USER_A, decision: SwipeDecision.YES },
      { swiperId: USER_A, targetUserId: ME, decision: SwipeDecision.YES },
      { swiperId: ME, targetUserId: USER_B, decision: SwipeDecision.YES },
      { swiperId: USER_B, targetUserId: ME, decision: SwipeDecision.YES },
    );
    state.groupSeekings.push(
      {
        id: '20000000-0000-4000-8000-000000000002',
        userId: USER_A,
        targetGroupSize: 3,
        interestIds: [INTEREST_A],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '20000000-0000-4000-8000-000000000003',
        userId: USER_B,
        targetGroupSize: 3,
        interestIds: [INTEREST_A],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const response = await makeApp().inject({
      method: 'POST',
      url: '/matching/formation/run',
      headers: authHeaders(),
      payload: { userGroupSeekingId: SEEKING_ID },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /every proposed group member/);
    assert.equal(state.formationProposals.length, 0);
  });

  it('runs group formation checks after a yes swipe', async () => {
    state.groupSeekings[0].targetGroupSize = 2;
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 10 },
      { userId: USER_A, interestId: INTEREST_A, weight: 10 },
    );
    state.swipes.push({ swiperId: USER_A, targetUserId: ME, decision: SwipeDecision.YES });
    state.groupSeekings.push({
      id: '20000000-0000-4000-8000-000000000002',
      userId: USER_A,
      targetGroupSize: 2,
      interestIds: [INTEREST_A],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'POST',
      url: '/matching/swipes',
      headers: authHeaders(),
      payload: { targetUserId: USER_A, decision: SwipeDecision.YES },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ok, true);
    assert.equal(state.formationProposals.length, 2);
    assert.deepEqual(
      state.formationInvites.slice(0, 2).map(inv => [inv.userId, inv.status]),
      [
        [ME, FormationInviteStatus.ACCEPTED],
        [USER_A, FormationInviteStatus.PENDING],
      ],
    );
  });

  it('accepting the last pending invite fulfills the proposal and creates a real group', async () => {
    state.formationProposals.push({
      id: PROPOSAL_ID,
      userGroupSeekingId: SEEKING_ID,
      status: GroupFormationStatus.OPEN,
      formedGroupId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    state.formationInvites.push(
      {
        id: '40000000-0000-4000-8000-000000000010',
        proposalId: PROPOSAL_ID,
        userId: USER_A,
        status: FormationInviteStatus.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: INVITE_ID,
        proposalId: PROPOSAL_ID,
        userId: ME,
        status: FormationInviteStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '40000000-0000-4000-8000-000000000011',
        proposalId: PROPOSAL_ID,
        userId: USER_B,
        status: FormationInviteStatus.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const response = await makeApp().inject({
      method: 'POST',
      url: `/matching/formation/proposals/${PROPOSAL_ID}/invites/respond`,
      headers: authHeaders(),
      payload: { accept: true },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(state.formationProposals[0].status, GroupFormationStatus.FULFILLED);
    assert.equal(state.groups.length, 1);
    assert.deepEqual(state.groups[0].memberIds.sort(), [ME, USER_A, USER_B].sort());

    // Once >=2 users accept, a proposal chat should exist and include all accepted members.
    assert.equal(state.groupChats.length, 1);
    assert.equal(state.groupChats[0]?.proposalId, PROPOSAL_ID);
    assert.equal(state.groupChats[0]?.groupId, state.groups[0]?.id);
    assert.deepEqual(
      state.groupChatMembers
        .filter(m => m.chatId === state.groupChats[0]?.id)
        .map(m => m.userId)
        .sort(),
      [ME, USER_A, USER_B].sort(),
    );
  });

  it('returns dashboard sections for seekings and pending formations', async () => {
    state.formationProposals.push({
      id: PROPOSAL_ID,
      userGroupSeekingId: SEEKING_ID,
      status: GroupFormationStatus.OPEN,
      formedGroupId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    state.formationInvites.push({
      id: INVITE_ID,
      proposalId: PROPOSAL_ID,
      userId: ME,
      status: FormationInviteStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'GET',
      url: '/me/matching/dashboard',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().groupSeekings.length, 1);
    assert.equal(response.json().invitesPendingMyAnswer.length, 1);
    assert.equal(response.json().invitesPendingMyAnswer[0].proposal.id, PROPOSAL_ID);
  });
});

describe('groups API', () => {
  it('returns only my joined groups with member count and future chat path', async () => {
    state.groups.push({
      id: '50000000-0000-4000-8000-000000000001',
      slug: 'board games',
      name: 'Board Games',
      createdById: USER_A,
      memberIds: [ME, USER_A, USER_B],
    });
    state.groupMemberships.push({
      groupId: '50000000-0000-4000-8000-000000000001',
      userId: ME,
      role: GroupRole.MEMBER,
      joinedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'GET',
      url: '/me/groups',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().groups, [
      {
        id: '50000000-0000-4000-8000-000000000001',
        slug: 'board games',
        name: 'Board Games',
        memberCount: 3,
        myRole: GroupRole.MEMBER,
        chatPath: '/groups/board%20games/chat',
      },
    ]);
  });
});
