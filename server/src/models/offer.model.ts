import type { OfferCategory, OfferType } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const OfferSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["A", "B"] satisfies OfferType[], required: true },
    /** @deprecated Prefer categoryIds; kept for API backward compatibility */
    category: { type: String, enum: ["laser", "beauty", "skincare", "other"] satisfies OfferCategory[] },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    subscriptionPriceKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ },
    validityDays: { type: Number, required: true, min: 1 },
    cashbackPerSessionKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    sessionIntervalDays: { type: Number, default: 0, min: 0 },
    maxSessions: { type: Number, min: 1 },
    active: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    enrollmentCap: { type: Number, min: 1 },
    enrolledCount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String },
    terms: { type: String },
    perVisitPriceKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    originalClinicPriceKwd: { type: String, match: /^\d+(\.\d{3})$/ }
  },
  { timestamps: true }
);

OfferSchema.index({ active: 1, featured: -1, createdAt: -1 });
OfferSchema.index({ clinicId: 1, active: 1 });
OfferSchema.index({ categoryIds: 1, active: 1 });

export type OfferDoc = mongoose.InferSchemaType<typeof OfferSchema> & { _id: mongoose.Types.ObjectId };
export const OfferModel = mongoose.models.Offer ?? mongoose.model("Offer", OfferSchema);
