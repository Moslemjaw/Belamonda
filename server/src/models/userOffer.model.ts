import type { UserOfferStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const UserOfferSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    status: {
      type: String,
      enum: ["pending_payment", "active", "expired", "cancelled"] satisfies UserOfferStatus[],
      required: true
    },
    pendingExpiresAt: { type: Date },
    activatedAt: { type: Date },
    expiresAt: { type: Date },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    paymentConfirmedBy: { type: String },
    paymentConfirmedAt: { type: Date },
    paymentProofRef: { type: String },
    paymentMethod: { type: String },
    paymentAmountKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" }
  },
  { timestamps: true }
);

UserOfferSchema.index({ userId: 1, createdAt: -1 });
UserOfferSchema.index({ status: 1, createdAt: 1 });
UserOfferSchema.index({ offerId: 1, status: 1 });

export type UserOfferDoc = mongoose.InferSchemaType<typeof UserOfferSchema> & { _id: mongoose.Types.ObjectId };
export const UserOfferModel = mongoose.models.UserOffer ?? mongoose.model("UserOffer", UserOfferSchema);
