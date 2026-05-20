import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Bucket that holds user-uploaded profile photos. Files are stored as:
 *   user-photos/<auth.uid()>/<uuid>.<ext>
 *
 * Browsers upload directly to Supabase Storage; the API only validates URLs and
 * removes objects when their owning `UserPhoto` row is deleted.
 */
export const USER_PHOTOS_BUCKET = 'user-photos';

const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${USER_PHOTOS_BUCKET}/`;

export type PhotoUrlValidation =
  | { ok: true; objectKey: string }
  | { ok: false; error: string };

/**
 * Confirms the URL points at the configured Supabase project's
 * `user-photos` bucket, inside the signed-in user's own folder.
 *
 * If `supabaseUrl` is null (e.g. tests that haven't stubbed it), validation is
 * skipped so legacy URL-only flows still work; production servers always pass
 * SUPABASE_URL so the strict path is exercised.
 */
export function validatePhotoUrl(
  rawUrl: string,
  supabaseUrl: string | null,
  authUserId: string,
): PhotoUrlValidation {
  if (!supabaseUrl) return { ok: true, objectKey: '' };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Photo URL is not a valid URL' };
  }

  let projectHost: string;
  try {
    projectHost = new URL(supabaseUrl).host;
  } catch {
    return { ok: false, error: 'Server is misconfigured: invalid SUPABASE_URL' };
  }

  if (parsed.host !== projectHost) {
    return { ok: false, error: 'Photo URL must point at this project\'s Supabase Storage' };
  }

  if (!parsed.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) {
    return { ok: false, error: `Photo URL must reference the ${USER_PHOTOS_BUCKET} bucket` };
  }

  const objectKey = decodeURIComponent(parsed.pathname.slice(PUBLIC_OBJECT_PREFIX.length));
  if (!objectKey) {
    return { ok: false, error: 'Photo URL is missing the object path' };
  }

  const [ownerFolder, ...rest] = objectKey.split('/');
  if (!ownerFolder || rest.length === 0 || rest.some(part => part.length === 0)) {
    return { ok: false, error: 'Photo URL must include a file inside your folder' };
  }

  if (ownerFolder !== authUserId) {
    return { ok: false, error: 'Photo URL must live in your own storage folder' };
  }

  return { ok: true, objectKey };
}

/**
 * Best-effort deletion of the storage object backing a stored photo URL.
 * Failures are reported back to the caller but the photo row is removed regardless,
 * so the user is never blocked from cleaning up their deck because of a stale object.
 */
export async function removeStorageObjectForUrl(
  rawUrl: string,
  supabaseAdmin: Pick<SupabaseClient, 'storage'> | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!supabaseAdmin) return { ok: false, reason: 'no supabase admin client' };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }

  if (!parsed.pathname.startsWith(PUBLIC_OBJECT_PREFIX)) {
    return { ok: false, reason: 'not a user-photos URL' };
  }

  const objectKey = decodeURIComponent(parsed.pathname.slice(PUBLIC_OBJECT_PREFIX.length));
  if (!objectKey) return { ok: false, reason: 'empty object key' };

  const { error } = await supabaseAdmin.storage.from(USER_PHOTOS_BUCKET).remove([objectKey]);
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}
