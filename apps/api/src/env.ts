import { z } from 'zod';

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  /** Comma-separated browser origins allowed to call the API (CORS). Requests with no Origin (e.g. mobile) are allowed. */
  API_CORS_ORIGINS: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Keep error message readable in dev.
    throw new Error(
      `Invalid env:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`,
    );
  }
  return parsed.data;
}
