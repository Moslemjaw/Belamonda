// GET response cache shared by the data hooks (stale-while-revalidate, persisted to
// localStorage). Entries are namespaced by the signed-in user so one account can
// never be shown another account's cached data on a shared device.

const STORAGE_KEY = "belamonda_api_cache";
const AUTH_STORAGE_KEY = "belamonda_auth";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const _cache = new Map<string, { data: unknown; ts: number }>();

try {
  const persisted = localStorage.getItem(STORAGE_KEY);
  if (persisted) {
    for (const [key, val] of Object.entries(JSON.parse(persisted))) {
      _cache.set(key, val as { data: unknown; ts: number });
    }
  }
} catch {
  // Ignore corrupt cache
}

function currentUserId(): string {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? String(JSON.parse(raw)?.userId ?? "anon") : "anon";
  } catch {
    return "anon";
  }
}

const keyFor = (path: string) => `${currentUserId()}|${path}`;

function writeStorage() {
  try {
    const now = Date.now();
    const toSave: Record<string, unknown> = {};
    for (const [key, val] of _cache.entries()) {
      if (now - val.ts < MAX_AGE_MS) toSave[key] = val;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    // Ignore quota exceeded
  }
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon() {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(writeStorage, 1000);
}

export function cacheGet(path: string) {
  return _cache.get(keyFor(path));
}

export function cacheHas(path: string) {
  return _cache.has(keyFor(path));
}

export function cacheSet(path: string, data: unknown) {
  _cache.set(keyFor(path), { data, ts: Date.now() });
  persistSoon();
}

export function cacheDelete(path: string) {
  _cache.delete(keyFor(path));
}

/** Drop the current user's entries whose path starts with `pathPrefix`. */
export function cacheInvalidate(pathPrefix: string) {
  const prefix = keyFor(pathPrefix);
  for (const key of _cache.keys()) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
  // Persist synchronously so a subsequent page reload won't restore stale data
  writeStorage();
}

/** Remove every cached response (all users) — call on login, logout and impersonation. */
export function clearApiCache() {
  _cache.clear();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
