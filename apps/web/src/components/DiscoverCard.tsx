import React from 'react';
import type { DiscoveryUser } from '@/lib/hooks/useDiscovery';

type Props = {
    user: DiscoveryUser;
    onSwipe?: (id: string, decision: 'YES' | 'NO') => void;
};

export default function DiscoverCard({ user, onSwipe }: Props) {
    return (
        <div className="rounded-lg bg-slate-800 p-4 shadow-md">
            <div className="flex gap-4">
                <img
                    src={user.avatarUrl ?? '/assets/avatar-placeholder.png'}
                    alt={user.displayName ?? 'profile'}
                    className="h-24 w-24 rounded-md object-cover"
                />
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">{user.displayName ?? 'Unknown'}</h3>
                        <span className={`h-3 w-3 rounded-full ${user.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    </div>
                    <p className="text-sm text-slate-400">
                        {user.age ? `${user.age} • ` : ''}{user.city ?? ''}{user.state ? `, ${user.state}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {(user.interests ?? []).slice(0, 5).map(i => (
                            <span key={i} className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-200">{i}</span>
                        ))}
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{user.bio ?? ''}</p>
                    <div className="mt-4 flex gap-2">
                        <button
                            className="rounded-full bg-slate-700 px-4 py-2 text-sm text-white"
                            onClick={() => onSwipe && onSwipe(user.id, 'NO')}
                        >
                            No
                        </button>
                        <button
                            className="rounded-full bg-purple-600 px-4 py-2 text-sm text-white"
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
