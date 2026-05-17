import mongoose, { Schema } from "mongoose";

export const EFORM_FIELD_TYPES = [
  "short_text",
  "long_text",
  "single_choice",
  "multi_choice",
  "date",
  "signature",
  "file_upload",
  "static_text"
] as const;
export type EFormFieldType = (typeof EFORM_FIELD_TYPES)[number];

const FieldSchema = new Schema(
  {
    key: { type: String, required: true },
    type: { type: String, enum: EFORM_FIELD_TYPES, required: true },
    labelEn: { type: String, required: true },
    labelAr: { type: String },
    helpText: { type: String },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const TargetSchema = new Schema(
  {
    kind: { type: String, enum: ["offer", "installment_plan", "session_type"], required: true },
    refId: { type: String, required: true }
  },
  { _id: false }
);

const FormSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    titleAr: { type: String },
    description: { type: String },
    descriptionAr: { type: String },
    fields: { type: [FieldSchema], default: [] },
    targets: { type: [TargetSchema], default: [] },
    requireBeforeBooking: { type: Boolean, default: false },
    requireBeforeFirstPayment: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    createdBy: { type: String }
  },
  { timestamps: true }
);

FormSchema.index({ archived: 1, createdAt: -1 });
FormSchema.index({ "targets.kind": 1, "targets.refId": 1 });

export const EFormModel = mongoose.models.EForm ?? mongoose.model("EForm", FormSchema);
export type EFormDoc = mongoose.InferSchemaType<typeof FormSchema> & { _id: mongoose.Types.ObjectId };

// === Submission model ===

const AnswerSchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed }
  },
  { _id: false }
);

const SnapshotFieldSchema = new Schema(
  {
    key: { type: String, required: true },
    type: { type: String, enum: EFORM_FIELD_TYPES, required: true },
    labelEn: { type: String, required: true },
    labelAr: { type: String },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    order: { type: Number, default: 0 }
  },
  { _id: false }
);

const FormSubmissionSchema = new Schema(
  {
    formId: { type: Schema.Types.ObjectId, ref: "EForm", required: true, index: true },
    formVersion: { type: Number, required: true },
    formTitle: { type: String, required: true },
    formSnapshot: { type: [SnapshotFieldSchema], default: [] },
    userId: { type: String, required: true, index: true },
    userOfferId: { type: String },
    targetKind: { type: String, enum: ["offer", "installment_plan", "session_type", "ad_hoc"], default: "ad_hoc" },
    targetRefId: { type: String },
    answers: { type: [AnswerSchema], default: [] },
    signatureRef: { type: String },
    uploadedFileRefs: { type: [String], default: [] },
    ip: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

FormSubmissionSchema.index({ userId: 1, createdAt: -1 });
FormSubmissionSchema.index({ formId: 1, userId: 1, createdAt: -1 });

export const EFormSubmissionModel =
  mongoose.models.EFormSubmission ?? mongoose.model("EFormSubmission", FormSubmissionSchema);
export type EFormSubmissionDoc = mongoose.InferSchemaType<typeof FormSubmissionSchema> & {
  _id: mongoose.Types.ObjectId;
};
