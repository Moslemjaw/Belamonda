import mongoose, { Schema } from "mongoose";

const ClinicSessionOfferingSchema = new Schema(
  {
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
    sessionTypeId: { type: Schema.Types.ObjectId, ref: "SessionType", required: true, index: true },
    isActive: { type: Boolean, default: true },
    priceKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    durationMinutes: { type: Number, min: 1 },
    notes: { type: String }
  },
  { timestamps: true }
);

ClinicSessionOfferingSchema.index({ clinicId: 1, sessionTypeId: 1 }, { unique: true });
ClinicSessionOfferingSchema.index({ clinicId: 1, isActive: 1 });

export const ClinicSessionOfferingModel =
  mongoose.models.ClinicSessionOffering ??
  mongoose.model("ClinicSessionOffering", ClinicSessionOfferingSchema);

