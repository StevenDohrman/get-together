'use client';

import DashboardHeaderClient from './DashboardHeaderClient';
import DashboardLayout from './DashboardLayout';
import ActivityItem from './ActivityItem';
import CommunityCard from './CommunityCard';
import EventCard, { type EventCardProps } from './EventCard';
import SectionHeader from './SectionHeader';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useGroups } from '@/lib/hooks/useGroups';

type DashboardStat = {
    icon: string;
    label: string;
    value?: string | number;
};

const featuredEvents: EventCardProps[] = [
    {
        image: '🎮',
        title: 'Game Night Live',
        date: 'Fri, Aug 23',
        time: '7:00 PM',
        eventType: 'Virtual Event',
        status: "You're going",
        statusColor: 'bg-purple-600',
    },
    {
        image: '🌅',
        title: 'Sunset Hike',
        date: 'Sun, Aug 25',
        time: '6:30 PM',
        location: 'Runyon Canyon',
        status: 'Going',
        statusColor: 'bg-green-500',
    },
];

const sidebarEvents: EventCardProps[] = [
    {
        image: '🎮',
        title: 'Game Night Live',
        date: 'Fri, Aug 23',
        time: '7:00 PM',
        eventType: 'Virtual Event',
        status: "You're going",
        statusColor: 'bg-purple-600',
    },
    {
        image: '🎨',
        title: 'Creative Workshop',
        date: 'Sat, Aug 24',
        time: '2:00 PM',
        location: 'Downtown Studio',
        status: 'Interested',
        statusColor: 'bg-yellow-500',
    },
    {
        image: '🌅',
        title: 'Sunset Hike',
        date: 'Sun, Aug 25',
        time: '6:30 PM',
        location: 'Runyon Canyon',
        status: 'Going',
        statusColor: 'bg-green-500',
    },
];

const mainActivity = [
    {
        id: 'joined-photography-circle',
        primary: 'You',
        secondary: 'joined Photography Circle',
        time: '2h ago',
        avatarClassName: 'bg-gradient-to-br from-cyan-400 to-blue-500',
    },
    {
        id: 'rsvp-game-night-live',
        primary: 'You',
        secondary: "RSVP'd to Game Night Live",
        time: '5h ago',
        avatarClassName: 'bg-gradient-to-br from-blue-400 to-purple-500',
    },
    {
        id: 'ethan-joined-hiking-adventures',
        primary: 'Ethan Parker',
        secondary: 'joined Hiking Adventures',
        time: '1d ago',
        avatarClassName: 'bg-gradient-to-br from-pink-400 to-rose-500',
    },
];

const sidebarActivity = [
    {
        id: 'sidebar-joined-photography-circle',
        primary: 'Joined Photography Circle',
        time: '2h ago',
        avatarClassName: 'bg-gradient-to-br from-cyan-400 to-blue-500',
        compact: true,
    },
    {
        id: 'sidebar-rsvp-game-night-live',
        primary: "RSVP'd to Game Night Live",
        time: '5h ago',
        avatarClassName: 'bg-gradient-to-br from-blue-400 to-purple-500',
        compact: true,
    },
    {
        id: 'sidebar-ethan-joined-hiking-adventures',
        primary: 'Ethan Parker joined Hiking Adventures',
        time: '1d ago',
        avatarClassName: 'bg-gradient-to-br from-pink-400 to-rose-500',
        compact: true,
    },
];

function mapGroupGradient(slug: string, index: number) {
    const palettes = [
        {
            gradientClassName: 'bg-gradient-to-br from-blue-500 to-indigo-600',
            accentClassName: 'bg-purple-500',
        },
        {
            gradientClassName: 'bg-gradient-to-br from-orange-500 to-yellow-600',
            accentClassName: 'bg-cyan-500',
        },
        {
            gradientClassName: 'bg-gradient-to-br from-green-500 to-emerald-600',
            accentClassName: 'bg-orange-500',
        },
        {
            gradientClassName: 'bg-gradient-to-br from-pink-500 to-rose-600',
            accentClassName: 'bg-emerald-400',
        },
    ] as const;

    return palettes[index % palettes.length] ?? palettes[slug.length % palettes.length];
}

export default function DashboardClient() {
    const { groups, loading, error } = useGroups();

    const communities = groups.map((group, index) => ({
        title: group.name,
        members: `${group.memberCount} member${group.memberCount === 1 ? '' : 's'}`,
        ...mapGroupGradient(group.slug, index),
    }));

    const dashboardStats: DashboardStat[] = [
        { icon: '👥', label: 'Groups', value: groups.length },
        { icon: '🔗', label: 'Connections', value: '—' },
        { icon: '📅', label: 'Events', value: featuredEvents.length },
    ];

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-7xl">
                <DashboardHeaderClient intro="Let's get you connected today." stats={dashboardStats} />

                <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="space-y-8 lg:col-span-2">
                        <section>
                            <SectionHeader title="Upcoming Events" href="/events" />
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {featuredEvents.map((event) => (
                                    <EventCard key={event.title} {...event} />
                                ))}
                            </div>
                        </section>

                        <section>
                            <SectionHeader title="Your Communities" href="/communities" />
                            {loading ? <Loading className="mt-4" /> : null}
                            {error ? <ErrorMessage message={error} /> : null}
                            {!loading && !error ? (
                                communities.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                                        {communities.map((community) => (
                                            <CommunityCard key={community.title} {...community} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
                                        You are not a member of any groups yet.
                                    </div>
                                )
                            ) : null}
                        </section>

                        <section>
                            <SectionHeader title="Recent Activity" href="/activity" />
                            <div className="divide-y divide-slate-700 rounded-lg bg-slate-800">
                                {mainActivity.map((activity) => (
                                    <ActivityItem
                                        key={activity.id}
                                        primary={activity.primary}
                                        secondary={activity.secondary}
                                        time={activity.time}
                                        avatarClassName={activity.avatarClassName}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="space-y-8">
                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-white">Upcoming Events</h3>
                            <div className="space-y-4">
                                {sidebarEvents.map((event) => (
                                    <EventCard key={event.title} {...event} />
                                ))}
                            </div>
                        </section>

                        <section>
                            <h3 className="mb-4 text-lg font-semibold text-white">Recent Activity</h3>
                            <div className="rounded-lg bg-slate-800 p-4">
                                <div className="space-y-4">
                                    {sidebarActivity.map((activity) => (
                                        <ActivityItem
                                            key={activity.id}
                                            primary={activity.primary}
                                            time={activity.time}
                                            avatarClassName={activity.avatarClassName}
                                            compact
                                        />
                                    ))}
                                </div>
                            </div>
                        </section>

                        <div className="rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 p-6 text-white">
                            <div className="mb-4 flex items-center gap-3">
                                <span className="text-3xl">👥</span>
                            </div>
                            <h3 className="mb-2 text-xl font-bold">Grow your network</h3>
                            <p className="mb-4 text-sm text-purple-100">
                                Find people with similar interests and connect!
                            </p>
                            <button className="w-full rounded-lg bg-white py-2 font-semibold text-purple-600 transition-colors hover:bg-purple-50">
                                Find People
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
