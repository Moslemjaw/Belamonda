import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Role } from "@belamonda/shared";
import { demoLogin } from "../lib/demoTokens";

interface AuthState {
  token: string;
  userId: string;
  role: Role;
}

interface AuthContextType {
  auth: AuthState | null;
  login: (userId: string, role: Role) => Promise<void>;
  logout: () => void;
  getAuthHeader: () => Record<string, string> | undefined;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    try {
      const saved = sessionStorage.getItem("belamonda_auth");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (userId: string, role: Role) => {
    const token = await demoLogin(userId, role);
    const state: AuthState = { token, userId, role };
    setAuth(state);
    sessionStorage.setItem("belamonda_auth", JSON.stringify(state));
  }, []);

  const logout = useCallback(() => {
    setAuth(null);
    sessionStorage.removeItem("belamonda_auth");
  }, []);

  const getAuthHeader = useCallback(() => {
    if (!auth?.token) return undefined;
    return { Authorization: `Bearer ${auth.token}` };
  }, [auth?.token]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
