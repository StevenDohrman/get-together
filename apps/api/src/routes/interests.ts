import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getBearerToken, requireAuthenticatedUser } from '../auth.js';
import { escapeLikePattern, sanitizeUserInput } from '../sanitization.js';

export type InterestsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

const userInterestInputSchema = z.object({
  interests: z.array(
    z.object({
      interestId: z.string().uuid(),
      weight: z.number().int().min(0).max(10),
    }),
  ),
});

type InterestRow = {
  id: string;
  slug: string;
  name: string;
  metadata: unknown;
  is_root: boolean;
  createdAt: string;
};

type TreeNode = InterestRow & { children: TreeNode[] };

async function resolveAuthedUser(supabaseAdmin: SupabaseClient, req: FastifyRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { error: 'Missing bearer token' } as const;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { error: 'Invalid token' } as const;
  }

  const email = data.user.email;
  if (!email) {
    return { error: 'Authenticated user is missing an email address' } as const;
  }

  const displayName =
    data.user.user_metadata?.full_name ??
    data.user.user_metadata?.name ??
    data.user.user_metadata?.username ??
    null;

  const { data: userById, error: userByIdError } = await supabaseAdmin
    .from('User')
    .select('id,email,displayName')
    .eq('id', data.user.id)
    .maybeSingle();

  if (userByIdError) {
    return { error: userByIdError.message } as const;
  }

  if (userById) {
    return { user: userById } as const;
  }

  const { data: userByEmail, error: userByEmailError } = await supabaseAdmin
    .from('User')
    .select('id,email,displayName')
    .eq('email', email)
    .maybeSingle();

  if (userByEmailError) {
    return { error: userByEmailError.message } as const;
  }

  if (userByEmail) {
    return { user: userByEmail } as const;
  }

  const { data: appUser, error: createError } = await supabaseAdmin
    .from('User')
    .upsert(
      {
        id: data.user.id,
        email,
        displayName,
        supabase_auth_id: data.user.id,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('id,email,displayName')
    .single();

  if (createError || !appUser) {
    return {
      error: createError?.message ?? 'Failed to resolve app user',
    } as const;
  }

  return { user: appUser } as const;
}

async function loadInterestRows(supabaseAdmin: SupabaseClient, userId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from('UserInterest')
    .select('interestId,weight,createdAt')
    .eq('userId', userId)
    .order('createdAt', { ascending: true });

  if (error) {
    return { error: error.message } as const;
  }

  const interestIds = (rows ?? []).map((row: { interestId: string }) => row.interestId);
  if (interestIds.length === 0) {
    return { interests: [] } as const;
  }

  const { data: interests, error: interestsError } = await supabaseAdmin
    .from('Interest')
    .select('id,slug,name,createdAt')
    .in('id', interestIds);

  if (interestsError) {
    return { error: interestsError.message } as const;
  }

  const interestById = new Map(
    (interests ?? []).map((interest: { id: string }) => [interest.id, interest]),
  );
  const merged = (rows ?? [])
    .map((row: { interestId: string; weight: number }) => {
      const interest = interestById.get(row.interestId);
      if (!interest) return null;
      return {
        ...interest,
        weight: row.weight,
      };
    })
    .filter(Boolean);

  return { interests: merged } as const;
}

export function registerInterestsRoutes(app: FastifyInstance, deps: InterestsRouteDeps) {
  const { supabaseAdmin } = deps;

  app.get('/me/interests', async (req, reply) => {
    if (!supabaseAdmin) {
      return reply.status(501).send({
        error:
          'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    const resolved = await resolveAuthedUser(supabaseAdmin, req);
    if ('error' in resolved) {
      return reply.status(401).send({ error: resolved.error });
    }

    const loaded = await loadInterestRows(supabaseAdmin, resolved.user.id);
    if ('error' in loaded) {
      return reply.status(500).send({ error: loaded.error });
    }

    return reply.send({ interests: loaded.interests });
  });

  app.put('/me/interests', async (req, reply) => {
    if (!supabaseAdmin) {
      return reply.status(501).send({
        error:
          'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    const resolved = await resolveAuthedUser(supabaseAdmin, req);
    if ('error' in resolved) {
      return reply.status(401).send({ error: resolved.error });
    }

    const parsed = userInterestInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Invalid interests payload',
      });
    }

    const deduped = new Map<string, number>();
    for (const item of parsed.data.interests) {
      deduped.set(item.interestId, item.weight);
    }

    const interestIds = Array.from(deduped.keys());

    if (interestIds.length > 0) {
      const { data: interestRows, error: interestError } = await supabaseAdmin
        .from('Interest')
        .select('id')
        .in('id', interestIds);

      if (interestError) {
        return reply.status(500).send({ error: interestError.message });
      }

      const validIds = new Set((interestRows ?? []).map((row: { id: string }) => row.id));
      const invalidId = interestIds.find(id => !validIds.has(id));
      if (invalidId) {
        return reply.status(400).send({ error: `Unknown interestId: ${invalidId}` });
      }
    }

    const upsertPayload = Array.from(deduped.entries()).map(([interestId, weight]) => ({
      userId: resolved.user.id,
      interestId,
      weight,
    }));

    if (upsertPayload.length > 0) {
      const { error } = await supabaseAdmin
        .from('UserInterest')
        .upsert(upsertPayload, { onConflict: 'userId,interestId' });

      if (error) {
        return reply.status(500).send({ error: error.message });
      }
    }

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('UserInterest')
      .select('interestId')
      .eq('userId', resolved.user.id);

    if (existingError) {
      return reply.status(500).send({ error: existingError.message });
    }

    const keepIdSet = new Set(interestIds);
    const deleteIds = (existingRows ?? [])
      .map((row: { interestId: string }) => row.interestId)
      .filter((interestId: string) => !keepIdSet.has(interestId));

    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from('UserInterest')
        .delete()
        .eq('userId', resolved.user.id)
        .in('interestId', deleteIds);

      if (deleteError) {
        return reply.status(500).send({ error: deleteError.message });
      }
    }

    const loaded = await loadInterestRows(supabaseAdmin, resolved.user.id);
    if ('error' in loaded) {
      return reply.status(500).send({ error: loaded.error });
    }

    return reply.send({ interests: loaded.interests });
  });

  app.register(
    async function interestsScope(instance) {
      instance.addHook('preHandler', async (req, reply) => {
        const user = await requireAuthenticatedUser(req, reply, supabaseAdmin);
        if (!user) return;
      });

      instance.get('/', async (req, reply) => {
        if (!supabaseAdmin) {
          return reply.status(501).send({
            error:
              'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
          });
        }

        const q = escapeLikePattern(sanitizeUserInput((req.query as { q?: string })?.q));

        let query = supabaseAdmin.from('Interest').select('id, slug, name, createdAt');
        if (q) {
          query = query.ilike('name', `%${q}%`);
        }

        const { data, error } = await query.order('name', { ascending: true });

        if (error) {
          return reply.status(500).send({ error: error.message });
        }

        return reply.send({ interests: data ?? [] });
      });

      instance.get('/tree', async (req, reply) => {
        const rawDepth = parseInt(String((req.query as { depth?: string })?.depth ?? '5'), 10);
        const depth = Number.isFinite(rawDepth) ? Math.min(Math.max(rawDepth, 0), 10) : 5;
        if (!supabaseAdmin) return reply.status(501).send({ error: 'Supabase admin not configured' });

        const [
          { data: interests, error: interestsError },
          { data: relations, error: relationsError },
        ] = await Promise.all([
          supabaseAdmin.from('Interest').select('id,slug,name,metadata,is_root,createdAt'),
          supabaseAdmin.from('InterestRelation').select('parent_id,child_id'),
        ]);

        if (interestsError || relationsError) {
          return reply
            .status(500)
            .send({ error: interestsError?.message ?? relationsError?.message });
        }

        if (!interests) return reply.status(500).send({ error: 'Failed to load interests' });

        const byId = new Map<string, TreeNode>();
        interests.forEach((i: InterestRow) => byId.set(i.id, { ...i, children: [] }));

        (relations ?? []).forEach((r: { parent_id: string; child_id: string }) => {
          const parent = byId.get(r.parent_id);
          const child = byId.get(r.child_id);
          if (parent && child) parent.children.push(child);
        });

        const hasParent = new Set((relations ?? []).map((r: { child_id: string }) => r.child_id));
        const roots: TreeNode[] = [];
        for (const node of byId.values()) {
          if (node.is_root || !hasParent.has(node.id)) roots.push(node);
        }

        function trim(node: TreeNode, d: number): TreeNode | { id: string; name: string } {
          if (d <= 0) return { id: node.id, name: node.name };
          return { ...node, children: node.children.map(c => trim(c, d - 1)) } as TreeNode;
        }

        return reply.send({ tree: roots.map(r => trim(r, depth)) });
      });

      instance.get('/:id/related', async (req, reply) => {
        const { id } = req.params as { id: string };
        const rawDepth = parseInt(String((req.query as { depth?: string })?.depth ?? '1'), 10);
        const depth = Number.isFinite(rawDepth) ? Math.min(Math.max(rawDepth, 0), 10) : 1;
        if (!supabaseAdmin) return reply.status(501).send({ error: 'Supabase admin not configured' });

        const { data: allRels, error: relsError } = await supabaseAdmin
          .from('InterestRelation')
          .select('parent_id,child_id');
        if (relsError) return reply.status(500).send({ error: relsError.message });

        const visited = new Set<string>();
        const result = new Set<string>();
        let frontier = [id];
        for (let d = 0; d < depth; d++) {
          if (frontier.length === 0) break;
          const next: string[] = [];
          for (const r of allRels ?? []) {
            if (frontier.includes(r.parent_id) && !visited.has(r.child_id)) {
              visited.add(r.child_id);
              result.add(r.child_id);
              next.push(r.child_id);
            }
            if (frontier.includes(r.child_id) && !visited.has(r.parent_id)) {
              visited.add(r.parent_id);
              result.add(r.parent_id);
              next.push(r.parent_id);
            }
          }
          frontier = next;
        }

        const ids = Array.from(result).filter(x => x !== id);
        const { data: interests } = await supabaseAdmin
          .from('Interest')
          .select('id,slug,name,metadata')
          .in('id', ids);
        return reply.send({ related: interests ?? [] });
      });

      instance.get('/:id/embedding', async (req, reply) => {
        const { id } = req.params as { id: string };
        if (!supabaseAdmin) return reply.status(501).send({ error: 'Supabase admin not configured' });

        const { data, error } = await supabaseAdmin
          .from('InterestEmbedding')
          .select('vector,model,created_at')
          .eq('interest_id', id)
          .single();
        if (error && error.code !== 'PGRST116') return reply.status(500).send({ error: error.message });
        return reply.send({ embedding: data ?? null });
      });
    },
    { prefix: '/interests' },
  );
}
