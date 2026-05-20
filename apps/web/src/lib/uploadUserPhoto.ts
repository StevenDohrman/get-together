import { getSupabaseBrowserClient } from './supabaseBrowser';

/** Mirrors the bucket-level config in the storage migration. */
export const USER_PHOTOS_BUCKET = 'user-photos';
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class PhotoUploadError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PhotoUploadError';
    this.cause = cause;
  }
}

export type UploadedPhoto = {
  /** Public URL the API expects in `POST /me/photos`. */
  publicUrl: string;
  /** Object key inside the bucket (e.g. `<authId>/<uuid>.jpg`). */
  objectKey: string;
};

function extensionFor(file: File): string {
  // Caller has already MIME-allowlisted the file, so this map always hits.
  // We intentionally do NOT fall back to `file.name` — a hostile filename
  // (e.g. containing `/` or `..`) could otherwise smuggle path separators
  // into the storage object key.
  const fromMime = MIME_TO_EXT[file.type];
  if (!fromMime) {
    throw new PhotoUploadError(`Unsupported file type: ${file.type || 'unknown'}.`);
  }
  return fromMime;
}

function generateId(): string {
  // We require `crypto.randomUUID` (available in every secure browser context).
  // If it's missing, refuse rather than silently falling back to non-crypto
  // randomness — a missing API here usually means an insecure context (HTTP),
  // which is itself something the user should know about.
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new PhotoUploadError(
      'Secure random IDs are unavailable in this browser context (uploads require HTTPS).',
    );
  }
  return crypto.randomUUID();
}

/**
 * Uploads `file` to `user-photos/<authId>/<uuid>.<ext>` using the signed-in
 * user's Supabase session, then returns the public URL the API expects.
 *
 * Mirrors the validation that Supabase Storage + RLS will apply server-side, so
 * users see a clear error before the network round trip.
 */
export async function uploadUserPhoto(file: File): Promise<UploadedPhoto> {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as typeof ALLOWED_PHOTO_MIME_TYPES[number])) {
    throw new PhotoUploadError(
      `Unsupported file type. Use one of: ${ALLOWED_PHOTO_MIME_TYPES.join(', ')}.`,
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    const mb = (MAX_PHOTO_BYTES / (1024 * 1024)).toFixed(0);
    throw new PhotoUploadError(`Photo is too large (max ${mb} MB).`);
  }

  const client = getSupabaseBrowserClient();
  const { data: sessionData, error: sessionError } = await client.auth.getUser();
  if (sessionError || !sessionData.user) {
    throw new PhotoUploadError('You must be signed in to upload a photo.', sessionError);
  }

  const authId = sessionData.user.id;
  const objectKey = `${authId}/${generateId()}.${extensionFor(file)}`;

  const { error: uploadError } = await client.storage
    .from(USER_PHOTOS_BUCKET)
    .upload(objectKey, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '3600',
    });
  if (uploadError) {
    throw new PhotoUploadError(uploadError.message || 'Upload failed', uploadError);
  }

  const { data: publicData } = client.storage.from(USER_PHOTOS_BUCKET).getPublicUrl(objectKey);
  if (!publicData.publicUrl) {
    throw new PhotoUploadError('Upload succeeded but no public URL was returned.');
  }

  return { publicUrl: publicData.publicUrl, objectKey };
}
