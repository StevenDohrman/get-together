import { prismaClient as prisma } from '../db.js';
import type { Prisma } from '@prisma/client';
import { FormationInviteStatus, GroupFormationStatus } from '@prisma/client';
import { getMutualYesUserIds } from './matchingDiscovery.js';

export const publicInterestFieldSelect = { id: true, slug: true, name: true } as const;

const interestSelect = publicInterestFieldSelect;

export const formationProposalInclude = {
  userGroupSeeking: {
    include: {
      interests: {
        include: { interest: { select: interestSelect } },
      },
    },
  },
  invites: {
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  },
} satisfies Prisma.GroupFormationProposalInclude;

type ProposalRow = Prisma.GroupFormationProposalGetPayload<{
  include: typeof formationProposalInclude;
}>;

export type GroupSeekingDto = {
  id: string;
  targetGroupSize: number;
  interests: { id: string; slug: string; name: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export type FormationProposalCardDto = {
  inviteId: string | null;
  myStatus: FormationInviteStatus | null;
  proposal: {
    id: string;
    status: GroupFormationStatus;
    formedGroupId: string | null;
    seedUserId: string;
    targetGroupSize: number;
    groupInterests: { id: string; slug: string; name: string }[];
    members: {
      userId: string;
      status: FormationInviteStatus;
      username: string | null;
      displayName: string | null;
    }[];
  };
};

function proposalPayload(p: ProposalRow): FormationProposalCardDto['proposal'] {
  return {
    id: p.id,
    status: p.status,
    formedGroupId: p.formedGroupId,
    seedUserId: p.userGroupSeeking.userId,
    targetGroupSize: p.userGroupSeeking.targetGroupSize,
    groupInterests: p.userGroupSeeking.interests.map(i => i.interest),
    members: p.invites.map(m => ({
      userId: m.userId,
      status: m.status,
      username: m.user.username,
      displayName: m.user.displayName,
    })),
  };
}

type InviteWithProposalRow = Prisma.GroupFormationInviteGetPayload<{
  include: { proposal: { include: typeof formationProposalInclude } };
}>;

export function formationCardFromInvite(inv: InviteWithProposalRow): FormationProposalCardDto {
  return {
    inviteId: inv.id,
    myStatus: inv.status,
    proposal: proposalPayload(inv.proposal),
  };
}

export function formationCardFromProposalForUser(
  proposal: ProposalRow,
  appUserId: string,
): FormationProposalCardDto {
  const myInvite = proposal.invites.find(i => i.userId === appUserId);
  return {
    inviteId: myInvite?.id ?? null,
    myStatus: myInvite?.status ?? null,
    proposal: proposalPayload(proposal),
  };
}

export async function listSerializedGroupSeekings(appUserId: string): Promise<GroupSeekingDto[]> {
  const list = await prisma.userGroupSeeking.findMany({
    where: { userId: appUserId },
    orderBy: { createdAt: 'asc' },
    include: {
      interests: {
        include: { interest: { select: interestSelect } },
      },
    },
  });

  return list.map(s => ({
    id: s.id,
    targetGroupSize: s.targetGroupSize,
    interests: s.interests.map(i => i.interest),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export async function validateInterestIdsAllExist(interestIds: string[]): Promise<boolean> {
  const unique = [...new Set(interestIds)];
  if (unique.length === 0) return false;
  const n = await prisma.interest.count({ where: { id: { in: unique } } });
  return n === unique.length;
}

export async function listMyFormationInviteCards(appUserId: string): Promise<FormationProposalCardDto[]> {
  const invites = await prisma.groupFormationInvite.findMany({
    where: { userId: appUserId },
    orderBy: { createdAt: 'desc' },
    include: { proposal: { include: formationProposalInclude } },
  });

  return invites.map(inv => formationCardFromInvite(inv));
}

export async function loadMatchingDashboard(appUserId: string) {
  const [groupSeekings, openInvites, openFromMySeekings, mutualYesIds] = await Promise.all([
    listSerializedGroupSeekings(appUserId),
    prisma.groupFormationInvite.findMany({
      where: {
        userId: appUserId,
        proposal: { status: GroupFormationStatus.OPEN },
      },
      orderBy: { createdAt: 'desc' },
      include: { proposal: { include: formationProposalInclude } },
    }),
    prisma.groupFormationProposal.findMany({
      where: {
        userGroupSeeking: { is: { userId: appUserId } },
        status: GroupFormationStatus.OPEN,
      },
      orderBy: { createdAt: 'desc' },
      include: formationProposalInclude,
    }),
    getMutualYesUserIds(appUserId),
  ]);

  const invitesPendingMyAnswer = openInvites
    .filter(inv => inv.status === FormationInviteStatus.PENDING)
    .map(inv => formationCardFromInvite(inv));

  const openFormationsWaitingOnOthers = openInvites
    .filter(
      inv =>
        inv.status === FormationInviteStatus.ACCEPTED &&
        inv.proposal.userGroupSeeking.userId !== appUserId,
    )
    .map(inv => formationCardFromInvite(inv));

  const openFormationsFromMySeekings = openFromMySeekings.map(p => formationCardFromProposalForUser(p, appUserId));

  return {
    groupSeekings,
    invitesPendingMyAnswer,
    openFormationsFromMySeekings,
    openFormationsWaitingOnOthers,
    connectionsCount: mutualYesIds.length,
  };
}
