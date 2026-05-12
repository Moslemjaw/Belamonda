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
        "awaiting_session_payment",
        "under_review",
        "slot_proposed",
        "slot_accepted",
        "confirmed",
        "rejected",
        "cancelled"
      ],
      default: "under_review",
      index: true
    },
    
    isStandalone: { type: Boolean, default: false },
    bookingRoute: { type: String, enum: ["cs", "clinic"], default: "cs", index: true },
    standaloneName: { type: String },
    
    preferredAt: { type: Date },
    proposedAt: { type: Date },
    proposedBy: { type: String },
    acceptedAt: { type: Date },
    confirmedAt: { type: Date },
    confirmedBy: { type: String },
    rejectedAt: { type: Date },
    rejectedBy: { type: String },
    rejectionReason: { type: String },
    
    scheduledSessionId: { type: String },
    sessionPaymentId: { type: String },
    sessionPriceKwd: { type: String },
    cashbackDeductedKwd: { type: String },
    membershipType: { type: String },
    hadCashback: { type: Boolean, default: false },
    clinicPaymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending"
    },
    clinicPaymentMarkedAt: { type: Date },
    clinicPaymentMarkedBy: { type: String },
    notes: { type: String },
    conversationId: { type: String }
  },
  { timestamps: true }
);

BookingRequestSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
BookingRequestSchema.index({ userOfferId: 1, status: 1 });

export const BookingRequestModel =
  mongoose.models.BookingRequest ?? mongoose.model("BookingRequest", BookingRequestSchema);

