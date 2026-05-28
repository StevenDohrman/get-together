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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-white">Propose an event</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="mt-1 text-xs text-slate-400">
          Members of this chat will be able to RSVP.
        </p>

        <div className="mt-4 space-y-3">
          <Field label="What" required>
            <input
              className="w-full rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-600"
              placeholder="Pickup basketball"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="Details">
            <textarea
              className="w-full resize-none rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-600"
              placeholder="Anything organizers want to share"
              value={description}
              maxLength={2000}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" required>
              <input
                type="datetime-local"
                className="w-full rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-600"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </Field>
            <Field label="Ends (optional)">
              <input
                type="datetime-local"
                className="w-full rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-600"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Where">
            <input
              className="w-full rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-600"
              placeholder="Westwood Rec Center"
              value={locationName}
              maxLength={200}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </Field>

          <Field label="Address">
            <input
              className="w-full rounded bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-800 focus:ring-slate-600"
              placeholder="1010 Glendon Ave, Los Angeles, CA"
              value={locationAddress}
              maxLength={500}
              onChange={(e) => setLocationAddress(e.target.value)}
            />
          </Field>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-2 text-sm text-slate-300 hover:text-white"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {submitting ? 'Posting…' : 'Post event'}
          </button>
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
      <span className="mb-1 block text-xs font-medium text-slate-300">
        {props.label}
        {props.required ? <span className="text-rose-400"> *</span> : null}
      </span>
      {props.children}
    </label>
  );
}
