import mongoose, { Schema } from "mongoose";

const PaymentSchema = new Schema(
  {
    userId: { type: String, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer" },
    userOfferId: { type: Schema.Types.ObjectId, ref: "UserOffer" },
    bookingId: { type: Schema.Types.ObjectId, ref: "BookingSession" },
    bookingRequestId: { type: String },
    amountKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ },
    cashbackAppliedKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    grossAmountKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", index: true },
    currency: { type: String, default: "KWD", uppercase: true },
    method: {
      type: String,
      enum: ["bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "other"],
      required: true
    },
    purpose: {
      type: String,
      enum: [
        "enrollment_full",
        "installment",
        "deposit",
        "deposit_balance",
        "enrollment_enet",
        "session_payment",
        "manual_entry"
      ],
      default: "enrollment_full",
      index: true
    },
    provider: { type: String, enum: ["mock", "enet", "cs", "manual"], default: "cs" },
    providerRef: { type: String },
    installmentNumber: { type: Number, min: 1 },
    failureReason: { type: String },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
      index: true
    },
    proofRef: { type: String },
    confirmedBy: { type: String },
    confirmedAt: { type: Date },
    customerWalletBalanceAfterKwd: { type: String },
    isManual: { type: Boolean, default: false, index: true },
    manualLabel: { type: String },
    notes: { type: String },
    createdByUserId: { type: String },
  },
  { timestamps: true }
);

PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ userId: 1, offerId: 1 });
PaymentSchema.index({ userOfferId: 1, purpose: 1 });

export type PaymentDoc = mongoose.InferSchemaType<typeof PaymentSchema> & { _id: mongoose.Types.ObjectId };
export const PaymentModel = mongoose.models.Payment ?? mongoose.model("Payment", PaymentSchema);
