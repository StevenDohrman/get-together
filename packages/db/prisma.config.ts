import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load env from the repo root so prisma commands work from this package.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Env = {
  DATABASE_URL?: string;
};

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Use a fallback to keep commands like `prisma generate` from failing
    // when DATABASE_URL isn't required.
    url: (process.env as Env).DATABASE_URL ?? '',
  },
});
