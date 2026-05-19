'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMyProfileInterests, type ProfileInterest } from '@/lib/hooks/useMyProfileInterests';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

type Props = {
    onSubmit: (input: { targetGroupSize: number; interestIds: string[] }) => Promise<void>;
    onCancel?: () => void;
    submitLabel?: string;
    initial?: { targetGroupSize?: number; interestIds?: string[] };
};

const MIN_SIZE = 2;
const MAX_SIZE = 100;

export default function NewGroupSeekingForm({
    onSubmit,
    onCancel,
    submitLabel = 'Start group seeking',
    initial,
}: Props) {
    const { interests, loading, error } = useMyProfileInterests();

    const [targetGroupSize, setTargetGroupSize] = useState<number>(initial?.targetGroupSize ?? 3);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(
        new Set(initial?.interestIds ?? []),
    );
    const [filter, setFilter] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Sort the user's profile interests by weight (highest first) — that's how
    // they appear on the profile page, and it's how someone would naturally
    // think of "what matters most" when picking interests for a group.
    const sortedInterests = useMemo<ProfileInterest[]>(() => {
        return interests
            .slice()
            .sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
    }, [interests]);

    const filtered = useMemo<ProfileInterest[]>(() => {
        const needle = filter.trim().toLowerCase();
        if (!needle) return sortedInterests;
        return sortedInterests.filter(
            i => i.name.toLowerCase().includes(needle) || i.slug.toLowerCase().includes(needle),
        );
    }, [sortedInterests, filter]);

    const selectedInterests = useMemo(
        () => sortedInterests.filter(i => selectedIds.has(i.id)),
        [sortedInterests, selectedIds],
    );

    const hasNoProfileInterests = !loading && !error && interests.length === 0;

    const toggleInterest = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);

        if (selectedIds.size === 0) {
            setFormError('Pick at least one interest for this group.');
            return;
        }

        const size = Math.round(targetGroupSize);
        if (!Number.isFinite(size) || size < MIN_SIZE || size > MAX_SIZE) {
            setFormError(`Group size must be between ${MIN_SIZE} and ${MAX_SIZE}.`);
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({ targetGroupSize: size, interestIds: [...selectedIds] });
            setSelectedIds(new Set());
            setFilter('');
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create group seeking');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-lg border border-slate-700 bg-slate-900/40 p-5"
        >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Start a new group seeking</h3>
                    <p className="text-sm text-slate-400">
                        Set the group size and pick interests from your profile that this group
                        should share. We&apos;ll suggest people once you start swiping.
                    </p>
                </div>
                {onCancel ? (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="self-start rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
                    >
                        Cancel
                    </button>
                ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-slate-200" htmlFor="group-size">
                    Target group size
                </label>
                <input
                    id="group-size"
                    type="number"
                    inputMode="numeric"
                    min={MIN_SIZE}
                    max={MAX_SIZE}
                    value={targetGroupSize}
                    onChange={e => setTargetGroupSize(Number(e.target.value))}
                    className="w-24 rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-purple-500"
                />
                <span className="text-xs text-slate-500">
                    Including you. Minimum {MIN_SIZE}, maximum {MAX_SIZE}.
                </span>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-200">Group interests</label>
                    <span className="text-xs text-slate-500">
                        {selectedIds.size} selected · pick from your profile
                    </span>
                </div>

                {hasNoProfileInterests ? (
                    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-sm">
                        <p className="text-slate-200">
                            You haven&apos;t picked any profile interests yet.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Group seekings can only use interests you&apos;ve set on your profile,
                            so we know how strongly you care about each one.
                        </p>
                        <Link
                            href="/profile"
                            className="mt-3 inline-block rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-500"
                        >
                            Set your interests →
                        </Link>
                    </div>
                ) : (
                    <>
                        <input
                            type="text"
                            placeholder="Search your interests..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-purple-500"
                        />

                        {selectedInterests.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {selectedInterests.map(interest => (
                                    <button
                                        type="button"
                                        key={interest.id}
                                        onClick={() => toggleInterest(interest.id)}
                                        className="rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500"
                                    >
                                        {interest.name}{' '}
                                        <span className="ml-1 opacity-70">w{interest.weight}</span>{' '}
                                        ×
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        {loading ? <Loading className="pt-2" /> : null}
                        {error ? <ErrorMessage message={error} /> : null}
                        {!loading && !error ? (
                            <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                                {filtered.length === 0 ? (
                                    <p className="px-2 py-3 text-sm text-slate-500">
                                        No interests match &quot;{filter}&quot;.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {filtered.map(interest => {
                                            const isSelected = selectedIds.has(interest.id);
                                            return (
                                                <button
                                                    type="button"
                                                    key={interest.id}
                                                    onClick={() => toggleInterest(interest.id)}
                                                    title={`Profile weight ${interest.weight}/10`}
                                                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                                        isSelected
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                    }`}
                                                >
                                                    {interest.name}
                                                    <span className="ml-1.5 opacity-70">
                                                        w{interest.weight}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </>
                )}
            </div>

            {formError ? <ErrorMessage message={formError} /> : null}

            <div className="flex items-center justify-end gap-2 pt-1">
                <button
                    type="submit"
                    disabled={submitting || loading || hasNoProfileInterests}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {submitting ? 'Saving...' : submitLabel}
                </button>
            </div>
        </form>
    );
}
