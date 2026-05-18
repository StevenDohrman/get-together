import type { FastifyInstance } from 'fastify';
import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import { prismaClient as prisma } from '../db.js';
import { z } from 'zod';
import { requireAuthenticatedUser } from '../auth.js';

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
    geoLocation: geoLocationSchema.optional(),
  })
  .refine(data => data.username !== undefined || data.displayName !== undefined, {
    message: 'Provide at least one of username or displayName',
  });

export type ProfileRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
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
  const { supabaseAdmin } = deps;

  app.get('/profile', async (req, reply) => {
    const authUser = await requireAuthenticatedUser(req, reply, supabaseAdmin);
    if (!authUser) return;

    const row = await resolveAppUser(authUser);

    let savedLocation: string | null = null;
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
    }

    return reply.send({
      supabaseUserId: authUser.id,
      email: authUser.email ?? null,
      appUserId: row?.id ?? null,
      username: row?.username ?? null,
      displayName: row?.displayName ?? null,
      savedLocation,
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

    const { username, displayName, geoLocation } = parsed.data;

    try {
      let row = await resolveAppUser(authUser);

      if (!row) {
        row = await prisma.user.create({
          data: {
            supabaseAuthId: authUser.id,
            email,
            ...(username !== undefined && { username }),
            ...(displayName !== undefined && { displayName: displayName }),
          },
        });
      } else {
        row = await prisma.user.update({
          where: { id: row.id },
          data: {
            ...(username !== undefined && { username }),
            ...(displayName !== undefined && { displayName: displayName }),
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

        // Persist the location into PostGIS geography column via raw SQL.
        try {
          await prisma.$executeRaw`
            INSERT INTO "UserLocation" ("userId","location","friendlyName")
            VALUES (${row.id}, ST_SetSRID(ST_MakePoint(${geoLocation.longitude}, ${geoLocation.latitude}), 4326), ${cityName})
            ON CONFLICT ("userId") DO UPDATE
            SET location = EXCLUDED.location,
                "friendlyName" = EXCLUDED."friendlyName",
                "updatedAt" = NOW()
          `;
        } catch (err) {
          req.log.error(err, 'Failed to persist user location');
        }
      }

      return reply.send({
        supabaseUserId: authUser.id,
        email,
        appUserId: row.id,
        username: row.username ?? null,
        displayName: row.displayName ?? null,
        savedLocation: cityName,
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
