'use client';

import { useMatchingDashboard } from '@/lib/hooks/useMatchingDashboard';
import { useProfile } from '@/lib/hooks/useProfile';

export default function TopBar() {
    const { profile } = useProfile();
    const { data } = useMatchingDashboard();

    const notificationCount = data.invitesPendingMyAnswer.length;
    const displayName = profile?.displayName ?? profile?.username ?? 'You';
    const initials = displayName
        .split(/\s+/)
        .map(s => s.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');

    return (
        <header className="flex items-center justify-end gap-4 border-b border-slate-800/60 bg-slate-950/50 px-6 py-3 backdrop-blur">
            <button
                type="button"
                aria-label={
                    notificationCount > 0
                        ? `${notificationCount} pending notifications`
                        : 'Notifications'
                }
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800"
            >
                <span className="text-lg" aria-hidden>
                    🔔
                </span>
                {notificationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white">
                        {notificationCount}
                    </span>
                ) : null}
            </button>

            <div className="flex items-center gap-3 rounded-full bg-slate-900 py-1.5 pl-1.5 pr-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 text-xs font-semibold text-white">
                    {initials || '·'}
                </div>
                <span className="text-sm font-medium text-white">{displayName}</span>
                <span className="text-xs text-slate-500" aria-hidden>
                    ▾
                </span>
            </div>
        </header>
    );
}
