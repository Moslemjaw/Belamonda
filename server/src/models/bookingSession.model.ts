import type { AppointmentStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";
import { CounterModel } from "./counter.model.js";

const BookingSessionSchema = new Schema(
  {
    userOfferId: { type: Schema.Types.ObjectId, ref: "UserOffer", required: true, index: true },
    userId: { type: String, required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: [
        "request_received",
        "slot_assigned",
        "scheduled",
        "checked_in",
        "completed",
        "cancelled",
        "no_show"
      ] satisfies AppointmentStatus[],
      default: "scheduled"
    },
    scheduledBy: { type: String, required: true },
    completedAt: { type: Date },
    markedBy: { type: String },
    notes: { type: String },
    cashbackUnlockedKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    extraItems: { type: [{ name: String, priceKwd: String, qty: Number }], default: [] },
    totalBillKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    finalPaidKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    shortId: { type: String, trim: true, unique: true, sparse: true }
  },
  { timestamps: true }
);

BookingSessionSchema.index({ clinicId: 1, scheduledAt: 1, status: 1 });
BookingSessionSchema.index({ userOfferId: 1, scheduledAt: 1 });

BookingSessionSchema.pre("save", async function (next) {
  if (this.isNew && !this.shortId) {
    try {
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: "bookingSession" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      
      const paddedSeq = String(counter.seq).padStart(7, '0');
      this.shortId = `s${paddedSeq}`;
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

export type BookingSessionDoc = mongoose.InferSchemaType<typeof BookingSessionSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const BookingSessionModel =
  mongoose.models.BookingSession ?? mongoose.model("BookingSession", BookingSessionSchema);
