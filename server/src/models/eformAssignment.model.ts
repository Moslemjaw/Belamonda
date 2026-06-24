import mongoose, { Schema } from "mongoose";

const FormAssignmentSchema = new Schema(
  {
    formId: { type: Schema.Types.ObjectId, ref: "EForm", required: true, index: true },
    userId: { type: String, required: true, index: true },
    assignedBy: { type: String, required: true },
  },
  { timestamps: true }
);

FormAssignmentSchema.index({ formId: 1, userId: 1 }, { unique: true });

export const EFormAssignmentModel = mongoose.models.EFormAssignment ?? mongoose.model("EFormAssignment", FormAssignmentSchema);
export type EFormAssignmentDoc = mongoose.InferSchemaType<typeof FormAssignmentSchema> & { _id: mongoose.Types.ObjectId };
