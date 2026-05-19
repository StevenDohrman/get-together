'use client';

import DashboardHeader from './DashboardHeader';
import { useProfile } from '@/lib/hooks/useProfile';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

interface Props {
    intro: string;
    stats: { icon: string; label: string; value?: string | number }[];
}

export default function DashboardHeaderClient({ intro, stats }: Props) {
    const { profile, loading, error } = useProfile();

    if (loading) return <Loading />;
    if (error) return <ErrorMessage message={error} />;

    const userName = profile?.displayName ?? profile?.username ?? 'You';

    return <DashboardHeader userName={userName} intro={intro} stats={stats} />;
}
