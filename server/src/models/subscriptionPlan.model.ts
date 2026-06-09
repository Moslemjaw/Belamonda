import mongoose, { Schema } from "mongoose";

const SubscriptionPlanSchema = new Schema(
  {
    nameEn: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    descriptionEn: { type: String, trim: true },
    descriptionAr: { type: String, trim: true },
    price: { type: Number, required: true },
    durationMonths: { type: Number, required: true, min: 1 },
    minimumCommitmentMonths: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const SubscriptionPlanModel =
  mongoose.models.SubscriptionPlan ?? mongoose.model("SubscriptionPlan", SubscriptionPlanSchema);

export type SubscriptionPlanDoc = mongoose.InferSchemaType<typeof SubscriptionPlanSchema> & {
  _id: mongoose.Types.ObjectId;
};
