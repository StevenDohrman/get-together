'use client';

import { apiJson } from '@/lib/api';
import type { ChatMessage } from '@/lib/chat';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type CreateEventDialogProps = {
  chatId: string;
  open: boolean;
  onClose: () => void;
  /** Called with the freshly created announce message when the request succeeds. */
  onCreated?: (message: ChatMessage) => void;
};

/**
 * Default the start time to the next round half-hour, in the user's local TZ.
 * Returned as a value suitable for `<input type="datetime-local">`.
 */
function defaultStartLocal(now: Date = new Date()): string {
  const d = new Date(now);
  d.setMinutes(d.getMinutes() <= 30 ? 30 : 60, 0, 0);
  // <input type="datetime-local"> wants `YYYY-MM-DDTHH:mm` in local time.
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert a `<input type="datetime-local">` value (which has no TZ info) into
 * an ISO 8601 string in the user's local TZ.
 */
function localInputToIso(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

export default function CreateEventDialog({
  chatId,
  open,
  onClose,
  onCreated,
}: CreateEventDialogProps) {
  const initialStart = useMemo(() => defaultStartLocal(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [startsAt, setStartsAt] = useState(initialStart);
  const [endsAt, setEndsAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTitle('');
    setDescription('');
    setLocationName('');
    setLocationAddress('');
    setStartsAt(defaultStartLocal());
    setEndsAt('');
    setError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const canSubmit =
    !submitting && title.trim().length > 0 && startsAt.length > 0;

  const submit = useCallback(async () => {
    if (!canSubmit) return;

    const isoStart = localInputToIso(startsAt);
    if (!isoStart) {
      setError('Pick a valid start time.');
      return;
    }
    const isoEnd = endsAt ? localInputToIso(endsAt) : null;
    if (endsAt && !isoEnd) {
      setError('Pick a valid end time.');
      return;
    }
    if (isoEnd && new Date(isoEnd) <= new Date(isoStart)) {
      setError('End time must be after the start.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await apiJson<{ message: ChatMessage }>(
        `/me/chats/${chatId}/events`,
        'POST',
        {
          title: title.trim(),
          description: description.trim() || null,
          locationName: locationName.trim() || null,
          locationAddress: locationAddress.trim() || null,
          startsAt: isoStart,
          endsAt: isoEnd,
        },
      );
      onCreated?.(res.message);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create event');
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    chatId,
    description,
    endsAt,
    locationAddress,
    locationName,
    onClose,
    onCreated,
    startsAt,
    title,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="propose-event-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md">
        <div
          aria-hidden
          className="absolute -inset-px rounded-3xl bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-pink-500/40 opacity-60 blur-xl"
        />

        <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/90 shadow-2xl backdrop-blur-xl">
          {/* Gradient hero header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 px-6 pb-5 pt-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-400 opacity-40 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-16 h-48 w-48 rounded-full bg-indigo-400 opacity-40 blur-3xl" />

            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur-sm"
                >
                  📅
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-100/90">
                    New event
                  </p>
                  <h2
                    id="propose-event-title"
                    className="mt-0.5 text-xl font-bold tracking-tight text-white"
                  >
                    Propose an event
                  </h2>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                onClick={onClose}
              >
                <span aria-hidden className="text-lg leading-none">×</span>
              </button>
            </div>

            <p className="relative mt-3 text-sm text-purple-100/90">
              Members of this chat will be able to RSVP.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4 px-6 py-6">
            <Field label="What" required>
              <input
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                placeholder="Pickup basketball"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </Field>

            <Field label="Details">
              <textarea
                className="block w-full resize-none rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                placeholder="Anything organizers want to share"
                value={description}
                maxLength={2000}
                rows={3}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Starts" required>
                <input
                  type="datetime-local"
                  className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 [color-scheme:dark]"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </Field>
              <Field label="Ends (optional)">
                <input
                  type="datetime-local"
                  className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50 [color-scheme:dark]"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Where">
              <input
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                placeholder="Westwood Rec Center"
                value={locationName}
                maxLength={200}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </Field>

            <Field label="Address">
              <input
                className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-purple-500/70 focus:bg-slate-800 focus:ring-2 focus:ring-purple-500/30 disabled:opacity-50"
                placeholder="1010 Glendon Ave, Los Angeles, CA"
                value={locationAddress}
                maxLength={500}
                onChange={(e) => setLocationAddress(e.target.value)}
              />
            </Field>

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="group relative inline-flex h-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-5 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition-all hover:shadow-purple-900/60 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
                disabled={!canSubmit}
                onClick={() => void submit()}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative flex items-center gap-2">
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Posting…
                    </>
                  ) : (
                    <>
                      <span aria-hidden>✨</span>
                      Post event
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {props.label}
        {props.required ? <span className="ml-0.5 text-rose-400">*</span> : null}
      </span>
      {props.children}
    </label>
  );
}
