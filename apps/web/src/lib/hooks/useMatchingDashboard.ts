import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiJson } from '@/lib/api';

export type InterestRef = {
    id: string;
    slug: string;
    name: string;
};

export type GroupSeekingDto = {
    id: string;
    targetGroupSize: number;
    interests: InterestRef[];
    createdAt: string;
    updatedAt: string;
};

export type FormationInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
export type GroupFormationStatus = 'OPEN' | 'FULFILLED' | 'CANCELLED';

export type FormationMemberDto = {
    userId: string;
    status: FormationInviteStatus;
    username: string | null;
    displayName: string | null;
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
        groupInterests: InterestRef[];
        members: FormationMemberDto[];
    };
};

export type MatchingDashboard = {
    groupSeekings: GroupSeekingDto[];
    invitesPendingMyAnswer: FormationProposalCardDto[];
    openFormationsFromMySeekings: FormationProposalCardDto[];
    openFormationsWaitingOnOthers: FormationProposalCardDto[];
    connectionsCount: number;
};

type GroupSeekingCreateResponse = { seeking: GroupSeekingDto };

const EMPTY_DASHBOARD: MatchingDashboard = {
    groupSeekings: [],
    invitesPendingMyAnswer: [],
    openFormationsFromMySeekings: [],
    openFormationsWaitingOnOthers: [],
    connectionsCount: 0,
};

export function useMatchingDashboard() {
    const [data, setData] = useState<MatchingDashboard>(EMPTY_DASHBOARD);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await apiGet<MatchingDashboard>('/me/matching/dashboard');
            setData({
                groupSeekings: resp.groupSeekings ?? [],
                invitesPendingMyAnswer: resp.invitesPendingMyAnswer ?? [],
                openFormationsFromMySeekings: resp.openFormationsFromMySeekings ?? [],
                openFormationsWaitingOnOthers: resp.openFormationsWaitingOnOthers ?? [],
                connectionsCount: resp.connectionsCount ?? 0,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setData(EMPTY_DASHBOARD);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchDashboard();
    }, [fetchDashboard]);

    const createGroupSeeking = useCallback(
        async (input: { targetGroupSize: number; interestIds: string[] }) => {
            const resp = await apiJson<GroupSeekingCreateResponse>(
                '/me/group-seekings',
                'POST',
                input,
            );
            await fetchDashboard();
            return resp.seeking;
        },
        [fetchDashboard],
    );

    const updateGroupSeeking = useCallback(
        async (
            id: string,
            input: { targetGroupSize?: number; interestIds?: string[] },
        ) => {
            const resp = await apiJson<GroupSeekingCreateResponse>(
                `/me/group-seekings/${id}`,
                'PUT',
                input,
            );
            await fetchDashboard();
            return resp.seeking;
        },
        [fetchDashboard],
    );

    const deleteGroupSeeking = useCallback(
        async (id: string) => {
            await apiJson<unknown>(`/me/group-seekings/${id}`, 'DELETE');
            await fetchDashboard();
        },
        [fetchDashboard],
    );

    const runFormation = useCallback(
        async (userGroupSeekingId: string) => {
            const resp = await apiJson<{ proposalId: string; reused: boolean }>(
                '/matching/formation/run',
                'POST',
                { userGroupSeekingId },
            );
            await fetchDashboard();
            return resp;
        },
        [fetchDashboard],
    );

    const respondToInvite = useCallback(
        async (proposalId: string, accept: boolean) => {
            await apiJson<unknown>(
                `/matching/formation/proposals/${proposalId}/invites/respond`,
                'POST',
                { accept },
            );
            await fetchDashboard();
        },
        [fetchDashboard],
    );

    return {
        data,
        loading,
        error,
        refetch: fetchDashboard,
        createGroupSeeking,
        updateGroupSeeking,
        deleteGroupSeeking,
        runFormation,
        respondToInvite,
    } as const;
}
