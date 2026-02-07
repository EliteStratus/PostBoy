/** Substrings that suggest a variable key is secret-like (case-insensitive). */
const SECRET_LIKE_PATTERNS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'auth',
  'authorization',
  'credential',
  'private_key',
  'privatekey',
  'access_key',
  'accesskey',
  'session',
  'cookie',
];

/**
 * Returns true if the variable key looks like it could hold a secret value.
 * Used to default such variables to Hide (masked, type secret).
 */
export function isSecretLikeKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const lower = key.trim().toLowerCase();
  return SECRET_LIKE_PATTERNS.some((p) => lower.includes(p));
}
