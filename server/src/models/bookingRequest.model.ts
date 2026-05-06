import mongoose, { Schema } from "mongoose";

const BookingRequestSchema = new Schema(
  {
    userOfferId: { type: Schema.Types.ObjectId, ref: "UserOffer", required: true, index: true },
    userId: { type: String, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true, index: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
    preferredAt: { type: Date },
    status: { type: String, enum: ["pending", "scheduled", "cancelled"], default: "pending", index: true },
    scheduledSessionId: { type: Schema.Types.ObjectId, ref: "BookingSession" },
    notes: { type: String }
  },
  { timestamps: true }
);

BookingRequestSchema.index({ clinicId: 1, status: 1, createdAt: -1 });
BookingRequestSchema.index({ userOfferId: 1, status: 1 });

export const BookingRequestModel =
  mongoose.models.BookingRequest ?? mongoose.model("BookingRequest", BookingRequestSchema);

