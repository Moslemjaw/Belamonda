import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../app/AuthContext";

/** Generic fetch hook — calls an API endpoint and manages loading/error/data state */
export function useApi<T>(
  path: string | null,
  options?: { method?: string; body?: unknown; deps?: unknown[] }
) {
  const { getAuthHeader } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const result = (await apiFetch(path, {
        method: options?.method || "GET",
        headers: getAuthHeader(),
        body: options?.body ? JSON.stringify(options.body) : undefined,
      })) as T;
      if (mountedRef.current) setData(result);
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [path, getAuthHeader, options?.method, ...(options?.deps || [])]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData, setData };
}

/** Mutation hook — for POST/PUT/DELETE actions */
export function useMutation<TInput, TResult = unknown>(
  path: string,
  method: string = "POST"
) {
  const { getAuthHeader } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (body?: TInput): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = (await apiFetch(path, {
          method,
          headers: getAuthHeader(),
          body: body ? JSON.stringify(body) : undefined,
        })) as TResult;
        return result;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [path, method, getAuthHeader]
  );

  return { mutate, loading, error };
}

// ── Domain-specific hooks ──────────────────────────

export function useWallet() {
  return useApi<{
    wallet: { lockedBalance: string; unlockedBalance: string; ceiling: string } | null;
    txns: Array<{ id: string; type: string; amount: string; notes?: string; createdAt: string }>;
  }>("/wallet/me");
}

export function useMyOffers() {
  return useApi<{
    items: Array<{
      id: string; offerId: string; clinicId: string; status: string;
      sessionsUsed: number; activatedAt?: string; expiresAt?: string;
    }>;
  }>("/commerce/me/offers");
}

export function useKycQueue() {
  return useApi<{
    items: Array<{
      id: string; userId: string; civilIdNumber: string;
      status: string; createdAt: string;
    }>;
  }>("/kyc/cs/queue?status=pending");
}

export function usePendingPayments() {
  return useApi<{
    items: Array<{
      id: string; userId: string; offerId: string; status: string;
      createdAt: string;
    }>;
  }>("/payments/cs/pending");
}

export function useNotifications() {
  return useApi<{
    inbox: Array<{
      id: string; type: string; title: string; body: string;
      read: boolean; sentAt: string;
    }>;
  }>("/notifications/me");
}

export function useFinanceSnapshot() {
  return useApi<{
    snapshot: {
      totalRevenue: string;
      totalCashbackLocked: string;
      totalCashbackUnlocked: string;
      totalCashbackUtilized: string;
      pendingPaymentsCount: number;
      pendingPaymentsKwd: string;
      sessionsToday: number;
      sessionsThisMonth: number;
    };
  }>("/reporting/finance/snapshot");
}

export function useAllTasks(dept: string) {
  return useApi<{
    items: Array<{
      id: string; title: string; description: string;
      priority: string; status: string; dueDate: string;
      assignedDepartments: string[];
    }>;
  }>(`/tasks/dept/${dept}/today`);
}

export function useComplaints() {
  return useApi<{
    items: Array<{
      id: string; userId: string; category: string; subject: string;
      status: string; createdAt: string;
    }>;
    total: number;
  }>("/complaints/all");
}

export function useProducts() {
  return useApi<{
    products: Array<{
      code: string; nameEn: string; nameAr: string;
      priceKwd: string; durationMonths: number;
      cashbackModel: string; fixedCashbackKwd: string;
    }>;
  }>("/products");
}

export function useClinicSchedule(clinicId: string) {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return useApi<{
    items: Array<{
      id: string; userOfferId: string; userId?: string; scheduledAt: string;
      status: string; notes?: string;
      eligibility: { offerActive: boolean; paymentConfirmed: boolean; intervalMet: boolean };
    }>;
  }>(`/scheduling/clinic/${clinicId}/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
}
