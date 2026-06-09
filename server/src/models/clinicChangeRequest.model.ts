import mongoose, { Schema } from "mongoose";

const ClinicChangeRequestSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    userOfferId: { type: Schema.Types.ObjectId, ref: "UserOffer", required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    fromClinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    toClinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true },
    changeNumber: { type: Number, required: true, min: 1 },
    feeKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reason: { type: String },
    approvedBy: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

ClinicChangeRequestSchema.index({ userOfferId: 1, status: 1 });
ClinicChangeRequestSchema.index({ status: 1, createdAt: 1 });

export type ClinicChangeRequestDoc = mongoose.InferSchemaType<typeof ClinicChangeRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const ClinicChangeRequestModel =
  mongoose.models.ClinicChangeRequest ??
  mongoose.model("ClinicChangeRequest", ClinicChangeRequestSchema);
