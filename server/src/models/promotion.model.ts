import mongoose, { Schema } from "mongoose";

const PromotionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
    offerIds: [{ type: Schema.Types.ObjectId, ref: "Offer" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PromotionSchema.index({ slug: 1 });
PromotionSchema.index({ isActive: 1 });

export type PromotionDoc = mongoose.InferSchemaType<typeof PromotionSchema> & { _id: mongoose.Types.ObjectId };
export const PromotionModel = mongoose.models.Promotion ?? mongoose.model("Promotion", PromotionSchema);
