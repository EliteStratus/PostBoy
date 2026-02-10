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
 * Keys containing these (e.g. CompanyCode, username, X-Auth-UserLastName) are NOT treated as secrets
 * even if they contain "auth". Checked before secret-like patterns.
 */
const NOT_SECRET_PATTERNS = [
  'companycode',
  'company-code',
  'username',
  'user-name',
  'userlastname',
  'user-last-name',
  'userfirstname',
  'user-first-name',
  'userid',
  'user-id',
];

/**
 * Returns true if the variable key looks like it could hold a secret value.
 * Used to default such variables to Hide (masked, type secret).
 * Excludes keys that are clearly identifiers (e.g. CompanyCode, username, X-Auth-UserLastName).
 */
export function isSecretLikeKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const lower = key.trim().toLowerCase();
  if (NOT_SECRET_PATTERNS.some((p) => lower.includes(p))) return false;
  return SECRET_LIKE_PATTERNS.some((p) => lower.includes(p));
}
