import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';
import {
  FormationInviteStatus,
  GroupFormationStatus,
  GroupRole,
  GroupSource,
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
  bio?: string | null;
  supabaseAuthId?: string | null;
};

type DbUserPhoto = {
  id: string;
  userId: string;
  url: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
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
    source: GroupSource;
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
  userPhotos: DbUserPhoto[];
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
      { id: ME, email: 'me@example.com', username: 'me', displayName: 'Me', supabaseAuthId: ME },
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
    userPhotos: [],
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
      // Mirror Prisma's behaviour: `findUnique` looks up by exactly one of the
      // provided unique fields. Using a naive OR across all three would let
      // a `supabaseAuthId: undefined` lookup accidentally match the first
      // user whose own supabaseAuthId is also undefined.
      state.users.find(u => {
        if (where.id !== undefined) return u.id === where.id;
        if (where.email !== undefined) return u.email === where.email;
        if (where.supabaseAuthId !== undefined) return u.supabaseAuthId === where.supabaseAuthId;
        return false;
      }) ?? null,
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      state.users
        .filter(u => where.id.in.includes(u.id))
        .map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          bio: u.bio ?? null,
        })),
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
    findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
      state.interests.filter(i => where.id.in.includes(i.id)),
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
          if (where.userId && typeof where.userId === 'object' && 'notIn' in where.userId) {
            if ((where.userId.notIn as string[]).includes(row.userId)) return false;
          }
          if (where.targetGroupSize && typeof where.targetGroupSize === 'number') {
            if (row.targetGroupSize !== where.targetGroupSize) return false;
          }
          if (where.targetGroupSize && typeof where.targetGroupSize === 'object' && 'in' in where.targetGroupSize) {
            if (!(where.targetGroupSize.in as number[]).includes(row.targetGroupSize)) return false;
          }
          // `proposals: { none: { status: FULFILLED } }` — used to filter out
          // seekings whose proposal has already produced a group.
          if (where.proposals && typeof where.proposals === 'object' && 'none' in where.proposals) {
            const noneFilter = (where.proposals as { none: { status?: GroupFormationStatus } }).none;
            const proposalsForSeeking = state.formationProposals.filter(
              p => p.userGroupSeekingId === row.id,
            );
            const offenders = noneFilter.status
              ? proposalsForSeeking.filter(p => p.status === noneFilter.status)
              : proposalsForSeeking;
            if (offenders.length > 0) return false;
          }
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
    findMany: async (args: {
      where?: {
        source?: GroupSource;
        members?: { every?: { userId?: { in?: string[] } } };
      };
    }) => {
      const where = args.where ?? {};
      const everyIds = where.members?.every?.userId?.in;
      return state.groups
        .filter(g => {
          if (where.source !== undefined && (g as { source?: GroupSource }).source !== where.source) {
            return false;
          }
          if (everyIds && !g.memberIds.every(uid => everyIds.includes(uid))) return false;
          return true;
        })
        .map(g => ({ id: g.id, _count: { members: g.memberIds.length } }));
    },
    create: async ({ data }: { data: { slug: string; name: string; createdById?: string; source?: GroupSource; members: { create: { userId: string; role: GroupRole }[] } } }) => {
      state.calls.groupsCreated.push(data);
      const row = {
        id: `50000000-0000-4000-8000-${String(state.groups.length + 100).padStart(12, '0')}`,
        slug: data.slug,
        name: data.name,
        createdById: data.createdById ?? '',
        source: data.source ?? GroupSource.USER_CREATED,
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
    findUnique: async ({ where }: { where: { groupId?: string; proposalId?: string } }) => {
      if (where.groupId !== undefined) {
        return state.groupChats.find(c => c.groupId === where.groupId) ?? null;
      }
      if (where.proposalId !== undefined) {
        return state.groupChats.find(c => c.proposalId === where.proposalId) ?? null;
      }
      return null;
    },
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
  userPhoto: {
    findMany: async ({
      where,
      orderBy,
    }: {
      where?: { userId?: string | { in: string[] } };
      orderBy?: { position?: 'asc' | 'desc' };
    }) => {
      let rows = state.userPhotos.slice();
      if (where?.userId) {
        if (typeof where.userId === 'string') {
          const target = where.userId;
          rows = rows.filter(p => p.userId === target);
        } else if ('in' in where.userId) {
          const ids = where.userId.in;
          rows = rows.filter(p => ids.includes(p.userId));
        }
      }
      if (orderBy?.position) {
        const dir = orderBy.position === 'asc' ? 1 : -1;
        rows = rows.sort((a, b) => (a.position - b.position) * dir);
      }
      return rows;
    },
    findFirst: async ({
      where,
      orderBy,
    }: {
      where: { userId?: string; id?: string };
      orderBy?: { position?: 'asc' | 'desc' };
    }) => {
      let rows = state.userPhotos.slice();
      if (where.userId) rows = rows.filter(p => p.userId === where.userId);
      if (where.id) rows = rows.filter(p => p.id === where.id);
      if (orderBy?.position) {
        const dir = orderBy.position === 'asc' ? 1 : -1;
        rows = rows.sort((a, b) => (a.position - b.position) * dir);
      }
      return rows[0] ?? null;
    },
    count: async ({ where }: { where: { userId: string } }) =>
      state.userPhotos.filter(p => p.userId === where.userId).length,
    create: async ({ data }: { data: { userId: string; url: string; position: number } }) => {
      const dupe = state.userPhotos.find(
        p => p.userId === data.userId && p.position === data.position,
      );
      if (dupe) {
        const err = new Error('Unique constraint failed') as Error & {
          code: string;
          meta: { target: string[] };
        };
        err.code = 'P2002';
        err.meta = { target: ['userId', 'position'] };
        throw err;
      }
      const row: DbUserPhoto = {
        id: `70000000-0000-4000-8000-${String(state.userPhotos.length + 1).padStart(12, '0')}`,
        userId: data.userId,
        url: data.url,
        position: data.position,
        createdAt: new Date('2026-05-19T23:00:00.000Z'),
        updatedAt: new Date('2026-05-19T23:00:00.000Z'),
      };
      state.userPhotos.push(row);
      return row;
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: { url?: string; position?: number };
    }) => {
      const row = state.userPhotos.find(p => p.id === where.id);
      if (!row) throw new Error(`Missing photo ${where.id}`);
      if (data.url !== undefined) row.url = data.url;
      if (data.position !== undefined) row.position = data.position;
      row.updatedAt = new Date('2026-05-19T23:30:00.000Z');
      return row;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const before = state.userPhotos.length;
      state.userPhotos = state.userPhotos.filter(p => p.id !== where.id);
      if (state.userPhotos.length === before) throw new Error(`Missing photo ${where.id}`);
    },
  },
  $transaction: async <T>(fn: (tx: typeof prisma) => Promise<T>) => fn(prisma),
};

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@127.0.0.1:5432/uconnect_test';

const { setPrismaClientForTests } = await import('../src/db.js');
const { registerMatchingRoutes } = await import('../src/routes/matching.js');
const { registerGroupsRoutes } = await import('../src/routes/groups.js');
const { registerProfileRoutes } = await import('../src/routes/profile.js');

setPrismaClientForTests(prisma as never);

function authHeaders() {
  return { authorization: 'Bearer good-token' };
}

const SUPABASE_URL = 'https://test-project.supabase.co';

type StorageRemoveCall = { bucket: string; paths: string[] };
const storageRemoveCalls: StorageRemoveCall[] = [];

function supabaseAdmin() {
  return {
    auth: {
      getUser: async (token: string) => ({
        data: token === 'good-token' ? { user: { id: ME, email: 'me@example.com' } } : { user: null },
        error: token === 'good-token' ? null : new Error('bad token'),
      }),
    },
    storage: {
      from: (bucket: string) => ({
        remove: async (paths: string[]) => {
          storageRemoveCalls.push({ bucket, paths });
          return { data: paths.map(p => ({ name: p })), error: null };
        },
      }),
    },
  };
}

function makeApp(opts: { supabaseUrl?: string | null } = {}) {
  const app = Fastify({ logger: false });
  const supabaseUrl = opts.supabaseUrl === undefined ? SUPABASE_URL : opts.supabaseUrl;
  registerMatchingRoutes(app, { supabaseAdmin: supabaseAdmin() as never });
  registerGroupsRoutes(app, { supabaseAdmin: supabaseAdmin() as never });
  registerProfileRoutes(app, { supabaseAdmin: supabaseAdmin() as never, supabaseUrl });
  return app;
}

function userPhotosUrl(authId: string, file: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/user-photos/${authId}/${file}`;
}

beforeEach(() => {
  resetState();
  storageRemoveCalls.length = 0;
});

describe('matching APIs', () => {
  it('returns NO_SEEKINGS when the signed-in user has no group seekings', async () => {
    state.groupSeekings = [];
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 5 },
      { userId: USER_A, interestId: INTEREST_A, weight: 9 },
    );

    const response = await makeApp().inject({
      method: 'GET',
      url: '/matching/discovery',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().reason, 'NO_SEEKINGS');
    assert.deepEqual(response.json().users, []);
  });

  it('ranks only users with a same-size group seeking that shares at least one interest with mine', async () => {
    // ME already has SEEKING_ID with targetGroupSize=3, interests A+B.
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
    // USER_A, USER_B, USER_C all share at least one seeking interest with ME via a same-size (3) seeking.
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
        interestIds: [INTEREST_A, INTEREST_B],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '20000000-0000-4000-8000-000000000004',
        userId: USER_C,
        targetGroupSize: 3,
        interestIds: [INTEREST_B],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // USER_D has a seeking but the size doesn't match, so they must be excluded.
      {
        id: '20000000-0000-4000-8000-000000000005',
        userId: USER_D,
        targetGroupSize: 4,
        interestIds: [INTEREST_A, INTEREST_B],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const response = await makeApp().inject({
      method: 'GET',
      url: '/matching/discovery',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().reason, 'COMPATIBLE_SEEKINGS');
    assert.deepEqual(
      response
        .json()
        .users.map((u: { id: string; sharedInterestCount: number; matchScore: number; matchedGroupSize: number | null }) => [
          u.id,
          u.sharedInterestCount,
          Math.round(u.matchScore * 1000) / 1000,
          u.matchedGroupSize,
        ]),
      [
        [USER_B, 2, 0.996, 3],
        [USER_A, 1, 0.6, 3],
        [USER_C, 1, 0.566, 3],
      ],
    );
  });

  it('falls back to profile-interest matching when no peer seekings line up', async () => {
    // ME has seekings but no other user has a matching-size + interest-overlap seeking.
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 3 },
      { userId: ME, interestId: INTEREST_B, weight: 4 },
      { userId: USER_A, interestId: INTEREST_A, weight: 10 },
      { userId: USER_B, interestId: INTEREST_B, weight: 9 },
    );

    const response = await makeApp().inject({
      method: 'GET',
      url: '/matching/discovery',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().reason, 'PROFILE_FALLBACK');
    const users = response.json().users as Array<{ id: string; matchedGroupSize: number | null }>;
    assert.deepEqual(
      users.map(u => [u.id, u.matchedGroupSize]).sort(),
      [
        [USER_A, null],
        [USER_B, null],
      ].sort(),
    );
  });

  it('excludes users I have already swiped on from discovery', async () => {
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 5 },
      { userId: USER_A, interestId: INTEREST_A, weight: 8 },
      { userId: USER_B, interestId: INTEREST_A, weight: 8 },
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
    state.swipes.push({ swiperId: ME, targetUserId: USER_A, decision: SwipeDecision.NO });

    const response = await makeApp().inject({
      method: 'GET',
      url: '/matching/discovery',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      (response.json().users as { id: string }[]).map(u => u.id),
      [USER_B],
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

  it('reuses a single group when two opposing proposals fulfill for the same member set', async () => {
    // Scenario: A and B each own a size-2 group seeking on the same interest.
    // Mutual yes spawns proposal_a (A=ACCEPTED, B=PENDING) and proposal_b
    // (B=ACCEPTED, A=PENDING). A accepts proposal_b first → group formed.
    // B accepts proposal_a second → must reuse the same group instead of
    // creating a duplicate.
    const SEEKING_A = '20000000-0000-4000-8000-0000000000aa';
    const SEEKING_B = '20000000-0000-4000-8000-0000000000bb';
    const PROPOSAL_A = '30000000-0000-4000-8000-0000000000aa';
    const PROPOSAL_B = '30000000-0000-4000-8000-0000000000bb';

    // Replace the default ME seeking so only A/B's seekings exist under test.
    state.groupSeekings = [
      {
        id: SEEKING_A,
        userId: USER_A,
        targetGroupSize: 2,
        interestIds: [INTEREST_A],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: SEEKING_B,
        userId: USER_B,
        targetGroupSize: 2,
        interestIds: [INTEREST_A],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    state.formationProposals.push(
      {
        id: PROPOSAL_A,
        userGroupSeekingId: SEEKING_A,
        status: GroupFormationStatus.OPEN,
        formedGroupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: PROPOSAL_B,
        userGroupSeekingId: SEEKING_B,
        status: GroupFormationStatus.OPEN,
        formedGroupId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    state.formationInvites.push(
      // proposal_a: A accepted (seed), B pending
      {
        id: '40000000-0000-4000-8000-0000000000a1',
        proposalId: PROPOSAL_A,
        userId: USER_A,
        status: FormationInviteStatus.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '40000000-0000-4000-8000-0000000000a2',
        proposalId: PROPOSAL_A,
        userId: USER_B,
        status: FormationInviteStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      // proposal_b: B accepted (seed), A pending
      {
        id: '40000000-0000-4000-8000-0000000000b1',
        proposalId: PROPOSAL_B,
        userId: USER_B,
        status: FormationInviteStatus.ACCEPTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '40000000-0000-4000-8000-0000000000b2',
        proposalId: PROPOSAL_B,
        userId: USER_A,
        status: FormationInviteStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    // Use a per-test mock whose identity is swapped between steps via a token
    // (`user-a` vs `user-b`). Registering routes against a fresh Fastify
    // instance per step also works, but a shared mock keeps the test compact.
    const dualSupabase = {
      auth: {
        getUser: async (token: string) => {
          if (token === 'user-a') return { data: { user: { id: USER_A, email: 'a2@example.com' } }, error: null };
          if (token === 'user-b') return { data: { user: { id: USER_B, email: 'b2@example.com' } }, error: null };
          return { data: { user: null }, error: new Error('bad token') };
        },
      },
    } as never;

    const app = Fastify({ logger: false });
    registerMatchingRoutes(app, { supabaseAdmin: dualSupabase });

    // Step 1: USER_A accepts proposal_b — group is formed.
    let resp = await app.inject({
      method: 'POST',
      url: `/matching/formation/proposals/${PROPOSAL_B}/invites/respond`,
      headers: { authorization: 'Bearer user-a' },
      payload: { accept: true },
    });
    assert.equal(resp.statusCode, 200);
    assert.equal(state.groups.length, 1, 'first acceptance creates exactly one group');

    // Step 2: USER_B accepts proposal_a — must REUSE the group.
    resp = await app.inject({
      method: 'POST',
      url: `/matching/formation/proposals/${PROPOSAL_A}/invites/respond`,
      headers: { authorization: 'Bearer user-b' },
      payload: { accept: true },
    });
    assert.equal(resp.statusCode, 200);
    assert.equal(state.groups.length, 1, 'second acceptance must NOT create a second group');

    // Both proposals end FULFILLED pointing at the same group.
    const propA = state.formationProposals.find(p => p.id === PROPOSAL_A);
    const propB = state.formationProposals.find(p => p.id === PROPOSAL_B);
    assert.equal(propA?.status, GroupFormationStatus.FULFILLED);
    assert.equal(propB?.status, GroupFormationStatus.FULFILLED);
    assert.equal(propA?.formedGroupId, state.groups[0]?.id);
    assert.equal(propB?.formedGroupId, state.groups[0]?.id);

    // Exactly one chat, both users members of it (no duplicate chat for the
    // second proposal even though that proposal now points at the same group).
    assert.equal(state.groupChats.length, 1, 'second proposal reuses the existing chat');
    assert.deepEqual(
      state.groupChatMembers
        .filter(m => m.chatId === state.groupChats[0]?.id)
        .map(m => m.userId)
        .sort(),
      [USER_A, USER_B].sort(),
    );
  });

  it('hides seekings from the dashboard once their proposal has been fulfilled', async () => {
    // ME's default seeking from `resetState()` is SEEKING_ID. Mark it fulfilled.
    state.formationProposals.push({
      id: PROPOSAL_ID,
      userGroupSeekingId: SEEKING_ID,
      status: GroupFormationStatus.FULFILLED,
      formedGroupId: '50000000-0000-4000-8000-000000000999',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'GET',
      url: '/me/matching/dashboard',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      response.json().groupSeekings,
      [],
      'fulfilled seekings should not appear in the active list',
    );
  });

  it('surfaces bio and photo URLs on discovery cards', async () => {
    state.users[1] = { ...state.users[1], bio: 'Coffee, books, long walks.' };
    state.userPhotos.push(
      {
        id: '70000000-0000-4000-8000-000000000010',
        userId: USER_A,
        url: 'https://cdn.example.com/a/main.jpg',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '70000000-0000-4000-8000-000000000011',
        userId: USER_A,
        url: 'https://cdn.example.com/a/second.jpg',
        position: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    state.userInterests.push(
      { userId: ME, interestId: INTEREST_A, weight: 5 },
      { userId: USER_A, interestId: INTEREST_A, weight: 8 },
    );
    state.groupSeekings.push({
      id: '20000000-0000-4000-8000-000000000099',
      userId: USER_A,
      targetGroupSize: 3,
      interestIds: [INTEREST_A],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'GET',
      url: '/matching/discovery',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    const user = (response.json().users as Array<{
      id: string;
      bio: string | null;
      avatarUrl: string | null;
      photos: { url: string; position: number }[];
    }>).find(u => u.id === USER_A);
    assert.ok(user, 'USER_A should be in the discovery result');
    assert.equal(user.bio, 'Coffee, books, long walks.');
    assert.equal(user.avatarUrl, 'https://cdn.example.com/a/main.jpg');
    assert.deepEqual(
      user.photos.map(p => [p.position, p.url]),
      [
        [0, 'https://cdn.example.com/a/main.jpg'],
        [1, 'https://cdn.example.com/a/second.jpg'],
      ],
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

describe('photo deck APIs', () => {
  it('lists my photos ordered by position', async () => {
    state.userPhotos.push(
      {
        id: '70000000-0000-4000-8000-000000000001',
        userId: ME,
        url: 'https://cdn.example.com/me/2.jpg',
        position: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '70000000-0000-4000-8000-000000000002',
        userId: ME,
        url: 'https://cdn.example.com/me/0.jpg',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '70000000-0000-4000-8000-000000000003',
        userId: ME,
        url: 'https://cdn.example.com/me/1.jpg',
        position: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const response = await makeApp().inject({
      method: 'GET',
      url: '/me/photos',
      headers: authHeaders(),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      (response.json().photos as { position: number }[]).map(p => p.position),
      [0, 1, 2],
    );
  });

  it('creates a photo and auto-positions it after existing photos', async () => {
    state.userPhotos.push({
      id: '70000000-0000-4000-8000-000000000050',
      userId: ME,
      url: userPhotosUrl(ME, 'old.jpg'),
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: userPhotosUrl(ME, 'new.jpg') },
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.json().photo.position, 1);
    assert.equal(state.userPhotos.length, 2);
  });

  it('rejects creating more than the per-user photo cap', async () => {
    for (let i = 0; i < 6; i += 1) {
      state.userPhotos.push({
        id: `70000000-0000-4000-8000-${String(i + 100).padStart(12, '0')}`,
        userId: ME,
        url: userPhotosUrl(ME, `${i}.jpg`),
        position: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: userPhotosUrl(ME, 'extra.jpg') },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /at most 6 photos/);
  });

  it('rejects malformed photo URL bodies', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: 'not-a-url' },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, 'Invalid body');
  });

  it('rejects photo URLs that do not point at the configured Supabase host', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: 'https://attacker.example.com/storage/v1/object/public/user-photos/' + ME + '/x.jpg' },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /Supabase Storage/);
  });

  it('rejects photo URLs that live in another user\'s storage folder', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: userPhotosUrl(USER_A, 'stolen.jpg') },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /your own storage folder/);
  });

  it('rejects photo URLs that reference a different bucket', async () => {
    const response = await makeApp().inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${ME}/x.jpg` },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /user-photos bucket/);
  });

  it('skips URL validation when supabaseUrl is not configured (legacy mode)', async () => {
    const response = await makeApp({ supabaseUrl: null }).inject({
      method: 'POST',
      url: '/me/photos',
      headers: authHeaders(),
      payload: { url: 'https://cdn.example.com/me/new.jpg' },
    });

    assert.equal(response.statusCode, 201);
  });

  it('deletes a photo I own, drops the backing storage object, and returns 404 for one I do not', async () => {
    state.userPhotos.push({
      id: '70000000-0000-4000-8000-000000000200',
      userId: ME,
      url: userPhotosUrl(ME, 'x.jpg'),
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    state.userPhotos.push({
      id: '70000000-0000-4000-8000-000000000201',
      userId: USER_A,
      url: userPhotosUrl(USER_A, 'x.jpg'),
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const okResp = await makeApp().inject({
      method: 'DELETE',
      url: '/me/photos/70000000-0000-4000-8000-000000000200',
      headers: authHeaders(),
    });
    assert.equal(okResp.statusCode, 204);
    assert.equal(state.userPhotos.length, 1);
    assert.deepEqual(storageRemoveCalls, [
      { bucket: 'user-photos', paths: [`${ME}/x.jpg`] },
    ]);

    const notMineResp = await makeApp().inject({
      method: 'DELETE',
      url: '/me/photos/70000000-0000-4000-8000-000000000201',
      headers: authHeaders(),
    });
    assert.equal(notMineResp.statusCode, 404);
    assert.equal(storageRemoveCalls.length, 1, 'no storage call for a 404 delete');
  });

  it('reorders my photos according to the provided id list', async () => {
    state.userPhotos.push(
      {
        id: '70000000-0000-4000-8000-000000000300',
        userId: ME,
        url: 'https://cdn.example.com/me/a.jpg',
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '70000000-0000-4000-8000-000000000301',
        userId: ME,
        url: 'https://cdn.example.com/me/b.jpg',
        position: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '70000000-0000-4000-8000-000000000302',
        userId: ME,
        url: 'https://cdn.example.com/me/c.jpg',
        position: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const response = await makeApp().inject({
      method: 'PUT',
      url: '/me/photos/order',
      headers: authHeaders(),
      payload: {
        photoIds: [
          '70000000-0000-4000-8000-000000000302',
          '70000000-0000-4000-8000-000000000300',
          '70000000-0000-4000-8000-000000000301',
        ],
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(
      (response.json().photos as { id: string; position: number }[]).map(p => [p.id, p.position]),
      [
        ['70000000-0000-4000-8000-000000000302', 0],
        ['70000000-0000-4000-8000-000000000300', 1],
        ['70000000-0000-4000-8000-000000000301', 2],
      ],
    );
  });

  it('rejects reorder payloads that do not match my current photos', async () => {
    state.userPhotos.push({
      id: '70000000-0000-4000-8000-000000000400',
      userId: ME,
      url: 'https://cdn.example.com/me/a.jpg',
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await makeApp().inject({
      method: 'PUT',
      url: '/me/photos/order',
      headers: authHeaders(),
      payload: {
        photoIds: [
          '70000000-0000-4000-8000-000000000400',
          '70000000-0000-4000-8000-000000000401',
        ],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /exactly your current photos/);
  });
});

describe('groups API', () => {
  it('returns only my joined groups with member count and future chat path', async () => {
    state.groups.push({
      id: '50000000-0000-4000-8000-000000000001',
      slug: 'board games',
      name: 'Board Games',
      createdById: USER_A,
      source: GroupSource.USER_CREATED,
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
