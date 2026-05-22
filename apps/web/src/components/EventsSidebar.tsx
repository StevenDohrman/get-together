'use client';

import Link from 'next/link';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useUserEvents, type UserEvent } from '@/lib/hooks/useUserEvents';

function formatStart(iso: string): { date: string; time: string } {
    const dt = new Date(iso);
    const date = dt.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const time = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return { date, time };
}

function visualFor(event: UserEvent) {
    if (event.ownerType === 'PUBLIC') {
        return {
            banner: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500',
            icon: '🌐',
        };
    }
    return {
        banner: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600',
        icon: '👥',
    };
}

function statusPill(event: UserEvent) {
    // The user's personal RSVP is the most actionable signal, so it always
    // wins over group-based reasons when both are present.
    if (event.myRsvp === 'GOING') {
        return { label: "You're going", className: 'bg-green-500/20 text-green-300' };
    }
    if (event.myRsvp === 'MAYBE') {
        return { label: 'Maybe', className: 'bg-amber-500/20 text-amber-300' };
    }
    if (event.myRsvp === 'NOT_GOING') {
        return { label: "Can't go", className: 'bg-rose-500/20 text-rose-300' };
    }
    if (event.reasons.includes('HOST_GROUP')) {
        return { label: 'Hosting', className: 'bg-purple-500/20 text-purple-300' };
    }
    if (event.reasons.includes('SUBSCRIBED_GROUP')) {
        return { label: 'Signed up', className: 'bg-indigo-500/20 text-indigo-300' };
    }
    if (event.reasons.includes('PUBLIC')) {
        return { label: 'Public', className: 'bg-orange-500/20 text-orange-300' };
    }
    return null;
}

export default function EventsSidebar({ limit = 3 }: { limit?: number }) {
    const { events, loading, error } = useUserEvents({ limit, includePublic: true });

    return (
        <section>
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Upcoming Events</h3>
                <Link href="/events" className="text-xs text-purple-400 hover:text-purple-300">
                    See all →
                </Link>
            </div>

            {loading ? <Loading className="mt-2" /> : null}
            {error ? <ErrorMessage message={error} /> : null}

            {!loading && !error ? (
                events.length === 0 ? (
                    <p className="rounded-lg bg-slate-800/60 p-3 text-xs text-slate-400">
                        No upcoming events yet.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {events.map(event => {
                            const visual = visualFor(event);
                            const { date, time } = formatStart(event.startsAt);
                            const pill = statusPill(event);
                            return (
                                <div
                                    key={event.id}
                                    className="flex items-center gap-3 rounded-lg bg-slate-800/60 p-2.5 transition-colors hover:bg-slate-800"
                                >
                                    <div
                                        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg text-2xl ${visual.banner}`}
                                    >
                                        {visual.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-white">
                                            {event.title}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            {date} · {time}
                                        </p>
                                        <p className="truncate text-[11px] text-slate-500">
                                            {event.ownerType === 'PUBLIC'
                                                ? 'UConnect public'
                                                : event.hostGroup?.name ?? 'Group event'}
                                        </p>
                                    </div>
                                    {pill ? (
                                        <span
                                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.className}`}
                                        >
                                            {pill.label}
                                        </span>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )
            ) : null}
        </section>
    );
}
