import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBearerToken } from '../auth.js';

// Password-based routes are deprecated. Use Supabase Auth (magic link / OAuth) directly from the client.

export type AuthRouteDeps = {
  supabasePublic: SupabaseClient | null;
  supabaseAdmin: SupabaseClient | null;
};

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  const { supabaseAdmin } = deps;

  app.post('/auth/signup', async (req, reply) => {
    return reply.status(410).send({
      error:
        'Deprecated: use Supabase magic link / OAuth from the client (this API does not accept passwords).',
    });
  });

  app.post('/auth/login', async (req, reply) => {
    return reply.status(410).send({
      error:
        'Deprecated: use Supabase magic link / OAuth from the client (this API does not accept passwords).',
    });
  });

  app.get('/auth/me', async (req, reply) => {
    if (!supabaseAdmin) {
      return reply.status(501).send({
        error: 'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    const token = getBearerToken(req);
    if (!token) {
      return reply.status(401).send({ error: 'Missing bearer token' });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    return reply.send({ user: data.user });
  });
}
