import type { SessionStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const BookingSessionSchema = new Schema(
  {
    userOfferId: { type: Schema.Types.ObjectId, ref: "UserOffer", required: true, index: true },
    userId: { type: String, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "completed", "no_show", "cancelled"] satisfies SessionStatus[],
      default: "scheduled"
    },
    scheduledBy: { type: String, required: true },
    completedAt: { type: Date },
    markedBy: { type: String },
    notes: { type: String },
    cashbackUnlockedKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" }
  },
  { timestamps: true }
);

BookingSessionSchema.index({ clinicId: 1, scheduledAt: 1, status: 1 });
BookingSessionSchema.index({ userOfferId: 1, scheduledAt: 1 });

export type BookingSessionDoc = mongoose.InferSchemaType<typeof BookingSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const BookingSessionModel =
  mongoose.models.BookingSession ?? mongoose.model("BookingSession", BookingSessionSchema);
