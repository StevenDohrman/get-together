import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User as AppUser } from '@prisma/client';
import { requireAuthenticatedUser } from './auth.js';
import { resolveAppUser } from './routes/profile.js';

export const APP_USER_REQUIRED_MESSAGE =
  'Create your app profile (username / display name flow) before using matching and groups.';

/**
 * Authenticates via Supabase JWT and resolves the Prisma {@link AppUser} row.
 * Sends 401/501 from {@link requireAuthenticatedUser}, or 400 if the user row is missing.
 */
export async function requireAppUser(
  req: FastifyRequest,
  reply: FastifyReply,
  supabaseAdmin: SupabaseClient | null,
): Promise<AppUser | null> {
  const authUser = await requireAuthenticatedUser(req, reply, supabaseAdmin);
  if (!authUser) return null;

  const row = await resolveAppUser(authUser);
  if (!row) {
    await reply.status(400).send({ error: APP_USER_REQUIRED_MESSAGE });
    return null;
  }

  return row;
}
