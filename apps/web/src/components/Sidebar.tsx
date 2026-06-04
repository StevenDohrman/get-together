'use client';

import Logo from './Logo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/lib/hooks/useProfile';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';

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

  const initial =
    (profile?.displayName ?? profile?.username ?? 'U')
      .trim()
      .charAt(0)
      .toUpperCase() || 'U';
  const primaryPhotoUrl = profile?.photos?.[0]?.url ?? null;

  return (
    <aside className="relative flex h-screen w-72 flex-shrink-0 flex-col overflow-hidden border-r border-slate-800/80 bg-slate-950">
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

      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-purple-500/20 to-transparent"
      />

      <div className="relative flex h-full flex-col px-5 pb-5 pt-6">
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

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Menu
        </p>

        <nav className="flex-1 space-y-1.5">
          {NAV_ITEMS.map((item) => {
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

        <div className="relative mt-4">
          <div
            aria-hidden
            className="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30 opacity-50 blur-lg"
          />

          <Link
            href="/profile"
            className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/80 px-3 py-3 backdrop-blur-xl transition-colors hover:border-slate-700 hover:bg-slate-900"
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 text-sm font-bold text-white shadow-md shadow-pink-900/40">
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : primaryPhotoUrl ? (
                <div
                  aria-label={
                    profile?.displayName ?? profile?.username ?? 'Profile photo'
                  }
                  role="img"
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${primaryPhotoUrl})` }}
                />
              ) : (
                initial
              )}
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400"
              />
            </div>

            <div className="min-w-0 flex-1">
              {loading ? (
                <Loading />
              ) : error ? (
                <ErrorMessage message={error} />
              ) : (
                <>
                  <p className="truncate text-sm font-semibold text-white">
                    {profile?.displayName ?? 'Your Name'}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    @{profile?.username ?? 'yourhandle'}
                  </p>
                </>
              )}
            </div>

            <span
              aria-hidden
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800/60 text-slate-400 transition-colors group-hover:text-white"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-3.5 w-3.5"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="m7.5 4.5 5 5.5-5 5.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
