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

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

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

  return data;
}
