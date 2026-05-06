import type { ComplaintCategory, ComplaintStatus } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const ComplaintSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ["service_quality", "billing", "scheduling", "cashback", "clinic", "other"] satisfies ComplaintCategory[],
      required: true
    },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "escalated", "resolved", "closed"] satisfies ComplaintStatus[],
      default: "open",
      index: true
    },
    assignedDept: { type: String }
  },
  { timestamps: true }
);

ComplaintSchema.index({ createdAt: -1 });

const ComplaintUpdateSchema = new Schema(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: "Complaint", required: true, index: true },
    by: { type: String, required: true },
    note: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "in_progress", "escalated", "resolved", "closed"] satisfies ComplaintStatus[]
    }
  },
  { timestamps: true }
);

ComplaintUpdateSchema.index({ complaintId: 1, createdAt: -1 });

export const ComplaintModel = mongoose.models.Complaint ?? mongoose.model("Complaint", ComplaintSchema);
export const ComplaintUpdateModel =
  mongoose.models.ComplaintUpdate ?? mongoose.model("ComplaintUpdate", ComplaintUpdateSchema);

