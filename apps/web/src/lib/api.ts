import { getSupabaseBrowserClient } from '@/lib/supabaseBrowser';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type JsonValue =
  | Record<string, unknown>
  | Array<unknown>
  | string
  | number
  | boolean
  | null;

function getApiUrl(path: string): string {
  return new URL(path, apiBaseUrl).toString();
}

async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
  } catch {
    // Fall through to status text.
  }

  return response.statusText || 'Request failed';
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in');
  }
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(getApiUrl(path), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as T;
}

export async function apiJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: JsonValue,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not signed in');
  }
  const headers = new Headers();
  headers.set('Authorization', `Bearer ${token}`);
  // Only declare a JSON content-type when we actually send a body — Fastify
  // rejects an empty body when content-type is application/json (e.g. for
  // DELETE requests with no payload).
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  if (serialized !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(getApiUrl(path), {
    method,
    headers,
    body: serialized,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
