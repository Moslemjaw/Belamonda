import type { VerificationStatus } from "@belamonda/shared";
import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface KycCheckboxesDoc {
  termsAndConditions: boolean;
  dataPrivacyConsent: boolean;
  serviceLiabilityWaiver: boolean;
  age18Plus: boolean;
  paymentTermsAcknowledgment: boolean;
}

export interface KycSubmissionDoc extends Document {
  _id: Types.ObjectId;
  userId: string;
  status: "pending" | "approved" | "rejected";
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
  civilIdNumberMasked: string;
  civilIdFrontRef: string;
  civilIdBackRef: string;
  signatureRef: string;
  checkboxes: KycCheckboxesDoc;
  createdAt: Date;
  updatedAt: Date;
}

const KycCheckboxesSchema = new Schema(
  {
    termsAndConditions: { type: Boolean, required: true },
    dataPrivacyConsent: { type: Boolean, required: true },
    serviceLiabilityWaiver: { type: Boolean, required: true },
    age18Plus: { type: Boolean, required: true },
    paymentTermsAcknowledgment: { type: Boolean, required: true }
  },
  { _id: false }
);

const KycSubmissionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], required: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: String },
    rejectionReason: { type: String },
    civilIdNumberMasked: { type: String, required: true },
    civilIdFrontRef: { type: String, required: true },
    civilIdBackRef: { type: String, required: true },
    signatureRef: { type: String, required: true },
    checkboxes: { type: KycCheckboxesSchema, required: true }
  },
  { timestamps: true }
);

export const KycSubmissionModel = mongoose.models.KycSubmission ?? mongoose.model<KycSubmissionDoc>("KycSubmission", KycSubmissionSchema);

export interface WalletDoc extends Document {
  _id: Types.ObjectId;
  userId: string;
  ceilingKwd: string;
  lockedKwd: string;
  unlockedKwd: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    ceilingKwd: { type: String, default: "500.000" },
    lockedKwd: { type: String, default: "0.000" },
    unlockedKwd: { type: String, default: "0.000" }
  },
  { timestamps: true }
);

export const WalletModel = mongoose.models.Wallet ?? mongoose.model<WalletDoc>("Wallet", WalletSchema);

export interface WalletTxnDoc extends Document {
  _id: Types.ObjectId;
  userId: string;
  type: "unlock" | "deduction" | "adjustment" | "reversal" | "forfeited_due_to_ceiling" | "signup_bonus" | "offer_cashback_credit" | "installment_unlock";
  amountKwd: string;
  reference?: {
    kind: "session" | "userOffer" | "admin";
    id: string;
  };
  createdBy: {
    kind: "system" | "cs" | "admin";
    id: string;
  };
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WalletTxnSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["unlock", "deduction", "adjustment", "reversal", "forfeited_due_to_ceiling", "signup_bonus", "offer_cashback_credit", "installment_unlock"], required: true },
    amountKwd: { type: String, required: true },
    reference: {
      kind: { type: String, enum: ["session", "userOffer", "admin"] },
      id: { type: String }
    },
    createdBy: {
      kind: { type: String, enum: ["system", "cs", "admin"], required: true },
      id: { type: String, required: true }
    },
    reason: { type: String }
  },
  { timestamps: true }
);

export const WalletTxnModel = mongoose.models.WalletTxn ?? mongoose.model<WalletTxnDoc>("WalletTxn", WalletTxnSchema);
