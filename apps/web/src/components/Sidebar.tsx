'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import { useProfile } from '@/lib/hooks/useProfile';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

export default function Sidebar() {
    const pathname = usePathname();
    const { profile, loading, error } = useProfile();

    const navItems = [
        { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
        { href: '/discover', icon: '🔍', label: 'Find / Discover' },
        { href: '/groups', icon: '👥', label: 'Groups' },
        { href: '/profile', icon: '👤', label: 'Profile' },
        { href: '/settings', icon: '⚙️', label: 'Settings' },
    ];

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col h-screen">
            {/* Logo */}
            <div className="mb-12">
                <Logo />
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-300 hover:bg-slate-800'
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile */}
            <div className="border-t border-slate-800 pt-4 mt-4">
                <div className="flex items-center gap-3 px-2">
                    {profile?.photos && profile.photos.length > 0 ? (
                        <div
                            aria-label={profile.displayName ?? profile.username ?? 'Profile photo'}
                            role="img"
                            className="w-10 h-10 rounded-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${profile.photos[0].url})` }}
                        />
                    ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                            {((profile?.displayName ?? profile?.username) || 'U').split(/\s+/).map(s => s.charAt(0)).slice(0, 2).join('')}
                        </div>
                    )}
                    <div className="flex-1">
                        {loading ? (
                            <Loading />
                        ) : error ? (
                            <ErrorMessage message={error} />
                        ) : (
                            <>
                                <p className="text-sm font-medium text-white">{profile?.displayName ?? 'Your Name'}</p>
                                <p className="text-xs text-slate-400">@{profile?.username ?? 'yourhandle'}</p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}
