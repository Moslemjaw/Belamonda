import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../app/AuthContext";

// ── Simple in-memory GET cache (stale-while-revalidate, 30 s TTL) ──────────
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 120_000;

function getCached<T>(key: string): T | undefined {
  const entry = _cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return undefined;
}
function setCached(key: string, data: unknown) {
  _cache.set(key, { data, ts: Date.now() });
}
/** Call after a successful mutation to invalidate related GET caches */
export function invalidateCache(pathPrefix: string) {
  for (const key of _cache.keys()) {
    if (key.startsWith(pathPrefix)) _cache.delete(key);
  }
}

/** Generic fetch hook — calls an API endpoint and manages loading/error/data state */
export function useApi<T>(
  path: string | null,
  options?: { method?: string; body?: unknown; deps?: unknown[]; lazy?: boolean }
) {
  const { getAuthHeader } = useAuth();
  const method = options?.method || "GET";
  const isGet = method === "GET";

  // Seed initial state from cache so pages feel instant on revisit
  const [data, setData] = useState<T | null>(() =>
    path && isGet ? (getCached<T>(path) ?? null) : null
  );
  const [loading, setLoading] = useState(() =>
    path && isGet ? !getCached(path) : (options?.lazy ? false : !!path)
  );
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (force = false) => {
    if (!path) return;

    // For GET: skip network if cache still fresh
    if (isGet) {
      if (force) _cache.delete(path);
      const fresh = force ? undefined : getCached<T>(path);
      if (fresh !== undefined) {
        if (mountedRef.current) { setData(fresh); setLoading(false); }
        return;
      }
      // Show stale data immediately if available while we revalidate
      const stale = _cache.get(path);
      if (stale && mountedRef.current) setData(stale.data as T);
    }

    setLoading(true);
    setError(null);
    try {
      const result = (await apiFetch(path, {
        method,
        headers: getAuthHeader(),
        body: options?.body ? JSON.stringify(options.body) : undefined,
      })) as T;
      if (isGet) setCached(path, result);
      if (mountedRef.current) setData(result);
    } catch (e: unknown) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [path, getAuthHeader, method, ...(options?.deps || [])]);

  useEffect(() => {
    mountedRef.current = true;
    if (!options?.lazy) fetchData();
    return () => { mountedRef.current = false; };
  }, [fetchData]);

  const refetch = useCallback((force = false) => fetchData(force), [fetchData]);

  return { data, loading, error, refetch, setData };
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

export function useWallet(opts?: { lazy?: boolean }) {
  return useApi<{
    wallet: { lockedBalance: string; unlockedBalance: string; ceiling: string } | null;
    txns: Array<{ id: string; type: string; amountKwd: string; reason?: string; createdAt: string }>;
  }>("/wallet/me", opts);
}

export type MyOfferItem = {
  id: string; offerId: string; clinicId: string; status: string;
  sessionsUsed: number; activatedAt?: string; expiresAt?: string;
  purchaseMode?: "full" | "installments" | "deposit" | "enet" | "deposit_completed";
  installmentCount?: number;
  installmentsPaid?: number;
  installmentSchedule?: Array<{ number: number; amountKwd: string; dueDate: string; paid: boolean; paidAt?: string }>;
  nextInstallmentDueAt?: string;
  depositAmountKwd?: string;
  reservationExpiresAt?: string;
  reservationPreferredPlan?: string;
  enetStatus?: "approved" | "rejected" | "pending";
  enetTxnRef?: string;
  cashbackAppliedKwd?: string;
  paymentMethod?: string;
  isStandalone?: boolean;
  offerName?: string;
  offerCategory?: string;
  category?: string;
  cashbackPerSessionKwd?: string;
  cashbackBalanceKwd?: string;
  totalSignupCashbackKwd?: string;
  cashbackGrantedKwd?: string;
  signupCashbackKwd?: string;
  isCashbackOnly?: boolean;
  membershipType?: string;
  method?: string;
  totalInstallments?: number;
  paidInstallments?: number;
  amount?: string;
  createdAt?: string;
  maxSessions?: number;
  hasActiveBooking?: boolean;
  lastCompletedSessionAt?: string;
  sessionIntervalDays?: number;
  clinicLocked?: boolean;
  branchSessionPrices?: any[];
  isGroupOffer?: boolean;
  groupSizeRequired?: number;
  clinicNameAr?: string;
  clinicNameEn?: string;
  allowExtraPaidSessions?: boolean;
  extraSessionPriceKwd?: string;
  priceKwd?: string;
  subscriptionPriceKwd?: string;
  price?: string;
  paymentAmountKwd?: string;
};

export function useMyOffers(opts?: { lazy?: boolean }) {
  return useApi<{ items: MyOfferItem[] }>("/commerce/me/offers", opts);
}

export function useKycQueue(opts?: { lazy?: boolean }) {
  return useApi<{
    items: Array<{
      id: string; userId: string; civilIdNumber: string;
      status: string; createdAt: string;
    }>;
  }>("/kyc/cs/queue?status=pending", opts);
}

export function usePendingPayments(opts?: { lazy?: boolean }) {
  return useApi<{
    items: Array<{
      id: string; userId: string; offerId: string; status: string;
      createdAt: string;
    }>;
  }>("/payments/cs/pending", opts);
}

export function useAdminUserOffers(opts?: { lazy?: boolean }) {
  return useApi<{
    items: Array<any>;
  }>("/commerce/admin/user-offers", opts);
}

export function useNotifications(opts?: { lazy?: boolean }) {
  return useApi<{
    inbox: Array<{
      id: string; type: string; title: string; body: string;
      read: boolean; sentAt: string;
    }>;
  }>("/notifications/me", opts);
}

export type FinanceSnapshot = {
  revenueKwd?: string;
  profitKwd?: string;
  cashbackAppliedKwd?: string;
  pendingKwd?: string;
  cashback?: {
    lockedKwd: string;
    unlockedKwd: string;
    utilizedKwd: string;
    creditedKwd: string;
    netLiabilityKwd: string;
  };
  counts?: { pendingPayments: number; activeClinics: number; activeOffers: number };
  totalRevenue: string;
  totalCashbackLocked: string;
  totalCashbackUnlocked: string;
  totalCashbackUtilized: string;
  pendingPaymentsCount: number;
  pendingPaymentsKwd: string;
  sessionsToday: number;
  sessionsThisMonth: number;
  expectedTotalRevenueKwd?: string;
  unpaidInstallmentsKwd?: string;
  paidTowardMembershipsKwd?: string;
};

export function useFinanceSnapshot(filters: { from?: string; to?: string } = {}, opts?: { lazy?: boolean }) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{ snapshot: FinanceSnapshot }>(`/reporting/finance/snapshot${q}`, { deps: [filters.from, filters.to], ...opts });
}

export type FinanceTimePoint = {
  bucket: string;
  revenueKwd: string;
  cashbackKwd: string;
  profitKwd: string;
  membershipKwd: string;
  sessionKwd: string;
  transactions: number;
};

export function useFinanceTimeseries(period: "daily" | "weekly" | "monthly" | "yearly", filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams({ period });
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  return useApi<{
    period: string;
    points: FinanceTimePoint[];
    totals: { revenueKwd: string; cashbackKwd: string; profitKwd: string; transactions: number };
  }>(`/reporting/finance/timeseries?${p.toString()}`, { deps: [period, filters.from, filters.to] });
}

export function useRevenueByOffer(filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{
    items: Array<{ offerId: string; offerName: string; membershipType: string; revenueKwd: string; cashbackKwd: string; profitKwd: string; salesCount: number }>;
  }>(`/reporting/finance/by-offer${q}`, { deps: [filters.from, filters.to] });
}

export function useRevenueByUser(filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{
    items: Array<{ userId: string; displayName: string; email?: string; phone?: string; ltvKwd: string; cashbackUsedKwd: string; purchasesCount: number; pendingPayments: number }>;
  }>(`/reporting/finance/by-user${q}`, { deps: [filters.from, filters.to] });
}

export function useRevenueByReferral(filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{
    items: Array<{ referrerId: string; displayName: string; referralCode: string; role: string; revenueKwd: string; salesCount: number }>;
  }>(`/reporting/finance/by-referral${q}`, { deps: [filters.from, filters.to] });
}

export function useFinanceInstallments(filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{
    summary: { paidKwd: string; upcomingKwd: string; lateKwd: string; forecastKwd: string; lateCount: number; upcomingCount: number };
    items: Array<{ userOfferId: string; userId: string; offerName: string; installmentNumber: number; amountKwd: string; dueDate?: string; status: "paid" | "late" | "upcoming"; customerName?: string }>;
  }>(`/reporting/finance/installments${q}`, { deps: [filters.from, filters.to] });
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

export function useComplaints(opts?: { lazy?: boolean }) {
  return useApi<{
    items: Array<{
      id: string; userId: string; category: string; subject: string;
      status: string; createdAt: string;
    }>;
    total: number;
  }>("/complaints/all", opts);
}

export function useMyComplaints() {
  return useApi<{
    items: Array<{
      id: string;
      category: string;
      subject: string;
      status: string;
      createdAt: string;
    }>;
  }>("/complaints/me");
}

export function useProducts(opts?: { lazy?: boolean }) {
  return useApi<{
    products: Array<{
      code: string; nameEn: string; nameAr: string;
      priceKwd: string; durationMonths: number;
      cashbackModel: string; fixedCashbackKwd: string;
    }>;
  }>("/products", opts);
}

export function useClinicSchedule(clinicId: string) {
  const [dates] = useState(() => ({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }));
  const { from, to } = dates;
  return useApi<{
    items: Array<{
      id: string;
      userOfferId: string;
      userId?: string;
      scheduledAt: string;
      status: string;
      notes?: string;
      eligibility: { offerActive: boolean; paymentConfirmed: boolean; intervalMet: boolean };
      payment?: {
        id: string;
        status: string;
        amountKwd: string;
        method?: string;
        bookingId?: string;
      } | null;
      bookingRequestId?: string | null;
      clinicPaymentStatus?: "pending" | "paid";
      sessionPriceKwd?: string | null;
      cashbackDeductedKwd?: string | null;
      membershipType?: string;
      isStandalone?: boolean;
    }>;
  }>(`/scheduling/clinic/${clinicId}/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    deps: [clinicId]
  });
}

export function useBookingRequests(status: "pending" | "open" | "scheduled" | "cancelled" | "all" = "pending") {
  const normalizedStatus = status === "pending" ? "open" : status;
  const q = `?status=${encodeURIComponent(normalizedStatus)}`;
  return useApi<{
    items: Array<{
      id: string;
      userId: string;
      userOfferId?: string;
      offerId?: string;
      clinicId: string;
      clinicNameEn?: string;
      clinicNameAr?: string;
      status: string;
      isStandalone?: boolean;
      bookingRoute?: "cs" | "clinic";
      preferredAt?: string;
      sessionPriceKwd?: string;
      cashbackDeductedKwd?: string;
      membershipType?: string;
      clinicPaymentStatus?: "pending" | "paid";
      notes?: string;
      createdAt?: string;
    }>;
  }>(`/scheduling/cs/requests${q}`, { deps: [normalizedStatus] });
}

export function useMySessions() {
  return useApi<{
    items: Array<{
      id: string;
      offerId: string;
      clinicId: string;
      userOfferId: string;
      scheduledAt: string;
      status: string;
      notes?: string;
    }>;
  }>("/scheduling/me/sessions");
}

export type PaymentLedgerItem = {
  id: string;
  userId: string;
  amountKwd: string;
  grossAmountKwd: string;
  cashbackAppliedKwd: string;
  customerWalletBalanceAfterKwd?: string;
  status: string;
  method: string;
  purpose?: string;
  createdAt: string;
};

export function usePaymentsLedger(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}&limit=50` : "?limit=50";
  return useApi<{ items: PaymentLedgerItem[]; total: number }>(`/payments${q}`);
}

export type EnrichedPaymentItem = PaymentLedgerItem & {
  offerName?: string;
  clinicId?: string;
  clinicNameEn?: string;
  clinicNameAr?: string;
  membershipType?: string;
};

export type PaymentsBreakdown = {
  items: EnrichedPaymentItem[];
  summary: {
    totalCollectedKwd: string;
    membershipRevenueKwd: string;
    sessionRevenueKwd: string;
    cashbackAppliedKwd: string;
    profitKwd: string;
    pendingCount: number;
  };
  byMethod: Array<{ method: string; count: number; totalKwd: string }>;
  byPurpose: Array<{ purpose: string; count: number; totalKwd: string }>;
  byClinics: Array<{ clinicId: string; clinicNameEn: string; clinicNameAr: string; count: number; totalKwd: string }>;
};

export function usePaymentsBreakdown(filters: { status?: string; method?: string; purpose?: string; from?: string; to?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.method) params.set("method", filters.method);
  if (filters.purpose) params.set("purpose", filters.purpose);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const q = params.toString() ? `?${params.toString()}` : "";
  return useApi<PaymentsBreakdown>(`/reporting/finance/payments-breakdown${q}`, {
    deps: [filters.status, filters.method, filters.purpose, filters.from, filters.to],
  });
}

export type ReservationItem = MyOfferItem & {
  userId: string;
  createdAt: string;
  offerName?: string;
  standaloneName?: string;
  reservationConvertedAt?: string;
  depositPaidAt?: string;
  reservationCompletionExpectedAt?: string;
};

export function useMyReservations() {
  return useApi<{ items: ReservationItem[] }>("/checkout/me/reservations");
}

export function useAdminReservations(opts?: { lazy?: boolean }) {
  return useApi<{ items: ReservationItem[] }>("/checkout/reservations/all", opts);
}

export function useMyClinicChangeRequests() {
  return useApi<{
    items: Array<{
      id: string; userOfferId: string; status: string; feeKwd: string;
      changeNumber: number; fromClinicId: string; toClinicId: string;
      fromClinicNameEn?: string; fromClinicNameAr?: string;
      toClinicNameEn?: string; toClinicNameAr?: string;
      createdAt: string; resolvedAt?: string; reason?: string;
    }>;
  }>("/commerce/me/clinic-change-requests");
}

export function useClinicChangeRequestsCs() {
  return useApi<{
    items: Array<{
      id: string; userOfferId: string; userId: string; status: string;
      feeKwd: string; changeNumber: number;
      userName?: string; userPhone?: string; userEmail?: string;
      offerName?: string; offerNameAr?: string;
      fromClinicId: string; toClinicId: string;
      fromClinicNameEn?: string; fromClinicNameAr?: string;
      toClinicNameEn?: string; toClinicNameAr?: string;
      createdAt: string; resolvedAt?: string; reason?: string; approvedBy?: string;
    }>;
  }>("/commerce/cs/clinic-change-requests");
}

// ── Clinic summaries (Finance view — all clinics) ───────────────────────────

export type ClinicSummaryItem = {
  clinicId: string;
  clinicNameEn: string;
  clinicNameAr: string;
  isActive: boolean;
  totalSessions: number;
  completedSessions: number;
  noShowSessions: number;
  scheduledSessions: number;
  revenueKwd: string;
  paymentsCount: number;
  activeMemberships: number;
  totalInvoices: number;
  paidInvoices: number;
};

export function useClinicSummaries(filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{ items: ClinicSummaryItem[] }>(`/reporting/finance/by-clinic${q}`, {
    deps: [filters.from, filters.to],
  });
}

export type ClinicDetailSession = {
  id: string; userId: string; customerName: string; customerPhone?: string | null;
  scheduledAt: string; status: string; notes?: string | null; cashbackUnlockedKwd?: string | null;
};
export type ClinicDetailInvoice = {
  id: string; userId: string; customerName: string; customerPhone?: string | null;
  status: string; sessionPriceKwd?: string | null; cashbackDeductedKwd?: string | null;
  clinicPaymentStatus: string; membershipType?: string | null; createdAt: string; confirmedAt?: string | null;
};
export type ClinicDetailSummary = {
  totalSessions: number; completedSessions: number; noShowSessions: number; scheduledSessions: number;
  totalInvoices: number; paidInvoices: number; pendingInvoices: number;
  sessionRevenueKwd: string; paidRevenueKwd: string; pendingRevenueKwd: string;
  cashbackTotalKwd?: string; netRevenueKwd?: string;
};

export function useClinicDetail(clinicId: string | null, filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (clinicId) p.set("clinicId", clinicId);
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const path = clinicId ? `/reporting/finance/clinic-detail?${p.toString()}` : null;
  return useApi<{ clinic: { nameEn: string; nameAr: string } | null; summary: ClinicDetailSummary; sessions: ClinicDetailSession[]; invoices: ClinicDetailInvoice[] }>(path, {
    deps: [clinicId, filters.from, filters.to],
  });
}

export function useMyClinicReport(filters: { from?: string; to?: string } = {}) {
  const p = new URLSearchParams();
  if (filters.from) p.set("from", filters.from);
  if (filters.to) p.set("to", filters.to);
  const q = p.toString() ? `?${p.toString()}` : "";
  return useApi<{ clinic: { nameEn: string; nameAr: string } | null; summary: ClinicDetailSummary; sessions: ClinicDetailSession[]; invoices: ClinicDetailInvoice[] }>(`/reporting/clinic/summary${q}`, {
    deps: [filters.from, filters.to],
  });
}
