import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Load env from repo root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({
  path: path.resolve(__dirname, '../.env.local'),
  override: true,
});

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL (or DIRECT_URL) for Prisma client.');
}

const { Pool } = pg;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const EMBEDDING_URL = process.env.EMBEDDING_URL || 'http://localhost:8080';
const MODEL_NAME = process.env.EMBEDDING_MODEL || 'all-mpnet-base-v2';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);

async function healthCheck() {
  try {
    const res = await fetch(EMBEDDING_URL + '/health');
    if (!res.ok) {
      throw new Error(`Health check failed with status ${res.status}`);
    }
    console.log('✓ Embedding service is healthy');
  } catch (err) {
    console.error(
      '✗ Embedding service health check failed:',
      err.message || err,
    );
    console.error('Make sure the all-mpnet-base-v2 model is running in Docker');
    process.exit(1);
  }
}

async function fetchEmbedding(text) {
  const res = await fetch(EMBEDDING_URL + '/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: text, normalize: true }),
  });
  if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json[0]) ? json[0] : json;
}

async function main() {
  await healthCheck();

  console.log('Fetching interests...');
  const interests = await prisma.interest.findMany({
    select: { id: true, name: true, metadata: true },
  });
  console.log(`Found ${interests.length} interests`);

  for (let i = 0; i < interests.length; i += BATCH_SIZE) {
    const batch = interests.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (interest) => {
        const text =
          interest.metadata && interest.metadata.description
            ? `${interest.name}\n${interest.metadata.description}`
            : interest.name;
        try {
          const vector = await fetchEmbedding(text);
          const vectorString = `[${vector.join(',')}]`;

          // Use raw SQL for upsert with pgvector type
          await prisma.$executeRaw`
            INSERT INTO "InterestEmbedding" (id, interest_id, vector, model, created_at)
            VALUES (
              gen_random_uuid(),
              ${interest.id}::uuid,
              ${vectorString}::vector(768),
              ${MODEL_NAME},
              NOW()
            )
            ON CONFLICT (interest_id) DO UPDATE SET
              vector = ${vectorString}::vector(768),
              model = ${MODEL_NAME},
              created_at = NOW()
          `;
          console.log(`Upserted embedding for interest ${interest.id}`);
        } catch (err) {
          console.error(
            `Failed to embed interest ${interest.id}:`,
            err.message || err,
          );
        }
      }),
    );
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
