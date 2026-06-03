'use client';

import { apiJson } from '@/lib/api';
import type {
  EventMessagePayload,
  RsvpStatus,
  User,
} from '@/lib/chat';
import { useCallback, useMemo, useState } from 'react';

export type EventMessageCardProps = {
  chatId: string;
  event: EventMessagePayload;
  /** Sender shown above the card (the proposer). */
  proposer: User;
  /** ID of the currently signed-in user (Prisma User.id), if known. */
  currentUserId: string | null;
  /** Called when the user's own RSVP changes; receives the updated event. */
  onEventUpdated?: (next: EventMessagePayload) => void;
};

const STATUS_OPTIONS: Array<{
  status: RsvpStatus;
  label: string;
  icon: string;
  activeClass: string;
}> = [
  {
    status: 'GOING',
    label: 'Going',
    icon: '✓',
    activeClass:
      'border-emerald-400/70 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/40',
  },
  {
    status: 'MAYBE',
    label: 'Maybe',
    icon: '?',
    activeClass:
      'border-amber-400/70 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-900/40',
  },
  {
    status: 'NOT_GOING',
    label: "Can't go",
    icon: '✕',
    activeClass:
      'border-rose-400/70 bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-900/40',
  },
];

function formatDateRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const startDate = start.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTime = start.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!endsAt) return `${startDate} · ${startTime}`;

  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const endTime = end.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) {
    return `${startDate} · ${startTime} – ${endTime}`;
  }
  const endDate = end.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return `${startDate} ${startTime} – ${endDate} ${endTime}`;
}

function senderName(user: User): string {
  return user.displayName ?? user.username ?? 'Someone';
}

function statusButtonClass(active: boolean, activeClass: string): string {
  const base =
    'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60';
  return active
    ? `${base} ${activeClass}`
    : `${base} border-slate-700/80 bg-slate-800/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800`;
}

export default function EventMessageCard({
  chatId,
  event,
  proposer,
  currentUserId,
  onEventUpdated,
}: EventMessageCardProps) {
  const [submitting, setSubmitting] = useState<RsvpStatus | 'CLEAR' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const acc: Record<RsvpStatus, number> = {
      GOING: 0,
      MAYBE: 0,
      NOT_GOING: 0,
    };
    for (const r of event.rsvps) acc[r.status] += 1;
    return acc;
  }, [event.rsvps]);

  const myRsvp = useMemo<RsvpStatus | null>(() => {
    if (!currentUserId) return null;
    return (
      event.rsvps.find((r) => r.user.id === currentUserId)?.status ?? null
    );
  }, [event.rsvps, currentUserId]);

  const setRsvp = useCallback(
    async (next: RsvpStatus) => {
      if (submitting) return;
      setSubmitting(next);
      setError(null);
      try {
        const res = await apiJson<{ event: EventMessagePayload }>(
          `/me/chats/${chatId}/events/${event.eventId}/rsvp`,
          'PUT',
          { status: next },
        );
        onEventUpdated?.(res.event);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to RSVP');
      } finally {
        setSubmitting(null);
      }
    },
    [chatId, event.eventId, onEventUpdated, submitting],
  );

  const clearRsvp = useCallback(async () => {
    if (submitting) return;
    setSubmitting('CLEAR');
    setError(null);
    try {
      const res = await apiJson<{ event: EventMessagePayload }>(
        `/me/chats/${chatId}/events/${event.eventId}/rsvp`,
        'DELETE',
      );
      onEventUpdated?.(res.event);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to clear RSVP');
    } finally {
      setSubmitting(null);
    }
  }, [chatId, event.eventId, onEventUpdated, submitting]);

  const goingList = event.rsvps.filter((r) => r.status === 'GOING');

  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40 opacity-60 blur-md"
      />

      <article className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/80 shadow-xl backdrop-blur-xl">
        {/* Gradient ribbon header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-600 px-4 py-2.5 text-white">
          <div className="pointer-events-none absolute -right-16 -top-12 h-40 w-40 rounded-full bg-orange-400 opacity-40 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-indigo-400 opacity-40 blur-3xl" />

          <div className="relative flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-base backdrop-blur-sm"
            >
              📅
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-100/90">
              Event proposed by {senderName(proposer)}
            </p>
          </div>
        </div>

        <div className="p-4">
          <h3 className="text-base font-bold text-white">{event.title}</h3>

          {event.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {event.description}
            </p>
          ) : null}

          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-800/40 px-3 py-2">
              <span aria-hidden className="text-base">🕒</span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  When
                </p>
                <p className="mt-0.5 text-slate-200">
                  {formatDateRange(event.startsAt, event.endsAt)}
                </p>
              </div>
            </div>

            {event.locationName || event.locationAddress ? (
              <div className="flex items-start gap-2 rounded-xl border border-slate-800/80 bg-slate-800/40 px-3 py-2">
                <span aria-hidden className="text-base">📍</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Where
                  </p>
                  <p className="mt-0.5 truncate text-slate-200">
                    {event.locationName ?? ''}
                    {event.locationName && event.locationAddress ? ' · ' : ''}
                    {event.locationAddress ?? ''}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* RSVP buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.status}
                type="button"
                className={statusButtonClass(
                  myRsvp === opt.status,
                  opt.activeClass,
                )}
                disabled={submitting !== null || !currentUserId}
                onClick={() => void setRsvp(opt.status)}
              >
                <span aria-hidden>{opt.icon}</span>
                {submitting === opt.status ? 'Saving…' : opt.label}
              </button>
            ))}
            {myRsvp ? (
              <button
                type="button"
                className="rounded-xl border border-transparent px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200 disabled:opacity-60"
                disabled={submitting !== null}
                onClick={() => void clearRsvp()}
              >
                {submitting === 'CLEAR' ? 'Clearing…' : 'Clear'}
              </button>
            ) : null}
          </div>

          {/* Counts */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {counts.GOING} going
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-300 ring-1 ring-amber-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {counts.MAYBE} maybe
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 font-semibold text-rose-300 ring-1 ring-rose-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              {counts.NOT_GOING} declined
            </span>
          </div>

          {goingList.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Going: </span>
              {goingList.map((r) => senderName(r.user)).join(', ')}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
