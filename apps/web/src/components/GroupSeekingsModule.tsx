'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import SectionHeader from './SectionHeader';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import NewGroupSeekingForm from './NewGroupSeekingForm';
import type {
    FormationProposalCardDto,
    GroupSeekingDto,
} from '@/lib/hooks/useMatchingDashboard';

type SeekingCallbacks = {
    onCreate: (input: { targetGroupSize: number; interestIds: string[] }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onRunFormation: (userGroupSeekingId: string) => Promise<void>;
};

type Props = SeekingCallbacks & {
    seekings: GroupSeekingDto[];
    openFormationsFromMySeekings: FormationProposalCardDto[];
    loading: boolean;
    error: string | null;
};

const PALETTES = [
    {
        banner: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600',
        dot: 'bg-purple-400',
        icon: '🎯',
    },
    {
        banner: 'bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500',
        dot: 'bg-amber-400',
        icon: '🔥',
    },
    {
        banner: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600',
        dot: 'bg-emerald-400',
        icon: '🌱',
    },
    {
        banner: 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500',
        dot: 'bg-pink-400',
        icon: '💞',
    },
    {
        banner: 'bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600',
        dot: 'bg-sky-400',
        icon: '🧭',
    },
] as const;

function paletteFor(index: number) {
    return PALETTES[index % PALETTES.length];
}

type SeekingStatus =
    | { kind: 'discovering'; label: string; dotClass: string; chipClass: string }
    | { kind: 'forming'; label: string; dotClass: string; chipClass: string; accepted: number; target: number; pending: number };

function statusFor(
    seeking: GroupSeekingDto,
    matchingProposal: FormationProposalCardDto | null,
): SeekingStatus {
    if (!matchingProposal) {
        return {
            kind: 'discovering',
            label: 'Discovering',
            dotClass: 'bg-slate-400',
            chipClass: 'bg-slate-700 text-slate-200',
        };
    }
    const accepted = matchingProposal.proposal.members.filter(m => m.status === 'ACCEPTED').length;
    const pending = matchingProposal.proposal.members.filter(m => m.status === 'PENDING').length;
    return {
        kind: 'forming',
        label: `${accepted}/${seeking.targetGroupSize} accepted`,
        dotClass: 'bg-purple-400',
        chipClass: 'bg-purple-900/40 text-purple-200',
        accepted,
        target: seeking.targetGroupSize,
        pending,
    };
}

function seekingTitle(seeking: GroupSeekingDto): string {
    const names = seeking.interests.map(i => i.name);
    if (names.length === 0) return `Group of ${seeking.targetGroupSize}`;
    if (names.length === 1) return names[0];
    if (names.length === 2) return names.join(' & ');
    return `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
}

function GroupSeekingCard({
    seeking,
    index,
    matchingProposal,
    onDelete,
    onRunFormation,
}: {
    seeking: GroupSeekingDto;
    index: number;
    matchingProposal: FormationProposalCardDto | null;
    onDelete: SeekingCallbacks['onDelete'];
    onRunFormation: SeekingCallbacks['onRunFormation'];
}) {
    const palette = paletteFor(index);
    const status = statusFor(seeking, matchingProposal);
    const [busy, setBusy] = useState<'delete' | 'run' | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDelete = async () => {
        if (!window.confirm('Stop seeking this group?')) return;
        setBusy('delete');
        setError(null);
        try {
            await onDelete(seeking.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setBusy(null);
        }
    };

    const handleRun = async () => {
        setBusy('run');
        setError(null);
        try {
            await onRunFormation(seeking.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run formation');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="group overflow-hidden rounded-2xl bg-slate-800 transition-transform hover:-translate-y-0.5 hover:bg-slate-700/80">
            <div className={`relative flex h-32 items-center justify-center text-5xl ${palette.banner}`}>
                <span aria-hidden>{palette.icon}</span>
                <span
                    className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full shadow-lg ring-2 ring-white/30 ${status.dotClass}`}
                    title={status.label}
                />
            </div>
            <div className="space-y-3 p-5">
                <div>
                    <h3 className="text-lg font-semibold leading-snug text-white">
                        {seekingTitle(seeking)}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                        {seeking.targetGroupSize} people · {seeking.interests.length} interest
                        {seeking.interests.length === 1 ? '' : 's'}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.chipClass}`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                        {status.label}
                    </span>
                    {status.kind === 'forming' && status.pending > 0 ? (
                        <span className="text-[11px] text-slate-400">
                            {status.pending} pending
                        </span>
                    ) : null}
                </div>

                {error ? <ErrorMessage message={error} /> : null}

                <div className="flex items-center gap-2 pt-1">
                    <Link
                        href="/discover"
                        className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-purple-500"
                    >
                        Find people
                    </Link>
                    <button
                        type="button"
                        onClick={handleRun}
                        disabled={busy !== null}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
                        title="Check if a group can be formed right now"
                    >
                        {busy === 'run' ? '…' : 'Try'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={busy !== null}
                        className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50"
                        aria-label="Remove group seeking"
                    >
                        {busy === 'delete' ? '…' : '✕'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function NewSeekingTile({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex h-full min-h-[14rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/30 p-6 text-center transition-colors hover:border-purple-500/70 hover:bg-slate-900/60"
        >
            <span className="text-3xl" aria-hidden>
                ＋
            </span>
            <span className="text-sm font-semibold text-purple-300">Start a new group seeking</span>
            <span className="text-xs text-slate-500">
                Pick a size and the interests for the group you want to form.
            </span>
        </button>
    );
}

export default function GroupSeekingsModule({
    seekings,
    openFormationsFromMySeekings,
    loading,
    error,
    onCreate,
    onDelete,
    onRunFormation,
}: Props) {
    const [creating, setCreating] = useState(false);

    // Best-effort match of proposal -> seeking by interest set + group size
    // because the dashboard payload doesn't echo userGroupSeekingId on each proposal.
    const proposalForSeeking = useMemo(() => {
        const map = new Map<string, FormationProposalCardDto>();
        for (const seeking of seekings) {
            const seekingInterestIds = new Set(seeking.interests.map(i => i.id));
            for (const card of openFormationsFromMySeekings) {
                const props = card.proposal;
                if (props.targetGroupSize !== seeking.targetGroupSize) continue;
                if (props.groupInterests.length !== seekingInterestIds.size) continue;
                const sameInterests = props.groupInterests.every(i => seekingInterestIds.has(i.id));
                if (sameInterests) {
                    map.set(seeking.id, card);
                    break;
                }
            }
        }
        return map;
    }, [seekings, openFormationsFromMySeekings]);

    return (
        <section>
            <SectionHeader title="Groups Seeking" />

            {creating ? (
                <div className="mb-4">
                    <NewGroupSeekingForm
                        onSubmit={async input => {
                            await onCreate(input);
                            setCreating(false);
                        }}
                        onCancel={() => setCreating(false)}
                    />
                </div>
            ) : null}

            {loading ? <Loading className="mt-2" /> : null}
            {error ? <ErrorMessage message={error} /> : null}

            {!loading && !error ? (
                seekings.length === 0 && !creating ? (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
                        <div className="text-4xl" aria-hidden>
                            🎯
                        </div>
                        <p className="mt-3 text-sm font-medium text-slate-200">
                            You aren&apos;t looking for any groups yet.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Tell us the size and interests of the group you&apos;re trying to form.
                            We&apos;ll match you with people who fit.
                        </p>
                        <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="mt-4 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
                        >
                            Start a group seeking
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {seekings.map((seeking, idx) => (
                            <GroupSeekingCard
                                key={seeking.id}
                                seeking={seeking}
                                index={idx}
                                matchingProposal={proposalForSeeking.get(seeking.id) ?? null}
                                onDelete={onDelete}
                                onRunFormation={onRunFormation}
                            />
                        ))}
                        {!creating ? <NewSeekingTile onClick={() => setCreating(true)} /> : null}
                    </div>
                )
            ) : null}
        </section>
    );
}
