import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ScanLogDoc extends Document {
  userId: string;
  scannedByUserId: string;
  clinicId: string;
  userOfferId?: string;
  offerName?: string;
  hadScheduledSession: boolean;
  status: "attended" | "no_scheduled_session";
  tokenUsed?: string;
  scannedAt?: Date;
  createdAt: Date;
}

const ScanLogSchema = new Schema<ScanLogDoc>(
  {
    userId: { type: String, required: true, index: true },
    scannedByUserId: { type: String, required: true },
    clinicId: { type: String, required: true, index: true },
    userOfferId: { type: String, index: true },
    offerName: { type: String },
    hadScheduledSession: { type: Boolean, default: false },
    status: { type: String, required: true, enum: ["attended", "no_scheduled_session"], index: true },
    tokenUsed: { type: String },
    scannedAt: { type: Date, default: Date.now }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ScanLogSchema.index({ clinicId: 1, createdAt: -1 });
ScanLogSchema.index({ userId: 1, createdAt: -1 });
ScanLogSchema.index({ createdAt: -1 });

export const ScanLogModel = mongoose.models.ScanLog ?? mongoose.model<ScanLogDoc>("ScanLog", ScanLogSchema);
