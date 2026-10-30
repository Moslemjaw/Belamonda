// Helpers, constants and small components shared by the FinanceDashboard tabs.
import i18n from "../../../app/i18n";

export const ar = () => i18n.language === "ar";

// ===========================================================================
// Helpers
// ===========================================================================

export type Period = "today" | "week" | "month" | "custom";

export function isoDate(d: Date) {
  return d.toISOString();
}

/** Calendar dates on the user's device (Kuwait for finance staff), sent as whole days. */
export function rangeForPeriod(period: Exclude<Period, "custom">): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today);
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(1);
  const day = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: `${day(start)}T00:00:00.000Z`, to: `${day(today)}T23:59:59.999Z` };
}

export function fmt(n: number) {
  if (Number.isNaN(n)) return "0.000";
  return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function parseKwd(s?: string | null) {
  if (!s) return 0;
  return parseFloat(s) || 0;
}

export const COLORS = {
  pink: "#ec4899",
  emerald: "#10b981",
  indigo: "#6366f1",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#a855f7",
  blue: "#3b82f6",
  cyan: "#06b6d4",
  surface: "#94a3b8",
};

export const PIE_COLORS = [COLORS.pink, COLORS.emerald, COLORS.indigo, COLORS.amber, COLORS.purple, COLORS.cyan, COLORS.blue, COLORS.surface];

/**
 * How a payment was made, as finance reads it. Customers pay for packages only through a
 * payment link sent by the Belamonda team (older records store it as bank_transfer, link, k-net…).
 * Mirrors paidViaLabel() on the server.
 */
export function paidVia(p: { method?: string; purpose?: string; status?: string }): { label: string; badge: string } {
  if (p.purpose === "refund" || p.status === "refunded") return { label: ar() ? "استرداد" : "Refund", badge: "bg-rose-50 text-rose-700 border-rose-200" };
  if (p.purpose === "session_payment") return { label: ar() ? "في العيادة" : "At clinic", badge: "bg-purple-50 text-purple-700 border-purple-200" };
  if (p.method === "free_package") return { label: ar() ? "ممنوحة" : "Granted", badge: "bg-surface-100 text-surface-600 border-surface-200" };
  if (p.method === "wallet") return { label: ar() ? "كاش باك" : "Cashback", badge: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: ar() ? "رابط دفع (فريق بيلاموندو)" : "Payment link (Belamonda team)", badge: "bg-blue-50 text-blue-700 border-blue-200" };
}

export const PURPOSE_LABELS: Record<string, string> = {
  enrollment_full: "Membership", installment: "Installment",
  deposit: "Deposit", deposit_balance: "Deposit Balance",
  enrollment_enet: "ENET Enrollment", session_payment: "Session",
  manual_entry: "Manual Entry", refund: "Refund",
};

export const STATUS_BADGE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  completed: "bg-emerald-50 text-emerald-700",
  payment_pending: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-surface-100 text-surface-500",
};

export const MANUAL_PURPOSES = [
  { value: "manual_entry", label: "Manual Entry (General)" },
  { value: "enrollment_full", label: "Membership / Full Payment" },
  { value: "installment", label: "Installment" },
  { value: "deposit", label: "Deposit" },
  { value: "deposit_balance", label: "Deposit Balance" },
  { value: "session_payment", label: "Session Payment" },
];

export const MANUAL_STATUSES = [
  { value: "paid", label: "Paid" },
  { value: "payment_pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
  { value: "failed", label: "Failed" },
];

export interface ManualEntry {
  id: string;
  amountKwd: string;
  method: string;
  purpose: string;
  status: string;
  manualLabel?: string;
  notes?: string;
  providerRef?: string;
  userId?: string;
  createdByUserId?: string;
  createdAt: string;
}
