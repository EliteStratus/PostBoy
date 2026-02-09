/**
 * Store cookies per origin so they can be sent automatically on subsequent requests.
 * Uses sessionStorage so cookies persist for the tab session (cleared when tab closes).
 */

const STORAGE_KEY = 'postboy_auto_cookies';

/** Parse Set-Cookie header(s) into the value to send in a Cookie header (name=value; name2=value2). */
function parseSetCookieToCookieHeader(setCookieRaw: string): string {
  const parts: string[] = [];
  // Proxy sends newline-separated; browser may send single or getSetCookie() array joined
  const lines = setCookieRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    // Each Set-Cookie is "name=value; Path=/; HttpOnly; ..." — we only need name=value
    const firstSemicolon = line.indexOf(';');
    const nameValue = firstSemicolon >= 0 ? line.slice(0, firstSemicolon).trim() : line.trim();
    if (nameValue) parts.push(nameValue);
  }
  return parts.join('; ');
}

function getStorage(): Record<string, string> {
  if (typeof sessionStorage === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function setStorage(map: Record<string, string>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Get the stored cookie string for this origin (for use in Cookie header). */
export function getStoredCookies(origin: string): string | null {
  const map = getStorage();
  const value = map[origin];
  return value && value.length > 0 ? value : null;
}

/** Store cookies from a Set-Cookie response header for this origin. Merges with existing. */
export function setStoredCookiesFromSetCookie(origin: string, setCookieHeaderValue: string): void {
  const parsed = parseSetCookieToCookieHeader(setCookieHeaderValue);
  if (!parsed) return;
  const map = getStorage();
  const existing = map[origin] ?? '';
  // Merge: existing cookies + new ones (new wins for same name if we ever parse by name)
  const merged = existing ? `${existing}; ${parsed}` : parsed;
  map[origin] = merged;
  setStorage(map);
}
