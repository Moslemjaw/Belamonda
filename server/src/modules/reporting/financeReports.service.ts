import { PaymentModel } from "../../models/payment.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserModel } from "../../models/user.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { WalletModel, WalletTxnModel } from "../../models/kyc.model.js";
import { kwdToMils, milsToKwd } from "../../utils/money.js";
import { kwDateRange, kwDateTime, kwDate } from "../../utils/kwDate.js";
import { isPackageRevenue, isPaidStatus, isRefund, isSessionPayment, paidViaLabel } from "../../services/financeRevenue.js";
import {
  loadPackageRevenueInput,
  summarizePackageRevenue,
  type PackageRevenueInput,
  type PackageRevenueSummary,
  type RevenueMembership,
} from "./revenue.service.js";
import { computeClinicSessionsReport } from "./clinicSessions.service.js";

/**
 * Finance reports. Every report is built as a ReportDoc: the same document is
 * returned as the on-screen preview and rendered to Excel and PDF, so the
 * three always show the same numbers. All money follows the shared rules in
 * services/financeRevenue.ts and revenue.service.ts.
 */

// ── Report document ─────────────────────────────────────────────────────────

export type Label = { en: string; ar: string };
export type CellValue = string | number | null;
export type ReportColumn = { key: string; label: Label; kind?: "text" | "kwd" | "int" };
export type ReportTable = {
  id: string;
  title: Label;
  columns: ReportColumn[];
  rows: Record<string, CellValue>[];
  totals?: Record<string, CellValue>;
  note?: Label;
};
export type ReportCard = { label: Label; value: string; hint?: Label; tone?: "good" | "bad" | "neutral" };
export type LedgerCheck = { ok: boolean; reportTotalKwd: string; ledgerTotalKwd: string; diffKwd: string };
export type ReportDoc = {
  type: FinanceReportType;
  title: Label;
  from: string;
  to: string;
  generatedAt: string;
  cards: ReportCard[];
  tables: ReportTable[];
  notes: Label[];
  check?: LedgerCheck;
};

export const FINANCE_REPORT_TYPES = [
  "monthly_summary",
  "package_sales",
  "payments_ledger",
  "installments_due",
  "clinic_sessions",
  "cashback",
] as const;
export type FinanceReportType = (typeof FINANCE_REPORT_TYPES)[number];

const L = (en: string, ar: string): Label => ({ en, ar });

// ── Periods ─────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The current Kuwait calendar month up to today, as YYYY-MM-DD strings. */
export function currentKwMonth(now = new Date()) {
  const kw = new Date(now.getTime() + 3 * 3600_000);
  return { from: `${kw.toISOString().slice(0, 7)}-01`, to: isoDay(kw) };
}

/**
 * The period to compare with: the previous calendar month for a whole month,
 * otherwise the same number of days immediately before [from, to] (inclusive).
 */
export function previousPeriod(from: string, to: string) {
  const f = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const t = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  const start = new Date(f);
  const wholeMonth = start.getUTCDate() === 1 && t === Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0);
  if (wholeMonth) {
    return {
      from: isoDay(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1))),
      to: isoDay(new Date(f - DAY)),
    };
  }
  const days = Math.round((t - f) / DAY) + 1;
  const prevTo = new Date(f - DAY);
  const prevFrom = new Date(f - days * DAY);
  return { from: isoDay(prevFrom), to: isoDay(prevTo) };
}

/** Percentage change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

const fmtChange = (c: number | null) => (c === null ? "—" : `${c > 0 ? "+" : ""}${c}%`);

// ── Ledger check ────────────────────────────────────────────────────────────

/** Compares a report's package revenue with the Payments Ledger for the same period. */
export function reconcileWithLedger(reportTotalKwd: string, ledgerTotalKwd: string): LedgerCheck {
  const diff = kwdToMils(reportTotalKwd) - kwdToMils(ledgerTotalKwd);
  return { ok: diff === 0, reportTotalKwd, ledgerTotalKwd, diffKwd: milsToKwd(diff) };
}

// ── People ──────────────────────────────────────────────────────────────────

export type Person = { name: string; phone?: string; role?: string };

const ROLE_LABEL: Record<string, string> = {
  cs: "Customer Service",
  cs_director: "CS Director",
  finance: "Finance",
  admin: "Admin",
  legal: "Legal",
  clinic: "Clinic",
  customer: "Customer",
};

/** "Paid by Customer Service — Sara", "Online checkout", … for who confirmed a payment. */
export function confirmerLabel(id: string | undefined, people: Map<string, Person>): string {
  if (!id) return "—";
  if (id === "system_checkout") return "Online checkout (system)";
  if (id === "customer") return "Customer";
  if (id === "system") return "System";
  const p = people.get(id);
  if (!p) return id;
  const role = p.role ? ROLE_LABEL[p.role] ?? p.role : "";
  return role ? `${role} — ${p.name}` : p.name;
}

const isOid = (s: unknown) => typeof s === "string" && /^[a-f0-9]{24}$/i.test(s);

/** Looks users up by id or username. */
async function loadPeople(ids: unknown[]): Promise<Map<string, Person>> {
  const all = [...new Set(ids.filter(Boolean).map(String))];
  const map = new Map<string, Person>();
  if (!all.length) return map;
  const users = (await UserModel.find({ $or: [{ _id: { $in: all.filter(isOid) } }, { username: { $in: all } }] })
    .select("username fullName phone role")
    .lean()) as any[];
  for (const u of users) {
    const p = { name: u.fullName || u.username || String(u._id), phone: u.phone, role: u.role };
    map.set(String(u._id), p);
    if (u.username) map.set(u.username, p);
  }
  return map;
}

async function loadOfferNames(ids: unknown[]): Promise<Map<string, string>> {
  const all = [...new Set(ids.filter(Boolean).map(String))].filter(isOid);
  if (!all.length) return new Map();
  const offers = (await OfferModel.find({ _id: { $in: all } }).select("name").lean()) as any[];
  return new Map(offers.map((o) => [String(o._id), String(o.name ?? "")]));
}

// ── Payments Ledger ─────────────────────────────────────────────────────────

export type LedgerType = "package" | "session" | "refund" | "manual";

export type LedgerPayment = {
  _id: unknown;
  createdAt?: Date | string;
  userId?: string;
  offerId?: unknown;
  clinicId?: unknown;
  bookingRequestId?: string;
  method?: string;
  purpose?: string;
  status?: string;
  amountKwd?: string;
  cashbackAppliedKwd?: string;
  confirmedBy?: string;
  createdByUserId?: string;
  isManual?: boolean;
  manualLabel?: string;
  notes?: string;
};

export type LedgerRow = {
  id: string;
  date: string;
  customer: string;
  phone: string;
  item: string;
  clinic: string;
  method: string;
  type: LedgerType;
  status: string;
  amountKwd: string;
  cashbackKwd: string;
  confirmedBy: string;
  /** Signed contribution to package revenue: +amount for a package payment, −amount for a refund, else 0. */
  revenueKwd: string;
};

export function ledgerType(p: LedgerPayment): LedgerType {
  if (isRefund(p)) return "refund";
  if (isSessionPayment(p)) return "session";
  if (p.isManual) return "manual";
  return "package";
}

export function buildLedgerRow(
  p: LedgerPayment,
  ctx: { people: Map<string, Person>; offerNames: Map<string, string>; clinicNames: Map<string, string>; serviceNames: Map<string, string> }
): LedgerRow {
  const mils = kwdToMils(p.amountKwd);
  const type = ledgerType(p);
  const revenue = type === "refund" ? -mils : isPackageRevenue(p, mils) ? mils : 0;
  const customer = p.userId ? ctx.people.get(p.userId) : undefined;
  const item: string =
    (p.bookingRequestId ? ctx.serviceNames.get(p.bookingRequestId) : undefined) ||
    (p.offerId ? ctx.offerNames.get(String(p.offerId)) : undefined) ||
    p.manualLabel ||
    (type === "session" ? "Session" : "—");
  return {
    id: String(p._id),
    date: kwDateTime(p.createdAt ?? null),
    customer: customer?.name ?? (p.userId && p.userId !== "manual" ? p.userId : "—"),
    phone: customer?.phone ?? "",
    item,
    clinic: (p.clinicId ? ctx.clinicNames.get(String(p.clinicId)) : undefined) || "",
    method: paidViaLabel(p),
    type,
    status: isPaidStatus(p.status) ? "paid" : p.status ?? "",
    amountKwd: milsToKwd(type === "refund" ? -mils : mils),
    cashbackKwd: milsToKwd(kwdToMils(p.cashbackAppliedKwd)),
    confirmedBy: confirmerLabel(p.confirmedBy || p.createdByUserId, ctx.people),
    revenueKwd: milsToKwd(revenue),
  };
}

export function summarizeLedger(rows: LedgerRow[]) {
  let packages = 0;
  let refunds = 0;
  let sessions = 0;
  let pending = 0;
  let cashback = 0;
  for (const r of rows) {
    const rev = kwdToMils(r.revenueKwd);
    if (r.type === "refund") refunds += -rev;
    else if (rev > 0) packages += rev;
    if (r.type === "session" && r.status === "paid") sessions += kwdToMils(r.amountKwd);
    if (r.status === "payment_pending") pending += kwdToMils(r.amountKwd);
    if (r.status === "paid") cashback += kwdToMils(r.cashbackKwd);
  }
  return {
    packagesKwd: milsToKwd(packages),
    refundsKwd: milsToKwd(refunds),
    revenueKwd: milsToKwd(packages - refunds),
    sessionsKwd: milsToKwd(sessions),
    pendingKwd: milsToKwd(pending),
    cashbackKwd: milsToKwd(cashback),
  };
}

async function loadLedger(from: string, to: string) {
  const range = kwDateRange(from, to);
  const payments = (await PaymentModel.find(range ? { createdAt: range } : {})
    .sort({ createdAt: 1 })
    .select("createdAt userId offerId clinicId bookingRequestId method purpose status amountKwd cashbackAppliedKwd confirmedBy createdByUserId isManual manualLabel notes")
    .lean()) as any[];

  const brIds = [...new Set(payments.map((p) => p.bookingRequestId).filter(isOid))];
  const requests = brIds.length
    ? ((await BookingRequestModel.find({ _id: { $in: brIds } }).select("clinicId isStandalone standaloneName").lean()) as any[])
    : [];
  const serviceNames = new Map<string, string>();
  const requestClinic = new Map<string, string>();
  for (const r of requests) {
    serviceNames.set(String(r._id), r.isStandalone ? r.standaloneName || "Standalone session" : "Membership session");
    if (r.clinicId) requestClinic.set(String(r._id), String(r.clinicId));
  }
  for (const p of payments) if (!p.clinicId && p.bookingRequestId) p.clinicId = requestClinic.get(p.bookingRequestId);

  const clinicIds = [...new Set(payments.map((p) => (p.clinicId ? String(p.clinicId) : "")).filter(isOid))];
  const [people, offerNames, clinics] = await Promise.all([
    loadPeople(payments.flatMap((p) => [p.userId, p.confirmedBy, p.createdByUserId])),
    loadOfferNames(payments.map((p) => p.offerId)),
    clinicIds.length ? ((await ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn").lean()) as any[]) : [],
  ]);
  const clinicNames = new Map(clinics.map((c: any) => [String(c._id), c.nameEn as string]));

  const rows = payments.map((p) => buildLedgerRow(p, { people, offerNames, clinicNames, serviceNames }));
  return { rows, summary: summarizeLedger(rows) };
}

const TYPE_LABEL: Record<LedgerType, string> = { package: "Package", session: "Session", refund: "Refund", manual: "Manual entry" };

function ledgerDoc(from: string, to: string, ledger: Awaited<ReturnType<typeof loadLedger>>): ReportDoc {
  const s = ledger.summary;
  return {
    type: "payments_ledger",
    title: L("Payments Ledger", "سجل المدفوعات"),
    from,
    to,
    generatedAt: new Date().toISOString(),
    cards: [
      { label: L("Package revenue", "إيرادات الباقات"), value: s.revenueKwd, hint: L("Packages minus refunds", "الباقات ناقص المسترد"), tone: "good" },
      { label: L("Packages collected", "المحصّل من الباقات"), value: s.packagesKwd },
      { label: L("Refunds", "المسترد"), value: s.refundsKwd, tone: "bad" },
      { label: L("Sessions (not revenue)", "الجلسات (ليست إيراد)"), value: s.sessionsKwd },
      { label: L("Awaiting payment", "بانتظار الدفع"), value: s.pendingKwd },
      { label: L("Payments", "عدد العمليات"), value: String(ledger.rows.length) },
    ],
    tables: [
      {
        id: "ledger",
        title: L("All payments", "كل المدفوعات"),
        columns: [
          { key: "date", label: L("Date (Kuwait)", "التاريخ (الكويت)") },
          { key: "customer", label: L("Customer", "العميل") },
          { key: "phone", label: L("Phone", "الهاتف") },
          { key: "item", label: L("Package / service", "الباقة / الخدمة") },
          { key: "clinic", label: L("Clinic", "العيادة") },
          { key: "method", label: L("Paid via", "طريقة الدفع") },
          { key: "type", label: L("Type", "النوع") },
          { key: "status", label: L("Status", "الحالة") },
          { key: "amountKwd", label: L("Amount (KWD)", "المبلغ (د.ك)"), kind: "kwd" },
          { key: "cashbackKwd", label: L("Cashback (KWD)", "الكاش باك (د.ك)"), kind: "kwd" },
          { key: "confirmedBy", label: L("Confirmed by", "أكّدها") },
        ],
        rows: ledger.rows.map((r) => ({ ...r, type: TYPE_LABEL[r.type] })),
        totals: { date: "Package revenue", amountKwd: s.revenueKwd, cashbackKwd: s.cashbackKwd },
        note: L(
          "Refunds are shown as negative amounts. Session payments are listed but are not revenue.",
          "المبالغ المستردة تظهر بالسالب. مدفوعات الجلسات معروضة لكنها ليست إيراد."
        ),
      },
    ],
    notes: [],
  };
}

// ── Package Sales ───────────────────────────────────────────────────────────

/** Splits the package revenue input by package and summarizes each with the shared rules. */
export function summarizePackageSales(input: PackageRevenueInput) {
  const membershipOffer = new Map(input.memberships.map((m) => [String(m._id), m.offerId ? String(m.offerId) : ""]));
  const offerOf = (p: { offerId?: unknown; userOfferId?: unknown }) =>
    (p.offerId ? String(p.offerId) : "") || membershipOffer.get(String(p.userOfferId)) || "";

  const groups = new Map<string, PackageRevenueInput>();
  const group = (offerId: string) => {
    let g = groups.get(offerId);
    if (!g) {
      g = { payments: [], memberships: [], membershipPayments: [], offerPrices: input.offerPrices, offerNames: input.offerNames };
      groups.set(offerId, g);
    }
    return g;
  };
  for (const p of input.payments) group(offerOf(p)).payments.push(p);
  for (const m of input.memberships) group(m.offerId ? String(m.offerId) : "").memberships.push(m as RevenueMembership);
  for (const p of input.membershipPayments) group(membershipOffer.get(String(p.userOfferId)) ?? "").membershipPayments.push(p);

  const rows = [...groups.entries()]
    .map(([offerId, g]) => ({ offerId, name: input.offerNames?.get(offerId) || (offerId ? offerId : "Unknown package"), s: summarizePackageRevenue(g) }))
    .filter(({ s }) => s.paymentsCount || s.refundsCount || s.packagesSold || s.granted.count || s.cancelled.count || kwdToMils(s.outstandingKwd))
    .sort((a, b) => kwdToMils(b.s.revenueKwd) - kwdToMils(a.s.revenueKwd));
  return { rows, total: summarizePackageRevenue(input) };
}

/** Package revenue in the period per referrer of the buyer. */
export function summarizeReferrals(
  payments: { userId?: unknown; userOfferId?: unknown; status?: unknown; purpose?: unknown; method?: unknown; amountKwd?: unknown }[],
  buyerReferrer: Map<string, string>
) {
  const map = new Map<string, { mils: number; sales: Set<string>; payments: number }>();
  for (const p of payments) {
    const mils = kwdToMils(p.amountKwd as string);
    if (!isPackageRevenue(p, mils)) continue;
    const ref = buyerReferrer.get(String(p.userId));
    if (!ref) continue;
    const cur = map.get(ref) ?? { mils: 0, sales: new Set<string>(), payments: 0 };
    cur.mils += mils;
    cur.payments++;
    cur.sales.add(p.userOfferId ? String(p.userOfferId) : `payment-${cur.payments}`);
    map.set(ref, cur);
  }
  return [...map.entries()]
    .map(([referrerId, v]) => ({ referrerId, sales: v.sales.size, revenueKwd: milsToKwd(v.mils) }))
    .sort((a, b) => kwdToMils(b.revenueKwd) - kwdToMils(a.revenueKwd));
}

async function loadReferrals(payments: PackageRevenueInput["payments"]) {
  const buyerIds = [...new Set(payments.map((p) => String(p.userId ?? "")).filter(Boolean))];
  if (!buyerIds.length) return [];
  const buyers = (await UserModel.find({ $or: [{ _id: { $in: buyerIds.filter(isOid) } }, { username: { $in: buyerIds } }] })
    .select("username referredBy")
    .lean()) as any[];
  const buyerReferrer = new Map<string, string>();
  for (const b of buyers) {
    if (!b.referredBy) continue;
    buyerReferrer.set(String(b._id), String(b.referredBy));
    if (b.username) buyerReferrer.set(b.username, String(b.referredBy));
  }
  const rows = summarizeReferrals(payments, buyerReferrer);
  const refs = rows.length
    ? ((await UserModel.find({ _id: { $in: rows.map((r) => r.referrerId) } }).select("fullName username referralCode role").lean()) as any[])
    : [];
  const refById = new Map(refs.map((r) => [String(r._id), r]));
  return rows.map((r) => {
    const u = refById.get(r.referrerId);
    return {
      referrer: u?.fullName || u?.username || r.referrerId,
      code: u?.referralCode ?? "—",
      role: u?.role ? ROLE_LABEL[u.role] ?? u.role : "—",
      sales: r.sales,
      revenueKwd: r.revenueKwd,
    };
  });
}

// ── Installments Due ────────────────────────────────────────────────────────

export type InstallmentDueRow = {
  userOfferId: string;
  userId: string;
  offerId: string;
  number: number;
  amountKwd: string;
  dueDate: string;
  daysLate: number;
  status: "late" | "upcoming";
};

/**
 * Unpaid installments of sold memberships that are due by `until`: every late
 * one (whenever it fell due) plus those coming up before the end of the period.
 */
export function buildInstallmentsDue(
  memberships: { _id: unknown; userId?: string; offerId?: unknown; status: string; installmentSchedule?: { number?: number; amountKwd?: string; paid?: boolean; dueDate?: Date | string }[] }[],
  now: Date,
  until?: Date
) {
  const rows: InstallmentDueRow[] = [];
  let late = 0;
  let upcoming = 0;
  for (const m of memberships) {
    if (!["active", "expired", "reserved"].includes(m.status)) continue;
    for (const inst of m.installmentSchedule ?? []) {
      if (inst.paid) continue;
      const due = inst.dueDate ? new Date(inst.dueDate) : null;
      if (until && due && due.getTime() > until.getTime()) continue;
      const isLate = !!due && due.getTime() < now.getTime();
      const mils = kwdToMils(inst.amountKwd);
      if (isLate) late += mils;
      else upcoming += mils;
      rows.push({
        userOfferId: String(m._id),
        userId: m.userId ?? "",
        offerId: m.offerId ? String(m.offerId) : "",
        number: inst.number ?? 0,
        amountKwd: milsToKwd(mils),
        dueDate: due ? due.toISOString() : "",
        daysLate: isLate && due ? Math.floor((now.getTime() - due.getTime()) / DAY) : 0,
        status: isLate ? "late" : "upcoming",
      });
    }
  }
  rows.sort((a, b) => (a.status !== b.status ? (a.status === "late" ? -1 : 1) : a.dueDate.localeCompare(b.dueDate)));
  return {
    rows,
    lateKwd: milsToKwd(late),
    upcomingKwd: milsToKwd(upcoming),
    totalKwd: milsToKwd(late + upcoming),
    lateCount: rows.filter((r) => r.status === "late").length,
    upcomingCount: rows.filter((r) => r.status === "upcoming").length,
  };
}

// ── Cashback ────────────────────────────────────────────────────────────────

const TXN_LABEL: Record<string, Label> = {
  offer_cashback_credit: L("Package cashback (locked)", "كاش باك الباقة (مقفل)"),
  signup_bonus: L("Signup bonus", "مكافأة التسجيل"),
  installment_unlock: L("Unlocked by installment", "فتح بالقسط"),
  unlock: L("Unlocked", "فتح"),
  session_reward: L("Session reward", "مكافأة جلسة"),
  invoice_reward: L("Invoice reward", "مكافأة فاتورة"),
  adjustment: L("Manual adjustment", "تعديل يدوي"),
  reversal: L("Reversal", "عكس"),
  deduction: L("Used on sessions", "مستخدم في الجلسات"),
  forfeited_due_to_ceiling: L("Forfeited (over ceiling)", "ملغى (فوق الحد)"),
};

export type CashbackTxn = { userId: string; type: string; amountKwd: string; reason?: string; createdAt?: Date | string; createdBy?: { kind?: string; id?: string } };

/** Totals by transaction type, and the transactions staff made by hand. */
export function summarizeCashbackTxns(txns: CashbackTxn[]) {
  const byType = new Map<string, { count: number; mils: number }>();
  const staff: CashbackTxn[] = [];
  for (const t of txns) {
    const cur = byType.get(t.type) ?? { count: 0, mils: 0 };
    cur.count++;
    cur.mils += kwdToMils(t.amountKwd);
    byType.set(t.type, cur);
    if (t.type === "adjustment" || t.createdBy?.kind === "cs" || t.createdBy?.kind === "admin") staff.push(t);
  }
  const used = byType.get("deduction")?.mils ?? 0;
  const staffAdded = staff.filter((t) => t.type !== "deduction").reduce((n, t) => n + kwdToMils(t.amountKwd), 0);
  return {
    byType: [...byType.entries()]
      .sort((a, b) => b[1].mils - a[1].mils)
      .map(([type, v]) => ({ type, label: TXN_LABEL[type] ?? L(type, type), count: v.count, totalKwd: milsToKwd(v.mils) })),
    staff,
    usedKwd: milsToKwd(used),
    staffAddedKwd: milsToKwd(staffAdded),
  };
}

// ── Builders ────────────────────────────────────────────────────────────────

async function monthlySummary(from: string, to: string): Promise<ReportDoc> {
  const prev = previousPeriod(from, to);
  const [cur, before, ledger, sessions, wallets] = await Promise.all([
    loadPackageRevenueInput({ from, to }).then((i) => summarizePackageRevenue(i)),
    loadPackageRevenueInput(prev).then((i) => summarizePackageRevenue(i)),
    loadLedger(from, to),
    computeClinicSessionsReport({ from, to }),
    walletTotals(),
  ]);
  const ch = (a: string | number, b: string | number) =>
    typeof a === "number" ? fmtChange(percentChange(a, b as number)) : fmtChange(percentChange(kwdToMils(a), kwdToMils(b as string)));
  const compare = (label: Label, a: string | number, b: string | number) => ({
    metric: label.en,
    metricAr: label.ar,
    current: a,
    previous: b,
    change: ch(a, b),
  });

  return {
    type: "monthly_summary",
    title: L("Monthly Finance Summary", "الملخص المالي"),
    from,
    to,
    generatedAt: new Date().toISOString(),
    cards: [
      { label: L("Package revenue", "إيرادات الباقات"), value: cur.revenueKwd, hint: L(`${ch(cur.revenueKwd, before.revenueKwd)} vs previous period`, `${ch(cur.revenueKwd, before.revenueKwd)} عن الفترة السابقة`), tone: "good" },
      { label: L("Collected", "المحصّل"), value: cur.collectedKwd },
      { label: L("Refunds", "المسترد"), value: cur.refundsKwd, tone: "bad" },
      { label: L("Still to collect", "المتبقي للتحصيل"), value: cur.outstandingKwd, hint: L(`${cur.lateKwd} late`, `${cur.lateKwd} متأخر`) },
      { label: L("Packages sold", "الباقات المباعة"), value: String(cur.packagesSold) },
      { label: L("Granted (not revenue)", "ممنوحة (ليست إيراد)"), value: String(cur.granted.count), hint: L(`List value ${cur.granted.listValueKwd}`, `القيمة ${cur.granted.listValueKwd}`) },
      { label: L("Cancellations", "الإلغاءات"), value: String(cur.cancelled.count), hint: L(`Refunded ${cur.cancelled.refundedKwd}`, `مسترد ${cur.cancelled.refundedKwd}`) },
      { label: L("Cashback owed", "الكاش باك المستحق"), value: wallets.totalKwd, hint: L("Current balance, not date-filtered", "الرصيد الحالي، غير مرتبط بالفترة") },
    ],
    tables: [
      {
        id: "comparison",
        title: L(`Compared with ${kwDate(prev.from)} – ${kwDate(prev.to)}`, `مقارنة مع ${kwDate(prev.from)} – ${kwDate(prev.to)}`),
        columns: [
          { key: "metric", label: L("Metric", "البند") },
          { key: "current", label: L("This period", "هذه الفترة") },
          { key: "previous", label: L("Previous period", "الفترة السابقة") },
          { key: "change", label: L("Change", "التغيير") },
        ],
        rows: [
          compare(L("Package revenue (KWD)", "إيرادات الباقات"), cur.revenueKwd, before.revenueKwd),
          compare(L("Collected (KWD)", "المحصّل"), cur.collectedKwd, before.collectedKwd),
          compare(L("Refunds (KWD)", "المسترد"), cur.refundsKwd, before.refundsKwd),
          compare(L("Packages sold", "الباقات المباعة"), cur.packagesSold, before.packagesSold),
          compare(L("Granted packages", "الباقات الممنوحة"), cur.granted.count, before.granted.count),
          compare(L("Cancellations", "الإلغاءات"), cur.cancelled.count, before.cancelled.count),
        ],
      },
      {
        id: "top_packages",
        title: L("Top packages", "أعلى الباقات"),
        columns: [
          { key: "offerName", label: L("Package", "الباقة") },
          { key: "count", label: L("Payments", "العمليات"), kind: "int" },
          { key: "revenueKwd", label: L("Revenue (KWD)", "الإيراد (د.ك)"), kind: "kwd" },
        ],
        rows: cur.topPackages.map((p) => ({ ...p })),
      },
      {
        id: "sessions_per_clinic",
        title: L("Sessions per clinic (count only, not revenue)", "الجلسات لكل عيادة (عدد فقط، ليست إيراد)"),
        columns: [
          { key: "clinic", label: L("Clinic", "العيادة") },
          { key: "completed", label: L("Completed", "مكتملة"), kind: "int" },
          { key: "noShow", label: L("No-show", "لم يحضر"), kind: "int" },
        ],
        rows: sessions.clinics.map((c) => ({ clinic: c.clinicNameEn, completed: c.completed, noShow: c.noShow })),
        totals: { clinic: "Total", completed: sessions.totals.completed, noShow: sessions.totals.noShow },
      },
    ],
    notes: [
      L("Revenue is money received for packages minus refunds. Session payments are not revenue.", "الإيراد هو المبالغ المستلمة للباقات ناقص المسترد. مدفوعات الجلسات ليست إيراد."),
      L("Still to collect, granted and cancellations cover packages sold in this period.", "المتبقي والممنوح والإلغاءات تخص الباقات المباعة في هذه الفترة."),
    ],
    check: reconcileWithLedger(cur.revenueKwd, ledger.summary.revenueKwd),
  };
}

async function packageSales(from: string, to: string): Promise<ReportDoc> {
  const input = await loadPackageRevenueInput({ from, to });
  const [ledger, referrals] = await Promise.all([loadLedger(from, to), loadReferrals(input.payments)]);
  const { rows, total } = summarizePackageSales(input);
  const reportTotal = milsToKwd(rows.reduce((n, r) => n + kwdToMils(r.s.revenueKwd), 0));
  return {
    type: "package_sales",
    title: L("Package Sales", "مبيعات الباقات"),
    from,
    to,
    generatedAt: new Date().toISOString(),
    cards: [
      { label: L("Package revenue", "إيرادات الباقات"), value: total.revenueKwd, tone: "good" },
      { label: L("Packages sold", "الباقات المباعة"), value: String(total.packagesSold) },
      { label: L("Still to collect", "المتبقي للتحصيل"), value: total.outstandingKwd },
      { label: L("Granted (not revenue)", "ممنوحة (ليست إيراد)"), value: String(total.granted.count), hint: L(`List value ${total.granted.listValueKwd}`, `القيمة ${total.granted.listValueKwd}`) },
      { label: L("Cancelled", "ملغاة"), value: String(total.cancelled.count), hint: L(`Refunds ${total.refundsKwd}`, `المسترد ${total.refundsKwd}`) },
    ],
    tables: [
      {
        id: "packages",
        title: L("By package", "حسب الباقة"),
        columns: [
          { key: "name", label: L("Package", "الباقة") },
          { key: "sold", label: L("Sold", "مباعة"), kind: "int" },
          { key: "collectedKwd", label: L("Collected (KWD)", "المحصّل"), kind: "kwd" },
          { key: "refundsKwd", label: L("Refunds (KWD)", "المسترد"), kind: "kwd" },
          { key: "revenueKwd", label: L("Revenue (KWD)", "الإيراد"), kind: "kwd" },
          { key: "outstandingKwd", label: L("Still to collect (KWD)", "المتبقي"), kind: "kwd" },
          { key: "granted", label: L("Granted", "ممنوحة"), kind: "int" },
          { key: "grantedValueKwd", label: L("Granted value (KWD)", "قيمة الممنوح"), kind: "kwd" },
          { key: "cancelled", label: L("Cancelled", "ملغاة"), kind: "int" },
        ],
        rows: rows.map(({ name, s }) => ({
          name,
          sold: s.packagesSold,
          collectedKwd: s.collectedKwd,
          refundsKwd: s.refundsKwd,
          revenueKwd: s.revenueKwd,
          outstandingKwd: s.outstandingKwd,
          granted: s.granted.count,
          grantedValueKwd: s.granted.listValueKwd,
          cancelled: s.cancelled.count,
        })),
        totals: {
          name: "Total",
          sold: total.packagesSold,
          collectedKwd: total.collectedKwd,
          refundsKwd: total.refundsKwd,
          revenueKwd: total.revenueKwd,
          outstandingKwd: total.outstandingKwd,
          granted: total.granted.count,
          grantedValueKwd: total.granted.listValueKwd,
          cancelled: total.cancelled.count,
        },
      },
      {
        id: "referrals",
        title: L("Referrals", "الإحالات"),
        columns: [
          { key: "referrer", label: L("Referred by", "المُحيل") },
          { key: "code", label: L("Code", "الكود") },
          { key: "role", label: L("Role", "الدور") },
          { key: "sales", label: L("Sales", "المبيعات"), kind: "int" },
          { key: "revenueKwd", label: L("Revenue (KWD)", "الإيراد"), kind: "kwd" },
        ],
        rows: referrals,
        totals: {
          referrer: "Total",
          sales: referrals.reduce((n, r) => n + r.sales, 0),
          revenueKwd: milsToKwd(referrals.reduce((n, r) => n + kwdToMils(r.revenueKwd), 0)),
        },
        note: L("Package payments in the period by customers who were referred.", "مدفوعات الباقات في الفترة من عملاء تمت إحالتهم."),
      },
    ],
    notes: [L("Sold, still to collect, granted and cancelled cover packages bought in this period.", "المباع والمتبقي والممنوح والملغى تخص الباقات المشتراة في هذه الفترة.")],
    check: reconcileWithLedger(reportTotal, ledger.summary.revenueKwd),
  };
}

async function installmentsDue(from: string, to: string): Promise<ReportDoc> {
  const until = kwDateRange(undefined, to)?.$lte;
  const memberships = (await UserOfferModel.find({
    status: { $in: ["active", "expired", "reserved"] },
    installmentSchedule: { $elemMatch: { paid: { $ne: true } } },
  })
    .select("userId offerId status installmentSchedule")
    .lean()) as any[];
  const due = buildInstallmentsDue(memberships, new Date(), until);
  const [people, offerNames] = await Promise.all([loadPeople(due.rows.map((r) => r.userId)), loadOfferNames(due.rows.map((r) => r.offerId))]);
  return {
    type: "installments_due",
    title: L("Installments Due", "الأقساط المستحقة"),
    from,
    to,
    generatedAt: new Date().toISOString(),
    cards: [
      { label: L("Late", "متأخرة"), value: due.lateKwd, hint: L(`${due.lateCount} installments`, `${due.lateCount} قسط`), tone: "bad" },
      { label: L("Coming up", "قادمة"), value: due.upcomingKwd, hint: L(`${due.upcomingCount} installments`, `${due.upcomingCount} قسط`) },
      { label: L("Total due", "إجمالي المستحق"), value: due.totalKwd },
    ],
    tables: [
      {
        id: "installments",
        title: L("Late first, then coming up", "المتأخرة أولاً ثم القادمة"),
        columns: [
          { key: "status", label: L("Status", "الحالة") },
          { key: "customer", label: L("Customer", "العميل") },
          { key: "phone", label: L("Phone", "الهاتف") },
          { key: "package", label: L("Package", "الباقة") },
          { key: "number", label: L("Installment #", "رقم القسط"), kind: "int" },
          { key: "amountKwd", label: L("Amount (KWD)", "المبلغ (د.ك)"), kind: "kwd" },
          { key: "dueDate", label: L("Due date", "تاريخ الاستحقاق") },
          { key: "daysLate", label: L("Days late", "أيام التأخير"), kind: "int" },
        ],
        rows: due.rows.map((r) => ({
          status: r.status === "late" ? "Late" : "Coming up",
          customer: people.get(r.userId)?.name ?? r.userId,
          phone: people.get(r.userId)?.phone ?? "",
          package: offerNames.get(r.offerId) ?? "—",
          number: r.number,
          amountKwd: r.amountKwd,
          dueDate: r.dueDate ? kwDate(r.dueDate) : "—",
          daysLate: r.daysLate,
        })),
        totals: { status: "Total", amountKwd: due.totalKwd },
      },
    ],
    notes: [
      L(
        "Shows every late installment (whenever it fell due) and those due up to the end of the period. Cancelled memberships are excluded.",
        "يعرض كل الأقساط المتأخرة (أياً كان تاريخها) والمستحقة حتى نهاية الفترة. الاشتراكات الملغاة غير مشمولة."
      ),
    ],
  };
}

async function clinicSessions(from: string, to: string): Promise<ReportDoc> {
  const r = await computeClinicSessionsReport({ from, to });
  return {
    type: "clinic_sessions",
    title: L("Clinic Sessions", "جلسات العيادات"),
    from,
    to,
    generatedAt: new Date().toISOString(),
    cards: [
      { label: L("Completed", "مكتملة"), value: String(r.totals.completed) },
      { label: L("No-shows", "لم يحضر"), value: String(r.totals.noShow) },
      { label: L("Session value", "قيمة الجلسات"), value: r.totals.sessionValueKwd },
      { label: L("Cashback used", "الكاش باك المستخدم"), value: r.totals.cashbackKwd },
      { label: L("Paid at clinic", "المدفوع في العيادة"), value: r.totals.paidAtClinicKwd },
    ],
    tables: [
      {
        id: "clinics",
        title: L("Per clinic", "لكل عيادة"),
        columns: [
          { key: "clinicNameEn", label: L("Clinic", "العيادة") },
          { key: "completed", label: L("Completed", "مكتملة"), kind: "int" },
          { key: "noShow", label: L("No-show", "لم يحضر"), kind: "int" },
          { key: "sessionValueKwd", label: L("Session value (KWD)", "قيمة الجلسات"), kind: "kwd" },
          { key: "cashbackKwd", label: L("Cashback (KWD)", "الكاش باك"), kind: "kwd" },
          { key: "paidAtClinicKwd", label: L("Paid at clinic (KWD)", "المدفوع في العيادة"), kind: "kwd" },
        ],
        rows: r.clinics.map((c) => ({ ...c })),
        totals: { clinicNameEn: "Total", ...r.totals },
      },
      {
        id: "sessions",
        title: L("All sessions", "كل الجلسات"),
        columns: [
          { key: "date", label: L("Date (Kuwait)", "التاريخ") },
          { key: "clinicNameEn", label: L("Clinic", "العيادة") },
          { key: "customerName", label: L("Customer", "العميل") },
          { key: "customerPhone", label: L("Phone", "الهاتف") },
          { key: "service", label: L("Package / service", "الباقة / الخدمة") },
          { key: "status", label: L("Status", "الحالة") },
          { key: "sessionValueKwd", label: L("Value (KWD)", "القيمة"), kind: "kwd" },
          { key: "cashbackKwd", label: L("Cashback (KWD)", "الكاش باك"), kind: "kwd" },
          { key: "paidAtClinicKwd", label: L("Paid at clinic (KWD)", "المدفوع"), kind: "kwd" },
        ],
        rows: r.rows.map((row) => ({
          date: kwDateTime(row.date),
          clinicNameEn: row.clinicNameEn,
          customerName: row.customerName,
          customerPhone: row.customerPhone,
          service: [row.packageName, row.extras].filter(Boolean).join(" + ") + (row.membershipCancelled ? " (membership cancelled)" : ""),
          status: row.status === "no_show" ? "No-show" : "Completed",
          sessionValueKwd: row.sessionValueKwd,
          cashbackKwd: row.cashbackKwd,
          paidAtClinicKwd: row.paidAtClinicKwd,
        })),
        totals: { date: "Total", sessionValueKwd: r.totals.sessionValueKwd, cashbackKwd: r.totals.cashbackKwd, paidAtClinicKwd: r.totals.paidAtClinicKwd },
      },
    ],
    notes: [L("Session amounts are not revenue. No-shows carry no money.", "مبالغ الجلسات ليست إيراد. حالات عدم الحضور بدون مبالغ.")],
  };
}

async function walletTotals() {
  const agg = await WalletModel.aggregate([
    { $group: { _id: null, locked: { $sum: { $toDouble: "$lockedKwd" } }, unlocked: { $sum: { $toDouble: "$unlockedKwd" } }, count: { $sum: 1 } } },
  ]);
  const locked = Math.round((agg[0]?.locked ?? 0) * 1000);
  const unlocked = Math.round((agg[0]?.unlocked ?? 0) * 1000);
  return { lockedKwd: milsToKwd(locked), unlockedKwd: milsToKwd(unlocked), totalKwd: milsToKwd(locked + unlocked), wallets: agg[0]?.count ?? 0 };
}

async function cashback(from: string, to: string): Promise<ReportDoc> {
  const range = kwDateRange(from, to);
  const [totals, txns, top] = await Promise.all([
    walletTotals(),
    WalletTxnModel.find(range ? { createdAt: range } : {}).select("userId type amountKwd reason createdAt createdBy").sort({ createdAt: 1 }).lean() as Promise<any[]>,
    WalletModel.aggregate([
      { $addFields: { balance: { $add: [{ $toDouble: "$lockedKwd" }, { $toDouble: "$unlockedKwd" }] } } },
      { $sort: { balance: -1 } },
      { $limit: 20 },
    ]),
  ]);
  const s = summarizeCashbackTxns(txns);
  const people = await loadPeople([...s.staff.flatMap((t) => [t.userId, t.createdBy?.id]), ...top.map((w: any) => w.userId)]);
  return {
    type: "cashback",
    title: L("Cashback & Adjustments", "الكاش باك والتعديلات"),
    from,
    to,
    generatedAt: new Date().toISOString(),
    cards: [
      { label: L("Cashback owed now", "الكاش باك المستحق الآن"), value: totals.totalKwd, hint: L("Locked + unlocked, all wallets", "مقفل + متاح، كل المحافظ") },
      { label: L("Unlocked (usable)", "متاح للاستخدام"), value: totals.unlockedKwd },
      { label: L("Locked", "مقفل"), value: totals.lockedKwd },
      { label: L("Used in period", "المستخدم في الفترة"), value: s.usedKwd },
      { label: L("Added by staff in period", "أضافه الموظفون في الفترة"), value: s.staffAddedKwd, tone: "bad" },
    ],
    tables: [
      {
        id: "by_type",
        title: L("Wallet activity in the period", "حركة المحافظ في الفترة"),
        columns: [
          { key: "label", label: L("Type", "النوع") },
          { key: "count", label: L("Entries", "العمليات"), kind: "int" },
          { key: "totalKwd", label: L("Amount (KWD)", "المبلغ (د.ك)"), kind: "kwd" },
        ],
        rows: s.byType.map((t) => ({ label: t.label.en, labelAr: t.label.ar, count: t.count, totalKwd: t.totalKwd })),
      },
      {
        id: "staff",
        title: L("Made by staff", "تمت من الموظفين"),
        columns: [
          { key: "date", label: L("Date (Kuwait)", "التاريخ") },
          { key: "customer", label: L("Customer", "العميل") },
          { key: "phone", label: L("Phone", "الهاتف") },
          { key: "type", label: L("Type", "النوع") },
          { key: "amountKwd", label: L("Amount (KWD)", "المبلغ (د.ك)"), kind: "kwd" },
          { key: "reason", label: L("Reason", "السبب") },
          { key: "by", label: L("Made by", "بواسطة") },
        ],
        rows: s.staff.map((t) => ({
          date: kwDateTime(t.createdAt ?? null),
          customer: people.get(t.userId)?.name ?? t.userId,
          phone: people.get(t.userId)?.phone ?? "",
          type: (TXN_LABEL[t.type] ?? L(t.type, t.type)).en,
          amountKwd: milsToKwd(kwdToMils(t.amountKwd)),
          reason: t.reason ?? "",
          by: confirmerLabel(t.createdBy?.id, people),
        })),
        totals: { date: "Total", amountKwd: milsToKwd(s.staff.reduce((n, t) => n + kwdToMils(t.amountKwd), 0)) },
      },
      {
        id: "top_balances",
        title: L("Top 20 balances", "أعلى 20 رصيد"),
        columns: [
          { key: "customer", label: L("Customer", "العميل") },
          { key: "phone", label: L("Phone", "الهاتف") },
          { key: "unlockedKwd", label: L("Unlocked (KWD)", "متاح"), kind: "kwd" },
          { key: "lockedKwd", label: L("Locked (KWD)", "مقفل"), kind: "kwd" },
          { key: "balanceKwd", label: L("Balance (KWD)", "الرصيد"), kind: "kwd" },
        ],
        rows: top.map((w: any) => ({
          customer: people.get(w.userId)?.name ?? w.userId,
          phone: people.get(w.userId)?.phone ?? "",
          unlockedKwd: milsToKwd(kwdToMils(w.unlockedKwd)),
          lockedKwd: milsToKwd(kwdToMils(w.lockedKwd)),
          balanceKwd: milsToKwd(kwdToMils(w.lockedKwd) + kwdToMils(w.unlockedKwd)),
        })),
      },
    ],
    notes: [L("Balances are current and not date-filtered. Cashback is not revenue.", "الأرصدة حالية وغير مرتبطة بالفترة. الكاش باك ليس إيراد.")],
  };
}

/** Builds one report for a period (Kuwait dates). Missing dates default to this month. */
export async function buildFinanceReport(type: FinanceReportType, period: { from?: string; to?: string }): Promise<ReportDoc> {
  const def = currentKwMonth();
  const from = (period.from || def.from).slice(0, 10);
  const to = (period.to || def.to).slice(0, 10);
  switch (type) {
    case "monthly_summary":
      return monthlySummary(from, to);
    case "package_sales":
      return packageSales(from, to);
    case "payments_ledger":
      return ledgerDoc(from, to, await loadLedger(from, to));
    case "installments_due":
      return installmentsDue(from, to);
    case "clinic_sessions":
      return clinicSessions(from, to);
    case "cashback":
      return cashback(from, to);
  }
}

export const isFinanceReportType = (t: unknown): t is FinanceReportType => FINANCE_REPORT_TYPES.includes(t as FinanceReportType);
