export const AVATAR_GRADIENT_STOPS = [
  'from-indigo-500 via-purple-500 to-fuchsia-500',
  'from-orange-400 via-rose-500 to-pink-600',
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-sky-500 via-blue-600 to-indigo-700',
  'from-amber-400 via-orange-500 to-red-600',
  'from-violet-500 via-purple-600 to-indigo-700',
] as const;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Tailwind color stops for use with `bg-gradient-to-br`. */
export function pickGradient(seed: string): string {
  return AVATAR_GRADIENT_STOPS[hashSeed(seed) % AVATAR_GRADIENT_STOPS.length];
}

export function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('') || '?'
  );
}
