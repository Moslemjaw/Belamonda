import { apiFetch } from "./api";

export async function passwordLogin(input: {
  identifier: string;
  password: string;
}): Promise<{ accessToken: string; userId: string; role: string; clinicId?: string }> {
  const data = (await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { accessToken: string; userId: string; role: string; clinicId?: string };
  return data;
}

export async function passwordRegister(input: {
  username?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  gender?: "female" | "male" | "other";
  password: string;
  referralCode?: string;
}): Promise<{ accessToken: string; role: string; userId: string }> {
  const data = (await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  })) as { accessToken: string; role: string; userId: string };
  return data;
}
