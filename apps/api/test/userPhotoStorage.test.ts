import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { removeStorageObjectForUrl, validatePhotoUrl } from '../src/services/userPhotoStorage.js';

const supabaseUrl = 'https://example.supabase.co';
const authUserId = 'user-123';

describe('validatePhotoUrl', () => {
  it('rejects invalid percent-encoding in object path', () => {
    const result = validatePhotoUrl(
      `${supabaseUrl}/storage/v1/object/public/user-photos/${authUserId}/bad%ZZ.jpg`,
      supabaseUrl,
      authUserId,
    );
    assert.deepEqual(result, {
      ok: false,
      error: 'Photo URL has invalid encoding in the object path',
    });
  });

  it('rejects nested object keys', () => {
    const nested = validatePhotoUrl(
      `${supabaseUrl}/storage/v1/object/public/user-photos/${authUserId}/nested/file.jpg`,
      supabaseUrl,
      authUserId,
    );
    assert.deepEqual(nested, {
      ok: false,
      error: 'Photo URL must include a file inside your folder',
    });
  });
});

describe('removeStorageObjectForUrl', () => {
  it('rejects invalid percent-encoding in object path', async () => {
    const removeCalls: string[][] = [];
    const supabaseAdmin = {
      storage: {
        from() {
          return {
            async remove(paths: string[]) {
              removeCalls.push(paths);
              return { error: null };
            },
          };
        },
      },
    };

    const result = await removeStorageObjectForUrl(
      `${supabaseUrl}/storage/v1/object/public/user-photos/${authUserId}/bad%ZZ.jpg`,
      supabaseAdmin,
    );
    assert.deepEqual(result, { ok: false, reason: 'invalid encoded object key' });
    assert.deepEqual(removeCalls, []);
  });
});
