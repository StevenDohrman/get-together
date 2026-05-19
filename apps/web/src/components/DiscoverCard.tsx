import React from 'react';
import type { DiscoveryUser } from '@/lib/hooks/useDiscovery';

type Props = {
    user: DiscoveryUser;
    onSwipe?: (id: string, decision: 'YES' | 'NO') => void;
    disabled?: boolean;
};

export default function DiscoverCard({ user, onSwipe, disabled = false }: Props) {
    const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.key === 'ArrowLeft') {
            onSwipe && onSwipe(user.id, 'NO');
        } else if (e.key === 'ArrowRight') {
            onSwipe && onSwipe(user.id, 'YES');
        } else if (e.key === 'Enter') {
            // default to YES on Enter
            onSwipe && onSwipe(user.id, 'YES');
        }
    };

    return (
        <div
            id={`discover-card-${user.id}`}
            tabIndex={0}
            onKeyDown={handleKey}
            role="group"
            aria-label={`Discover card for ${user.displayName ?? 'Unknown'}`}
            className="rounded-lg bg-slate-800 p-4 shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
            <div className="flex gap-4">
                <img
                    src={user.avatarUrl ?? '/assets/avatar-placeholder.png'}
                    alt={user.displayName ?? 'profile'}
                    className="h-24 w-24 rounded-md object-cover"
                />
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">{user.displayName ?? 'Unknown'}</h3>
                        <span
                            className={`h-3 w-3 rounded-full ${user.online ? 'bg-emerald-400' : 'bg-slate-600'}`}
                            aria-hidden
                        />
                    </div>
                    <p className="text-sm text-slate-400">
                        {user.age ? `${user.age} • ` : ''}
                        {user.city ?? ''}
                        {user.state ? `, ${user.state}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {(user.interests ?? []).slice(0, 5).map(i => (
                            <span key={i} className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-200">{i}</span>
                        ))}
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{user.bio ?? ''}</p>
                    <div className="mt-4 flex gap-2">
                        <button
                            aria-label={`Reject ${user.displayName ?? 'user'}`}
                            disabled={disabled}
                            className={`rounded-full px-4 py-2 text-sm text-white ${disabled ? 'bg-slate-600' : 'bg-slate-700'}`}
                            onClick={() => onSwipe && onSwipe(user.id, 'NO')}
                        >
                            No
                        </button>
                        <button
                            aria-label={`Accept ${user.displayName ?? 'user'}`}
                            disabled={disabled}
                            className={`rounded-full px-4 py-2 text-sm text-white ${disabled ? 'bg-slate-600' : 'bg-purple-600'}`}
                            onClick={() => onSwipe && onSwipe(user.id, 'YES')}
                        >
                            Yes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
