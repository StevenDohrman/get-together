import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getBearerToken } from '../auth.js';

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

async function resolveAuthedUser(
  supabaseAdmin: SupabaseClient,
  req: FastifyRequest,
) {
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

  const interestIds = (rows ?? []).map((row: any) => row.interestId);
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
    (interests ?? []).map((interest: any) => [interest.id, interest]),
  );
  const merged = (rows ?? [])
    .map((row: any) => {
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

export function registerInterestsRoutes(
  app: FastifyInstance,
  deps: InterestsRouteDeps,
) {
  const { supabaseAdmin } = deps;

  app.get('/interests', async (req, reply) => {
    if (!supabaseAdmin) {
      return reply.status(501).send({
        error:
          'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    const q =
      typeof (req.query as any)?.q === 'string'
        ? String((req.query as any).q).trim()
        : '';

    let query = supabaseAdmin
      .from('Interest')
      .select('id, slug, name, createdAt');
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    const { data, error } = await query.order('name', { ascending: true });

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.send({ interests: data ?? [] });
  });

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

      const validIds = new Set((interestRows ?? []).map((row: any) => row.id));
      const invalidId = interestIds.find((id) => !validIds.has(id));
      if (invalidId) {
        return reply
          .status(400)
          .send({ error: `Unknown interestId: ${invalidId}` });
      }
    }

    const upsertPayload = Array.from(deduped.entries()).map(
      ([interestId, weight]) => ({
        userId: resolved.user.id,
        interestId,
        weight,
      }),
    );

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
      .map((row: any) => row.interestId)
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

  // Return a tree of interests (nested children). Optional `depth` query param.
  app.get('/interests/tree', async (req, reply) => {
    const rawDepth = parseInt(String((req.query as any)?.depth ?? '5'), 10);
    const depth = Number.isFinite(rawDepth)
      ? Math.min(Math.max(rawDepth, 0), 10)
      : 5;
    if (!supabaseAdmin)
      return reply.status(501).send({ error: 'Supabase admin not configured' });

    // Load interests and relations, then assemble tree in-memory
    const [
      { data: interests, error: interestsError },
      { data: relations, error: relationsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('Interest')
        .select('id,slug,name,metadata,is_root,createdAt'),
      supabaseAdmin.from('InterestRelation').select('parent_id,child_id'),
    ]);

    if (interestsError || relationsError) {
      return reply
        .status(500)
        .send({ error: interestsError?.message ?? relationsError?.message });
    }

    if (!interests)
      return reply.status(500).send({ error: 'Failed to load interests' });

    const byId = new Map();
    interests.forEach((i: any) => byId.set(i.id, { ...i, children: [] }));

    (relations ?? []).forEach((r: any) => {
      const parent = byId.get(r.parent_id);
      const child = byId.get(r.child_id);
      if (parent && child) parent.children.push(child);
    });

    // Roots: explicit is_root or nodes with no incoming edges
    const hasParent = new Set((relations ?? []).map((r: any) => r.child_id));
    const roots = [] as any[];
    for (const node of byId.values()) {
      if (node.is_root || !hasParent.has(node.id)) roots.push(node);
    }

    // Optionally trim depth
    function trim(node: any, d: number) {
      if (d <= 0) return { id: node.id, name: node.name };
      return {
        ...node,
        children: node.children.map((c: any) => trim(c, d - 1)),
      };
    }

    return reply.send({ tree: roots.map((r) => trim(r, depth)) });
  });

  // Return related interests up to N hops
  app.get('/interests/:id/related', async (req, reply) => {
    const { id } = req.params as any;
    const depth = parseInt(String((req.query as any)?.depth ?? '1'), 10);
    if (!supabaseAdmin)
      return reply.status(501).send({ error: 'Supabase admin not configured' });

    const { data: allRels, error: relsError } = await supabaseAdmin
      .from('InterestRelation')
      .select('parent_id,child_id');
    if (relsError) return reply.status(500).send({ error: relsError.message });

    // BFS
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

    const ids = Array.from(result).filter((x) => x !== id);
    const { data: interests } = await supabaseAdmin
      .from('Interest')
      .select('id,slug,name,metadata')
      .in('id', ids);
    return reply.send({ related: interests ?? [] });
  });

  // Return embedding for an interest
  app.get('/interests/:id/embedding', async (req, reply) => {
    const { id } = req.params as any;
    if (!supabaseAdmin)
      return reply.status(501).send({ error: 'Supabase admin not configured' });

    const { data, error } = await supabaseAdmin
      .from('InterestEmbedding')
      .select('vector,model,created_at')
      .eq('interest_id', id)
      .single();
    if (error && error.code !== 'PGRST116')
      return reply.status(500).send({ error: error.message });
    return reply.send({ embedding: data ?? null });
  });
}
