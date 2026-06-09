import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface SubscriptionRequestDoc extends Document {
  _id: Types.ObjectId;
  userId: string;
  paymentOption?: "monthly" | "advance";
  planId?: Types.ObjectId;
  amountKwd: string;
  status: "pending" | "paid" | "rejected";
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionRequestSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    paymentOption: { type: String, enum: ["monthly", "advance"] },
    planId: { type: Schema.Types.ObjectId, ref: "SubscriptionPlan" },
    amountKwd: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "rejected"],
      default: "pending",
      index: true
    },
    rejectionReason: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

export const SubscriptionRequestModel =
  mongoose.models.SubscriptionRequest ?? mongoose.model<SubscriptionRequestDoc>("SubscriptionRequest", SubscriptionRequestSchema);
