import mongoose, { Schema } from "mongoose";

const ClinicSchema = new Schema(
  {
    nameEn: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number },
    lng: { type: Number },
    phone: { type: String, trim: true },
    categoryTags: { type: [String], default: [] },
    operatingHours: {
      open: { type: String, match: /^\d{2}:\d{2}$/ },
      close: { type: String, match: /^\d{2}:\d{2}$/ }
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ClinicSchema.index({ active: 1, createdAt: -1 });

export type ClinicDoc = mongoose.InferSchemaType<typeof ClinicSchema> & { _id: mongoose.Types.ObjectId };
export const ClinicModel = mongoose.models.Clinic ?? mongoose.model("Clinic", ClinicSchema);
