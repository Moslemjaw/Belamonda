import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface OtpDoc extends Document {
  _id: Types.ObjectId;
  phone: string;
  code: string;
  createdAt: Date;
}

const OtpSchema = new Schema(
  {
    phone: { type: String, required: true, trim: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 } // automatically delete after 10 minutes (600 seconds)
  }
);

OtpSchema.index({ phone: 1 });

export const OtpModel = mongoose.models.Otp ?? mongoose.model<OtpDoc>("Otp", OtpSchema);
