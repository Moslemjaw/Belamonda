import mongoose, { Schema } from "mongoose";

const SessionTypeSchema = new Schema(
  {
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

SessionTypeSchema.index({ categoryId: 1, isActive: 1, nameEn: 1 });

export const SessionTypeModel =
  mongoose.models.SessionType ?? mongoose.model("SessionType", SessionTypeSchema);

