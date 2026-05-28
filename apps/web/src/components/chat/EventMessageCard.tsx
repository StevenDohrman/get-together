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

const STATUS_OPTIONS: Array<{ status: RsvpStatus; label: string }> = [
  { status: 'GOING', label: 'Going' },
  { status: 'MAYBE', label: 'Maybe' },
  { status: 'NOT_GOING', label: "Can't go" },
];

function formatDateRange(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  if (!endsAt) return start.toLocaleString();

  const end = new Date(endsAt);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${start.toLocaleString()} – ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  return `${start.toLocaleString()} – ${end.toLocaleString()}`;
}

function senderName(user: User): string {
  return user.displayName ?? user.username ?? 'Someone';
}

function statusButtonClass(active: boolean): string {
  const base =
    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors';
  return active
    ? `${base} border-purple-500 bg-purple-600 text-white`
    : `${base} border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800`;
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
    <div className="rounded-lg border border-purple-700/40 bg-slate-800/60 p-3">
      <p className="text-xs uppercase tracking-wider text-purple-300">
        Event proposed by {senderName(proposer)}
      </p>

      <h3 className="mt-1 text-base font-semibold text-white">{event.title}</h3>

      {event.description ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
          {event.description}
        </p>
      ) : null}

      <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-300 sm:grid-cols-[max-content_1fr] sm:gap-x-3">
        <dt className="font-medium text-slate-400">When</dt>
        <dd>{formatDateRange(event.startsAt, event.endsAt)}</dd>

        {event.locationName || event.locationAddress ? (
          <>
            <dt className="font-medium text-slate-400">Where</dt>
            <dd>
              {event.locationName ?? ''}
              {event.locationName && event.locationAddress ? ' · ' : ''}
              {event.locationAddress ?? ''}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.status}
            type="button"
            className={statusButtonClass(myRsvp === opt.status)}
            disabled={submitting !== null || !currentUserId}
            onClick={() => void setRsvp(opt.status)}
          >
            {submitting === opt.status ? 'Saving…' : opt.label}
          </button>
        ))}
        {myRsvp ? (
          <button
            type="button"
            className="rounded-md border border-transparent px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
            disabled={submitting !== null}
            onClick={() => void clearRsvp()}
          >
            {submitting === 'CLEAR' ? 'Clearing…' : 'Clear'}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-slate-400">
        <span className="font-medium text-emerald-300">{counts.GOING}</span> going
        {' · '}
        <span className="font-medium text-amber-300">{counts.MAYBE}</span> maybe
        {' · '}
        <span className="font-medium text-rose-300">{counts.NOT_GOING}</span>{' '}
        declined
      </p>

      {goingList.length > 0 ? (
        <p className="mt-1 text-xs text-slate-500">
          Going: {goingList.map((r) => senderName(r.user)).join(', ')}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
