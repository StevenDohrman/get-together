'use client';

import SectionHeader from './SectionHeader';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useUserEvents, type UserEvent } from '@/lib/hooks/useUserEvents';

type BadgeKey =
    | 'GOING'
    | 'MAYBE'
    | 'NOT_GOING'
    | 'HOST_GROUP'
    | 'SUBSCRIBED_GROUP'
    | 'PUBLIC';

/**
 * Choose the most informative single badge for an event. The user's own
 * RSVP — when they've made one — always wins, since it's the most actionable
 * signal. Group-based reasons are the fallback.
 */
function primaryBadge(event: UserEvent): BadgeKey | null {
    if (event.myRsvp === 'GOING') return 'GOING';
    if (event.myRsvp === 'MAYBE') return 'MAYBE';
    if (event.myRsvp === 'NOT_GOING') return 'NOT_GOING';
    if (event.reasons.includes('HOST_GROUP')) return 'HOST_GROUP';
    if (event.reasons.includes('SUBSCRIBED_GROUP')) return 'SUBSCRIBED_GROUP';
    if (event.reasons.includes('PUBLIC')) return 'PUBLIC';
    return null;
}

const BADGE_STYLES: Record<BadgeKey, { label: string; className: string }> = {
    GOING: { label: "You're going", className: 'bg-green-500 text-white' },
    MAYBE: { label: 'You said maybe', className: 'bg-amber-500 text-white' },
    NOT_GOING: { label: "You can't go", className: 'bg-rose-500 text-white' },
    HOST_GROUP: { label: 'Your group hosts', className: 'bg-purple-600 text-white' },
    SUBSCRIBED_GROUP: { label: 'Your group signed up', className: 'bg-indigo-600 text-white' },
    PUBLIC: { label: 'UConnect public', className: 'bg-orange-500/90 text-white' },
};

function formatDate(iso: string): { date: string; time: string } {
    const dt = new Date(iso);
    const date = dt.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    const time = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return { date, time };
}

/**
 * Visual treatment differentiating PUBLIC vs GROUP events:
 *  - PUBLIC: warm orange/amber gradient banner with 🌐 icon and a "PUBLIC" badge stripe
 *  - GROUP:  cool indigo/purple gradient banner with 👥 icon and the group name
 */
function eventVisual(event: UserEvent) {
    if (event.ownerType === 'PUBLIC') {
        return {
            bannerClass: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500',
            icon: '🌐',
            ownerLabel: 'Public · UConnect',
            ownerChip: 'bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/30',
        };
    }
    return {
        bannerClass: 'bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600',
        icon: '👥',
        ownerLabel: event.hostGroup ? event.hostGroup.name : 'Group event',
        ownerChip: 'bg-purple-500/20 text-purple-200 ring-1 ring-purple-500/30',
    };
}

function FeaturedEventCard({ event }: { event: UserEvent }) {
    const visual = eventVisual(event);
    const { date, time } = formatDate(event.startsAt);
    const key = primaryBadge(event);
    const badge = key ? BADGE_STYLES[key] : null;

    return (
        <div className="flex flex-col overflow-hidden rounded-2xl bg-slate-800 transition-colors hover:bg-slate-700/80 md:flex-row">
            <div
                className={`flex items-center justify-center text-7xl md:h-auto md:w-2/5 md:flex-shrink-0 ${visual.bannerClass} h-44`}
            >
                {visual.icon}
            </div>
            <div className="flex flex-1 flex-col justify-between gap-3 p-6">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${visual.ownerChip}`}
                        >
                            {event.ownerType === 'PUBLIC' ? 'Public' : 'Group'}
                        </span>
                        <span className="text-xs text-slate-400">{visual.ownerLabel}</span>
                    </div>
                    <p className="text-sm text-slate-400">
                        📅 {date} · {time}
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-white">{event.title}</h3>
                    {event.locationName ? (
                        <p className="mt-1 text-sm text-slate-300">📍 {event.locationName}</p>
                    ) : null}
                </div>
                {badge ? (
                    <div>
                        <span
                            className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                        >
                            {badge.label}
                        </span>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function CompactEventCard({ event }: { event: UserEvent }) {
    const visual = eventVisual(event);
    const { date, time } = formatDate(event.startsAt);
    const key = primaryBadge(event);
    const badge = key ? BADGE_STYLES[key] : null;

    return (
        <div className="overflow-hidden rounded-xl bg-slate-800 transition-colors hover:bg-slate-700/80">
            <div className={`relative flex h-28 items-center justify-center text-4xl ${visual.bannerClass}`}>
                {visual.icon}
                <span
                    className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${visual.ownerChip}`}
                >
                    {event.ownerType === 'PUBLIC' ? 'Public' : 'Group'}
                </span>
            </div>
            <div className="space-y-1 p-4">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">{event.title}</h3>
                    {badge ? (
                        <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                        >
                            {badge.label}
                        </span>
                    ) : null}
                </div>
                <p className="text-xs text-slate-400">{visual.ownerLabel}</p>
                <p className="text-xs text-slate-300">
                    📅 {date} · {time}
                </p>
            </div>
        </div>
    );
}

type Props = {
    limit?: number;
    href?: string;
    title?: string;
};

export default function EventsModule({ limit = 6, href, title = 'Upcoming Events' }: Props) {
    const { events, loading, error } = useUserEvents({ limit, includePublic: true });

    const [featured, ...rest] = events;

    return (
        <section>
            <SectionHeader title={title} href={href} />
            {loading ? <Loading className="mt-2" /> : null}
            {error ? <ErrorMessage message={error} /> : null}
            {!loading && !error ? (
                events.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-6 text-sm text-slate-400">
                        No upcoming events yet. Join a group or follow a public event to see it here.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {featured ? <FeaturedEventCard event={featured} /> : null}
                        {rest.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {rest.map(event => (
                                    <CompactEventCard key={event.id} event={event} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                )
            ) : null}
        </section>
    );
}
