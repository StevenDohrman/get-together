import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

// Load env from the repo root so prisma commands work from this package.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

type Env = {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.js' },
  datasource: {
    // Prefer DIRECT_URL for Prisma CLI operations (migrate/status), because
    // pooled PgBouncer URLs can hang or fail for migration-related queries.
    // Fallback to DATABASE_URL for local/dev convenience.
    url: (process.env as Env).DIRECT_URL ?? (process.env as Env).DATABASE_URL ?? '',
  },
});
