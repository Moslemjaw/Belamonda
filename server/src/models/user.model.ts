import type { Role, VerificationStatus } from "@belamonda/shared";
import mongoose, { Schema, type Document, type Types } from "mongoose";
import { CounterModel } from "./counter.model.js";

export interface UserDoc extends Document {
  _id: Types.ObjectId;
  username?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  gender?: "female" | "male" | "other";
  passwordHash: string;
  role: Role;
  clinicId?: Types.ObjectId;
  isActive: boolean;
  referralCode?: string;
  referredBy?: Types.ObjectId;
  referralNotified: boolean;
  publicToken?: string;
  verificationStatus: VerificationStatus;
  civilIdNumberMasked?: string;
  createdAt: Date;
  updatedAt: Date;
  shortId?: string;
  belmondoPlan?: "basic" | "pro";
  belmondoProExpiresAt?: Date;
  belmondoProCommitmentEndsAt?: Date;
  belmondoProPaymentType?: "monthly" | "advance";
}

const UserSchema = new Schema(
  {
    username: { type: String, trim: true, lowercase: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    fullName: { type: String, trim: true },
    gender: { type: String, enum: ["female", "male", "other"] },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "admin", "cs", "finance", "clinicStaff", "legal"] satisfies Role[],
      required: true
    },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic" },
    isActive: { type: Boolean, default: true },
    referralCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User", index: true },
    referralNotified: { type: Boolean, default: false },
    publicToken: { type: String },
    verificationStatus: { type: String, enum: ["unverified", "pending", "approved", "rejected"], default: "unverified" },
    civilIdNumberMasked: { type: String },
    shortId: { type: String, trim: true, unique: true, sparse: true },
    belmondoPlan: { type: String, enum: ["basic", "pro"], default: "basic" },
    belmondoProExpiresAt: { type: Date },
    belmondoProCommitmentEndsAt: { type: Date },
    belmondoProPaymentType: { type: String, enum: ["monthly", "advance"] }
  },
  { timestamps: true }
);

UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1 }, { sparse: true });
UserSchema.index({ role: 1, clinicId: 1 });
UserSchema.index({ publicToken: 1 }, { unique: true, sparse: true });

UserSchema.pre("save", async function (next) {
  if (this.isNew && !this.shortId) {
    try {
      let counterId = "user_other";
      let prefix = "f";
      let startSeq = 10000000;
      
      if (this.role === "customer") {
        counterId = "user_customer";
        prefix = "u";
        startSeq = 20000000;
      }
      
      const counter = await CounterModel.findByIdAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      
      this.shortId = `${prefix}${startSeq + counter.seq}`;
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

export const UserModel = mongoose.models.User ?? mongoose.model<UserDoc>("User", UserSchema);
