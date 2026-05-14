import type { SupabaseClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';

export type InterestsRouteDeps = {
  supabaseAdmin: SupabaseClient | null;
};

export function registerInterestsRoutes(app: FastifyInstance, deps: InterestsRouteDeps) {
  const { supabaseAdmin } = deps;

  app.get('/interests', async (req, reply) => {
    if (!supabaseAdmin) {
      return reply.status(501).send({
        error: 'Supabase admin auth is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    const { data, error } = await supabaseAdmin
      .from('Interest')
      .select('id, slug, name, createdAt')
      .order('name', { ascending: true });

    if (error) {
      return reply.status(500).send({ error: error.message });
    }

    return reply.send({ interests: data ?? [] });
  });

  // Return a tree of interests (nested children). Optional `depth` query param.
  app.get('/interests/tree', async (req, reply) => {
    const rawDepth = parseInt(String((req.query as any)?.depth ?? '5'), 10);
    const depth = Number.isFinite(rawDepth) ? Math.min(Math.max(rawDepth, 0), 10) : 5;
    if (!supabaseAdmin) return reply.status(501).send({ error: 'Supabase admin not configured' });

    // Load interests and relations, then assemble tree in-memory
    const [
      { data: interests, error: interestsError },
      { data: relations, error: relationsError },
    ] = await Promise.all([
      supabaseAdmin.from('Interest').select('id,slug,name,metadata,is_root,createdAt'),
      supabaseAdmin.from('InterestRelation').select('parent_id,child_id'),
    ]);

    if (interestsError || relationsError) {
      return reply.status(500).send({ error: interestsError?.message ?? relationsError?.message });
    }

    if (!interests) return reply.status(500).send({ error: 'Failed to load interests' });

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
      return { ...node, children: node.children.map((c: any) => trim(c, d - 1)) };
    }

    return reply.send({ tree: roots.map(r => trim(r, depth)) });
  });

  // Return related interests up to N hops
  app.get('/interests/:id/related', async (req, reply) => {
    const { id } = req.params as any;
    const depth = parseInt(String((req.query as any)?.depth ?? '1'), 10);
    if (!supabaseAdmin) return reply.status(501).send({ error: 'Supabase admin not configured' });

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
      for (const r of (allRels ?? [])) {
        if (frontier.includes(r.parent_id) && !visited.has(r.child_id)) {
          visited.add(r.child_id); result.add(r.child_id); next.push(r.child_id);
        }
        if (frontier.includes(r.child_id) && !visited.has(r.parent_id)) {
          visited.add(r.parent_id); result.add(r.parent_id); next.push(r.parent_id);
        }
      }
      frontier = next;
    }

    const ids = Array.from(result).filter(x => x !== id);
    const { data: interests } = await supabaseAdmin.from('Interest').select('id,slug,name,metadata').in('id', ids);
    return reply.send({ related: interests ?? [] });
  });

  // Return embedding for an interest
  app.get('/interests/:id/embedding', async (req, reply) => {
    const { id } = req.params as any;
    if (!supabaseAdmin) return reply.status(501).send({ error: 'Supabase admin not configured' });

    const { data, error } = await supabaseAdmin.from('InterestEmbedding').select('vector,model,created_at').eq('interest_id', id).single();
    if (error && error.code !== 'PGRST116') return reply.status(500).send({ error: error.message });
    return reply.send({ embedding: data ?? null });
  });
}
