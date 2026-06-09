import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface CashbackRequestDoc extends Document {
  _id: Types.ObjectId;
  userId: string;
  invoiceImageRef: string;
  invoiceAmountKwd: string;
  cashbackAmountKwd: string;
  status: "pending" | "accepted" | "rejected";
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CashbackRequestSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    invoiceImageRef: { type: String, required: true },
    invoiceAmountKwd: { type: String, required: true },
    cashbackAmountKwd: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true
    },
    rejectionReason: { type: String },
    reviewedBy: { type: String },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

export const CashbackRequestModel =
  mongoose.models.CashbackRequest ?? mongoose.model<CashbackRequestDoc>("CashbackRequest", CashbackRequestSchema);
