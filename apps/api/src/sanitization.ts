export function sanitizeUserInput(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const LIKE_SPECIAL_CHAR_PATTERN = /[%_\\]/g;

/**
 * Escapes SQL LIKE wildcard characters (`%`, `_`) and escape char (`\`).
 */
export function escapeLikePattern(value: string): string {
  return value.replace(LIKE_SPECIAL_CHAR_PATTERN, (match) => `\\${match}`);
}
