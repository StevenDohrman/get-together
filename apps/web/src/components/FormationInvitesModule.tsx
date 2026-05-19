'use client';

import { useState } from 'react';
import SectionHeader from './SectionHeader';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import type { FormationProposalCardDto } from '@/lib/hooks/useMatchingDashboard';

type Props = {
    invitesPendingMyAnswer: FormationProposalCardDto[];
    openFormationsWaitingOnOthers: FormationProposalCardDto[];
    loading: boolean;
    error: string | null;
    onRespond: (proposalId: string, accept: boolean) => Promise<void>;
};

function InviteCard({
    card,
    onRespond,
}: {
    card: FormationProposalCardDto;
    onRespond: Props['onRespond'];
}) {
    const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const accepted = card.proposal.members.filter(m => m.status === 'ACCEPTED').length;
    const target = card.proposal.targetGroupSize;

    const handleRespond = async (accept: boolean) => {
        setBusy(accept ? 'accept' : 'decline');
        setError(null);
        try {
            await onRespond(card.proposal.id, accept);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to respond');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-3 rounded-lg border border-purple-500/30 bg-purple-950/20 p-5">
            <div className="flex items-center gap-2">
                <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                    Group invite
                </span>
                <span className="text-sm text-slate-300">
                    {accepted}/{target} accepted so far
                </span>
            </div>

            <p className="text-sm text-slate-200">
                You&apos;ve been invited to join a group forming around shared interests.
            </p>

            {card.proposal.groupInterests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {card.proposal.groupInterests.map(interest => (
                        <span
                            key={interest.id}
                            className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-200"
                        >
                            {interest.name}
                        </span>
                    ))}
                </div>
            ) : null}

            <div className="text-xs text-slate-400">
                {card.proposal.members
                    .map(m => m.displayName ?? m.username ?? 'Someone')
                    .join(', ')}
            </div>

            {error ? <ErrorMessage message={error} /> : null}

            <div className="flex items-center gap-2 pt-1">
                <button
                    type="button"
                    onClick={() => void handleRespond(true)}
                    disabled={busy !== null}
                    className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                    {busy === 'accept' ? 'Joining...' : 'Accept'}
                </button>
                <button
                    type="button"
                    onClick={() => void handleRespond(false)}
                    disabled={busy !== null}
                    className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                    {busy === 'decline' ? 'Declining...' : 'Decline'}
                </button>
            </div>
        </div>
    );
}

function WaitingCard({ card }: { card: FormationProposalCardDto }) {
    const accepted = card.proposal.members.filter(m => m.status === 'ACCEPTED').length;
    const target = card.proposal.targetGroupSize;
    const pending = card.proposal.members.filter(m => m.status === 'PENDING').length;

    return (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
                    Waiting on others
                </span>
                <span className="text-xs text-slate-400">
                    {accepted}/{target} accepted · {pending} pending
                </span>
            </div>
            {card.proposal.groupInterests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {card.proposal.groupInterests.map(interest => (
                        <span
                            key={interest.id}
                            className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
                        >
                            {interest.name}
                        </span>
                    ))}
                </div>
            ) : null}
            <p className="text-xs text-slate-500">
                The group will be officially created once everyone accepts.
            </p>
        </div>
    );
}

export default function FormationInvitesModule({
    invitesPendingMyAnswer,
    openFormationsWaitingOnOthers,
    loading,
    error,
    onRespond,
}: Props) {
    const hasInvites = invitesPendingMyAnswer.length > 0;
    const hasWaiting = openFormationsWaitingOnOthers.length > 0;

    if (loading) {
        return (
            <section>
                <SectionHeader title="Group invites" />
                <Loading className="mt-2" />
            </section>
        );
    }

    if (!hasInvites && !hasWaiting && !error) {
        return null;
    }

    return (
        <section className="space-y-4">
            <SectionHeader title="Group invites" />
            {error ? <ErrorMessage message={error} /> : null}

            {hasInvites ? (
                <div className="space-y-3">
                    {invitesPendingMyAnswer.map(card => (
                        <InviteCard
                            key={card.proposal.id}
                            card={card}
                            onRespond={onRespond}
                        />
                    ))}
                </div>
            ) : null}

            {hasWaiting ? (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-300">
                        Groups still forming
                    </h3>
                    {openFormationsWaitingOnOthers.map(card => (
                        <WaitingCard key={card.proposal.id} card={card} />
                    ))}
                </div>
            ) : null}
        </section>
    );
}
