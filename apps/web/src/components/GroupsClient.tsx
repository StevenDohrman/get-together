'use client';

import { initialsFor, pickGradient } from '@/lib/avatarUtils';
import Link from 'next/link';
import { useMemo } from 'react';
import DashboardLayout from './DashboardLayout';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useGroups, type GroupSummary } from '@/lib/hooks/useGroups';

function GroupCard({ group }: { group: GroupSummary }) {
    const gradient = useMemo(() => pickGradient(group.id || group.slug), [group.id, group.slug]);
    const initials = useMemo(() => initialsFor(group.name), [group.name]);
    const role = group.myRole?.toLowerCase() ?? '';
    const isOwnerLike = role === 'owner' || role === 'admin';

    return (
        <Link
            href={group.chatPath}
            className="group relative block focus:outline-none"
        >
            <div
                aria-hidden
                className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
            />

            <article className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-xl transition-transform duration-200 group-hover:-translate-y-0.5">
                <div className={`relative h-32 bg-gradient-to-br ${gradient}`}>
                    <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/30 opacity-40 blur-3xl" />
                    <div className="pointer-events-none absolute -left-8 -bottom-10 h-36 w-36 rounded-full bg-black/30 opacity-30 blur-3xl" />

                    <div className="relative flex h-full items-end justify-between gap-3 p-4">
                        <span
                            aria-hidden
                            className="select-none text-5xl font-black leading-none tracking-tight text-white/30"
                        >
                            {initials}
                        </span>
                        {isOwnerLike ? (
                            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                                {role}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="space-y-3 p-5">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold text-white">
                            {group.name}
                        </h3>
                        <p className="mt-1 truncate text-xs text-slate-500">
                            /{group.slug}
                        </p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <span aria-hidden>👥</span>
                            <span>
                                {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                            </span>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-200 ring-1 ring-purple-500/30 transition-colors group-hover:bg-purple-500/25 group-hover:text-purple-100">
                            Open chat
                            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
}

function GroupsHero({ count }: { count: number }) {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-xl">
            <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-orange-400 opacity-50 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-12 h-72 w-72 rounded-full bg-pink-500 opacity-40 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-indigo-500 opacity-40 blur-3xl" />

            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm">
                            👥
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-100/90">
                            Your communities
                        </span>
                    </div>
                    <h1 className="mt-5 text-4xl font-bold tracking-tight">Groups</h1>
                    <p className="mt-2 max-w-xl text-base text-purple-100">
                        Hop into your group chats, plan events together, and stay in sync with the people you’re building things with.
                    </p>
                </div>

                <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg">
                            🏷️
                        </div>
                        <div>
                            <p className="text-2xl font-bold leading-none">{count}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-wider text-purple-100/80">
                                {count === 1 ? 'Group' : 'Groups'}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/discover"
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-purple-700 shadow-lg shadow-purple-900/30 transition-colors hover:bg-purple-50"
                    >
                        <span aria-hidden>🔍</span>
                        Find new people
                    </Link>
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="relative">
            <div
                aria-hidden
                className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40 opacity-50 blur-xl"
            />
            <div className="relative overflow-hidden rounded-3xl border border-dashed border-slate-700/80 bg-slate-900/70 p-10 text-center backdrop-blur-xl">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-3xl shadow-lg shadow-purple-900/40">
                    👥
                </div>
                <h2 className="mt-5 text-2xl font-bold text-white">
                    No groups yet
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                    Once you match with people on Discover or accept a formation invite, your groups will appear here ready for chatting and planning events.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <Link
                        href="/discover"
                        className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition-all hover:brightness-110"
                    >
                        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        <span className="relative">Start discovering</span>
                        <span aria-hidden className="relative transition-transform group-hover:translate-x-0.5">→</span>
                    </Link>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/60 px-5 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
                    >
                        Add a group seeking
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function GroupsClient() {
    const { groups, loading, error } = useGroups();

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-7xl space-y-8">
                <GroupsHero count={groups.length} />

                {error ? <ErrorMessage message={error} /> : null}

                {loading ? (
                    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-10 backdrop-blur-xl">
                        <Loading />
                    </div>
                ) : null}

                {!loading && !error ? (
                    groups.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                            {groups.map(group => (
                                <GroupCard key={group.id} group={group} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState />
                    )
                ) : null}
            </div>
        </DashboardLayout>
    );
}
