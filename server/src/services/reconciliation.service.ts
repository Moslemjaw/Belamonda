import { PaymentModel } from "../models/payment.model.js";
import { UserModel } from "../models/user.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { SystemMetricModel } from "../models/metric.model.js";

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
    .select("amountKwd purpose createdAt")
    .lean();
    
  let totalRevenueMils = 0;
  let totalMembershipsSold = 0;
  let totalMembershipRevenueMils = 0;
  let totalStandaloneSessionsSold = 0;
  let totalStandaloneSessionRevenueMils = 0;
  
  // Also calculate daily buckets
  const dailyBuckets = new Map<string, any>();
  
  for (const p of payments as any[]) {
    const mils = parseKwd(p.amountKwd);
    totalRevenueMils += mils;
    
    const isSession = (p.purpose || "enrollment_full") === "session_payment";
    if (isSession) {
      totalStandaloneSessionsSold++;
      totalStandaloneSessionRevenueMils += mils;
    } else {
      totalMembershipsSold++;
      totalMembershipRevenueMils += mils;
    }
    
    // Daily
    const d = new Date(p.createdAt).toISOString().split("T")[0];
    const key = `daily_${d}`;
    if (!dailyBuckets.has(key)) {
      dailyBuckets.set(key, {
        totalRevenueMils: 0,
        totalMembershipsSold: 0,
        totalMembershipRevenueMils: 0,
        totalStandaloneSessionsSold: 0,
        totalStandaloneSessionRevenueMils: 0
      });
    }
    const b = dailyBuckets.get(key)!;
    b.totalRevenueMils += mils;
    if (isSession) {
      b.totalStandaloneSessionsSold++;
      b.totalStandaloneSessionRevenueMils += mils;
    } else {
      b.totalMembershipsSold++;
      b.totalMembershipRevenueMils += mils;
    }
  }

  const now = new Date();

  // Save global
  await SystemMetricModel.findOneAndUpdate(
    { _id: "global" },
    {
      totalUsers,
      totalSessionsCompleted,
      totalRevenueMils,
      totalMembershipsSold,
      totalMembershipRevenueMils,
      totalStandaloneSessionsSold,
      totalStandaloneSessionRevenueMils,
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
