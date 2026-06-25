import mongoose, { Schema } from "mongoose";

const SystemMetricSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g., "global", "daily_2026-06-25"
    totalUsers: { type: Number, default: 0 },
    totalRevenueMils: { type: Number, default: 0 },         // net (amountKwd — after cashback)
    totalGrossRevenueMils: { type: Number, default: 0 },    // gross (sticker price)
    totalCashbackAppliedMils: { type: Number, default: 0 }, // cashback applied
    totalSessionsCompleted: { type: Number, default: 0 },
    
    // Detailed breakdowns (net)
    totalMembershipsSold: { type: Number, default: 0 },
    totalMembershipRevenueMils: { type: Number, default: 0 },
    totalStandaloneSessionsSold: { type: Number, default: 0 },
    totalStandaloneSessionRevenueMils: { type: Number, default: 0 },
    totalGrossMembershipRevenueMils: { type: Number, default: 0 },
    totalGrossStandaloneSessionRevenueMils: { type: Number, default: 0 },
    
    // Future receivables (all-time)
    totalExpectedMembershipRevenueMils: { type: Number, default: 0 },
    totalPaidTowardMembershipsMils: { type: Number, default: 0 },
    
    // Caching/Reconciliation metadata
    lastReconciledAt: { type: Date }
  },
  { timestamps: true }
);

export type SystemMetricDoc = mongoose.InferSchemaType<typeof SystemMetricSchema> & { _id: string };
export const SystemMetricModel = mongoose.models.SystemMetric ?? mongoose.model("SystemMetric", SystemMetricSchema);
