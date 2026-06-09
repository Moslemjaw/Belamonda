import mongoose, { Schema } from "mongoose";

const SessionTypeSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    categorySlug: { type: String, lowercase: true, trim: true, default: "other" },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

SessionTypeSchema.index({ isActive: 1, nameEn: 1 });

export const SessionTypeModel =
  mongoose.models.SessionType ?? mongoose.model("SessionType", SessionTypeSchema);

