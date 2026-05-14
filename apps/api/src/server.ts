import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import Fastify from 'fastify';
import { getBearerToken } from './auth.js';
import { getEnv } from './env.js';
import { registerInterestsRoutes } from './routes/interests.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerInterestsRoutes } from './routes/interests.js';

export function buildServer() {
  const env = getEnv();

  const app = Fastify({
    logger: {
      redact: {
        paths: ['req.headers.authorization'],
        remove: true,
      },
    },
  });

  app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const supabasePublic =
    env.SUPABASE_URL && env.SUPABASE_ANON_KEY
      ? createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  const supabaseAdmin =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  registerAuthRoutes(app, { supabasePublic, supabaseAdmin });
  registerInterestsRoutes(app, { supabaseAdmin });

  app.get('/health', async () => {
    return { ok: true };
  });

  app.get('/me', async (req, reply) => {
    if (!supabaseAdmin) {
      return reply.status(501).send({
        error:
          'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
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

    return { user: data.user };
  });

  return app;
}
