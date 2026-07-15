import type { AppointmentStatus, PaymentStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const BookingRequestSchema = new Schema(
  {
    userOfferId: { type: String, index: true },
    userId: { type: String, required: true, index: true },
    offerId: { type: String, index: true },
    clinicId: { type: String, required: true, index: true },
    
    status: {
      type: String,
      enum: [
        "request_received",
        "slot_assigned",
        "scheduled",
        "confirmed",
        "checked_in",
        "in_progress",
        "completed",
        "cancelled",
        "rescheduled",
        "no_show"
      ],
      default: "request_received",
      index: true
    },
    
    isStandalone: { type: Boolean, default: false },
    bookingRoute: { type: String, enum: ["cs", "clinic"], default: "cs", index: true },
    standaloneName: { type: String },
    
    preferredAt: { type: Date },
    proposedAt: { type: Date },
    proposedBy: { type: String },
    adminSuggestedAt: { type: Date },
    clinicScheduledAt: { type: Date },
    acceptedAt: { type: Date },
    confirmedAt: { type: Date },
    confirmedBy: { type: String },
    rejectedAt: { type: Date },
    rejectedBy: { type: String },
    rejectionReason: { type: String },
    
    scheduledSessionId: { type: String, index: true },
    sessionPaymentId: { type: String },
    sessionPriceKwd: { type: String },
    cashbackDeductedKwd: { type: String },
    membershipType: { type: String },
    hadCashback: { type: Boolean, default: false },
    clinicPaymentStatus: {
      type: String,
      enum: ["payment_pending", "paid", "refunded", "failed"] satisfies PaymentStatus[],
      default: "payment_pending"
    },
    clinicPaymentMarkedAt: { type: Date },
    clinicPaymentMarkedBy: { type: String },
    notes: { type: String },
    conversationId: { type: String },
    extraItems: { type: [{ name: String, priceKwd: String, qty: Number }], default: [] },
    totalBillKwd: { type: String },
    finalPaidKwd: { type: String }
  },
  { timestamps: true }
);

BookingRequestSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
BookingRequestSchema.index({ userOfferId: 1, status: 1 });

export const BookingRequestModel =
  mongoose.models.BookingRequest ?? mongoose.model("BookingRequest", BookingRequestSchema);

