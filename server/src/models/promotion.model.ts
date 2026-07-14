import mongoose, { Schema } from "mongoose";

const PromotionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    descriptionEn: { type: String, default: "", trim: true },
    descriptionAr: { type: String, default: "", trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
    type: { type: String, enum: ["packages", "survey"], default: "packages" },
    offerIds: [{ type: Schema.Types.ObjectId, ref: "Offer" }],
    surveyQuestions: {
      type: [
        new Schema(
          {
            key: { type: String, required: true },
            type: { type: String, enum: ["short_text", "long_text", "single_choice", "multi_choice"], required: true },
            labelEn: { type: String, required: true },
            labelAr: { type: String },
            options: { type: [String], default: [] },
            required: { type: Boolean, default: false }
          },
          { _id: false }
        )
      ],
      default: []
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PromotionSchema.index({ slug: 1 });
PromotionSchema.index({ isActive: 1 });

export type PromotionDoc = mongoose.InferSchemaType<typeof PromotionSchema> & { _id: mongoose.Types.ObjectId };
export const PromotionModel = mongoose.models.Promotion ?? mongoose.model("Promotion", PromotionSchema);
