import mongoose, { Schema } from "mongoose";

const SystemMetricSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g., "global", "daily_2026-06-25", "clinic_123_global", etc.
    totalUsers: { type: Number, default: 0 },
    totalRevenueMils: { type: Number, default: 0 },
    totalSessionsCompleted: { type: Number, default: 0 },
    
    // Detailed breakdowns
    totalMembershipsSold: { type: Number, default: 0 },
    totalMembershipRevenueMils: { type: Number, default: 0 },
    totalStandaloneSessionsSold: { type: Number, default: 0 },
    totalStandaloneSessionRevenueMils: { type: Number, default: 0 },
    
    // Caching/Reconciliation metadata
    lastReconciledAt: { type: Date }
  },
  { timestamps: true }
);

export type SystemMetricDoc = mongoose.InferSchemaType<typeof SystemMetricSchema> & { _id: string };
export const SystemMetricModel = mongoose.models.SystemMetric ?? mongoose.model("SystemMetric", SystemMetricSchema);
