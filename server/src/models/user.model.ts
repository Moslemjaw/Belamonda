import type { Role } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    username: { type: String, trim: true, lowercase: true, sparse: true },
    email: { type: String, trim: true, lowercase: true, sparse: true },
    phone: { type: String, trim: true, sparse: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "admin", "cs", "finance", "clinicStaff"] satisfies Role[],
      required: true
    },
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

UserSchema.index({ username: 1 }, { unique: true, sparse: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1, clinicId: 1 });

export const UserModel = mongoose.models.User ?? mongoose.model("User", UserSchema);
