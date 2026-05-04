export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    throw new Error(typeof data === "object" && data && "error" in (data as any) ? (data as any).error : "HTTP_ERROR");
  }

  return data;
}

