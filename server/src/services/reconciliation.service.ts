import { PaymentModel } from "../models/payment.model.js";
import { UserModel } from "../models/user.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { SystemMetricModel } from "../models/metric.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { OfferModel } from "../models/offer.model.js";

function parseKwd(k: string | undefined | null) {
  if (!k) return 0;
  const f = parseFloat(k);
  if (isNaN(f)) return 0;
  return Math.round(f * 1000);
}

export async function reconcileMetrics() {
  console.log("[reconciliation] Starting metrics reconciliation...");
  
  // 1. Reconcile Users
  const totalUsers = await UserModel.countDocuments({ role: "customer" });
  
  // 2. Reconcile Sessions
  const totalSessionsCompleted = await BookingSessionModel.countDocuments({ status: "completed" });
  
  // 3. Reconcile Payments (Global)
  const payments = await PaymentModel.find({ status: "completed" })
    .select("amountKwd grossAmountKwd cashbackAppliedKwd purpose createdAt")
    .lean();
    
  let totalRevenueMils = 0;
  let totalGrossRevenueMils = 0;
  let totalCashbackAppliedMils = 0;
  
  let totalMembershipsSold = 0;
  let totalMembershipRevenueMils = 0;
  let totalGrossMembershipRevenueMils = 0;
  
  let totalStandaloneSessionsSold = 0;
  let totalStandaloneSessionRevenueMils = 0;
  let totalGrossStandaloneSessionRevenueMils = 0;
  
  // Also calculate daily buckets
  const dailyBuckets = new Map<string, any>();
  
  for (const p of payments as any[]) {
    const net = parseKwd(p.amountKwd);
    const cb = parseKwd(p.cashbackAppliedKwd || "0.000");
    const gross = p.grossAmountKwd ? parseKwd(p.grossAmountKwd) : net + cb;
    
    totalRevenueMils += net;
    totalGrossRevenueMils += gross;
    totalCashbackAppliedMils += cb;
    
    const isSession = (p.purpose || "enrollment_full") === "session_payment";
    if (isSession) {
      totalStandaloneSessionsSold++;
      totalStandaloneSessionRevenueMils += net;
      totalGrossStandaloneSessionRevenueMils += gross;
    } else {
      totalMembershipsSold++;
      totalMembershipRevenueMils += net;
      totalGrossMembershipRevenueMils += gross;
    }
    
    // Daily
    const d = new Date(p.createdAt).toISOString().split("T")[0];
    const key = `daily_${d}`;
    if (!dailyBuckets.has(key)) {
      dailyBuckets.set(key, {
        totalRevenueMils: 0,
        totalGrossRevenueMils: 0,
        totalCashbackAppliedMils: 0,
        totalMembershipsSold: 0,
        totalMembershipRevenueMils: 0,
        totalGrossMembershipRevenueMils: 0,
        totalStandaloneSessionsSold: 0,
        totalStandaloneSessionRevenueMils: 0,
        totalGrossStandaloneSessionRevenueMils: 0
      });
    }
    const b = dailyBuckets.get(key)!;
    b.totalRevenueMils += net;
    b.totalGrossRevenueMils += gross;
    b.totalCashbackAppliedMils += cb;
    
    if (isSession) {
      b.totalStandaloneSessionsSold++;
      b.totalStandaloneSessionRevenueMils += net;
      b.totalGrossStandaloneSessionRevenueMils += gross;
    } else {
      b.totalMembershipsSold++;
      b.totalMembershipRevenueMils += net;
      b.totalGrossMembershipRevenueMils += gross;
    }
  }

  // 4. Reconcile Expected vs Paid (User Offers)
  const allUserOffers = await UserOfferModel.find({
    status: { $nin: ["pending_payment", "enet_pending", "enet_rejected", "rejected"] }
  }).select("offerId installmentSchedule purchaseMode paymentAmountKwd depositAmountKwd status").lean();
  
  const allOfferIds = [...new Set(allUserOffers.map((uo: any) => uo.offerId?.toString()).filter(Boolean))];
  const allOfferDocs = await OfferModel.find({ _id: { $in: allOfferIds } }).select("subscriptionPriceKwd").lean();
  const offerPriceMap = new Map(allOfferDocs.map((o: any) => [o._id.toString(), o.subscriptionPriceKwd]));

  let totalExpectedMembershipRevenueMils = 0;
  let totalPaidTowardMembershipsMils = 0;

  for (const uo of allUserOffers as any[]) {
    const totalPriceKwd = offerPriceMap.get(uo.offerId?.toString()) || uo.paymentAmountKwd || "0.000";
    const uoTotal = parseKwd(totalPriceKwd);
    
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
    
    totalExpectedMembershipRevenueMils += uoTotal;
    totalPaidTowardMembershipsMils += paidMils;
  }

  const now = new Date();

  // Save global
  await SystemMetricModel.findOneAndUpdate(
    { _id: "global" },
    {
      totalUsers,
      totalSessionsCompleted,
      totalRevenueMils,
      totalGrossRevenueMils,
      totalCashbackAppliedMils,
      totalMembershipsSold,
      totalMembershipRevenueMils,
      totalGrossMembershipRevenueMils,
      totalStandaloneSessionsSold,
      totalStandaloneSessionRevenueMils,
      totalGrossStandaloneSessionRevenueMils,
      totalExpectedMembershipRevenueMils,
      totalPaidTowardMembershipsMils,
      lastReconciledAt: now
    },
    { upsert: true }
  );

  // Save daily
  for (const [key, b] of dailyBuckets.entries()) {
    await SystemMetricModel.findOneAndUpdate(
      { _id: key },
      {
        ...b,
        lastReconciledAt: now
      },
      { upsert: true }
    );
  }
  
  console.log("[reconciliation] Completed.");
}

export function startReconciliationCron() {
  // Reconcile every 12 hours
  setInterval(() => {
    reconcileMetrics().catch(console.error);
  }, 12 * 60 * 60 * 1000);
  
  // Also run immediately on startup
  setTimeout(() => {
    reconcileMetrics().catch(console.error);
  }, 5000);
}
