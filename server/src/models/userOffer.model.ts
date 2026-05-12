import type { UserOfferStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";
import { CounterModel } from "./counter.model.js";

const InstallmentEntrySchema = new Schema(
  {
    number: { type: Number, required: true, min: 1 },
    amountKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ },
    dueDate: { type: Date },
    paid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" }
  },
  { _id: false }
);

const UserOfferSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "active",
        "expired",
        "cancelled",
        "reserved",
        "enet_pending",
        "enet_rejected"
      ] as UserOfferStatus[],
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
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    isStandalone: { type: Boolean, default: false },

    // === Membership type — drives booking behaviour ===
    // cashback: user has a cashback budget; per-session deduction from cashbackBalanceKwd
    // free_sessions: user has N free sessions; clinic charges a small fee per session
    // group: group offer mechanics (existing GroupOfferTeam logic)
    membershipType: {
      type: String,
      enum: ["cashback", "free_sessions", "group"],
      default: undefined
    },
    // Remaining cashback budget (TYPE 1 — Cashback)
    cashbackBalanceKwd: { type: String, match: /^\d+(\.\d{3})$/ },

    // For Group memberships (TYPE 3)
    groupInviteCode: { type: String, sparse: true, index: true },
    sharedWith: [{ type: String }],

    // === Purchase flow extensions (Task #2) ===
    purchaseMode: {
      type: String,
      enum: ["full", "installments", "deposit", "enet"]
    },
    cashbackAppliedKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },

    // Installments
    installmentCount: { type: Number, min: 1 },
    installmentsPaid: { type: Number, default: 0, min: 0 },
    installmentSchedule: { type: [InstallmentEntrySchema], default: [] },
    nextInstallmentDueAt: { type: Date },

    // Deposit reservation
    depositAmountKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    depositPaymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    depositPaidAt: { type: Date },
    reservationExpiresAt: { type: Date },
    reservationCompletionExpectedAt: { type: Date },
    reservationPreferredPlan: {
      type: String,
      enum: ["full", "installments_2", "installments_3", "installments_4_enet"]
    },
    reservationConvertedAt: { type: Date },

    // ENET
    enetStatus: { type: String, enum: ["pending", "approved", "rejected"] },
    enetTxnRef: { type: String },
    enetReason: { type: String },

    // Reminder dedupe (so background ticks don't spam users)
    lastInstallmentReminderAt: { type: Date },
    lastDepositReminderAt: { type: Date },
    lastMembershipExpiryReminderAt: { type: Date },
    shortId: { type: String, trim: true, unique: true, sparse: true }
  },
  { timestamps: true }
);

UserOfferSchema.index({ userId: 1, createdAt: -1 });
UserOfferSchema.index({ status: 1, createdAt: 1 });
UserOfferSchema.index({ offerId: 1, status: 1 });
UserOfferSchema.index({ status: 1, reservationExpiresAt: 1 });
UserOfferSchema.index({ status: 1, nextInstallmentDueAt: 1 });

UserOfferSchema.pre("save", async function (next) {
  if (this.isNew && !this.shortId) {
    try {
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: "userOffer" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      
      const paddedSeq = String(counter.seq).padStart(7, '0');
      this.shortId = `m${paddedSeq}`;
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

export type UserOfferDoc = mongoose.InferSchemaType<typeof UserOfferSchema> & { _id: mongoose.Types.ObjectId };
export const UserOfferModel = mongoose.models.UserOffer ?? mongoose.model("UserOffer", UserOfferSchema);
