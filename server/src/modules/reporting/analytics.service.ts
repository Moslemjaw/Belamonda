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
import { WalletModel, WalletTxnModel } from "../../models/kyc.model.js";
import ExcelJS from "exceljs";
import { SystemMetricModel } from "../../models/metric.model.js";

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
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(0, 0, 0, 0);
      f.$gte = d;
    }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      f.$lte = d;
    }
  }
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
  const limit = filters.limit ?? 50000;

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
    brIds.length ? BookingRequestModel.find({ _id: { $in: brIds } }).select("clinicId membershipType extraItems isStandalone standaloneName").lean().catch(() => []) : Promise.resolve([]),
    userIds.length ? UserModel.find({ _id: { $in: userIds } }).select("fullName phone").lean() : Promise.resolve([]),
  ]);

  const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), { name: o.name as string, membershipType: o.membershipType as string }]));
  const breqMap = new Map(breqDocs.map((b: any) => [b._id.toString(), { 
    clinicId: b.clinicId as string, 
    membershipType: b.membershipType as string,
    extraItems: b.extraItems as any[],
    isStandalone: !!b.isStandalone,
    standaloneName: b.standaloneName as string,
  }]));
  const userMap = new Map(userDocs.map((u: any) => [u._id.toString(), { fullName: u.fullName as string, phone: u.phone as string }]));

  const clinicIds = [...new Set([
    ...[...breqMap.values()].map((b) => b.clinicId),
    ...payments.map((p) => p.clinicId?.toString())
  ].filter(Boolean))] as string[];
  const clinicDocs = await ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn nameAr").lean();
  const clinicMap = new Map(clinicDocs.map((c: any) => [c._id.toString(), { nameEn: c.nameEn as string, nameAr: c.nameAr as string }]));

  const enriched = payments.map((p: any) => {
    const offerId = p.offerId?.toString();
    const brId = p.bookingRequestId;
    const userId = p.userId?.toString();
    const directClinicId = p.clinicId?.toString();
    const breq = brId ? breqMap.get(brId) : undefined;
    const clinicId = directClinicId || breq?.clinicId;
    const clinic = clinicId ? clinicMap.get(clinicId) : undefined;
    const offer = offerId ? offerMap.get(offerId) : undefined;
    const user = userId ? userMap.get(userId) : undefined;
    
    let sessionType = "—";
    if (p.purpose === "session_payment" || p.purpose === "deposit") {
      sessionType = breq?.isStandalone ? (breq?.standaloneName || "Standalone") : "Membership Session";
    }

    const additionalTreatmentsArr = (breq?.extraItems || []).map((item: any) => `${item.name} (x${item.qty})`);

    return {
      ...serializePayment(p as any),
      offerName: offer?.name,
      clinicId,
      clinicNameEn: clinic?.nameEn,
      clinicNameAr: clinic?.nameAr,
      membershipType: breq?.membershipType ?? offer?.membershipType,
      customerName: user?.fullName,
      customerPhone: user?.phone,
      sessionType,
      additionalTreatments: additionalTreatmentsArr.join(", "),
      _treatmentsArr: additionalTreatmentsArr,
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

  const tableItems = enriched.flatMap((p: any) => {
    if (p._treatmentsArr && p._treatmentsArr.length > 1) {
      return p._treatmentsArr.map((t: string) => ({ ...p, additionalTreatments: t }));
    }
    if (p._treatmentsArr && p._treatmentsArr.length === 1) {
      return { ...p, additionalTreatments: p._treatmentsArr[0] };
    }
    return p;
  });

  return {
    items: tableItems,
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

  // ── Fast path: use pre-calculated daily SystemMetric documents ──────────────
  const dailyQuery: Record<string, unknown> = { _id: { $regex: /^daily_/ } };
  if (filters.from || filters.to) {
    const fromKey = filters.from ? `daily_${filters.from.split("T")[0]}` : "daily_0000-01-01";
    const toKey = filters.to ? `daily_${filters.to.split("T")[0]}` : "daily_9999-12-31";
    dailyQuery._id = { $gte: fromKey, $lte: toKey };
  }

  const dailyDocs = await SystemMetricModel.find(dailyQuery).lean();

  const buckets = new Map<string, { revenue: number; net: number; cashback: number; sessions: number; memberships: number; count: number }>();

  if (dailyDocs.length > 0) {
    // Use pre-calculated data (super fast — just summing stored numbers)
    for (const doc of dailyDocs as any[]) {
      // doc._id = "daily_YYYY-MM-DD"
      const dateStr = doc._id.replace("daily_", "");
      const k = bucketKey(new Date(dateStr + "T00:00:00Z"), period);
      const cur = buckets.get(k) ?? { revenue: 0, net: 0, cashback: 0, sessions: 0, memberships: 0, count: 0 };
      cur.revenue += (doc.totalGrossRevenueMils || 0);
      cur.net += (doc.totalRevenueMils || 0);
      cur.cashback += (doc.totalCashbackAppliedMils || 0);
      cur.memberships += (doc.totalGrossMembershipRevenueMils || 0);
      cur.sessions += (doc.totalGrossStandaloneSessionRevenueMils || 0);
      cur.count += (doc.totalMembershipsSold || 0) + (doc.totalStandaloneSessionsSold || 0);
      buckets.set(k, cur);
    }
  } else {
    // Fallback: live scan (before first reconciliation run)
    const payments = await PaymentModel.find(q).select("amountKwd grossAmountKwd cashbackAppliedKwd purpose createdAt").lean();
    for (const p of payments as any[]) {
      const k = bucketKey(new Date(p.createdAt), period);
      const cur = buckets.get(k) ?? { revenue: 0, net: 0, cashback: 0, sessions: 0, memberships: 0, count: 0 };
      const net = parseKwd(p.amountKwd);
      const cb = parseKwd(p.cashbackAppliedKwd || "0.000");
      const gross = p.grossAmountKwd ? parseKwd(p.grossAmountKwd) : net + cb;
      cur.revenue += gross; cur.net += net; cur.cashback += cb;
      if ((p.purpose || "enrollment_full") === "session_payment") cur.sessions += gross;
      else cur.memberships += gross;
      cur.count++;
      buckets.set(k, cur);
    }
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

  const map = new Map<string, { revenue: number; net: number; cashback: number; count: number; actualSales: number; expected: number; needsOfferPriceCount: number }>();
  for (const p of payments as any[]) {
    const k = p.offerId?.toString();
    if (!k) continue;
    const cur = map.get(k) ?? { revenue: 0, net: 0, cashback: 0, count: 0, actualSales: 0, expected: 0, needsOfferPriceCount: 0 };
    const net = parseKwd(p.amountKwd);
    const cb = parseKwd(p.cashbackAppliedKwd || "0.000");
    const gross = p.grossAmountKwd ? parseKwd(p.grossAmountKwd) : net + cb;
    cur.revenue += gross;
    cur.net += net;
    cur.cashback += cb;
    cur.count++;
    map.set(k, cur);
  }

  const uoQuery: Record<string, unknown> = { status: { $in: ["active", "pending_payment", "reserved"] } };
  if (dateFilter) uoQuery.createdAt = dateFilter;
  const userOffers = await UserOfferModel.find(uoQuery).select("offerId purchaseMode paymentAmountKwd installmentSchedule").lean();

  for (const uo of userOffers as any[]) {
    const k = uo.offerId?.toString();
    if (!k) continue;
    const cur = map.get(k) ?? { revenue: 0, net: 0, cashback: 0, count: 0, actualSales: 0, expected: 0, needsOfferPriceCount: 0 };
    cur.actualSales = (cur.actualSales || 0) + 1;
    
    let expected = 0;
    if (uo.purchaseMode === "free") expected = 0;
    else if (uo.purchaseMode === "installments") {
      expected = (uo.installmentSchedule || []).reduce((sum: number, inst: any) => sum + parseKwd(inst.amountKwd || "0"), 0);
    } else {
      expected = parseKwd(uo.paymentAmountKwd || "0"); // we will fallback to offer price later if this is 0
      if (expected === 0 && uo.purchaseMode !== "discount") {
        // flag it so we can add the offer price later
        cur.needsOfferPriceCount = (cur.needsOfferPriceCount || 0) + 1;
      }
    }
    cur.expected = (cur.expected || 0) + expected;
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
        salesCount: v.actualSales || 0,
        paymentsCount: v.count,
        expectedKwd: fmtKwd((v.expected || 0) + (v.needsOfferPriceCount || 0) * parseKwd(o?.subscriptionPriceKwd || "0")),
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

// Detailed Customers Report (for export)
export async function computeDetailedCustomersReport(filters: { from?: string; to?: string; limit?: number } = {}) {
  const q: Record<string, unknown> = {};
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;
  const userOffers = await UserOfferModel.find(q).lean();

  const userIds = [...new Set(userOffers.map((u: any) => u.userId))].filter(Boolean);
  const userDocs = await UserModel.find({
    $or: [
      { _id: { $in: userIds.filter(i => /^[a-f0-9]{24}$/i.test(i)) } },
      { username: { $in: userIds } },
    ],
  }).select("username displayName fullName phone referredBy").lean().catch(() => []);

  // Fetch all actual completed payments to calculate true Paid Amount
  const uoIds = userOffers.map((u: any) => u._id).filter(Boolean);
  const uoPayments = await PaymentModel.find({ userOfferId: { $in: uoIds }, status: "completed" }).select("userOfferId amountKwd").lean().catch(() => []);
  const uoPaidMap = new Map<string, number>();
  for (const p of uoPayments as any[]) {
    const id = p.userOfferId?.toString();
    if (id) {
      uoPaidMap.set(id, (uoPaidMap.get(id) || 0) + parseKwd(p.amountKwd));
    }
  }
  
  const userMap = new Map<string, any>();
  const referrerIds = new Set<string>();
  for (const u of userDocs as any[]) {
    userMap.set(u._id.toString(), u);
    if (u.username) userMap.set(u.username, u);
    if (u.referredBy) referrerIds.add(u.referredBy.toString());
  }

  const referrerDocs = await UserModel.find({ _id: { $in: [...referrerIds] } }).select("username displayName referralCode").lean().catch(() => []);
  const referrerMap = new Map<string, any>();
  for (const r of referrerDocs as any[]) {
    referrerMap.set(r._id.toString(), r);
  }

  const offerIds = [...new Set(userOffers.map((u: any) => u.offerId))].filter(Boolean);
  const offerDocs = await OfferModel.find({ _id: { $in: offerIds } }).select("name subscriptionPriceKwd").lean().catch(() => []);
  const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), o]));

  const clinicIds = [...new Set(userOffers.map((u: any) => u.clinicId))].filter(Boolean);
  const clinicDocs = await ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn").lean().catch(() => []);
  const clinicMap = new Map(clinicDocs.map((c: any) => [c._id.toString(), c]));

  const items = userOffers.map((uo: any) => {
    const user = userMap.get(uo.userId) || {};
    const refId = user.referredBy?.toString();
    const referrer = refId ? referrerMap.get(refId) : null;
    const offer = offerMap.get(uo.offerId?.toString());
    const clinic = clinicMap.get(uo.clinicId?.toString());
    
    let depositAmt = "0.000";
    let inst2Amt = "0.000";
    let inst3Amt = "0.000";
    let firstDate = "";
    let secDate = "";
    let thirdDate = "";
    
    // True paid amount from actual payment records
    const paidMils = uoPaidMap.get(uo._id.toString()) || 0;
    
    // Calculate total expected amount
    let totalMils = 0;
    if (uo.purchaseMode === "installments") {
      const sched = uo.installmentSchedule || [];
      for (const inst of sched) {
        totalMils += parseKwd(inst.amountKwd || "0");
      }
    } else {
      totalMils = parseKwd(uo.paymentAmountKwd || offer?.subscriptionPriceKwd || "0");
    }

    if (uo.purchaseMode === "installments") {
      const sched = uo.installmentSchedule || [];
      if (sched[0]) {
         depositAmt = sched[0].amountKwd;
         if (sched[0].paid) firstDate = sched[0].paidAt ? new Date(sched[0].paidAt).toISOString().slice(0,10) : "";
      }
      if (sched[1]) {
         inst2Amt = sched[1].amountKwd;
         if (sched[1].paid) secDate = sched[1].paidAt ? new Date(sched[1].paidAt).toISOString().slice(0,10) : "";
      }
      if (sched[2]) {
         inst3Amt = sched[2].amountKwd;
         if (sched[2].paid) thirdDate = sched[2].paidAt ? new Date(sched[2].paidAt).toISOString().slice(0,10) : "";
      }
    } else {
      firstDate = uo.paymentConfirmedAt ? new Date(uo.paymentConfirmedAt).toISOString().slice(0, 10) : "";
      if (uo.purchaseMode === "deposit") {
         depositAmt = uo.depositAmountKwd || "0.000";
         firstDate = uo.depositPaidAt ? new Date(uo.depositPaidAt).toISOString().slice(0, 10) : firstDate;
      }
    }

    const refString = referrer ? `${referrer.displayName || referrer.username} (${referrer.referralCode || ''})` : "";
    const balanceMils = Math.max(0, totalMils - paidMils);

    return {
      customerId: uo.userId || "",
      customerName: user.fullName || user.displayName || user.username || "",
      customerPhone: user.phone || "",
      service: offer?.name || "",
      clinicName: clinic?.nameEn || "",
      expiryDate: uo.expiresAt ? new Date(uo.expiresAt).toISOString().slice(0,10) : "",
      reference: refString,
      totalPaymentKwd: fmtKwd(totalMils),
      paidAmountKwd: fmtKwd(paidMils),
      balanceKwd: fmtKwd(balanceMils),
      paymentType: uo.purchaseMode || "full",
      depositAmount: depositAmt,
      installment2Amount: inst2Amt,
      installment3Amount: inst3Amt,
      firstPaymentDate: firstDate,
      secondPaymentDate: secDate,
      thirdPaymentDate: thirdDate,
      notes: uo.enetReason || "",
      packageDate: uo.createdAt ? new Date(uo.createdAt).toISOString().slice(0,10) : "",
    };
  });
  
  return { items };
}

// Revenue grouped by referrer (the staff who referred the buyer) - ONLY first transaction counts
export async function computeRevenueByReferral(filters: { from?: string; to?: string; limit?: number } = {}) {
  const q: Record<string, unknown> = { status: "completed" };
  const dateFilter = buildDateFilter(filters.from, filters.to);
  if (dateFilter) q.createdAt = dateFilter;
  
  // Find all completed payments in this period
  const paymentsInPeriod = await PaymentModel.find(q).select("_id userId amountKwd createdAt").lean();

  // Get unique userIds who made a payment in this period
  const buyerIds = [...new Set(paymentsInPeriod.map((p: any) => p.userId))].filter(Boolean);
  if (buyerIds.length === 0) return { items: [] };

  // For these buyers, find their FIRST payment EVER
  const firstPaymentsEver = await PaymentModel.aggregate([
    { $match: { status: "completed", userId: { $in: buyerIds } } },
    { $sort: { createdAt: 1 } },
    { $group: {
        _id: "$userId",
        paymentId: { $first: "$_id" }
    }}
  ]);

  const firstPaymentIds = new Set(firstPaymentsEver.map((p: any) => p.paymentId.toString()));

  // Filter payments: only keep if it is the absolute first payment for that user
  const validPayments = paymentsInPeriod.filter((p: any) => firstPaymentIds.has(p._id.toString()));

  // Map buyer userId → referredBy
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
  for (const p of validPayments as any[]) {
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

  // First pass: calculate total unpaid per userOfferId
  const unpaidMap = new Map<string, number>();
  for (const uo of offers as any[]) {
    const id = uo._id.toString();
    let unpaidMils = 0;
    for (const inst of uo.installmentSchedule ?? []) {
      if (!inst.paid) unpaidMils += parseKwd(inst.amountKwd);
    }
    unpaidMap.set(id, unpaidMils);
  }

  for (const uo of offers as any[]) {
    const offerName = offerMap.get(uo.offerId?.toString()) ?? "—";
    const amountLeftKwd = fmtKwd(unpaidMap.get(uo._id.toString()) ?? 0);
    for (const inst of uo.installmentSchedule ?? []) {
      const due = inst.dueDate ? new Date(inst.dueDate) : null;
      const paidAt = inst.paidAt ? new Date(inst.paidAt) : null;
      // Filter by date range — paid entries by paidAt, unpaid by dueDate
      const filterDate = inst.paid ? paidAt : due;
      if ((fromDate || toDate) && !inRange(filterDate)) continue;
      const amt = parseKwd(inst.amountKwd);
      if (inst.paid) {
        paidMils += amt;
      } else {
        const isLate = due && due.getTime() < now.getTime();
        if (isLate) lateMils += amt;
        else upcomingMils += amt;
      }
      tracker.push({
        userOfferId: uo._id.toString(),
        userId: uo.userId,
        customerName: userMap.get(uo.userId)?.fullName,
        customerPhone: userMap.get(uo.userId)?.phone,
        offerName,
        installmentNumber: inst.number,
        amountKwd: inst.amountKwd,
        amountLeftKwd,
        dueDate: inst.dueDate,
        paidAt: inst.paidAt,
        method: inst.method || undefined,
        status: inst.paid ? "paid" : (due && due.getTime() < now.getTime() ? "late" : "upcoming"),
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

// ── Finance snapshot cache (60s TTL) ──
let _snapshotCache: { data: any; ts: number; key: string } | null = null;
const SNAPSHOT_TTL = 60_000;
const _snapshotPromises: Map<string, Promise<any>> = new Map();

export async function computeFinanceSnapshot(filters: { from?: string; to?: string } = {}) {
  const cacheKey = `${filters.from || ""}_${filters.to || ""}`;
  if (_snapshotCache && _snapshotCache.key === cacheKey && Date.now() - _snapshotCache.ts < SNAPSHOT_TTL) {
    return _snapshotCache.data;
  }
  
  const inflight = _snapshotPromises.get(cacheKey);
  if (inflight) return inflight;

  const promise = _computeFinanceSnapshotImpl(filters).then(result => {
    _snapshotCache = { data: result, ts: Date.now(), key: cacheKey };
    _snapshotPromises.delete(cacheKey);
    return result;
  }).catch(err => {
    _snapshotPromises.delete(cacheKey);
    throw err;
  });

  _snapshotPromises.set(cacheKey, promise);
  return promise;
}

async function _computeFinanceSnapshotImpl(filters: { from?: string; to?: string } = {}) {
  const dateFilter = buildDateFilter(filters.from, filters.to);
  let revenueKwd: string;
  let revenueMils: number;
  let cashbackAppliedMils = 0;
  
  let globalMetric: any = null;
  if (!dateFilter) {
    globalMetric = await SystemMetricModel.findById("global").lean();
  }

  // Revenue = gross (sticker), profit = net (amountKwd — already excludes cashback)
  let netMils = 0;
  let grossMils = 0;
  const rowsQ: Record<string, unknown> = { status: "completed" };
  if (dateFilter) rowsQ.createdAt = dateFilter;

  if (!dateFilter) {
    // ── Fast path: use the pre-calculated global metric document ─────────────
    if (globalMetric) {
      netMils = globalMetric.totalRevenueMils || 0;
      grossMils = globalMetric.totalGrossRevenueMils || 0;
      cashbackAppliedMils = globalMetric.totalCashbackAppliedMils || 0;
    } else {
      // Fallback if reconciliation hasn't run yet
      const rows = await PaymentModel.find(rowsQ).select("amountKwd grossAmountKwd cashbackAppliedKwd").lean();
      for (const r of rows as any[]) {
        const net = parseKwd(r.amountKwd);
        const cb = parseKwd((r as any).cashbackAppliedKwd || "0.000");
        const gross = (r as any).grossAmountKwd ? parseKwd((r as any).grossAmountKwd) : net + cb;
        netMils += net; grossMils += gross; cashbackAppliedMils += cb;
      }
    }
  } else {
    // Date-filtered: live scan (can't use global metric)
    const rows = await PaymentModel.find(rowsQ).select("amountKwd grossAmountKwd cashbackAppliedKwd").lean();
    for (const r of rows as any[]) {
      const net = parseKwd(r.amountKwd);
      const cb = parseKwd((r as any).cashbackAppliedKwd || "0.000");
      const gross = (r as any).grossAmountKwd ? parseKwd((r as any).grossAmountKwd) : net + cb;
      netMils += net; grossMils += gross; cashbackAppliedMils += cb;
    }
  }

  revenueMils = grossMils;
  revenueKwd = fmtKwd(grossMils);

  const pending = await userOfferService.listPendingPaymentsQueue();
  let pendingMils = 0;
  if (!dateFilter && globalMetric) {
    // pending doesn't have a precalculated field yet, but we can do a quick aggregate if we want.
    // listPendingPaymentsQueue is fast anyway (find on small dataset).
  }
  const pendingOfferIds = [...new Set(pending.map(uo => uo.offerId).filter(Boolean))];
  const pendingOffers = await OfferModel.find({ _id: { $in: pendingOfferIds } }).lean<{ _id: mongoose.Types.ObjectId; subscriptionPriceKwd: string }[]>();
  const offerMap = Object.fromEntries(pendingOffers.map(o => [String(o._id), o]));
  for (const uo of pending) {
    const offer = offerMap[String(uo.offerId)];
    if (offer) pendingMils += parseKwd(offer.subscriptionPriceKwd || "0.000");
  }

  let locked = 0;
  let unlocked = 0;
  let utilized = 0;
  let credited = 0;
  
  if (!dateFilter) {
    // ── Fast path: use MongoDB Aggregation for system-wide wallets ──────────────
    const [walletAgg, txnAgg] = await Promise.all([
      WalletModel.aggregate([
        { $group: { _id: null, locked: { $sum: { $toDouble: "$lockedKwd" } }, unlocked: { $sum: { $toDouble: "$unlockedKwd" } } } }
      ]),
      WalletTxnModel.aggregate([
        { $group: { _id: "$type", total: { $sum: { $toDouble: "$amountKwd" } } } }
      ])
    ]);
    
    if (walletAgg.length > 0) {
      locked = Math.round(walletAgg[0].locked * 1000);
      unlocked = Math.round(walletAgg[0].unlocked * 1000);
    }
    for (const t of txnAgg) {
      const mils = Math.round(t.total * 1000);
      if (t._id === "deduction") utilized += mils;
      if (["signup_bonus", "unlock", "adjustment", "reversal"].includes(t._id)) credited += mils;
    }
  } else {
    // Date-filtered fallback (less common)
    const paymentUserIds = await PaymentModel.distinct<string>("userId");
    const walletUserIds = new Set<string>([...paymentUserIds, ...pending.map((p) => p.userId), "cust1"]);
    const userIdsArr = Array.from(walletUserIds);
    const wallets = await WalletModel.find({ userId: { $in: userIdsArr } }).lean();
    for (const w of wallets as any[]) {
      locked += parseKwd(w.lockedKwd || "0.000");
      unlocked += parseKwd(w.unlockedKwd || "0.000");
    }
    const txns = await WalletTxnModel.find({ userId: { $in: userIdsArr } }).select("type amountKwd").lean();
    for (const t of txns as any[]) {
      if (t.type === "deduction") utilized += parseKwd(t.amountKwd || "0.000");
      if (t.type === "signup_bonus" || t.type === "unlock" || t.type === "adjustment" || t.type === "reversal") credited += parseKwd(t.amountKwd || "0.000");
    }
  }

  const liability = locked + unlocked - utilized;

  const clinics = await clinicService.listClinics({ activeOnly: true });
  const offersRes = await offerService.listOffersPublic({});

  // Sessions (this month) — count completed payments with purpose=session_payment
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const [sessionsToday, sessionsThisMonth] = await Promise.all([
    BookingSessionModel.countDocuments({ status: "completed", scheduledAt: { $gte: todayStart } }),
    BookingSessionModel.countDocuments({ status: "completed", scheduledAt: { $gte: monthStart } }),
  ]);

  let expectedTotalMils = 0;
  let paidTowardMembershipsMils = 0;

  if (!dateFilter && globalMetric) {
    expectedTotalMils = globalMetric.totalExpectedMembershipRevenueMils || 0;
    paidTowardMembershipsMils = globalMetric.totalPaidTowardMembershipsMils || 0;
  } else {
    const uoQ: any = { status: { $nin: ["pending_payment", "enet_pending", "enet_rejected", "rejected"] } };
    if (dateFilter) uoQ.createdAt = dateFilter;

    // Fetch all user offers (excluding pending/rejected) to calculate Expected amounts exactly like the comprehensive report
    const allUserOffers = await UserOfferModel.find(uoQ).select("offerId installmentSchedule purchaseMode paymentAmountKwd depositAmountKwd status").lean();

    const allOfferIds = [...new Set(allUserOffers.map((uo: any) => uo.offerId?.toString()).filter(Boolean))];
    const allOfferDocs = await OfferModel.find({ _id: { $in: allOfferIds } }).select("subscriptionPriceKwd").lean();
    const offerPriceMap = new Map(allOfferDocs.map((o: any) => [o._id.toString(), o.subscriptionPriceKwd]));

    for (const uo of allUserOffers as any[]) {
      // Calculate total price expected (Report logic: offerPrice first, then paymentAmount)
      const totalPriceKwd = offerPriceMap.get(uo.offerId?.toString()) || uo.paymentAmountKwd || "0.000";
      const uoTotal = parseKwd(totalPriceKwd);
      
      // Calculate paid amount exactly like the report
      let paidMils = 0;
      if (uo.purchaseMode === "installments") {
        const sched = uo.installmentSchedule || [];
        paidMils += parseKwd(uo.depositAmountKwd || "0");
        sched.forEach((s: any) => {
          if (s.paid) paidMils += parseKwd(s.amountKwd || "0");
        });
      } else if (uo.purchaseMode === "deposit") {
        paidMils = parseKwd(uo.paymentAmountKwd || uo.depositAmountKwd || "0");
      } else {
        if (uo.status === "active" || uo.status === "expired" || uo.status === "reserved" || uo.status === "cancelled") {
           paidMils = uoTotal;
        }
      }
      
      expectedTotalMils += uoTotal;
      paidTowardMembershipsMils += paidMils;
    }
  }

  // Unpaid = Expected - Paid
  const unpaidInstallmentsMils = Math.max(0, expectedTotalMils - paidTowardMembershipsMils);

  console.log("[FinanceSnapshot] expectedTotalMils:", expectedTotalMils, "paidTowardMembershipsMils:", paidTowardMembershipsMils, "unpaidInstallmentsMils:", unpaidInstallmentsMils);

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
    expectedTotalRevenueKwd: fmtKwd(expectedTotalMils),
    unpaidInstallmentsKwd: fmtKwd(unpaidInstallmentsMils),
    paidTowardMembershipsKwd: fmtKwd(paidTowardMembershipsMils),
  };
}

export async function computeDormantCustomersReport(filters: { from?: string; to?: string } = {}) {
  // Dormant customers: users who haven't had a completed session or payment in the last 90 days.
  // For simplicity if date range is given, use that as the "activity" window (if they have NO activity in this window).
  // We'll return users who have 0 payments and 0 sessions in the target date range.
  const dateFilter = buildDateFilter(filters.from, filters.to);
  const activeQ: Record<string, unknown> = {};
  if (dateFilter) activeQ.createdAt = dateFilter;

  const [recentPayments, recentSessions] = await Promise.all([
    PaymentModel.distinct("userId", { ...activeQ, status: "completed" }),
    BookingSessionModel.distinct("userId", { ...activeQ, status: "completed" }),
  ]);
  const activeUserIds = new Set([...recentPayments, ...recentSessions].map(id => id.toString()));

  const allUsers = await UserModel.find({ isActive: true, role: "customer" }).select("username fullName phone email createdAt").lean();
  const dormant = allUsers.filter((u: any) => !activeUserIds.has(u._id.toString()));

  return {
    items: dormant.map((u: any) => ({
      userId: u._id.toString(),
      customerName: u.fullName || u.username,
      phone: u.phone || "—",
      email: u.email || "—",
      joinedAt: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "—",
    })).sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime())
  };
}

export async function computeSystemHealthReport(filters: { from?: string; to?: string } = {}) {
  const snapshot = await computeFinanceSnapshot(filters);
  const usersCount = await UserModel.countDocuments();
  const clinicsCount = await ClinicModel.countDocuments();
  const offersCount = await OfferModel.countDocuments();

  return {
    items: [
      { metric: "Total Users", value: String(usersCount) },
      { metric: "Total Clinics", value: String(clinicsCount) },
      { metric: "Total Offers", value: String(offersCount) },
      { metric: "Revenue (KWD)", value: snapshot.revenueKwd },
      { metric: "Profit (KWD)", value: snapshot.profitKwd },
      { metric: "Pending Payments Count", value: String(snapshot.pendingPaymentsCount) },
      { metric: "Pending Payments (KWD)", value: snapshot.pendingPaymentsKwd },
      { metric: "Cashback Locked (KWD)", value: snapshot.cashback.lockedKwd },
      { metric: "Cashback Unlocked (KWD)", value: snapshot.cashback.unlockedKwd },
      { metric: "Cashback Utilized (KWD)", value: snapshot.cashback.utilizedKwd },
      { metric: "Sessions Today", value: String(snapshot.sessionsToday) },
      { metric: "Sessions This Month", value: String(snapshot.sessionsThisMonth) },
    ]
  };
}



export type FinanceExportKind = "payments" | "offers" | "subscriptions" | "referrals" | "installments" | "clinics" | "comprehensive";

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
        { key: "sessionType", header: "Session Type" },
        { key: "amountKwd", header: "Amount (KWD)", numFmt: "0.000" },
        { key: "cashbackAppliedKwd", header: "Cashback (KWD)", numFmt: "0.000" },
        { key: "status", header: "Status" },
        { key: "additionalTreatments", header: "Additional Treatments" },
      ],
      data.items.map((p: any) => ({
        date: new Date(p.createdAt).toISOString(),
        customerName: p.customerName || p.userId,
        customerPhone: p.customerPhone || "",
        offerName: p.offerName ?? "",
        clinic: p.clinicNameEn ?? "",
        method: p.method,
        purpose: p.purpose ?? "",
        sessionType: p.sessionType ?? "—",
        amountKwd: Number.parseFloat(p.amountKwd ?? "0"),
        cashbackAppliedKwd: Number.parseFloat(p.cashbackAppliedKwd ?? "0"),
        status: p.status,
        additionalTreatments: p.additionalTreatments ?? "",
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
        { key: "expectedKwd", header: "Expected Revenue (KWD)", numFmt: "0.000" },
        { key: "cashbackKwd", header: "Cashback (KWD)", numFmt: "0.000" },
        { key: "profitKwd", header: "Profit (KWD)", numFmt: "0.000" },
      ],
      data.items.map((o) => ({
        offerName: o.offerName,
        membershipType: o.membershipType,
        salesCount: o.salesCount,
        revenueKwd: Number.parseFloat(o.revenueKwd),
        expectedKwd: Number.parseFloat(o.expectedKwd || "0"),
        cashbackKwd: Number.parseFloat(o.cashbackKwd),
        profitKwd: Number.parseFloat(o.profitKwd),
      })),
    );
  } else if (kind === "subscriptions") {
    const data = await computeDetailedCustomersReport({ from: filters.from, to: filters.to });
    addTable(
      [
        { key: "customerId", header: "Customer ID" },
        { key: "customerName", header: "Customer Name" },
        { key: "customerPhone", header: "Phone" },
        { key: "service", header: "Service" },
        { key: "clinicName", header: "Clinic Name" },
        { key: "expiryDate", header: "Expiry Date" },
        { key: "reference", header: "Reference" },
        { key: "totalPaymentKwd", header: "Total Payment", numFmt: "0.000" },
        { key: "paidAmountKwd", header: "Paid Amount", numFmt: "0.000" },
        { key: "balanceKwd", header: "Balance", numFmt: "0.000" },
        { key: "paymentType", header: "Payment Type" },
        { key: "depositAmount", header: "Deposit", numFmt: "0.000" },
        { key: "installment2Amount", header: "Installment 2", numFmt: "0.000" },
        { key: "installment3Amount", header: "Installment 3", numFmt: "0.000" },
        { key: "firstPaymentDate", header: "First Payment Date" },
        { key: "secondPaymentDate", header: "Second Payment Date" },
        { key: "thirdPaymentDate", header: "Third Payment Date" },
        { key: "notes", header: "Notes" },
        { key: "packageDate", header: "Package Date" },
      ],
      data.items,
    );
  } else if (kind === "referrals") {
    // 1. Get payments in period
    const q: Record<string, unknown> = { status: "completed" };
    const dateFilter = buildDateFilter(filters.from, filters.to);
    if (dateFilter) q.createdAt = dateFilter;
    
    const paymentsInPeriod = await PaymentModel.find(q).select("_id userId amountKwd createdAt offerId").lean();
    const buyerIdsStr = [...new Set(paymentsInPeriod.map((p: any) => String(p.userId)))].filter(Boolean);
    
    let validPayments: any[] = [];
    const buyerToReferrer = new Map<string, string>();
    
    if (buyerIdsStr.length > 0) {
      // 2. Find their FIRST payment EVER
      const firstPaymentsEver = await PaymentModel.aggregate([
        { $match: { status: "completed", userId: { $in: buyerIdsStr } } },
        { $sort: { createdAt: 1 } },
        { $group: {
            _id: "$userId",
            paymentId: { $first: "$_id" }
        }}
      ]);
      const firstPaymentIds = new Set(firstPaymentsEver.map((p: any) => p.paymentId.toString()));
      validPayments = paymentsInPeriod.filter((p: any) => firstPaymentIds.has(p._id.toString()));
      
      // 3. Map buyer to referrer
      const buyers: any[] = await UserModel.find({
        $or: [
          { _id: { $in: buyerIdsStr.filter((i) => /^[a-f0-9]{24}$/i.test(i)) } },
          { username: { $in: buyerIdsStr } },
        ],
      }).select("username referredBy").lean().catch(() => []);
      
      for (const b of buyers) {
        if (!b.referredBy) continue;
        buyerToReferrer.set(b._id.toString(), b.referredBy.toString());
        if (b.username) buyerToReferrer.set(b.username, b.referredBy.toString());
      }
    }
    
    // 4. Group by offer and referrer
    const matrix: Record<string, Record<string, number>> = {};
    const offerIds = new Set<string>();
    const referrerIds = new Set<string>();

    // Pre-fill all active offers and cs/legal staff so they always show up
    const allOffers = await OfferModel.find({ isActive: true }).select("name nameAr").lean();
    const offerMap = new Map();
    for (const o of allOffers) {
      offerIds.add(String(o._id));
      offerMap.set(String(o._id), (o as any).nameAr || (o as any).name);
    }
    
    const staffUsers = await UserModel.find({ role: { $in: ["cs", "legal", "cs_director"] } }).select("username displayName fullName").lean();
    const refMap = new Map();
    for (const s of staffUsers) {
      referrerIds.add(String(s._id));
      refMap.set(String(s._id), (s as any).fullName || (s as any).displayName || (s as any).username || "Staff");
    }
    
    for (const p of validPayments as any[]) {
      const ref = buyerToReferrer.get(String(p.userId));
      if (!ref) continue;
      
      const oId = p.offerId ? String(p.offerId) : "unknown";
      offerIds.add(oId);
      referrerIds.add(ref);
      
      if (!matrix[oId]) matrix[oId] = {};
      matrix[oId][ref] = (matrix[oId][ref] || 0) + 1;
    }
    
    // Load any missing Offer and Referrer names
    const missingOfferIds = [...offerIds].filter(id => !offerMap.has(id) && id !== "unknown" && /^[a-f0-9]{24}$/i.test(id));
    if (missingOfferIds.length > 0) {
      const extraOffers = await OfferModel.find({ _id: { $in: missingOfferIds } }).select("name nameAr").lean();
      for (const o of extraOffers) { offerMap.set(String(o._id), (o as any).nameAr || (o as any).name); }
    }
    const missingRefIds = [...referrerIds].filter(id => !refMap.has(id));
    if (missingRefIds.length > 0) {
      const extraRefs = await UserModel.find({ _id: { $in: missingRefIds } }).select("username displayName fullName").lean();
      for (const r of extraRefs) { refMap.set(String(r._id), (r as any).fullName || (r as any).displayName || (r as any).username || String(r._id)); }
    }
    
    // 6. Build the Excel Table structure
    const refIdList = [...referrerIds];
    
    const headers = [
      { key: "code", header: "الكود", alignment: { vertical: "middle", horizontal: "center" } as any },
      { key: "offerName", header: "العرض" },
      ...refIdList.map(refId => ({
        key: `ref_${refId}`,
        header: refMap.get(refId) || refId,
        alignment: { vertical: "middle", horizontal: "center" } as any
      })),
      { key: "total", header: "الإجمالي", alignment: { vertical: "middle", horizontal: "center" } as any },
      { key: "target", header: "التاجيت", alignment: { vertical: "middle", horizontal: "center" } as any },
      { key: "remaining", header: "المتبقي", alignment: { vertical: "middle", horizontal: "center" } as any }
    ];
    
    const rows = [];
    const colTotals: Record<string, number> = {};
    let rowIndex = 1;
    
    for (const oId of [...offerIds]) {
      const rowData: Record<string, any> = {
        code: rowIndex++,
        offerName: oId === "unknown" ? "أخرى (Other)" : (offerMap.get(oId) || oId),
        target: "-",
        remaining: "-"
      };
      
      let rowTotal = 0;
      for (const refId of refIdList) {
        const count = matrix[oId]?.[refId] || 0;
        rowData[`ref_${refId}`] = count > 0 ? count : "-";
        rowTotal += count;
        colTotals[refId] = (colTotals[refId] || 0) + count;
      }
      rowData.total = rowTotal;
      rows.push(rowData);
    }
    
    // Final Row: Totals
    const totalRow: Record<string, any> = { code: "", offerName: "الإجمالي", target: "-", remaining: "-" };
    let superTotal = 0;
    for (const refId of refIdList) {
      totalRow[`ref_${refId}`] = colTotals[refId] || 0;
      superTotal += colTotals[refId] || 0;
    }
    totalRow.total = superTotal;
    rows.push(totalRow);
    
    addTable(headers, rows);
  } else if (kind === "installments") {
    const data = await computeInstallmentsAnalytics({ from: filters.from, to: filters.to });
    addTable(
      [
        { key: "customerName", header: "Customer Name" },
        { key: "customerPhone", header: "Phone" },
        { key: "offerName", header: "Offer" },
        { key: "installmentNumber", header: "Installment #" },
        { key: "amountKwd", header: "Amount (KWD)", numFmt: "0.000" },
        { key: "amountLeftKwd", header: "Amount Left (KWD)", numFmt: "0.000" },
        { key: "dueDate", header: "Due Date" },
        { key: "status", header: "Status" },
      ],
      data.items.map((i: any) => ({
        customerName: i.customerName || i.userId,
        customerPhone: i.customerPhone || "",
        offerName: i.offerName,
        installmentNumber: i.installmentNumber,
        amountKwd: Number.parseFloat(i.amountKwd ?? "0"),
        amountLeftKwd: Number.parseFloat(i.amountLeftKwd ?? "0"),
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : "",
        status: i.status,
      })),
    );
  } else if (kind === "clinics") {
    const data = await computeClinicSummaries({ from: filters.from, to: filters.to });
    addTable(
      [
        { key: "clinicName", header: "Clinic Name" },
        { key: "totalSessions", header: "Total Sessions" },
        { key: "completed", header: "Completed" },
        { key: "scheduled", header: "Scheduled" },
        { key: "noShow", header: "No-Show" },
        { key: "totalInvoices", header: "Total Invoices" },
        { key: "paidInvoices", header: "Paid Invoices" },
        { key: "status", header: "Status" },
      ],
      data.items.map((c: any) => ({
        clinicName: c.clinicNameEn,
        totalSessions: c.totalSessions,
        completed: c.completedSessions,
        scheduled: c.scheduledSessions,
        noShow: c.noShowSessions,
        totalInvoices: c.totalInvoices,
        paidInvoices: c.paidInvoices,
        status: c.isActive ? "Active" : "Inactive",
      })),
    );

    const wsS = wb.addWorksheet("All Sessions");
    
    // Add subtotal row at the top
    wsS.getCell("A1").value = "Total Sessions:";
    wsS.getCell("A1").font = { bold: true };
    wsS.getCell("B1").value = { formula: "SUBTOTAL(3, B4:B100000)" };
    wsS.getCell("B1").font = { bold: true };
    
    wsS.getCell("G1").value = "Total Bill (KWD):";
    wsS.getCell("G1").font = { bold: true };
    wsS.getCell("H1").value = { formula: "SUBTOTAL(9, H4:H100000)" };
    wsS.getCell("H1").font = { bold: true };

    const sHeaders = ["Date", "Customer", "Phone", "Clinic", "Membership", "Session Type", "Status", "Bill (KWD)", "Notes"];
    const sHeaderRow = wsS.getRow(3);
    sHeaderRow.values = sHeaders;
    sHeaderRow.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    });
    wsS.getColumn(1).width = 20;
    wsS.getColumn(2).width = 25;
    wsS.getColumn(3).width = 18;
    wsS.getColumn(4).width = 25;
    wsS.getColumn(5).width = 25; // Membership
    wsS.getColumn(6).width = 20; // Session Type
    wsS.getColumn(7).width = 15; // Status
    wsS.getColumn(8).width = 15; // Bill
    wsS.getColumn(9).width = 30; // Notes

    const sessionQ: any = {};
    const sessionDateFilter = buildDateFilter(filters.from, filters.to);
    if (sessionDateFilter) sessionQ.scheduledAt = sessionDateFilter;
    const allSessions = await BookingSessionModel.find(sessionQ).sort({ scheduledAt: -1 }).lean();

    const uIds = [...new Set(allSessions.map((s: any) => s.userId).filter(Boolean))];
    const isOid = (s: string) => /^[a-f0-9]{24}$/i.test(s);
    const users = await UserModel.find({ 
      $or: [
        { _id: { $in: uIds.filter(isOid) } },
        { username: { $in: uIds } },
      ],
    }).select("username fullName phone").lean();
    const uMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    users.forEach((u: any) => { if (u.username) uMap.set(u.username, u); });

    const clinicDocs = await ClinicModel.find().lean();
    const cMap = new Map(clinicDocs.map((c: any) => [c._id.toString(), c.nameEn || c.nameAr]));
    
    // Fetch offers to get membership and session type
    const oIds = [...new Set(allSessions.map((s: any) => s.offerId?.toString()).filter(Boolean))];
    const offers = await OfferModel.find({ _id: { $in: oIds } }).select("name nameAr category offerKind").lean();
    const oMap = new Map(offers.map((o: any) => [o._id.toString(), o]));

    allSessions.forEach((s: any, idx) => {
      const u = uMap.get(s.userId) || {};
      const c = cMap.get(s.clinicId?.toString()) || s.clinicId;
      const o = s.offerId ? (oMap.get(s.offerId.toString()) || {}) : {};
      
      const membership = o.nameAr || o.name || "—";
      const sessionType = o.offerKind || o.category || "—";

      const row = wsS.getRow(idx + 4);
      row.values = [
        s.scheduledAt ? new Date(s.scheduledAt).toISOString().slice(0, 16).replace("T", " ") : "",
        u.fullName || u.username || s.userId,
        u.phone || "",
        c,
        membership,
        sessionType,
        s.status,
        Number.parseFloat(s.finalPaidKwd || s.totalBillKwd || "0"),
        s.notes || "",
      ];
    });

    wsS.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3, column: sHeaders.length },
    };
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
  if (dateFilter) sessionMatchStage.scheduledAt = dateFilter;
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
  const breakdown = await computePaymentsBreakdown({ from: filters.from, to: filters.to, limit: 100000 });
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
  if (dateFilter) sessionQ.scheduledAt = dateFilter;
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

  // Find sessions for these bookingReqs
  const brSessionIds = (bookingReqs as any[]).map(br => br.scheduledSessionId).filter(Boolean);
  const brSessions = await BookingSessionModel.find({ _id: { $in: brSessionIds } }).select("status").lean();
  const brSessionMap = new Map(brSessions.map((s: any) => [s._id.toString(), s.status]));

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
    invoices: (bookingReqs as any[]).map((br) => {
      const sStatus = br.scheduledSessionId ? brSessionMap.get(br.scheduledSessionId.toString()) : null;
      let combinedStatus = "";
      if (br.clinicPaymentStatus === "paid" && sStatus === "completed") combinedStatus = "Completed";
      else if (br.clinicPaymentStatus !== "paid" && sStatus === "completed") combinedStatus = "Missing POS";
      else if (br.clinicPaymentStatus === "paid" && sStatus !== "completed") combinedStatus = "Missing Came";
      else combinedStatus = "Missing Both";

      return {
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
        combinedSessionStatus: combinedStatus,
      };
    }),
  };
}

// ===========================================================================
// CLINIC REPORT EXPORT — CSV and XLSX per clinic
// ===========================================================================


export async function exportClinicReportXlsx(clinicId: string, filters: { from?: string; to?: string }) {
  const data = await computeClinicDetail(clinicId, filters);
  const clinicNameEn = data.clinic?.nameEn ?? clinicId;
  const clinicNameAr = data.clinic?.nameAr ?? "";

  // Fetch all sessions for this clinic with full enrichment
  const dateFilter = buildDateFilter(filters.from, filters.to);
  const sessionQ: Record<string, unknown> = {
    clinicId: mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : clinicId,
  };
  if (dateFilter) sessionQ.scheduledAt = dateFilter;
  const sessions = await BookingSessionModel.find(sessionQ).sort({ scheduledAt: -1 }).lean();

  // Gather all userOfferIds and userIds
  const userOfferIds = [...new Set((sessions as any[]).map(s => s.userOfferId?.toString()).filter(Boolean))];
  const userIds = [...new Set((sessions as any[]).map(s => s.userId).filter(Boolean))];

  // Fetch UserOffers with Offer details
  const userOffers = userOfferIds.length
    ? await UserOfferModel.find({ _id: { $in: userOfferIds } }).lean()
    : [];
  const userOfferMap = new Map((userOffers as any[]).map(uo => [uo._id.toString(), uo]));

  // Fetch Offers
  const offerIds = [...new Set((userOffers as any[]).map((uo: any) => uo.offerId?.toString()).filter(Boolean))];
  const offers = offerIds.length
    ? await OfferModel.find({ _id: { $in: offerIds } }).select("name membershipType totalSessions subscriptionPriceKwd").lean()
    : [];
  const offerMap = new Map((offers as any[]).map(o => [o._id.toString(), o]));

  // Fetch Users
  const isOid = (s: string) => /^[a-f0-9]{24}$/i.test(s);
  const userDocs = userIds.length
    ? await UserModel.find({
        $or: [
          { _id: { $in: userIds.filter(isOid) } },
          { username: { $in: userIds } },
        ],
      }).select("username fullName phone nationalId").lean()
    : [];
  const userMap = new Map<string, any>();
  for (const u of userDocs as any[]) {
    userMap.set(u._id.toString(), u);
    if (u.username) userMap.set(u.username, u);
  }

  // Count sessions per userOffer for this clinic to compute completed/remaining
  const sessionsPerUserOffer = new Map<string, { completed: number; total: number }>();
  for (const s of sessions as any[]) {
    const uoId = s.userOfferId?.toString();
    if (!uoId) continue;
    const entry = sessionsPerUserOffer.get(uoId) ?? { completed: 0, total: 0 };
    entry.total++;
    if (s.status === "completed") entry.completed++;
    sessionsPerUserOffer.set(uoId, entry);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Belamonda";
  wb.created = new Date();

  const ws = wb.addWorksheet(clinicNameAr || clinicNameEn, { views: [{ rightToLeft: true }] });

  // ── Title row ──
  ws.mergeCells("A1:V1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `كشف حساب المركز الطبي عبر نظام بيلاموندو — ${clinicNameAr || clinicNameEn}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFCC0000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 35;

  // ── Summary row ──
  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = clinicNameAr || clinicNameEn;
  ws.getCell("A2").font = { bold: true, size: 13, color: { argb: "FFCC0000" } };

  ws.getCell("R2").value = data.summary.totalSessions;
  ws.getCell("R2").font = { bold: true, size: 12 };
  ws.getCell("Q2").value = data.summary.sessionRevenueKwd;
  ws.getCell("Q2").font = { bold: true, size: 12 };
  ws.getCell("P2").value = data.summary.paidRevenueKwd;
  ws.getCell("P2").font = { bold: true, size: 12 };

  // ── Headers (row 3) ──
  const headers = [
    "#",
    "الاسم",
    "نوع الباقة",
    "نوع الجلسة",
    "منتج إضافي",
    "حالة الجلسة",
    "تاريخ الجلسة",
    "المركز",
    "الهاتف",
    "رقم الهوية",
    "تاريخ الباقة",
    "تاريخ الانتهاء",
    "اسم المستخدم",
    "كلمة المرور",
    "ملاحظات",
  ];

  const headerRow = ws.getRow(3);
  headerRow.values = headers;
  styleHeaderRow(headerRow);
  headerRow.height = 30;

  // ── Data rows ──
  let rowIdx = 4;
  let counter = 1;
  const rowsData: any[][] = [];
  
  for (const s of sessions as any[]) {
    const user = userMap.get(s.userId) ?? {};
    const userOffer = userOfferMap.get(s.userOfferId?.toString()) ?? {} as any;
    const offer = offerMap.get(userOffer.offerId?.toString()) ?? {} as any;

    const sessionType = offer.offerKind ?? offer.category ?? "—";
    const extraItems = (s.extraItems || []).map((e: any) => `${e.name} (${e.qty})`).join(", ") || "—";
    const sessionStatus = s.status === "completed" ? "معتمد" : s.status === "no_show" ? "غير معتمد" : s.status;
    const sessionDate = s.scheduledAt ? new Date(s.scheduledAt).toISOString().slice(0, 10) : "";
    const packageDate = userOffer.activatedAt ? new Date(userOffer.activatedAt).toISOString().slice(0, 10) : (userOffer.createdAt ? new Date(userOffer.createdAt).toISOString().slice(0, 10) : "");
    const expiryDate = userOffer.expiresAt ? new Date(userOffer.expiresAt).toISOString().slice(0, 10) : "";


    const values = [
      counter,
      user.fullName ?? user.username ?? s.userId,
      offer.name ?? "—",
      sessionType,
      extraItems,
      sessionStatus,
      sessionDate,
      clinicNameAr || clinicNameEn,
      user.phone ?? "",
      user.nationalId ?? "",
      packageDate,
      expiryDate,
      user.username ?? "",
      "", // password not exposed
      s.notes ?? "",
    ];
    rowsData.push(values);

    const row = ws.getRow(rowIdx);
    row.values = values;
    styleDataRow(row, rowIdx % 2 === 1);

    // Color status cell (index 6 is "حالة الجلسة")
    const statusCell = row.getCell(6);
    if (sessionStatus === "معتمد") {
      statusCell.font = { color: { argb: "FF008000" }, bold: true };
    } else if (sessionStatus === "غير معتمد") {
      statusCell.font = { color: { argb: "FFCC0000" }, bold: true };
    }

    rowIdx++;
    counter++;
  }

  // Auto-filter on header row
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: headers.length },
  };

  // Auto-fit column widths
  setAutoWidths(ws, 3, 4);

  // — Invoices sheet —
  const wsI = wb.addWorksheet("Invoices");
  const invoiceHeaders = ["Date", "Customer", "Phone", "Session Price (KWD)", "Cashback Applied (KWD)", "Clinic Payment", "Type", "Status", "Combined Status"];
  const iHeaderRow = wsI.getRow(1);
  iHeaderRow.values = invoiceHeaders;
  styleHeaderRow(iHeaderRow);

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
      inv.combinedSessionStatus,
    ];
    styleDataRow(row, idx % 2 === 1);
  });

  wsI.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: invoiceHeaders.length },
  };
  setAutoWidths(wsI, 1, 2);


  const bufXlsx = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(bufXlsx) ? bufXlsx : Buffer.from(bufXlsx as ArrayBuffer);
}

export async function exportComprehensiveReportXlsx(filters: { from?: string; to?: string } = {}, opts?: { rtl?: boolean }) {
  const rtl = opts?.rtl ?? true;
  const dateFilter = buildDateFilter(filters.from, filters.to);

  const usersQ: any = {};
  const paymentsQ: any = { status: "completed" };
  const membershipsQ: any = { status: { $nin: ["pending_payment", "enet_pending", "enet_rejected", "rejected"] } };
  const sessionsQ: any = {};

  if (dateFilter) {
    usersQ.createdAt = dateFilter;
    paymentsQ.createdAt = dateFilter;
    membershipsQ.createdAt = dateFilter;
    sessionsQ.scheduledAt = dateFilter;
  }

  const [users, payments, memberships, sessions] = await Promise.all([
    UserModel.find(usersQ).sort({ createdAt: -1 }).lean(),
    PaymentModel.find(paymentsQ).sort({ createdAt: -1 }).lean(),
    UserOfferModel.find(membershipsQ).sort({ createdAt: -1 }).lean(),
    BookingSessionModel.find(sessionsQ).sort({ scheduledAt: -1 }).lean(),
  ]);

  // Build lookups
  const userMap: Record<string, any> = {};
  users.forEach((u: any) => {
    userMap[String(u._id)] = u;
    if (u.username) userMap[u.username] = u;
  });

  const offerIds = [...new Set([
    ...memberships.map((m: any) => m.offerId ? String(m.offerId) : null),
    ...payments.map((p: any) => p.offerId ? String(p.offerId) : null),
    ...sessions.map((s: any) => s.offerId ? String(s.offerId) : null),
  ].filter(Boolean))];
  const offers = offerIds.length
    ? await OfferModel.find({ _id: { $in: offerIds } }).select("name subscriptionPriceKwd").lean()
    : [];
  const offerMap: Record<string, string> = {};
  const offerPriceMap: Record<string, string> = {};
  offers.forEach((o: any) => {
    offerMap[String(o._id)] = o.name;
    offerPriceMap[String(o._id)] = o.subscriptionPriceKwd || "0.000";
  });

  // Fetch ALL clinics so that every clinic is always represented as a column in the report
  const clinics = await ClinicModel.find({}).select("nameEn").lean();
  const clinicMap: Record<string, string> = {};
  clinics.forEach((c: any) => { clinicMap[String(c._id)] = c.nameEn; });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Belamonda";
  wb.created = new Date();

  const addSheet = (name: string, headers: string[], rows: any[][], totalColIndices?: number[]) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: rtl }] });
    
    let headerRowIdx = 1;
    let dataStartRow = 2;

    if (totalColIndices && totalColIndices.length > 0) {
      headerRowIdx = 2;
      dataStartRow = 3;
    }

    const headerRow = ws.getRow(headerRowIdx);
    headerRow.values = headers;
    styleHeaderRow(headerRow);

    rows.forEach((r, idx) => {
      // Ensure numeric values for totals
      if (totalColIndices) {
        for (const colIdx of totalColIndices) {
          if (typeof r[colIdx] === "string" && r[colIdx] !== "") {
            const parsed = parseFloat(r[colIdx]);
            if (!isNaN(parsed)) r[colIdx] = parsed;
          }
        }
      }
      const row = ws.getRow(idx + dataStartRow);
      row.values = r;
      styleDataRow(row, idx % 2 === 1);
    });

    if (totalColIndices && totalColIndices.length > 0) {
      const totalRow = ws.getRow(1);
      totalRow.getCell(1).value = "Total";
      
      for (const colIdx of totalColIndices) {
        const colLetter = ws.getColumn(colIdx + 1).letter;
        const lastRow = dataStartRow + rows.length - 1;
        
        if (rows.length > 0) {
          totalRow.getCell(colIdx + 1).value = { formula: `SUBTOTAL(109,${colLetter}${dataStartRow}:${colLetter}${lastRow})` };
        } else {
          totalRow.getCell(colIdx + 1).value = 0;
        }
      }

      totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true, size: 12, color: { argb: "FF1A1A1A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD97706" } },
          bottom: { style: "thin", color: { argb: "FFD97706" } },
        };
        cell.alignment = { vertical: "middle" };
        if (cell.value && typeof cell.value === 'object' && 'formula' in cell.value) {
            const headerText = headers[colNumber - 1]?.toLowerCase() || "";
            if (headerText.includes("kwd") || headerText.includes("price") || headerText.includes("amount") || headerText.includes("revenue")) {
              cell.numFmt = '0.000';
            } else {
              cell.numFmt = '0'; // Integer format for counts like Sessions Used
            }
        }
      });
      totalRow.height = 25;
      
      ws.views = [{ rightToLeft: rtl, state: 'frozen', xSplit: 0, ySplit: 2 }];
    } else {
      ws.views = [{ rightToLeft: rtl, state: 'frozen', xSplit: 0, ySplit: 1 }];
    }

    ws.autoFilter = {
      from: { row: headerRowIdx, column: 1 },
      to: { row: headerRowIdx, column: headers.length },
    };

    headers.forEach((h, i) => {
      let max = h.length;
      rows.forEach(r => {
        const val = r[i] ? String(r[i]) : "";
        if (val.length > max) max = val.length;
      });
      ws.getColumn(i + 1).width = clampColWidth(max + 2);
    });
  };

  // 1. Customers
  addSheet(
    "Customers",
    ["User ID", "Full Name", "Username", "Phone", "Email", "National ID", "Role", "Status", "Joined"],
    users.map((u: any) => [
      String(u._id), u.fullName ?? "", u.username ?? "", u.phone ?? "", u.email ?? "",
      u.civilIdNumberMasked ?? "", u.role ?? "", u.isActive !== false ? "Active" : "Disabled",
      u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : ""
    ])
  );

  // 2. Memberships
  // Headers: 0=Membership ID, 1=User ID, 2=Customer Name, 3=Phone, 4=Offer, 5=Status, 6=Purchase Mode,
  //          7=Sessions Used, 8=Total Installments, 9=Installments Paid, 10=Total Price, 11=Amount Left,
  //          12-15=Installment Due Dates, 16=Activated, 17=Created
  addSheet(
    "Memberships",
    ["Membership ID", "User ID", "Customer Name", "Phone", "Offer", "Status", "Purchase Mode", "Sessions Used", "Total Installments", "Installments Paid", "Total Price", "Amount Left (KWD)", "Installment 1 Due", "Installment 2 Due", "Installment 3 Due", "Installment 4 Due", "Activated", "Created"],
    memberships.map((m: any) => {
      const u = userMap[m.userId] || {};
      const totalPriceKwd = offerPriceMap[String(m.offerId)] || m.paymentAmountKwd || "0.000";
      const totalPriceMils = parseKwd(totalPriceKwd);
      
      let paidMils = 0;
      let dates = ["", "", "", ""];
      if (m.purchaseMode === "installments") {
        const sched = m.installmentSchedule || [];
        paidMils += parseKwd(m.depositAmountKwd || "0");
        sched.forEach((s: any, i: number) => {
          if (s.paid) paidMils += parseKwd(s.amountKwd || "0");
          if (i < 4 && s.dueDate && !s.paid) {
            dates[i] = new Date(s.dueDate).toISOString().slice(0, 10);
          }
        });
      } else if (m.purchaseMode === "deposit") {
        paidMils = parseKwd(m.paymentAmountKwd || m.depositAmountKwd || "0");
      } else {
        if (m.status === "active" || m.status === "expired" || m.status === "reserved") {
           paidMils = totalPriceMils;
        }
      }
      const balanceKwd = Math.max(0, totalPriceMils - paidMils) / 1000;

      return [
        String(m._id), m.userId, u.fullName || u.username || "", u.phone || "",
        offerMap[String(m.offerId)] ?? "", m.status, m.purchaseMode ?? "",
        m.sessionsUsed ?? 0, m.installmentCount ?? "", m.installmentsPaid ?? 0,
        totalPriceKwd,
        balanceKwd.toFixed(3),
        ...dates,
        m.activatedAt ? new Date(m.activatedAt).toISOString().slice(0, 10) : "",
        m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : ""
      ];
    }),
    [7, 9, 10, 11] // Totals for: Sessions Used, Installments Paid, Total Price, Amount Left
  );

  // 3. Sessions (Pivot by Clinic)
  const activeClinics = clinics.map((c: any) => String(c._id));
  const clinicHeaders = activeClinics.map(id => clinicMap[id] || id);
  
  const packageMemberships = memberships.filter((m: any) => !m.isStandalone);

  const sessionPivot: Record<string, Record<string, number>> = {};
  sessions.forEach((s: any) => {
    if (s.status === "completed") {
      const uoId = String(s.userOfferId);
      const cId = String(s.clinicId);
      if (!sessionPivot[uoId]) sessionPivot[uoId] = {};
      sessionPivot[uoId][cId] = (sessionPivot[uoId][cId] || 0) + 1;
    }
  });

  const sessionPivotRows = packageMemberships.map((m: any) => {
    const u = userMap[m.userId] || {};
    const totalPriceKwd = offerPriceMap[String(m.offerId)] || m.paymentAmountKwd || "0.000";
    const totalPriceMils = parseKwd(totalPriceKwd);
    
    let paidMils = 0;
    if (m.purchaseMode === "installments") {
      const sched = m.installmentSchedule || [];
      paidMils += parseKwd(m.depositAmountKwd || "0");
      sched.forEach((s: any) => { if (s.paid) paidMils += parseKwd(s.amountKwd || "0"); });
    } else if (m.purchaseMode === "deposit") {
      paidMils = parseKwd(m.paymentAmountKwd || m.depositAmountKwd || "0");
    } else {
      if (m.status === "active" || m.status === "expired" || m.status === "reserved") {
         paidMils = totalPriceMils;
      }
    }
    const paidKwd = (paidMils / 1000).toFixed(3);
    const balanceKwd = Math.max(0, totalPriceMils - paidMils) / 1000;
    
    const clinicCounts = activeClinics.map(cId => {
      const count = sessionPivot[String(m._id)]?.[cId] || 0;
      return count > 0 ? count : "";
    });

    return [
      u.shortId || u.username || m.userId,
      u.fullName || u.username || "",
      u.phone || "",
      offerMap[String(m.offerId)] ?? "",
      m.purchaseMode ?? "",
      totalPriceKwd,
      paidKwd,
      balanceKwd.toFixed(3),
      m.sessionsUsed ?? 0,
      ...clinicCounts
    ];
  });

  addSheet(
    "Sessions",
    [
      "Customer ID", "Customer Name", "Phone", "Package Type", "Payment Type", "Total Price", "Paid Amount (KWD)", "Amount Left (KWD)", "Total Sessions Executed",
      ...clinicHeaders
    ],
    sessionPivotRows,
    [5, 6, 7, 8] // Totals for: Total Price, Paid Amount, Amount Left, Total Sessions Executed
  );

  // 4. Payments
  addSheet(
    "Payments",
    ["Payment ID", "Date", "Customer Name", "Phone", "Offer", "Clinic", "Amount (KWD)", "Gross (KWD)", "Cashback Applied", "Method", "Purpose", "Status"],
    payments.map((p: any) => {
      const u = userMap[p.userId] || {};
      return [
        String(p._id),
        p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 16).replace("T", " ") : "",
        u.fullName || u.username || "", u.phone || "",
        offerMap[String(p.offerId)] ?? "", clinicMap[String(p.clinicId)] ?? "",
        p.amountKwd, p.grossAmountKwd ?? p.amountKwd, p.cashbackAppliedKwd ?? "0",
        p.method, p.purpose, p.status
      ];
    }),
    [6, 7, 8] // Totals for: Amount (KWD), Gross (KWD), Cashback Applied
  );



  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
