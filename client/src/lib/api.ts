/** Render / local API origin. Leave empty locally so Vite dev proxy routes `/auth`, `/public`, … to the backend. */
function normalizeApiBase(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  return t.replace(/\/+$/, "");
}

function normalizeSiteBase(raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "https://belamondokw.com";
  return t.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeApiBase(import.meta.env.VITE_API_URL);
export const SITE_BASE_URL = normalizeSiteBase(import.meta.env.VITE_SITE_URL);

const AUTH_STORAGE_KEY = "belamonda_auth";

/** Handle expired / invalid sessions globally — clear stored auth and redirect to login. */
function handleSessionExpired() {
  // Prevent infinite redirect loops: only act once
  if ((window as any).__bel_session_expired) return;
  (window as any).__bel_session_expired = true;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  // Redirect to login with a return-to path
  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?expired=1&next=${returnTo}`;
}

const _inflightFetches = new Map<string, Promise<any>>();

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const isGet = !init?.method || init.method.toUpperCase() === "GET";
  
  if (isGet) {
    const inflight = _inflightFetches.get(path);
    if (inflight) return inflight;
  }

  const promise = (async () => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  // ── Handle expired / invalid token globally ──
  if (res.status === 401) {
    // Only auto-logout for authenticated endpoints (those with an Authorization header)
    const hasAuth = init?.headers && typeof init.headers === "object" && "Authorization" in init.headers;
    if (hasAuth) {
      handleSessionExpired();
      const err = new Error("UNAUTHORIZED") as Error & { data?: unknown; status?: number };
      err.status = 401;
      throw err;
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      const hint =
        API_BASE_URL.length === 0
          ? ' Set VITE_API_URL to your backend URL (e.g. https://your-api.onrender.com) in Vercel environment variables.'
          : "";
      const err = new Error(
        `${res.status} response was not JSON (often a wrong API URL or CORS).${hint}`
      ) as Error & { data?: unknown; status?: number };
      err.status = res.status;
      err.data = text.slice(0, 200);
      throw err;
    }
  }

  if (!res.ok) {
    const code = typeof data === "object" && data && "error" in (data as object) ? (data as Record<string, string>).error : "HTTP_ERROR";
    const err = new Error(code) as Error & { data?: unknown; status?: number };
    err.data = data;
    err.status = res.status;
    throw err;
  }

  return data as T;
  })();

  if (isGet) {
    _inflightFetches.set(path, promise);
    promise.finally(() => _inflightFetches.delete(path));
  }

  return promise;
}
