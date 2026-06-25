import { SystemMetricModel } from "../models/metric.model.js";

function getDailyKey() {
  return `daily_${new Date().toISOString().split("T")[0]}`;
}

export async function incrementMetric(
  metrics: {
    totalUsers?: number;
    totalRevenueMils?: number;
    totalGrossRevenueMils?: number;
    totalCashbackAppliedMils?: number;
    totalSessionsCompleted?: number;
    totalMembershipsSold?: number;
    totalMembershipRevenueMils?: number;
    totalGrossMembershipRevenueMils?: number;
    totalStandaloneSessionsSold?: number;
    totalStandaloneSessionRevenueMils?: number;
    totalGrossStandaloneSessionRevenueMils?: number;
  }
) {
  try {
    const inc: Record<string, number> = {};
    for (const [k, v] of Object.entries(metrics)) {
      if (v !== undefined && v !== 0) inc[k] = v;
    }

    if (Object.keys(inc).length === 0) return;

    // Update global totals
    await SystemMetricModel.updateOne(
      { _id: "global" },
      { $inc: inc },
      { upsert: true }
    );

    // Update daily totals
    await SystemMetricModel.updateOne(
      { _id: getDailyKey() },
      { $inc: inc },
      { upsert: true }
    );
  } catch (err) {
    console.error("[metric.service] Failed to increment metric:", err);
  }
}
