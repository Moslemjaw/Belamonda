/**
 * Single definition of finance revenue, shared by the dashboard, exports and
 * the metrics reconciliation job.
 *
 * Revenue = money actually received for packages (memberships):
 *  - installment packages count only the installments already paid;
 *  - session payments are not revenue;
 *  - 0 KWD / free packages are "granted", not revenue;
 *  - refunds are subtracted in the period the refund was recorded.
 */

/** "completed" is the legacy status used for payments recorded in June–July 2026. */
export const PAID_STATUSES = ["paid", "completed"] as const;

export const isPaidStatus = (status: unknown) => PAID_STATUSES.includes(status as any);

type PaymentLike = { status?: unknown; purpose?: unknown; method?: unknown; amountKwd?: unknown };

export function isSessionPayment(p: PaymentLike) {
  return p.purpose === "session_payment";
}

export function isRefund(p: PaymentLike) {
  return p.purpose === "refund" || p.status === "refunded";
}

/** A paid package payment with a positive amount. */
export function isPackageRevenue(p: PaymentLike, amountMils: number) {
  return isPaidStatus(p.status) && !isSessionPayment(p) && !isRefund(p) && amountMils > 0;
}

/** A package given away: free method or a 0 KWD confirmed payment. */
export function isGrant(p: PaymentLike, amountMils: number) {
  return isPaidStatus(p.status) && !isSessionPayment(p) && (p.method === "free_package" || amountMils === 0);
}

/** Mongo filter for package payments that can count as revenue (amount checked in code). */
export const packageRevenueQuery = {
  status: { $in: [...PAID_STATUSES] },
  purpose: { $nin: ["session_payment", "refund"] },
};

/**
 * How a payment was made, as finance should read it. Customers pay for packages only
 * through a payment link sent by the Belamonda team; older records store that as
 * bank_transfer / link / k-net etc., so the stored method is not shown for packages.
 */
export function paidViaLabel(p: PaymentLike): string {
  if (isRefund(p)) return "Refund";
  if (isSessionPayment(p)) return "At clinic";
  if (p.method === "free_package") return "Granted";
  if (p.method === "wallet") return "Cashback";
  return "Payment link (Belamonda team)";
}
