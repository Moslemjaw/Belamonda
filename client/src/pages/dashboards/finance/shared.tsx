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

export const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Paid by Customer Service", cash: "Paid in Clinic", pos: "POS",
  card_mock: "Card (Online)", enet: "ENET", wallet: "Wallet", free_package: "Free Package", other: "Other",
};

export const PURPOSE_LABELS: Record<string, string> = {
  enrollment_full: "Membership", installment: "Installment",
  deposit: "Deposit", deposit_balance: "Deposit Balance",
  enrollment_enet: "ENET Enrollment", session_payment: "Session",
  manual_entry: "Manual Entry", refund: "Refund",
};

export const METHOD_COLORS: Record<string, string> = {
  bank_transfer: "bg-blue-50 text-blue-700 border-blue-200",
  cash: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pos: "bg-purple-50 text-purple-700 border-purple-200",
  card_mock: "bg-indigo-50 text-indigo-700 border-indigo-200",
  enet: "bg-brand-pink-50 text-brand-pink-700 border-brand-pink-200",
  wallet: "bg-amber-50 text-amber-700 border-amber-200",
  free_package: "bg-surface-100 text-surface-600 border-surface-200",
  other: "bg-surface-100 text-surface-600 border-surface-200",
};

export const STATUS_BADGE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  completed: "bg-emerald-50 text-emerald-700",
  payment_pending: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-surface-100 text-surface-500",
};

export const MANUAL_METHODS = [
  { value: "cash", label: "Paid in Clinic" },
  { value: "bank_transfer", label: "Paid by Customer Service" },
  { value: "pos", label: "POS" },
  { value: "card_mock", label: "Card (Online)" },
  { value: "enet", label: "ENET" },
  { value: "wallet", label: "Wallet" },
  { value: "other", label: "Other" },
];

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
