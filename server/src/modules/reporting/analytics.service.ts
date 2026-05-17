import mongoose from "mongoose";
import * as clinicService from "../../services/clinic.service.js";
import * as offerService from "../../services/offer.service.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { sumCompletedPaymentsKwd } from "../../services/payment.service.js";
import { PaymentModel } from "../../models/payment.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { UserModel } from "../../models/user.model.js";
import { serializePayment } from "../../utils/serialize.js";
import { kycStore } from "../kyc/kyc.store.js";
import ExcelJS from "exceljs";

function parseKwd(s: string) {
  if (!s) return 0;
  const negative = s.startsWith("-");
  const abs = negative ? s.slice(1) : s;
  const [a, b = "000"] = abs.split(".");
  const mils = Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
  return negative ? -mils : mils;
}

function fmtKwd(mils: number) {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  const a = Math.floor(abs / 1000);
  const b = String(abs % 1000).padStart(3, "0");
  return `${sign}${a}.${b}`;
}

function buildDateFilter(from?: string, to?: string) {
  const f: any = {};
  if (from) f.$gte = new Date(from);
  if (to) f.$lte = new Date(to);
  return Object.keys(f).length ? f : undefined;
}

// Returns the "bucket key" for a given date and period
function bucketKey(d: Date, period: "daily" | "weekly" | "monthly" | "yearly"): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  if (period === "yearly") return `${y}`;
  if (period === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  if (period === "weekly") {
    // ISO-week-like: anchor to start of week (Monday)
    const tmp = new Date(Date.UTC(y, d.getUTCMonth(), day));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum);
    return `${tmp.getUTCFullYear()}-W${String(Math.ceil(((tmp.getTime() - Date.UTC(tmp.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
  }
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function computePaymentsBreakdown(filters: {
  status?: string;
  method?: string;
  purpose?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}) {
  const q: Record<string, unknown> = {};
  if (filters.status) q.status = filters.status;
  if (filters.method) q.method = filters.method;
  if (filters.purpose) q.purpose = filters.purpose;
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;
  const limit = Math.min(500, filters.limit ?? 200);

  const [payments, totalCount] = await Promise.all([
    PaymentModel.find(q).sort({ createdAt: -1 }).limit(limit).lean(),
    PaymentModel.countDocuments(q),
  ]);

  const isObjectId = (s: string) => /^[a-f0-9]{24}$/i.test(s);
  const offerIds = [...new Set(payments.map((p) => p.offerId?.toString()).filter(Boolean))].filter(isObjectId) as string[];
  const brIds = [...new Set(payments.map((p) => (p as any).bookingRequestId).filter(Boolean))].filter(isObjectId) as string[];
  const userIds = [...new Set(payments.map((p) => p.userId?.toString()).filter(Boolean))].filter(isObjectId) as string[];

  const [offerDocs, breqDocs, userDocs] = await Promise.all([
    offerIds.length ? OfferModel.find({ _id: { $in: offerIds } }).select("name membershipType").lean() : Promise.resolve([]),
    brIds.length ? BookingRequestModel.find({ _id: { $in: brIds } }).select("clinicId membershipType").lean().catch(() => []) : Promise.resolve([]),
    userIds.length ? UserModel.find({ _id: { $in: userIds } }).select("fullName phone").lean() : Promise.resolve([]),
  ]);

  const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), { name: o.name as string, membershipType: o.membershipType as string }]));
  const breqMap = new Map(breqDocs.map((b: any) => [b._id.toString(), { clinicId: b.clinicId as string, membershipType: b.membershipType as string }]));
  const userMap = new Map(userDocs.map((u: any) => [u._id.toString(), { fullName: u.fullName as string, phone: u.phone as string }]));

  const clinicIds = [...new Set([...breqMap.values()].map((b) => b.clinicId).filter(Boolean))] as string[];
  const clinicDocs = await ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn nameAr").lean();
  const clinicMap = new Map(clinicDocs.map((c: any) => [c._id.toString(), { nameEn: c.nameEn as string, nameAr: c.nameAr as string }]));

  const enriched = payments.map((p: any) => {
    const offerId = p.offerId?.toString();
    const brId = p.bookingRequestId;
    const userId = p.userId?.toString();
    const breq = brId ? breqMap.get(brId) : undefined;
    const clinic = breq?.clinicId ? clinicMap.get(breq.clinicId) : undefined;
    const offer = offerId ? offerMap.get(offerId) : undefined;
    const user = userId ? userMap.get(userId) : undefined;
    return {
      ...serializePayment(p as any),
      offerName: offer?.name,
      clinicId: breq?.clinicId,
      clinicNameEn: clinic?.nameEn,
      clinicNameAr: clinic?.nameAr,
      membershipType: breq?.membershipType ?? offer?.membershipType,
      customerName: user?.fullName,
      customerPhone: user?.phone,
    };
  });

  const byMethod: Record<string, { count: number; mils: number }> = {};
  const byPurpose: Record<string, { count: number; mils: number }> = {};
  const byClinic: Record<string, { clinicId: string; clinicNameEn: string; clinicNameAr: string; count: number; mils: number }> = {};
  let totalCompletedMils = 0;
  let membershipMils = 0;
  let sessionMils = 0;
  let cashbackAppliedMils = 0;
  let pendingCount = 0;

  // Money model: amountKwd = NET collected (after cashback). grossAmountKwd = sticker price.
  // Revenue (gross) = grossAmountKwd ?? (amountKwd + cashback). Profit = net = amountKwd.
  let grossRevenueMils = 0;
  for (const p of enriched) {
    const netMils = parseKwd(p.amountKwd);
    if (p.status === "pending") { pendingCount++; continue; }
    if (p.status !== "completed") continue;

    const cbMils = parseKwd(p.cashbackAppliedKwd || "0.000");
    const grossMils = p.grossAmountKwd ? parseKwd(p.grossAmountKwd) : netMils + cbMils;

    totalCompletedMils += netMils;
    grossRevenueMils += grossMils;
    cashbackAppliedMils += cbMils;

    const purpose = p.purpose || "enrollment_full";
    if (purpose === "session_payment") sessionMils += grossMils;
    else membershipMils += grossMils;

    const m = p.method;
    if (!byMethod[m]) byMethod[m] = { count: 0, mils: 0 };
    byMethod[m].count++;
    byMethod[m].mils += grossMils;

    if (!byPurpose[purpose]) byPurpose[purpose] = { count: 0, mils: 0 };
    byPurpose[purpose].count++;
    byPurpose[purpose].mils += grossMils;

    if (p.clinicId && p.clinicNameEn) {
      if (!byClinic[p.clinicId]) byClinic[p.clinicId] = { clinicId: p.clinicId, clinicNameEn: p.clinicNameEn, clinicNameAr: p.clinicNameAr ?? "", count: 0, mils: 0 };
      byClinic[p.clinicId].count++;
      byClinic[p.clinicId].mils += grossMils;
    }
  }

  return {
    items: enriched,
    truncated: payments.length < totalCount,
    totalMatching: totalCount,
    summary: {
      totalCollectedKwd: fmtKwd(totalCompletedMils),
      grossRevenueKwd: fmtKwd(grossRevenueMils),
      membershipRevenueKwd: fmtKwd(membershipMils),
      sessionRevenueKwd: fmtKwd(sessionMils),
      cashbackAppliedKwd: fmtKwd(cashbackAppliedMils),
      profitKwd: fmtKwd(totalCompletedMils),
      pendingCount,
    },
    byMethod: Object.entries(byMethod).map(([method, v]) => ({ method, count: v.count, totalKwd: fmtKwd(v.mils) })),
    byPurpose: Object.entries(byPurpose).map(([purpose, v]) => ({ purpose, count: v.count, totalKwd: fmtKwd(v.mils) })),
    byClinics: Object.values(byClinic)
      .sort((a, b) => b.mils - a.mils)
      .map((v) => ({ clinicId: v.clinicId, clinicNameEn: v.clinicNameEn, clinicNameAr: v.clinicNameAr, count: v.count, totalKwd: fmtKwd(v.mils) })),
  };
}

// Time-bucketed revenue/cashback/profit
export async function computeFinanceTimeseries(filters: { period: "daily" | "weekly" | "monthly" | "yearly"; from?: string; to?: string }) {
  const period = filters.period;
  const q: Record<string, unknown> = { status: "completed" };
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;

  const payments = await PaymentModel.find(q).select("amountKwd grossAmountKwd cashbackAppliedKwd purpose createdAt").lean();

  const buckets = new Map<string, { revenue: number; net: number; cashback: number; sessions: number; memberships: number; count: number }>();

  for (const p of payments as any[]) {
    const k = bucketKey(new Date(p.createdAt), period);
    const cur = buckets.get(k) ?? { revenue: 0, net: 0, cashback: 0, sessions: 0, memberships: 0, count: 0 };
    const net = parseKwd(p.amountKwd);
    const cb = parseKwd(p.cashbackAppliedKwd || "0.000");
    const gross = p.grossAmountKwd ? parseKwd(p.grossAmountKwd) : net + cb;
    cur.revenue += gross;
    cur.net += net;
    cur.cashback += cb;
    if ((p.purpose || "enrollment_full") === "session_payment") cur.sessions += gross;
    else cur.memberships += gross;
    cur.count++;
    buckets.set(k, cur);
  }

  const points = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, v]) => ({
      bucket,
      revenueKwd: fmtKwd(v.revenue),
      cashbackKwd: fmtKwd(v.cashback),
      profitKwd: fmtKwd(v.net),
      membershipKwd: fmtKwd(v.memberships),
      sessionKwd: fmtKwd(v.sessions),
      transactions: v.count,
    }));

  // Totals
  let totalRev = 0;
  let totalNet = 0;
  let totalCb = 0;
  let totalCnt = 0;
  for (const v of buckets.values()) { totalRev += v.revenue; totalNet += v.net; totalCb += v.cashback; totalCnt += v.count; }

  return {
    period,
    points,
    totals: {
      revenueKwd: fmtKwd(totalRev),
      cashbackKwd: fmtKwd(totalCb),
      profitKwd: fmtKwd(totalNet),
      transactions: totalCnt,
    },
  };
}

// Revenue per offer
export async function computeRevenueByOffer(filters: { from?: string; to?: string; limit?: number } = {}) {
  const q: Record<string, unknown> = { status: "completed" };
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;
  const payments = await PaymentModel.find(q).select("offerId amountKwd grossAmountKwd cashbackAppliedKwd").lean();

  const map = new Map<string, { revenue: number; net: number; cashback: number; count: number }>();
  for (const p of payments as any[]) {
    const k = p.offerId?.toString();
    if (!k) continue;
    const cur = map.get(k) ?? { revenue: 0, net: 0, cashback: 0, count: 0 };
    const net = parseKwd(p.amountKwd);
    const cb = parseKwd(p.cashbackAppliedKwd || "0.000");
    const gross = p.grossAmountKwd ? parseKwd(p.grossAmountKwd) : net + cb;
    cur.revenue += gross;
    cur.net += net;
    cur.cashback += cb;
    cur.count++;
    map.set(k, cur);
  }

  const offerIds = [...map.keys()];
  const offers = await OfferModel.find({ _id: { $in: offerIds } }).select("name membershipType subscriptionPriceKwd").lean();
  const offerMap = new Map(offers.map((o: any) => [o._id.toString(), o]));

  const items = [...map.entries()]
    .map(([offerId, v]) => {
      const o: any = offerMap.get(offerId);
      return {
        offerId,
        offerName: o?.name ?? offerId,
        membershipType: o?.membershipType ?? "—",
        revenueKwd: fmtKwd(v.revenue),
        cashbackKwd: fmtKwd(v.cashback),
        profitKwd: fmtKwd(v.net),
        salesCount: v.count,
      };
    })
    .sort((a, b) => parseKwd(b.revenueKwd) - parseKwd(a.revenueKwd));

  const limit = Math.min(200, filters.limit ?? 50);
  return { items: items.slice(0, limit) };
}

// Top customers by revenue / LTV
export async function computeRevenueByUser(filters: { from?: string; to?: string; limit?: number } = {}) {
  const q: Record<string, unknown> = { status: "completed" };
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;
  const payments = await PaymentModel.find(q).select("userId amountKwd cashbackAppliedKwd").lean();

  const map = new Map<string, { revenue: number; cashback: number; count: number }>();
  for (const p of payments as any[]) {
    const cur = map.get(p.userId) ?? { revenue: 0, cashback: 0, count: 0 };
    cur.revenue += parseKwd(p.amountKwd);
    cur.cashback += parseKwd(p.cashbackAppliedKwd || "0.000");
    cur.count++;
    map.set(p.userId, cur);
  }

  const userIds = [...map.keys()];
  // Try to load user names — userId might be ObjectId string or username
  const userDocs: any[] = await UserModel.find({
    $or: [
      { _id: { $in: userIds.filter((i) => /^[a-f0-9]{24}$/i.test(i)) } },
      { username: { $in: userIds } },
    ],
  }).select("username displayName email phone").lean().catch(() => []);
  const userMap = new Map<string, any>();
  for (const u of userDocs) {
    userMap.set(u._id.toString(), u);
    if (u.username) userMap.set(u.username, u);
  }

  // Pending balance per user (pending payments)
  const pendingDocs = await PaymentModel.aggregate([
    { $match: { status: "pending", userId: { $in: userIds } } },
    { $group: { _id: "$userId", total: { $sum: 1 } } },
  ]).catch(() => []);
  const pendingMap = new Map<string, number>(pendingDocs.map((d: any) => [d._id, d.total]));

  const items = [...map.entries()]
    .map(([userId, v]) => {
      const u = userMap.get(userId);
      return {
        userId,
        displayName: u?.displayName ?? u?.username ?? userId,
        email: u?.email,
        phone: u?.phone,
        ltvKwd: fmtKwd(v.revenue),
        cashbackUsedKwd: fmtKwd(v.cashback),
        purchasesCount: v.count,
        pendingPayments: pendingMap.get(userId) ?? 0,
      };
    })
    .sort((a, b) => parseKwd(b.ltvKwd) - parseKwd(a.ltvKwd));

  const limit = Math.min(200, filters.limit ?? 50);
  return { items: items.slice(0, limit) };
}

// Revenue grouped by referrer (the staff who referred the buyer)
export async function computeRevenueByReferral(filters: { from?: string; to?: string; limit?: number } = {}) {
  const q: Record<string, unknown> = { status: "completed" };
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;
  const payments = await PaymentModel.find(q).select("userId amountKwd").lean();

  // Map buyer userId → referredBy
  const buyerIds = [...new Set(payments.map((p: any) => p.userId))];
  const buyers: any[] = await UserModel.find({
    $or: [
      { _id: { $in: buyerIds.filter((i) => /^[a-f0-9]{24}$/i.test(i)) } },
      { username: { $in: buyerIds } },
    ],
  }).select("username referredBy").lean().catch(() => []);

  const buyerToReferrer = new Map<string, string>();
  for (const b of buyers) {
    if (!b.referredBy) continue;
    buyerToReferrer.set(b._id.toString(), b.referredBy.toString());
    if (b.username) buyerToReferrer.set(b.username, b.referredBy.toString());
  }

  const map = new Map<string, { revenue: number; sales: number }>();
  for (const p of payments as any[]) {
    const ref = buyerToReferrer.get(p.userId);
    if (!ref) continue;
    const cur = map.get(ref) ?? { revenue: 0, sales: 0 };
    cur.revenue += parseKwd(p.amountKwd);
    cur.sales++;
    map.set(ref, cur);
  }

  const referrerIds = [...map.keys()];
  const referrers: any[] = await UserModel.find({ _id: { $in: referrerIds } }).select("username displayName referralCode role").lean().catch(() => []);
  const refMap = new Map(referrers.map((r) => [r._id.toString(), r]));

  const items = [...map.entries()]
    .map(([refId, v]) => {
      const r: any = refMap.get(refId);
      return {
        referrerId: refId,
        displayName: r?.displayName ?? r?.username ?? refId,
        referralCode: r?.referralCode ?? "—",
        role: r?.role ?? "—",
        revenueKwd: fmtKwd(v.revenue),
        salesCount: v.sales,
      };
    })
    .sort((a, b) => parseKwd(b.revenueKwd) - parseKwd(a.revenueKwd));

  const limit = Math.min(200, filters.limit ?? 50);
  return { items: items.slice(0, limit) };
}

// Installment tracker (paid / upcoming / late)
export async function computeInstallmentsAnalytics(filters: { from?: string; to?: string; limit?: number } = {}) {
  const now = new Date();
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  const inRange = (d: Date | null) => {
    if (!d) return !fromDate && !toDate;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };
  const offers = await UserOfferModel.find({
    purchaseMode: "installments",
    status: { $in: ["active", "pending_payment", "reserved"] },
  })
    .select("userId offerId installmentSchedule installmentCount installmentsPaid status")
    .lean();

  let paidMils = 0;
  let upcomingMils = 0;
  let lateMils = 0;
  const tracker: any[] = [];

  const offerIds = offers.map((o: any) => o.offerId).filter(Boolean);
  const userIds = offers.map((o: any) => o.userId).filter(Boolean);
  
  const [offerDocs, userDocs] = await Promise.all([
    OfferModel.find({ _id: { $in: offerIds } }).select("name").lean(),
    UserModel.find({ _id: { $in: userIds } }).select("fullName phone").lean(),
  ]);
  const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), o.name]));
  const userMap = new Map(userDocs.map((u: any) => [u._id.toString(), { fullName: u.fullName as string, phone: u.phone as string }]));

  for (const uo of offers as any[]) {
    const offerName = offerMap.get(uo.offerId?.toString()) ?? "—";
    for (const inst of uo.installmentSchedule ?? []) {
      const due = inst.dueDate ? new Date(inst.dueDate) : null;
      const paidAt = inst.paidAt ? new Date(inst.paidAt) : null;
      // Filter by date range — paid entries by paidAt, unpaid by dueDate
      const filterDate = inst.paid ? paidAt : due;
      if ((fromDate || toDate) && !inRange(filterDate)) continue;
      const amt = parseKwd(inst.amountKwd);
      if (inst.paid) {
        paidMils += amt;
        continue;
      }
      const isLate = due && due.getTime() < now.getTime();
      if (isLate) lateMils += amt;
      else upcomingMils += amt;
      tracker.push({
        userOfferId: uo._id.toString(),
        userId: uo.userId,
        customerName: userMap.get(uo.userId)?.fullName,
        customerPhone: userMap.get(uo.userId)?.phone,
        offerName,
        installmentNumber: inst.number,
        amountKwd: inst.amountKwd,
        dueDate: inst.dueDate,
        status: isLate ? "late" : "upcoming",
      });
    }
  }

  // Sort: late first (oldest due date first), then upcoming (soonest first)
  tracker.sort((a, b) => {
    if (a.status !== b.status) return a.status === "late" ? -1 : 1;
    return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
  });

  return {
    summary: {
      paidKwd: fmtKwd(paidMils),
      upcomingKwd: fmtKwd(upcomingMils),
      lateKwd: fmtKwd(lateMils),
      forecastKwd: fmtKwd(paidMils + upcomingMils + lateMils),
      lateCount: tracker.filter((t) => t.status === "late").length,
      upcomingCount: tracker.filter((t) => t.status === "upcoming").length,
    },
    items: tracker.slice(0, Math.min(500, filters.limit ?? 200)),
    truncated: tracker.length > Math.min(500, filters.limit ?? 200),
    totalMatching: tracker.length,
  };
}

export async function computeFinanceSnapshot(filters: { from?: string; to?: string } = {}) {
  const dateFilter = buildDateFilter(filters.from, filters.to);
  let revenueKwd: string;
  let revenueMils: number;
  let cashbackAppliedMils = 0;

  // Revenue = gross (sticker), profit = net (amountKwd — already excludes cashback)
  let netMils = 0;
  let grossMils = 0;
  const rowsQ: Record<string, unknown> = { status: "completed" };
  if (dateFilter) rowsQ.createdAt = dateFilter;
  const rows = await PaymentModel.find(rowsQ).select("amountKwd grossAmountKwd cashbackAppliedKwd").lean();
  for (const r of rows as any[]) {
    const net = parseKwd(r.amountKwd);
    const cb = parseKwd(r.cashbackAppliedKwd || "0.000");
    const gross = r.grossAmountKwd ? parseKwd(r.grossAmountKwd) : net + cb;
    netMils += net;
    grossMils += gross;
    cashbackAppliedMils += cb;
  }
  revenueMils = grossMils;
  revenueKwd = fmtKwd(grossMils);

  const pending = await userOfferService.listPendingPaymentsQueue();
  let pendingMils = 0;
  for (const uo of pending) {
    const offer = await offerService.getOffer(uo.offerId);
    if (offer) pendingMils += parseKwd(offer.subscriptionPriceKwd);
  }

  const paymentUserIds = await PaymentModel.distinct<string>("userId");
  const walletUserIds = new Set<string>([...paymentUserIds, ...pending.map((p) => p.userId), "cust1"]);

  let locked = 0;
  let unlocked = 0;
  let utilized = 0;
  let credited = 0;
  for (const uid of walletUserIds) {
    const w = await kycStore.getWallet(uid);
    if (!w) continue;
    locked += parseKwd(w.lockedKwd);
    unlocked += parseKwd(w.unlockedKwd);
    const txns = await kycStore.listWalletTxns(uid);
    for (const t of txns) {
      if (t.type === "deduction") utilized += parseKwd(t.amountKwd);
      if (t.type === "signup_bonus" || t.type === "unlock" || t.type === "adjustment" || t.type === "reversal") credited += parseKwd(t.amountKwd);
    }
  }

  const liability = locked + unlocked - utilized;

  const clinics = await clinicService.listClinics({ activeOnly: true });
  const offersRes = await offerService.listOffersPublic({});

  // Sessions (this month) — count completed payments with purpose=session_payment
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const [sessionsToday, sessionsThisMonth] = await Promise.all([
    PaymentModel.countDocuments({ purpose: "session_payment", status: "completed", createdAt: { $gte: todayStart } }),
    PaymentModel.countDocuments({ purpose: "session_payment", status: "completed", createdAt: { $gte: monthStart } }),
  ]);

  return {
    revenueKwd,
    netCollectedKwd: fmtKwd(netMils),
    profitKwd: fmtKwd(netMils),
    cashbackAppliedKwd: fmtKwd(cashbackAppliedMils),
    pendingKwd: fmtKwd(pendingMils),
    cashback: {
      lockedKwd: fmtKwd(locked),
      unlockedKwd: fmtKwd(unlocked),
      utilizedKwd: fmtKwd(utilized),
      creditedKwd: fmtKwd(credited),
      netLiabilityKwd: fmtKwd(liability)
    },
    counts: {
      pendingPayments: pending.length,
      activeClinics: clinics.length,
      activeOffers: offersRes.items.length
    },
    totalRevenue: revenueKwd,
    totalCashbackLocked: fmtKwd(locked),
    totalCashbackUnlocked: fmtKwd(unlocked),
    totalCashbackUtilized: fmtKwd(utilized),
    pendingPaymentsCount: pending.length,
    pendingPaymentsKwd: fmtKwd(pendingMils),
    sessionsToday,
    sessionsThisMonth,
  };
}

// CSV export — generates CSV string for a chosen report
export async function exportFinanceCsv(kind: "payments" | "offers" | "users" | "referrals" | "installments", filters: { from?: string; to?: string }) {
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const toCsv = (headers: string[], rows: any[][]) =>
    [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");

  if (kind === "payments") {
    const data = await computePaymentsBreakdown({ from: filters.from, to: filters.to, limit: 500 });
    return toCsv(
      ["Date", "User", "Offer", "Clinic", "Method", "Purpose", "Amount KWD", "Cashback Applied", "Status"],
      data.items.map((p: any) => [
        new Date(p.createdAt).toISOString(),
        p.userId,
        p.offerName ?? "",
        p.clinicNameEn ?? "",
        p.method,
        p.purpose ?? "",
        p.amountKwd,
        p.cashbackAppliedKwd ?? "0.000",
        p.status,
      ]),
    );
  }
  if (kind === "offers") {
    const data = await computeRevenueByOffer({ from: filters.from, to: filters.to, limit: 200 });
    return toCsv(
      ["Offer", "Membership Type", "Sales", "Revenue KWD", "Cashback KWD", "Profit KWD"],
      data.items.map((o) => [o.offerName, o.membershipType, o.salesCount, o.revenueKwd, o.cashbackKwd, o.profitKwd]),
    );
  }
  if (kind === "users") {
    const data = await computeRevenueByUser({ from: filters.from, to: filters.to, limit: 500 });
    return toCsv(
      ["User", "Display Name", "Email", "Phone", "Purchases", "LTV KWD", "Cashback Used KWD", "Pending"],
      data.items.map((u) => [u.userId, u.displayName, u.email ?? "", u.phone ?? "", u.purchasesCount, u.ltvKwd, u.cashbackUsedKwd, u.pendingPayments]),
    );
  }
  if (kind === "referrals") {
    const data = await computeRevenueByReferral({ from: filters.from, to: filters.to, limit: 200 });
    return toCsv(
      ["Referrer", "Referral Code", "Role", "Sales", "Revenue KWD"],
      data.items.map((r) => [r.displayName, r.referralCode, r.role, r.salesCount, r.revenueKwd]),
    );
  }
  if (kind === "installments") {
    const data = await computeInstallmentsAnalytics({ from: filters.from, to: filters.to });
    return toCsv(
      ["User", "Offer", "Installment #", "Amount KWD", "Due Date", "Status"],
      data.items.map((i: any) => [i.userId, i.offerName, i.installmentNumber, i.amountKwd, i.dueDate ?? "", i.status]),
    );
  }
  return "";
}

type FinanceExportKind = "payments" | "offers" | "users" | "referrals" | "installments";

function clampColWidth(n: number) {
  return Math.max(10, Math.min(44, n));
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDB2777" } }; // brand pink
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });
}

function styleDataRow(row: ExcelJS.Row, isAlt: boolean) {
  row.height = 18;
  row.eachCell((cell: ExcelJS.Cell) => {
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
    if (isAlt) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } }; // light surface
    }
  });
}

function setAutoWidths(ws: ExcelJS.Worksheet, headerRowNumber: number, dataStartRow: number) {
  const headerRow = ws.getRow(headerRowNumber);
  const colCount = headerRow.cellCount;
  for (let c = 1; c <= colCount; c++) {
    const header = String(headerRow.getCell(c).value ?? "");
    let maxLen = header.length;
    const lastRow = ws.lastRow?.number ?? dataStartRow;
    for (let r = dataStartRow; r <= lastRow; r++) {
      const v = ws.getRow(r).getCell(c).value;
      const s = v === null || v === undefined ? "" : String((v as any).text ?? v);
      if (s.length > maxLen) maxLen = s.length;
      if (maxLen > 48) break;
    }
    ws.getColumn(c).width = clampColWidth(maxLen + 2);
  }
}

export async function exportFinanceXlsx(kind: FinanceExportKind, filters: { from?: string; to?: string }, opts?: { rtl?: boolean }) {
  const rtl = opts?.rtl ?? true;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Belamonda";
  wb.created = new Date();

  const ws = wb.addWorksheet("Finance", {
    views: [
      {
        rightToLeft: rtl,
        state: "frozen",
        xSplit: 0,
        ySplit: 4,
      },
    ],
  });

  // Title + meta block (rows 1-3)
  const title = `Finance Report — ${kind}`;
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { size: 16, bold: true, color: { argb: "FF0F172A" } };
  ws.getCell("A1").alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };

  const from = filters.from ? new Date(filters.from).toISOString().slice(0, 10) : "—";
  const to = filters.to ? new Date(filters.to).toISOString().slice(0, 10) : "—";
  ws.getCell("A2").value = `Range: ${from} → ${to}`;
  ws.getCell("A2").font = { size: 11, color: { argb: "FF334155" } };
  ws.getCell("A2").alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };

  ws.getCell("A3").value = `Generated: ${new Date().toISOString()}`;
  ws.getCell("A3").font = { size: 10, color: { argb: "FF64748B" } };
  ws.getCell("A3").alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };

  // Empty spacer row 4 (used by freeze panes)
  ws.getRow(4).height = 6;

  const headerRowNumber = 5;
  const dataStartRow = headerRowNumber + 1;

  const addTable = (headers: Array<{ key: string; header: string; numFmt?: string; alignment?: Partial<ExcelJS.Alignment> }>, rows: Array<Record<string, any>>) => {
    ws.columns = headers.map((h) => ({
      key: h.key,
      header: h.header,
      style: {
        numFmt: h.numFmt,
        alignment: (h.alignment ?? { vertical: "middle", horizontal: "left", wrapText: true }) as any,
      },
    }));

    const headerRow = ws.getRow(headerRowNumber);
    headerRow.values = headers.map((h) => h.header);
    styleHeaderRow(headerRow);

    rows.forEach((r, idx) => {
      const row = ws.getRow(dataStartRow + idx);
      row.values = headers.map((h) => r[h.key]);
      styleDataRow(row, idx % 2 === 1);
    });

    ws.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: headers.length },
    };

    // Merge title/meta across table width
    const lastCol = headers.length;
    ws.mergeCells(1, 1, 1, lastCol);
    ws.mergeCells(2, 1, 2, lastCol);
    ws.mergeCells(3, 1, 3, lastCol);

    setAutoWidths(ws, headerRowNumber, dataStartRow);
  };

  if (kind === "payments") {
    const data = await computePaymentsBreakdown({ from: filters.from, to: filters.to, limit: 500 });
    addTable(
      [
        { key: "date", header: "Date", alignment: { vertical: "middle", horizontal: "left" } },
        { key: "customerName", header: "Customer Name" },
        { key: "customerPhone", header: "Phone" },
        { key: "offerName", header: "Offer" },
        { key: "clinic", header: "Clinic" },
        { key: "method", header: "Method" },
        { key: "purpose", header: "Purpose" },
        { key: "amountKwd", header: "Amount (KWD)", numFmt: "0.000" },
        { key: "cashbackAppliedKwd", header: "Cashback (KWD)", numFmt: "0.000" },
        { key: "status", header: "Status" },
      ],
      data.items.map((p: any) => ({
        date: new Date(p.createdAt).toISOString(),
        customerName: p.customerName || p.userId,
        customerPhone: p.customerPhone || "",
        offerName: p.offerName ?? "",
        clinic: p.clinicNameEn ?? "",
        method: p.method,
        purpose: p.purpose ?? "",
        amountKwd: Number.parseFloat(p.amountKwd ?? "0"),
        cashbackAppliedKwd: Number.parseFloat(p.cashbackAppliedKwd ?? "0"),
        status: p.status,
      })),
    );
  } else if (kind === "offers") {
    const data = await computeRevenueByOffer({ from: filters.from, to: filters.to, limit: 200 });
    addTable(
      [
        { key: "offerName", header: "Offer" },
        { key: "membershipType", header: "Membership Type" },
        { key: "salesCount", header: "Sales" },
        { key: "revenueKwd", header: "Revenue (KWD)", numFmt: "0.000" },
        { key: "cashbackKwd", header: "Cashback (KWD)", numFmt: "0.000" },
        { key: "profitKwd", header: "Profit (KWD)", numFmt: "0.000" },
      ],
      data.items.map((o) => ({
        offerName: o.offerName,
        membershipType: o.membershipType,
        salesCount: o.salesCount,
        revenueKwd: Number.parseFloat(o.revenueKwd),
        cashbackKwd: Number.parseFloat(o.cashbackKwd),
        profitKwd: Number.parseFloat(o.profitKwd),
      })),
    );
  } else if (kind === "users") {
    const data = await computeRevenueByUser({ from: filters.from, to: filters.to, limit: 500 });
    addTable(
      [
        { key: "userId", header: "User" },
        { key: "displayName", header: "Name" },
        { key: "email", header: "Email" },
        { key: "phone", header: "Phone" },
        { key: "purchasesCount", header: "Purchases" },
        { key: "ltvKwd", header: "LTV (KWD)", numFmt: "0.000" },
        { key: "cashbackUsedKwd", header: "Cashback Used (KWD)", numFmt: "0.000" },
        { key: "pendingPayments", header: "Pending" },
      ],
      data.items.map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        email: u.email ?? "",
        phone: u.phone ?? "",
        purchasesCount: u.purchasesCount,
        ltvKwd: Number.parseFloat(u.ltvKwd),
        cashbackUsedKwd: Number.parseFloat(u.cashbackUsedKwd),
        pendingPayments: u.pendingPayments,
      })),
    );
  } else if (kind === "referrals") {
    const data = await computeRevenueByReferral({ from: filters.from, to: filters.to, limit: 200 });
    addTable(
      [
        { key: "displayName", header: "Referrer" },
        { key: "referralCode", header: "Referral Code" },
        { key: "role", header: "Role" },
        { key: "salesCount", header: "Sales" },
        { key: "revenueKwd", header: "Revenue (KWD)", numFmt: "0.000" },
      ],
      data.items.map((r) => ({
        displayName: r.displayName,
        referralCode: r.referralCode,
        role: r.role,
        salesCount: r.salesCount,
        revenueKwd: Number.parseFloat(r.revenueKwd),
      })),
    );
  } else {
    const data = await computeInstallmentsAnalytics({ from: filters.from, to: filters.to });
    addTable(
      [
        { key: "customerName", header: "Customer Name" },
        { key: "customerPhone", header: "Phone" },
        { key: "offerName", header: "Offer" },
        { key: "installmentNumber", header: "Installment #" },
        { key: "amountKwd", header: "Amount (KWD)", numFmt: "0.000" },
        { key: "dueDate", header: "Due Date" },
        { key: "status", header: "Status" },
      ],
      data.items.map((i: any) => ({
        customerName: i.customerName || i.userId,
        customerPhone: i.customerPhone || "",
        offerName: i.offerName,
        installmentNumber: i.installmentNumber,
        amountKwd: Number.parseFloat(i.amountKwd ?? "0"),
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : "",
        status: i.status,
      })),
    );
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}

// ===========================================================================
// CLINIC SUMMARIES — all clinics with session + revenue stats (Finance view)
// ===========================================================================

export async function computeClinicSummaries(filters: { from?: string; to?: string } = {}) {
  const dateFilter = buildDateFilter(filters.from, filters.to);

  const clinics = await ClinicModel.find({}).select("nameEn nameAr isActive").lean();

  // Sessions per clinic (BookingSessionModel, clinicId is ObjectId → convert to string)
  const sessionMatchStage: Record<string, unknown> = {};
  if (dateFilter) sessionMatchStage.createdAt = dateFilter;
  const sessionAgg = await BookingSessionModel.aggregate([
    ...(Object.keys(sessionMatchStage).length ? [{ $match: sessionMatchStage }] : []),
    {
      $group: {
        _id: { $toString: "$clinicId" },
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ["$status", "no_show"] }, 1, 0] } },
        scheduled: { $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] } },
      },
    },
  ]);
  const sessionMap = new Map<string, { total: number; completed: number; noShow: number; scheduled: number }>();
  for (const s of sessionAgg) sessionMap.set(s._id, { total: s.total, completed: s.completed, noShow: s.noShow, scheduled: s.scheduled });

  // Revenue per clinic from payments breakdown
  const breakdown = await computePaymentsBreakdown({ from: filters.from, to: filters.to, limit: 500 });
  const revenueMap = new Map<string, { count: number; mils: number }>();
  for (const c of breakdown.byClinics) revenueMap.set(c.clinicId, { count: c.count, mils: parseKwd(c.totalKwd) });

  // Active memberships per clinic (clinicId may be ObjectId or String)
  const membershipAgg = await UserOfferModel.aggregate([
    { $match: { status: "active" } },
    { $group: { _id: { $toString: "$clinicId" }, count: { $sum: 1 } } },
  ]).catch(() => []);
  const membershipMap = new Map<string, number>();
  for (const m of membershipAgg) membershipMap.set(m._id, m.count);

  // Invoices (booking requests) per clinic
  const brMatchStage: Record<string, unknown> = {};
  if (dateFilter) brMatchStage.createdAt = dateFilter;
  const invoiceAgg = await BookingRequestModel.aggregate([
    ...(Object.keys(brMatchStage).length ? [{ $match: brMatchStage }] : []),
    {
      $group: {
        _id: "$clinicId",
        totalInvoices: { $sum: 1 },
        paidInvoices: { $sum: { $cond: [{ $eq: ["$clinicPaymentStatus", "paid"] }, 1, 0] } },
      },
    },
  ]);
  const invoiceMap = new Map<string, { total: number; paid: number }>();
  for (const i of invoiceAgg) invoiceMap.set(i._id, { total: i.totalInvoices, paid: i.paidInvoices });

  const items = (clinics as any[]).map((c) => {
    const cid = c._id.toString();
    const sess = sessionMap.get(cid) ?? { total: 0, completed: 0, noShow: 0, scheduled: 0 };
    const rev = revenueMap.get(cid) ?? { count: 0, mils: 0 };
    const inv = invoiceMap.get(cid) ?? { total: 0, paid: 0 };
    return {
      clinicId: cid,
      clinicNameEn: c.nameEn ?? "",
      clinicNameAr: c.nameAr ?? "",
      isActive: c.isActive ?? true,
      totalSessions: sess.total,
      completedSessions: sess.completed,
      noShowSessions: sess.noShow,
      scheduledSessions: sess.scheduled,
      revenueKwd: fmtKwd(rev.mils),
      paymentsCount: rev.count,
      activeMemberships: membershipMap.get(cid) ?? 0,
      totalInvoices: inv.total,
      paidInvoices: inv.paid,
    };
  }).sort((a, b) => parseKwd(b.revenueKwd) - parseKwd(a.revenueKwd));

  return { items };
}

// ===========================================================================
// CLINIC DETAIL — sessions + invoices for a single clinic
// ===========================================================================

export async function computeClinicDetail(clinicId: string, filters: { from?: string; to?: string } = {}) {
  const dateFilter = buildDateFilter(filters.from, filters.to);

  const clinic = await ClinicModel.findById(clinicId).select("nameEn nameAr").lean().catch(() => null);

  // Sessions
  const sessionQ: Record<string, unknown> = {
    clinicId: mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : clinicId,
  };
  if (dateFilter) sessionQ.createdAt = dateFilter;
  const sessions = await BookingSessionModel.find(sessionQ).sort({ scheduledAt: -1 }).limit(300).lean();

  // Booking requests (invoices)
  const brQ: Record<string, unknown> = { clinicId };
  if (dateFilter) brQ.createdAt = dateFilter;
  const bookingReqs = await BookingRequestModel.find(brQ).sort({ createdAt: -1 }).limit(300).lean();

  // Enrich with user names
  const allUserIds = [
    ...new Set([
      ...(sessions as any[]).map((s) => s.userId),
      ...(bookingReqs as any[]).map((b) => b.userId),
    ]),
  ].filter(Boolean);
  const isOid = (s: string) => /^[a-f0-9]{24}$/i.test(s);
  const userDocs = await UserModel.find({
    $or: [
      { _id: { $in: allUserIds.filter(isOid) } },
      { username: { $in: allUserIds } },
    ],
  }).select("username displayName phone fullName").lean().catch(() => []);
  const userMap = new Map<string, any>();
  for (const u of userDocs as any[]) {
    userMap.set(u._id.toString(), u);
    if (u.username) userMap.set(u.username, u);
  }

  const resolveUser = (userId: string) => {
    const u = userMap.get(userId);
    return {
      customerName: u?.fullName ?? u?.displayName ?? u?.username ?? userId,
      customerPhone: u?.phone ?? null,
    };
  };

  // Revenue from session prices
  let sessionRevenueMils = 0;
  let paidRevenueMils = 0;
  let cashbackTotalMils = 0;
  for (const br of bookingReqs as any[]) {
    if (br.sessionPriceKwd) {
      sessionRevenueMils += parseKwd(br.sessionPriceKwd);
      if (br.clinicPaymentStatus === "paid") paidRevenueMils += parseKwd(br.sessionPriceKwd);
    }
    if (br.cashbackDeductedKwd) {
      cashbackTotalMils += parseKwd(br.cashbackDeductedKwd);
    }
  }

  const completed = (sessions as any[]).filter((s) => s.status === "completed").length;
  const noShow = (sessions as any[]).filter((s) => s.status === "no_show").length;
  const scheduled = (sessions as any[]).filter((s) => s.status === "scheduled").length;

  return {
    clinic: clinic ? { nameEn: (clinic as any).nameEn ?? "", nameAr: (clinic as any).nameAr ?? "" } : null,
    summary: {
      totalSessions: sessions.length,
      completedSessions: completed,
      noShowSessions: noShow,
      scheduledSessions: scheduled,
      totalInvoices: bookingReqs.length,
      paidInvoices: (bookingReqs as any[]).filter((b) => b.clinicPaymentStatus === "paid").length,
      pendingInvoices: (bookingReqs as any[]).filter((b) => b.clinicPaymentStatus !== "paid").length,
      sessionRevenueKwd: fmtKwd(sessionRevenueMils),
      paidRevenueKwd: fmtKwd(paidRevenueMils),
      pendingRevenueKwd: fmtKwd(sessionRevenueMils - paidRevenueMils),
      cashbackTotalKwd: fmtKwd(cashbackTotalMils),
      netRevenueKwd: fmtKwd(sessionRevenueMils - cashbackTotalMils),
    },
    sessions: (sessions as any[]).map((s) => ({
      id: s._id.toString(),
      userId: s.userId,
      ...resolveUser(s.userId),
      scheduledAt: s.scheduledAt,
      status: s.status,
      notes: s.notes ?? null,
      cashbackUnlockedKwd: s.cashbackUnlockedKwd ?? null,
    })),
    invoices: (bookingReqs as any[]).map((br) => ({
      id: br._id.toString(),
      userId: br.userId,
      ...resolveUser(br.userId),
      status: br.status,
      sessionPriceKwd: br.sessionPriceKwd ?? null,
      cashbackDeductedKwd: br.cashbackDeductedKwd ?? null,
      clinicPaymentStatus: br.clinicPaymentStatus ?? "pending",
      membershipType: br.membershipType ?? null,
      createdAt: br.createdAt,
      confirmedAt: br.confirmedAt ?? null,
    })),
  };
}

// ===========================================================================
// CLINIC REPORT EXPORT — CSV and XLSX per clinic
// ===========================================================================

export async function exportClinicReportCsv(clinicId: string, filters: { from?: string; to?: string }) {
  const data = await computeClinicDetail(clinicId, filters);
  const escape = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const toCsv = (headers: string[], rows: any[][]) =>
    [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");

  const sessionsCsv = toCsv(
    ["Date", "Customer", "Phone", "Status", "Cashback Unlocked (KWD)"],
    data.sessions.map((s) => [
      new Date(s.scheduledAt).toISOString().slice(0, 16).replace("T", " "),
      s.customerName,
      s.customerPhone ?? "",
      s.status,
      s.cashbackUnlockedKwd ?? "0.000",
    ])
  );

  const invoicesCsv = toCsv(
    ["Date", "Customer", "Phone", "Session Price (KWD)", "Cashback Applied (KWD)", "Clinic Payment", "Type", "Request Status"],
    data.invoices.map((i) => [
      new Date(i.createdAt).toISOString().slice(0, 10),
      i.customerName,
      i.customerPhone ?? "",
      i.sessionPriceKwd ?? "—",
      i.cashbackDeductedKwd ?? "0.000",
      i.clinicPaymentStatus,
      i.membershipType ?? "—",
      i.status,
    ])
  );

  const clinicName = data.clinic?.nameEn ?? clinicId;
  const s = data.summary;
  const summaryLines = [
    `Clinic Report: ${clinicName}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "SUMMARY",
    `Total Sessions,${s.totalSessions}`,
    `Completed Sessions,${s.completedSessions}`,
    `No-Show Sessions,${s.noShowSessions}`,
    `Scheduled Sessions,${s.scheduledSessions}`,
    `Total Invoices,${s.totalInvoices}`,
    `Paid Invoices,${s.paidInvoices}`,
    `Pending Invoices,${s.pendingInvoices}`,
    `Total Sales (Base KWD),${s.sessionRevenueKwd}`,
    `Cashback Utilized (KWD),${s.cashbackTotalKwd}`,
    `Net Revenue (KWD),${s.netRevenueKwd}`,
    `Paid Revenue (KWD),${s.paidRevenueKwd}`,
    `Pending Revenue (KWD),${s.pendingRevenueKwd}`,
  ].join("\n");

  return `${summaryLines}\n\nSESSIONS\n${sessionsCsv}\n\nINVOICES\n${invoicesCsv}`;
}

export async function exportClinicReportXlsx(clinicId: string, filters: { from?: string; to?: string }) {
  const data = await computeClinicDetail(clinicId, filters);
  const clinicName = data.clinic?.nameEn ?? clinicId;
  const s = data.summary;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Belamonda";
  wb.created = new Date();

  // — Summary sheet —
  const wsSum = wb.addWorksheet("Summary");
  wsSum.getCell("A1").value = `Clinic Report: ${clinicName}`;
  wsSum.getCell("A1").font = { size: 16, bold: true };
  wsSum.getCell("A2").value = `Generated: ${new Date().toISOString()}`;
  wsSum.getCell("A2").font = { size: 10, color: { argb: "FF64748B" } };
  const summaryRows = [
    ["Total Sessions", s.totalSessions],
    ["Completed", s.completedSessions],
    ["No-Show", s.noShowSessions],
    ["Scheduled", s.scheduledSessions],
    ["Total Invoices", s.totalInvoices],
    ["Paid Invoices", s.paidInvoices],
    ["Pending Invoices", s.pendingInvoices],
    ["Total Sales (Base KWD)", parseFloat(s.sessionRevenueKwd)],
    ["Cashback Utilized (KWD)", parseFloat(s.cashbackTotalKwd)],
    ["Net Revenue (KWD)", parseFloat(s.netRevenueKwd)],
    ["Paid Revenue (KWD)", parseFloat(s.paidRevenueKwd)],
    ["Pending Revenue (KWD)", parseFloat(s.pendingRevenueKwd)],
  ];
  summaryRows.forEach(([label, value], i) => {
    const row = wsSum.getRow(i + 4);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true };
    row.getCell(2).value = value;
    styleDataRow(row, i % 2 === 1);
  });
  wsSum.getColumn(1).width = 28;
  wsSum.getColumn(2).width = 18;

  // — Sessions sheet —
  const wsS = wb.addWorksheet("Sessions");
  const sessionHeaders = ["Date", "Customer", "Phone", "Status", "Cashback Unlocked (KWD)"];
  const sHeaderRow = wsS.getRow(1);
  sHeaderRow.values = sessionHeaders;
  styleHeaderRow(sHeaderRow);
  wsS.getColumn(1).width = 20;
  wsS.getColumn(2).width = 24;
  wsS.getColumn(3).width = 18;
  wsS.getColumn(4).width = 14;
  wsS.getColumn(5).width = 24;
  data.sessions.forEach((s, idx) => {
    const row = wsS.getRow(idx + 2);
    row.values = [
      new Date(s.scheduledAt).toISOString().slice(0, 16).replace("T", " "),
      s.customerName,
      s.customerPhone ?? "",
      s.status,
      s.cashbackUnlockedKwd ? parseFloat(s.cashbackUnlockedKwd) : 0,
    ];
    styleDataRow(row, idx % 2 === 1);
  });

  // — Invoices sheet —
  const wsI = wb.addWorksheet("Invoices");
  const invoiceHeaders = ["Date", "Customer", "Phone", "Session Price (KWD)", "Cashback Applied (KWD)", "Clinic Payment", "Type", "Status"];
  const iHeaderRow = wsI.getRow(1);
  iHeaderRow.values = invoiceHeaders;
  styleHeaderRow(iHeaderRow);
  wsI.getColumn(1).width = 14;
  wsI.getColumn(2).width = 24;
  wsI.getColumn(3).width = 18;
  wsI.getColumn(4).width = 20;
  wsI.getColumn(5).width = 24;
  wsI.getColumn(6).width = 16;
  wsI.getColumn(7).width = 16;
  wsI.getColumn(8).width = 18;
  data.invoices.forEach((inv, idx) => {
    const row = wsI.getRow(idx + 2);
    row.values = [
      new Date(inv.createdAt).toISOString().slice(0, 10),
      inv.customerName,
      inv.customerPhone ?? "",
      inv.sessionPriceKwd ? parseFloat(inv.sessionPriceKwd) : "",
      inv.cashbackDeductedKwd ? parseFloat(inv.cashbackDeductedKwd) : 0,
      inv.clinicPaymentStatus,
      inv.membershipType ?? "—",
      inv.status,
    ];
    styleDataRow(row, idx % 2 === 1);
  });

  const bufXlsx = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(bufXlsx) ? bufXlsx : Buffer.from(bufXlsx as ArrayBuffer);
}
