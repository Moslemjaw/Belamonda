import { apiFetch } from "./api";
import type { Role } from "@belamonda/shared";

export async function demoLogin(
  userId: string,
  role: Role
): Promise<string> {
  const data = (await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ userId, role }),
  })) as { accessToken: string };
  return data.accessToken;
}
