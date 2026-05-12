import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBearerToken } from '../auth.js';

const signUpBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type AuthRouteDeps = {
  supabasePublic: SupabaseClient | null;
  supabaseAdmin: SupabaseClient | null;
};

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  const { supabasePublic, supabaseAdmin } = deps;

  app.post('/auth/signup', async (req, reply) => {
    if (!supabasePublic) {
      return reply.status(501).send({
        error: 'Supabase public auth is not configured (SUPABASE_URL, SUPABASE_ANON_KEY)',
      });
    }

    const parsed = signUpBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const { data, error } = await supabasePublic.auth.signUp({ email, password });
    if (error) {
      return reply.status(400).send({ error: error.message });
    }

    // Note: session may be null if email confirmation is enabled.
    return reply.send({ user: data.user, session: data.session });
  });

  app.post('/auth/login', async (req, reply) => {
    if (!supabasePublic) {
      return reply.status(501).send({
        error: 'Supabase public auth is not configured (SUPABASE_URL, SUPABASE_ANON_KEY)',
      });
    }

    const parsed = loginBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid body', details: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;

    const { data, error } = await supabasePublic.auth.signInWithPassword({ email, password });
    if (error) {
      // Avoid leaking too much detail; Supabase already returns a generic message.
      return reply.status(401).send({ error: error.message });
    }

    return reply.send({ user: data.user, session: data.session });
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
