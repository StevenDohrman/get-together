import type { FastifyInstance } from 'fastify';
import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import { prismaClient as prisma } from '../db.js';
import { z } from 'zod';
import { requireAuthenticatedUser } from '../auth.js';
import { requireAppUser } from '../requireAppUser.js';
import { removeStorageObjectForUrl, validatePhotoUrl } from '../services/userPhotoStorage.js';

export const MAX_PHOTOS_PER_USER = 6;
const MAX_PHOTO_URL_LENGTH = 2048;

const photoUrlSchema = z.string().url('url must be a valid URL').max(MAX_PHOTO_URL_LENGTH);

const createPhotoBody = z.object({
  url: photoUrlSchema,
  position: z.number().int().min(0).max(MAX_PHOTOS_PER_USER - 1).optional(),
});

const reorderPhotosBody = z.object({
  photoIds: z.array(z.string().uuid()).min(1).max(MAX_PHOTOS_PER_USER),
});

const photoIdParam = z.object({ id: z.string().uuid() });

type PhotoDto = {
  id: string;
  url: string;
  position: number;
};

async function listUserPhotos(appUserId: string): Promise<PhotoDto[]> {
  const rows = await prisma.userPhoto.findMany({
    where: { userId: appUserId },
    orderBy: { position: 'asc' },
    select: { id: true, url: true, position: true },
  });
  return rows.map(r => ({ id: r.id, url: r.url, position: r.position }));
}

async function nextPhotoPosition(appUserId: string): Promise<number> {
  const last = await prisma.userPhoto.findFirst({
    where: { userId: appUserId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return last ? last.position + 1 : 0;
}

export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores');

const displayNameSchema = z
  .string()
  .max(80, 'Display name must be at most 80 characters')
  .transform(s => {
    const t = s.trim();
    return t.length === 0 ? null : t;
  });

export const MAX_BIO_LENGTH = 500;

const bioSchema = z
  .string()
  .max(MAX_BIO_LENGTH, `Bio must be at most ${MAX_BIO_LENGTH} characters`)
  .transform(s => {
    const t = s.trim();
    return t.length === 0 ? null : t;
  });

const geoLocationSchema = z
  .object({
    latitude: z.number().finite().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
    longitude: z.number().finite().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
    accuracy: z.number().optional().nullable(),
    altitude: z.number().optional().nullable(),
    altitudeAccuracy: z.number().optional().nullable(),
    heading: z.number().optional().nullable(),
    speed: z.number().optional().nullable(),
  })
  .nullable();

const patchProfileBody = z
  .object({
    username: z.union([usernameSchema, z.null()]).optional(),
    displayName: z.union([displayNameSchema, z.null()]).optional(),
    bio: z.union([bioSchema, z.null()]).optional(),
    geoLocation: geoLocationSchema.optional(),
  })
  .refine(
    data =>
      data.username !== undefined ||
      data.displayName !== undefined ||
      data.bio !== undefined ||
      data.geoLocation !== undefined,
    {
      message: 'Provide at least one of username, displayName, bio, or geoLocation',
    },
  );

export type ProfileRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
  /**
   * Public origin of the Supabase project (matches `SUPABASE_URL`).
   * Used to verify that registered photo URLs point at this project's `user-photos`
   * bucket and live under the signed-in user's folder. When null, URL validation
   * is skipped (legacy/test mode).
   */
  supabaseUrl: string | null;
};

export async function resolveAppUser(authUser: AuthUser) {
  const sub = authUser.id;
  const email = authUser.email?.trim() ?? '';

  const byId = await prisma.user.findUnique({ where: { id: sub } });
  if (byId) return byId;

  const byAuth = await prisma.user.findUnique({ where: { supabaseAuthId: sub } });
  if (byAuth) return byAuth;

  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && !byEmail.supabaseAuthId) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { supabaseAuthId: sub },
      });
    }
  }

  return null;
}

function isPrismaUniqueViolation(e: unknown): e is { code: string; meta?: { target?: string | string[] } } {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002';
}

export function registerProfileRoutes(app: FastifyInstance, deps: ProfileRouteDeps) {
  const { supabaseAdmin, supabaseUrl } = deps;

  app.get('/profile', async (req, reply) => {
    const authUser = await requireAuthenticatedUser(req, reply, supabaseAdmin);
    if (!authUser) return;

    const row = await resolveAppUser(authUser);

    let savedLocation: string | null = null;
    let photos: PhotoDto[] = [];
    if (row) {
      try {
        const r =
          (await prisma.$queryRaw`SELECT "friendlyName" FROM "UserLocation" WHERE "userId" = ${row.id} LIMIT 1`) as {
            friendlyName: string | null;
          }[];
        savedLocation = r?.[0]?.friendlyName ?? null;
      } catch (err) {
        req.log.warn(err, 'Failed to read saved location');
      }
      photos = await listUserPhotos(row.id);
    }

    return reply.send({
      supabaseUserId: authUser.id,
      email: authUser.email ?? null,
      appUserId: row?.id ?? null,
      username: row?.username ?? null,
      displayName: row?.displayName ?? null,
      bio: row?.bio ?? null,
      savedLocation,
      photos,
    });
  });

  app.patch('/profile', async (req, reply) => {
    const authUser = await requireAuthenticatedUser(req, reply, supabaseAdmin);
    if (!authUser || !supabaseAdmin) return;

    const email = authUser.email?.trim();
    if (!email) {
      return reply.status(400).send({ error: 'Your account has no email address; profile cannot be saved.' });
    }

    const parsed = patchProfileBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid profile',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { username, displayName, bio, geoLocation } = parsed.data;

    try {
      let row = await resolveAppUser(authUser);

      if (!row) {
        row = await prisma.user.create({
          data: {
            supabaseAuthId: authUser.id,
            email,
            ...(username !== undefined && { username }),
            ...(displayName !== undefined && { displayName: displayName }),
            ...(bio !== undefined && { bio }),
          },
        });
      } else {
        row = await prisma.user.update({
          where: { id: row.id },
          data: {
            ...(username !== undefined && { username }),
            ...(displayName !== undefined && { displayName: displayName }),
            ...(bio !== undefined && { bio }),
            email,
          },
        });
      }

      // Keep Supabase JWT metadata in sync for clients that read `user.user_metadata`.
      const nextMeta: Record<string, unknown> = { ...(authUser.user_metadata ?? {}) };
      if (username !== undefined) {
        if (username === null) delete nextMeta.username;
        else nextMeta.username = username;
      }
      if (displayName !== undefined) {
        if (displayName === null) {
          delete nextMeta.display_name;
          delete nextMeta.full_name;
        } else {
          nextMeta.display_name = displayName;
          // Auth UI / OAuth often surface `full_name`; keep both aligned with app display name.
          nextMeta.full_name = displayName;
        }
      }

      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        user_metadata: nextMeta,
      });
      if (metaError) {
        req.log.error(
          metaError,
          'Failed to sync profile to Supabase user_metadata',
        );
        return reply.status(500).send({
          error:
            'Profile saved in database but failed to sync session metadata',
        });
      }

      let cityName = 'Unknown';
      if (geoLocation) {
        try {
          cityName = await nearestCity(
            geoLocation.latitude,
            geoLocation.longitude,
          );
        } catch (err) {
          req.log.warn(err, 'Failed to resolve nearest city');
        }

        // Snap coordinates to a ~1.1 km grid (2 decimal places) BEFORE storing.
        // This is a privacy mitigation: the precise device location is never
        // persisted, so even an attacker with direct DB access can't recover
        // it, and distance computations between any two users are quantized
        // to the same grid. Combined with the API-side bucketing in
        // `distanceBuckets.ts`, this defeats trilateration via Discover.
        const snappedLat = snapCoordinate(geoLocation.latitude);
        const snappedLng = snapCoordinate(geoLocation.longitude);

        try {
          await prisma.$executeRaw`
            INSERT INTO "UserLocation" ("userId","location","friendlyName")
            VALUES (${row.id}, ST_SetSRID(ST_MakePoint(${snappedLng}, ${snappedLat}), 4326), ${cityName})
            ON CONFLICT ("userId") DO UPDATE
            SET location = EXCLUDED.location,
                "friendlyName" = EXCLUDED."friendlyName",
                "updatedAt" = NOW()
          `;
        } catch (err) {
          req.log.error(err, 'Failed to persist user location');
        }
      }

      const photos = await listUserPhotos(row.id);

      return reply.send({
        supabaseUserId: authUser.id,
        email,
        appUserId: row.id,
        username: row.username ?? null,
        displayName: row.displayName ?? null,
        bio: row.bio ?? null,
        savedLocation: cityName,
        photos,
      });
    } catch (e: unknown) {
      if (isPrismaUniqueViolation(e)) {
        const targets = e.meta?.target;
        const t = Array.isArray(targets) ? targets.join(',') : String(targets ?? '');
        if (t.includes('username')) {
          return reply.status(409).send({ error: 'That username is already taken' });
        }
        return reply.status(409).send({ error: 'A unique profile constraint failed' });
      }
      req.log.error(e, 'Failed to update profile');
      return reply.status(500).send({ error: 'Failed to update profile' });
    }
  });

  app.get('/me/photos', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const photos = await listUserPhotos(row.id);
    return reply.send({ photos });
  });

  app.post('/me/photos', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = createPhotoBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    if (!row.supabaseAuthId) {
      return reply.status(400).send({
        error: 'Your profile is missing a Supabase auth id; sign out and back in to refresh it.',
      });
    }

    const urlCheck = validatePhotoUrl(parsed.data.url, supabaseUrl, row.supabaseAuthId);
    if (!urlCheck.ok) {
      return reply.status(400).send({ error: urlCheck.error });
    }

    const existingCount = await prisma.userPhoto.count({ where: { userId: row.id } });
    if (existingCount >= MAX_PHOTOS_PER_USER) {
      return reply.status(400).send({
        error: `You can have at most ${MAX_PHOTOS_PER_USER} photos`,
      });
    }

    const position = parsed.data.position ?? (await nextPhotoPosition(row.id));

    try {
      const created = await prisma.userPhoto.create({
        data: {
          userId: row.id,
          url: parsed.data.url,
          position,
        },
        select: { id: true, url: true, position: true },
      });
      return reply.status(201).send({ photo: created });
    } catch (err: unknown) {
      if (isPrismaUniqueViolation(err)) {
        return reply.status(409).send({
          error: 'Another photo already occupies that position. Reorder photos first.',
        });
      }
      req.log.error(err, 'Failed to create photo');
      return reply.status(500).send({ error: 'Failed to create photo' });
    }
  });

  app.delete('/me/photos/:id', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = photoIdParam.safeParse(req.params);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid id' });
    }

    const existing = await prisma.userPhoto.findFirst({
      where: { id: parsed.data.id, userId: row.id },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Photo not found' });
    }

    await prisma.userPhoto.delete({ where: { id: existing.id } });

    // Best-effort: drop the backing storage object so we don't leak bytes.
    // The row is gone regardless of what storage does.
    const cleanup = await removeStorageObjectForUrl(existing.url, supabaseAdmin);
    if (!cleanup.ok) {
      req.log.warn(
        { photoId: existing.id, reason: cleanup.reason },
        'Failed to delete storage object for photo',
      );
    }

    return reply.status(204).send();
  });

  app.put('/me/photos/order', async (req, reply) => {
    const row = await requireAppUser(req, reply, supabaseAdmin);
    if (!row) return;

    const parsed = reorderPhotosBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid body',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const ids = parsed.data.photoIds;
    const owned = await prisma.userPhoto.findMany({
      where: { userId: row.id },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map(p => p.id));
    if (ids.length !== owned.length || !ids.every(id => ownedSet.has(id))) {
      return reply.status(400).send({
        error: 'photoIds must contain exactly your current photos with no duplicates',
      });
    }

    // Two-phase reorder so we never violate the @@unique([userId, position]) index.
    // First push every photo to a negative slot (-1, -2, ...), then assign final positions.
    await prisma.$transaction(async tx => {
      for (let i = 0; i < ids.length; i += 1) {
        await tx.userPhoto.update({
          where: { id: ids[i]! },
          data: { position: -(i + 1) },
        });
      }
      for (let i = 0; i < ids.length; i += 1) {
        await tx.userPhoto.update({
          where: { id: ids[i]! },
          data: { position: i },
        });
      }
    });

    const photos = await listUserPhotos(row.id);
    return reply.send({ photos });
  });
}

/**
 * Snap a coordinate to a fixed decimal precision to coarsen stored locations.
 * 2 decimal places ≈ a 1.1 km grid at the equator, finer toward the poles —
 * sufficient to defeat trilateration to building level while still allowing
 * "within N miles" buckets to look natural to users.
 */
function snapCoordinate(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

async function nearestCity(
  latitude: number,
  longitude: number,
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { 'User-Agent': 'uconnect-api' } },
    );

    if (!response.ok) return 'Unknown';

    const data = (await response.json()) as {
      address?: { city?: string; town?: string; village?: string };
    };
    return (
      data.address?.city ??
      data.address?.town ??
      data.address?.village ??
      'Unknown'
    );
  } catch {
    return 'Unknown';
  }
}
