export interface TechStackItem {
    icon: string;
    name: string;
    role: string;
    description: string;
}

export const techStack: TechStackItem[] = [
    {
        icon: '⚡',
        name: 'Next.js 16 + React 19',
        role: 'Web app',
        description:
            'App Router-based web client. Pages are server components by default, with islands of interactivity for live data and forms.',
    },
    {
        icon: '🎨',
        name: 'Tailwind CSS v4',
        role: 'Styling',
        description:
            'Utility-first styling with a custom dark palette (slate-950 surfaces, purple-600 accents, indigo→purple→pink gradients).',
    },
    {
        icon: '🚀',
        name: 'Fastify 5 + TypeScript',
        role: 'API server',
        description:
            'High-throughput HTTP API. Routes are organized by domain (profile, matching, groups, chats, events) and registered from a single buildServer entry point.',
    },
    {
        icon: '🛡️',
        name: 'Zod + pino',
        role: 'Validation and logging',
        description:
            'Zod validates request bodies and query parameters before they reach service code. Pino provides structured logs with sensitive headers redacted.',
    },
    {
        icon: '🗄️',
        name: 'Prisma 7 + PostgreSQL + pgvector',
        role: 'Database',
        description:
            'A single Prisma schema models users, interests, groups, swipes, formation proposals, chats, and events. pgvector stores 768-dimensional interest embeddings indexed for cosine similarity.',
    },
    {
        icon: '🔐',
        name: 'Supabase',
        role: 'Auth, Postgres, Realtime',
        description:
            'Supabase provides authentication (JWTs verified by the API), the hosted Postgres instance Prisma talks to, and Realtime broadcast channels for live chat updates.',
    },
    {
        icon: '📦',
        name: 'pnpm workspaces',
        role: 'Monorepo',
        description:
            'apps/web, apps/api, packages/db, and packages/shared live in a single repo so types, schemas, and the generated Prisma client stay in lockstep.',
    },
    {
        icon: '🧠',
        name: 'Text Embeddings Inference (all-mpnet-base-v2)',
        role: 'Interest embeddings',
        description:
            'A Dockerized TEI service generates 768-dim sentence-transformer embeddings for every interest. These are stored in the InterestEmbedding table with an IVFFlat index for fast similarity search.',
    },
];
