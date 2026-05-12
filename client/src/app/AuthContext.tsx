import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Role } from "@belamonda/shared";
import { passwordLogin, passwordRegister } from "../lib/demoTokens";
import { API_BASE_URL } from "../lib/api";

interface AuthState {
  token: string;
  userId: string;
  role: Role;
  clinicId?: string;
}

interface AuthContextType {
  auth: AuthState | null;
  login: (identifier: string, role?: string) => Promise<void>;
  loginWithPassword: (identifier: string, password: string) => Promise<void>;
  registerCustomer: (input: { username?: string; email?: string; phone?: string; fullName?: string; gender?: "female" | "male" | "other"; password: string; referralCode?: string }) => Promise<void>;
  impersonateClinic: (clinicId: string) => Promise<void>;
  impersonateUser: (userId: string) => Promise<void>;
  logout: () => void;
  getAuthHeader: () => Record<string, string> | undefined;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_STORAGE_KEY = "belamonda_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try {
      const localSaved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (localSaved) return JSON.parse(localSaved);

      // Backward compatibility for existing sessions created before persistence fix.
      const sessionSaved = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (sessionSaved) {
        localStorage.setItem(AUTH_STORAGE_KEY, sessionSaved);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        return JSON.parse(sessionSaved);
      }

      return null;
    } catch {
      return null;
    }
  });

  const loginWithPassword = useCallback(async (identifier: string, password: string) => {
    const { accessToken, clinicId, role, userId } = await passwordLogin({ identifier, password });
    const state: AuthState = { token: accessToken, userId: userId || identifier, role: role as Role, clinicId };
    setAuth(state);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  }, []);

  // Backward-compatible helper used by older dashboard flows.
  const login = useCallback(async (identifier: string, role?: string) => {
    const defaultPasswordByRole: Record<string, string> = {
      admin: "admin123",
      cs: "cs123",
      clinic: "clinic123",
      clinicStaff: "clinic123",
      customer: "customer123"
    };
    const fallbackPassword = role ? (defaultPasswordByRole[role] ?? "123456") : "123456";
    await loginWithPassword(identifier, fallbackPassword);
  }, [loginWithPassword]);

  const registerCustomer = useCallback(async (input: { username?: string; email?: string; phone?: string; fullName?: string; gender?: "female" | "male" | "other"; password: string; referralCode?: string }) => {
    const { accessToken, role, userId } = await passwordRegister(input);
    const state: AuthState = { token: accessToken, userId, role: role as Role };
    setAuth(state);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const getAuthHeader = useCallback(() => {
    if (!auth?.token) return undefined;
    return { Authorization: `Bearer ${auth.token}` };
  }, [auth?.token]);

  const impersonateClinic = useCallback(async (clinicId: string) => {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error("Not logged in");

    const res = await fetch(`${API_BASE_URL}/auth/admin/impersonate`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ clinicId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to impersonate");

    const state: AuthState = { token: data.accessToken, userId: `impersonated_${clinicId}`, role: data.role as Role, clinicId: data.clinicId };
    setAuth(state);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  }, [getAuthHeader]);

  const impersonateUser = useCallback(async (userId: string) => {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error("Not logged in");

    const res = await fetch(`${API_BASE_URL}/auth/admin/impersonate-user`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to impersonate user");

    const state: AuthState = {
      token: data.accessToken,
      userId: data.userId,
      role: data.role as Role,
      clinicId: data.clinicId,
    };
    setAuth(state);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  }, [getAuthHeader]);

  return (
    <AuthContext.Provider value={{ auth, login, loginWithPassword, registerCustomer, impersonateClinic, impersonateUser, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
