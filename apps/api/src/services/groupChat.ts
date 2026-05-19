import { prismaClient as prisma } from '../db.js';
import { FormationInviteStatus } from '@prisma/client';

export type EnsureProposalChatResult = {
  chatId: string | null;
  addedUserIds: string[];
};

/**
 * Ensures a proposal-scoped chat exists once >=2 people have accepted.
 * Also keeps membership in sync with the set of ACCEPTED invites.
 */
export async function ensureProposalGroupChat(proposalId: string): Promise<EnsureProposalChatResult> {
  const proposal = await prisma.groupFormationProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      formedGroupId: true,
      invites: { select: { userId: true, status: true } },
    },
  });
  if (!proposal) return { chatId: null, addedUserIds: [] };

  const acceptedUserIds = proposal.invites
    .filter(i => i.status === FormationInviteStatus.ACCEPTED)
    .map(i => i.userId);

  if (acceptedUserIds.length < 2) {
    return { chatId: null, addedUserIds: [] };
  }

  const chat = await prisma.groupChat.upsert({
    where: { proposalId: proposal.id },
    create: {
      proposalId: proposal.id,
      ...(proposal.formedGroupId ? { groupId: proposal.formedGroupId } : {}),
    },
    update: {
      ...(proposal.formedGroupId ? { groupId: proposal.formedGroupId } : {}),
    },
    select: { id: true, groupId: true },
  });

  const existingMembers = await prisma.groupChatMember.findMany({
    where: { chatId: chat.id },
    select: { userId: true },
  });
  const existingSet = new Set(existingMembers.map(m => m.userId));

  const toAdd = acceptedUserIds.filter(uid => !existingSet.has(uid));
  if (toAdd.length > 0) {
    await prisma.groupChatMember.createMany({
      data: toAdd.map(userId => ({ chatId: chat.id, userId })),
      skipDuplicates: true,
    });
  }

  return { chatId: chat.id, addedUserIds: toAdd };
}

export async function isChatMember(chatId: string, userId: string): Promise<boolean> {
  const membership = await prisma.groupChatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
    select: { userId: true },
  });
  return membership !== null;
}
