import mongoose, { Schema } from "mongoose";
import { CounterModel } from "./counter.model.js";

const ClinicSchema = new Schema(
  {
    nameEn: { type: String, required: true, trim: true },
    nameAr: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    lat: { type: Number },
    lng: { type: Number },
    phone: { type: String, trim: true },
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    categoryTags: { type: [String], default: [] },
    operatingHours: {
      open: { type: String, match: /^\d{2}:\d{2}$/ },
      close: { type: String, match: /^\d{2}:\d{2}$/ }
    },
    active: { type: Boolean, default: true },
    shortId: { type: String, trim: true, unique: true, sparse: true }
  },
  { timestamps: true }
);

ClinicSchema.index({ active: 1, createdAt: -1 });

ClinicSchema.pre("save", async function (next) {
  if (this.isNew && !this.shortId) {
    try {
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: "clinic" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      
      this.shortId = `c${30000000 + counter.seq}`;
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

export type ClinicDoc = mongoose.InferSchemaType<typeof ClinicSchema> & { _id: mongoose.Types.ObjectId };
export const ClinicModel = mongoose.models.Clinic ?? mongoose.model("Clinic", ClinicSchema);
