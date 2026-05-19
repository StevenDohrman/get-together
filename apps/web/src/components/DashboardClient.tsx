'use client';

import DashboardHeaderClient from './DashboardHeaderClient';
import DashboardLayout from './DashboardLayout';
import EventsModule from './EventsModule';
import EventsSidebar from './EventsSidebar';
import GroupSeekingsModule from './GroupSeekingsModule';
import FormationInvitesModule from './FormationInvitesModule';
import RecentActivity from './RecentActivity';
import { useGroups } from '@/lib/hooks/useGroups';
import { useMatchingDashboard } from '@/lib/hooks/useMatchingDashboard';
import { useUserEvents } from '@/lib/hooks/useUserEvents';

type DashboardStat = {
    icon: string;
    label: string;
    value?: string | number;
};

export default function DashboardClient() {
    const { groups } = useGroups();
    const { events: upcomingEvents } = useUserEvents({ limit: 50, includePublic: true });
    const {
        data,
        loading: matchingLoading,
        error: matchingError,
        createGroupSeeking,
        deleteGroupSeeking,
        runFormation,
        respondToInvite,
    } = useMatchingDashboard();

    const dashboardStats: DashboardStat[] = [
        { icon: '👥', label: 'Groups', value: groups.length },
        { icon: '💬', label: 'Connections', value: data.connectionsCount },
        { icon: '📅', label: 'Events', value: upcomingEvents.length },
    ];

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-7xl">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="space-y-8 lg:col-span-2">
                        <DashboardHeaderClient
                            intro="Let's get you connected today."
                            stats={dashboardStats}
                        />

                        <FormationInvitesModule
                            invitesPendingMyAnswer={data.invitesPendingMyAnswer}
                            openFormationsWaitingOnOthers={data.openFormationsWaitingOnOthers}
                            loading={matchingLoading}
                            error={matchingError}
                            onRespond={respondToInvite}
                        />

                        <EventsModule limit={6} />

                        <GroupSeekingsModule
                            seekings={data.groupSeekings}
                            openFormationsFromMySeekings={data.openFormationsFromMySeekings}
                            loading={matchingLoading}
                            error={matchingError}
                            onCreate={async input => {
                                await createGroupSeeking(input);
                            }}
                            onDelete={deleteGroupSeeking}
                            onRunFormation={async id => {
                                await runFormation(id);
                            }}
                        />

                        <RecentActivity limit={3} />
                    </div>

                    <div className="space-y-8">
                        <EventsSidebar limit={3} />

                        <RecentActivity limit={3} compact />

                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 p-6 text-white shadow-lg">
                            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-pink-400 opacity-30 blur-3xl" />
                            <div className="relative">
                                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-2xl">
                                    👥
                                </div>
                                <h3 className="mb-2 text-xl font-bold">Grow your network</h3>
                                <p className="mb-4 text-sm text-purple-100">
                                    Find people with similar interests and connect!
                                </p>
                                <a
                                    href="/discover"
                                    className="block w-full rounded-lg bg-white py-2 text-center font-semibold text-purple-600 transition-colors hover:bg-purple-50"
                                >
                                    Find People
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
