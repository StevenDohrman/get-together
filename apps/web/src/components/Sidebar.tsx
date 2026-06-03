'use client';

import { useProfile } from '@/lib/hooks/useProfile';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ErrorMessage from './ErrorMessage';
import Loading from './Loading';
import Logo from './Logo';

type NavItem = {
    href: string;
    icon: string;
    label: string;
};

const NAV_ITEMS: NavItem[] = [
    { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
    { href: '/discover', icon: '🔍', label: 'Discover' },
    { href: '/groups', icon: '👥', label: 'Groups' },
    { href: '/profile', icon: '👤', label: 'Profile' },
    { href: '/settings', icon: '⚙️', label: 'Settings' },
];

function isActiveHref(pathname: string, href: string): boolean {
    if (href === '/dashboard') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
    const pathname = usePathname();
    const { profile, loading, error } = useProfile();

    const initial = (profile?.displayName ?? profile?.username ?? 'U')
        .trim()
        .charAt(0)
        .toUpperCase();

    return (
        <aside className="relative flex h-screen w-72 flex-shrink-0 flex-col overflow-hidden border-r border-slate-800/80 bg-slate-950">
            {/* Aurora glow — same vibe as the dashboard hero & auth card */}
            <div
                aria-hidden
                className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-600 opacity-25 blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-purple-600 opacity-20 blur-3xl"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-pink-500 opacity-20 blur-3xl"
            />

            {/* Right-edge hairline that fades into the page */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-purple-500/20 to-transparent"
            />

            <div className="relative flex h-full flex-col px-5 pb-5 pt-6">
                {/* Brand */}
                <Link
                    href="/dashboard"
                    className="group mb-8 flex items-center gap-3 rounded-2xl px-2 py-1.5 transition-colors hover:bg-white/5"
                >
                    <Logo className="h-8 w-8 flex-shrink-0 text-white" />
                    <div className="flex flex-col leading-tight">
                        <span className="text-base font-semibold tracking-tight text-white">
                            UConnect
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-200/70">
                            Stay connected
                        </span>
                    </div>
                </Link>

                {/* Section label */}
                <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Menu
                </p>

                {/* Navigation */}
                <nav className="flex-1 space-y-1.5">
                    {NAV_ITEMS.map(item => {
                        const isActive = isActiveHref(pathname, item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive ? 'page' : undefined}
                                className={`group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                                    isActive
                                        ? 'text-white shadow-lg shadow-purple-900/40'
                                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                }`}
                            >
                                {isActive ? (
                                    <>
                                        <span
                                            aria-hidden
                                            className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"
                                        />
                                        <span
                                            aria-hidden
                                            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-pink-400 opacity-30 blur-2xl"
                                        />
                                    </>
                                ) : null}

                                <span
                                    className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-base transition-colors ${
                                        isActive
                                            ? 'bg-white/15 backdrop-blur-sm'
                                            : 'bg-slate-800/60 ring-1 ring-inset ring-slate-700/60 group-hover:bg-slate-800 group-hover:ring-slate-600'
                                    }`}
                                >
                                    {item.icon}
                                </span>
                                <span className="relative flex-1 truncate">{item.label}</span>

                                {isActive ? (
                                    <span
                                        aria-hidden
                                        className="relative h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.6)]"
                                    />
                                ) : null}
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
                            {(((profile?.displayName ?? profile?.username) || 'U').split(/\s+/).filter(Boolean).map((s) => s.charAt(0).toUpperCase()).slice(0, 2).join(''))}

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
          </div>
        </aside>
    );
}
