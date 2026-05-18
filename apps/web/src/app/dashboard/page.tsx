import DashboardLayout from '@/components/DashboardLayout';
import DashboardHeaderClient from '@/components/DashboardHeaderClient';
import ActivityItem from '@/components/ActivityItem';
import CommunityCard from '@/components/CommunityCard';
import EventCard, { type EventCardProps } from '@/components/EventCard';
import SectionHeader from '@/components/SectionHeader';

const dashboardStats = [
    { icon: '👥', label: 'Groups' },
    { icon: '🔗', label: 'Connections' },
    { icon: '📅', label: 'Events' },
];

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

const communities = [
    {
        title: 'Gaming & Nerd Culture',
        members: '28 members',
        gradientClassName: 'bg-gradient-to-br from-blue-500 to-indigo-600',
        accentClassName: 'bg-purple-500',
    },
    {
        title: 'Creative Studio',
        members: '16 members',
        gradientClassName: 'bg-gradient-to-br from-orange-500 to-yellow-600',
        accentClassName: 'bg-cyan-500',
    },
    {
        title: 'Hiking Adventures',
        members: '32 members',
        gradientClassName: 'bg-gradient-to-br from-green-500 to-emerald-600',
        accentClassName: 'bg-orange-500',
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

export default function Dashboard() {
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* Header and Stats */}
                <DashboardHeaderClient intro="Let's get you connected today." stats={dashboardStats} />

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Upcoming Events Section */}
                        <section>
                            <SectionHeader title="Upcoming Events" href="/events" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {featuredEvents.map((event) => (
                                    <EventCard key={event.title} {...event} />
                                ))}
                            </div>
                        </section>

                        {/* Your Communities Section */}
                        <section>
                            <SectionHeader title="Your Communities" href="/communities" />
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {communities.map((community) => (
                                    <CommunityCard key={community.title} {...community} />
                                ))}
                            </div>
                        </section>

                        {/* Recent Activity Section */}
                        <section>
                            <SectionHeader title="Recent Activity" href="/activity" />
                            <div className="bg-slate-800 rounded-lg divide-y divide-slate-700">
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

                    {/* Right Column - Sidebar */}
                    <div className="space-y-8">
                        {/* Upcoming Events (Right) */}
                        <section>
                            <h3 className="text-lg font-semibold text-white mb-4">Upcoming Events</h3>
                            <div className="space-y-4">
                                {sidebarEvents.map((event) => (
                                    <EventCard key={event.title} {...event} />
                                ))}
                            </div>
                        </section>

                        {/* Recent Activity (Right) */}
                        <section>
                            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
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

                        {/* CTA Card */}
                        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg p-6 text-white">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-3xl">👥</span>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Grow your network</h3>
                            <p className="text-purple-100 text-sm mb-4">Find people with similar interests and connect!</p>
                            <button className="w-full bg-white text-purple-600 font-semibold py-2 rounded-lg hover:bg-purple-50 transition-colors">
                                Find People
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
