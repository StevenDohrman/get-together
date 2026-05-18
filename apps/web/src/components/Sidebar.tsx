'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';

export default function Sidebar() {
    const pathname = usePathname();

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
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full"></div>
                    <div>
                        <p className="text-sm font-medium text-white">Amanda Carrington</p>
                        <p className="text-xs text-slate-400">@amandacarrington</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
