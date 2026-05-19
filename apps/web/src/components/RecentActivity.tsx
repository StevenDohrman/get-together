'use client';

import Link from 'next/link';
import SectionHeader from './SectionHeader';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useRecentActivity, type ActivityItem } from '@/lib/hooks/useRecentActivity';

function relativeTime(iso: string): string {
    const dt = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - dt);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) return 'just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < day) return `${Math.floor(diff / hour)}h ago`;
    return `${Math.floor(diff / day)}d ago`;
}

function senderLabel(item: ActivityItem): string {
    if (item.sender.isMe) return 'You';
    return item.sender.displayName ?? item.sender.username ?? 'Someone';
}

function groupLabel(item: ActivityItem): string {
    if (item.group) return item.group.name;
    return 'a group forming';
}

const AVATAR_PALETTES = [
    'bg-gradient-to-br from-cyan-400 to-blue-500',
    'bg-gradient-to-br from-blue-400 to-purple-500',
    'bg-gradient-to-br from-pink-400 to-rose-500',
    'bg-gradient-to-br from-emerald-400 to-teal-500',
    'bg-gradient-to-br from-orange-400 to-amber-500',
    'bg-gradient-to-br from-purple-400 to-fuchsia-500',
];

function avatarPaletteFor(seed: string): string {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function initials(item: ActivityItem): string {
    if (item.sender.isMe) return 'Y';
    const name = item.sender.displayName ?? item.sender.username ?? '?';
    return name
        .split(/\s+/)
        .map(s => s.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('') || '?';
}

function bodyExcerpt(body: string, max = 80): string {
    const trimmed = body.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= max) return trimmed;
    return trimmed.slice(0, max - 1).trimEnd() + '…';
}

function ActivityRow({ item, compact }: { item: ActivityItem; compact: boolean }) {
    const palette = avatarPaletteFor(item.sender.id);
    const sender = senderLabel(item);
    const where = groupLabel(item);
    const time = relativeTime(item.createdAt);
    const target = item.group ? `/groups/${item.group.slug}/chat` : null;

    const content = (
        <div
            className={`flex w-full items-start transition-colors hover:bg-slate-700/50 ${
                compact ? 'gap-3 p-2 rounded-lg' : 'gap-4 p-4'
            }`}
        >
            <div
                className={`flex-shrink-0 rounded-full ${palette} flex items-center justify-center text-[10px] font-bold text-white ${
                    compact ? 'h-8 w-8' : 'h-10 w-10'
                }`}
            >
                {initials(item)}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`text-white ${compact ? 'text-sm' : 'text-base'}`}>
                    <span className="font-semibold">{sender}</span>{' '}
                    <span className="text-slate-300">in</span>{' '}
                    <span className="font-semibold">{where}</span>
                </p>
                <p className={`truncate text-slate-300 ${compact ? 'text-xs' : 'text-sm'}`}>
                    “{bodyExcerpt(item.body, compact ? 60 : 120)}”
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{time}</p>
            </div>
        </div>
    );

    if (target) {
        return (
            <Link href={target} className="block">
                {content}
            </Link>
        );
    }
    return content;
}

function EmptyState({ compact }: { compact: boolean }) {
    return (
        <div
            className={`rounded-lg border border-dashed border-slate-700/80 bg-slate-900/30 text-slate-400 ${
                compact ? 'p-3 text-xs' : 'p-5 text-sm'
            }`}
        >
            <p className="font-medium text-slate-300">No recent activity yet</p>
            <p className={`mt-1 text-slate-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
                Once you join a group, messages from your groups will show up here.
            </p>
        </div>
    );
}

type Props = {
    limit?: number;
    compact?: boolean;
    /** Override the section header for the full-size variant. */
    showHeader?: boolean;
    href?: string;
};

export default function RecentActivity({
    limit = 3,
    compact = false,
    showHeader = true,
    href = '/activity',
}: Props) {
    const { items, loading, error } = useRecentActivity({ limit });

    const body = (
        <>
            {loading ? <Loading className="mt-1" /> : null}
            {error ? <ErrorMessage message={error} /> : null}
            {!loading && !error ? (
                items.length === 0 ? (
                    <EmptyState compact={compact} />
                ) : compact ? (
                    <div className="space-y-2 rounded-2xl bg-slate-800/60 p-2">
                        {items.map(item => (
                            <ActivityRow key={item.id} item={item} compact />
                        ))}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-700/60 overflow-hidden rounded-2xl bg-slate-800">
                        {items.map(item => (
                            <ActivityRow key={item.id} item={item} compact={false} />
                        ))}
                    </div>
                )
            ) : null}
        </>
    );

    if (compact) {
        return (
            <section>
                {showHeader ? (
                    <h3 className="mb-4 text-lg font-semibold text-white">Recent Activity</h3>
                ) : null}
                {body}
            </section>
        );
    }

    return (
        <section>
            {showHeader ? <SectionHeader title="Recent Activity" href={href} /> : null}
            {body}
        </section>
    );
}
