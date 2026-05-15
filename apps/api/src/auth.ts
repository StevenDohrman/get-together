import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export function getBearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] ?? null;
}

/**
 * Validates the caller's Supabase access token using the admin client.
 * Sends an error response and returns null when unauthenticated or misconfigured.
 */
export async function requireAuthenticatedUser(
  req: FastifyRequest,
  reply: FastifyReply,
  supabaseAdmin: SupabaseClient | null,
): Promise<User | null> {
  if (!supabaseAdmin) {
    await reply.status(501).send({
      error: 'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
    });
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    await reply.status(401).send({ error: 'Missing bearer token' });
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    await reply.status(401).send({ error: 'Invalid token' });
    return null;
  }

  return data.user;
}
