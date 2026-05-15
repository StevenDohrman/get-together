import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuthenticatedUser } from '../auth.js';

// Password-based routes are deprecated. Use Supabase Auth (magic link / OAuth) directly from the client.

export type AuthRouteDeps = {
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
    const user = await requireAuthenticatedUser(req, reply, supabaseAdmin);
    if (!user) return;
    return reply.send({ user });
  });
}
