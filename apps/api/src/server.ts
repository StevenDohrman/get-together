import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import Fastify from 'fastify';
import { requireAuthenticatedUser } from './auth.js';
import { getEnv, type Env } from './env.js';
import { registerActivityRoutes } from './routes/activity.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerChatEventsRoutes } from './routes/chatEvents.js';
import { registerChatsRoutes } from './routes/chats.js';
import { registerEventsRoutes } from './routes/events.js';
import { registerGroupsRoutes } from './routes/groups.js';
import { registerInterestsRoutes } from './routes/interests.js';
import { registerMatchingRoutes } from './routes/matching.js';
import { registerProfileRoutes } from './routes/profile.js';
import { createChatBroadcaster } from './services/realtimeBroadcast.js';

function parseCorsOriginList(raw: string | undefined): Set<string> {
  const trimmed = raw?.trim();
  if (!trimmed) return new Set();
  return new Set(
    trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Next.js / Vite etc. on loopback, any port (incl. [::1]) when not using an explicit CORS list. */
function isDevLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
}

function isCorsOriginAllowed(origin: string | undefined, env: Env): boolean {
  if (origin === undefined || origin.length === 0) return true;

  const explicit = env.API_CORS_ORIGINS?.trim();
  if (explicit) {
    return parseCorsOriginList(explicit).has(origin);
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return isDevLoopbackOrigin(origin);
}

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
    origin: (origin, cb) => {
      if (!isCorsOriginAllowed(origin, env)) {
        cb(null, false);
        return;
      }
      if (origin === undefined || origin.length === 0) {
        cb(null, true);
        return;
      }
      cb(null, origin);
    },
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  const supabaseAdmin =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  // Chat realtime broadcaster: publishes to Supabase Realtime over the
  // service-role REST endpoint. Null when SUPABASE_URL/SERVICE_ROLE_KEY
  // aren't configured (tests, local-only setups). Callers tolerate this.
  const broadcaster =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createChatBroadcaster({
          supabaseUrl: env.SUPABASE_URL,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
          onError: (data, msg) => app.log.error(data, msg),
        })
      : null;

  registerAuthRoutes(app, { supabaseAdmin });
  registerInterestsRoutes(app, { supabaseAdmin });
  registerProfileRoutes(app, {
    supabaseAdmin,
    supabaseUrl: env.SUPABASE_URL ?? null,
  });
  registerMatchingRoutes(app, { supabaseAdmin });
  registerGroupsRoutes(app, { supabaseAdmin });
  registerChatsRoutes(app, { supabaseAdmin, broadcaster });
  registerChatEventsRoutes(app, { supabaseAdmin, broadcaster });
  registerEventsRoutes(app, { supabaseAdmin });
  registerActivityRoutes(app, { supabaseAdmin });

  app.get('/health', async () => {
    return { ok: true };
  });

  app.get('/me', async (req, reply) => {
    const user = await requireAuthenticatedUser(req, reply, supabaseAdmin);
    if (!user) return;
    return { user };
  });

  return app;
}
