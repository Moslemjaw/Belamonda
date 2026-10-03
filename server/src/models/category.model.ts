import mongoose, { Schema } from "mongoose";
import { watchModel } from "../utils/cache.js";
import { categoryCache, catalogCache } from "../utils/caches.js";

const CategorySchema = new Schema(
  {
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

CategorySchema.index({ isActive: 1, sortOrder: 1 });

// Any write to this model clears its read cache (utils/caches.ts)
watchModel(CategorySchema, categoryCache, catalogCache);

export const CategoryModel = mongoose.models.Category ?? mongoose.model("Category", CategorySchema);
