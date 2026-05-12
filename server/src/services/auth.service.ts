import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model.js";

interface ReferrerLean {
  _id: mongoose.Types.ObjectId;
  role: string;
}

interface LoginUserLean {
  _id: mongoose.Types.ObjectId;
  role: string;
  isActive?: boolean;
  passwordHash: string;
  clinicId?: mongoose.Types.ObjectId;
}

function normIdentifier(s: string) {
  return s.trim();
}

function normUsername(s: string) {
  return s.trim().toLowerCase();
}

function normEmail(s: string) {
  return s.trim().toLowerCase();
}

export async function registerCustomer(input: {
  username?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  gender?: "female" | "male" | "other";
  password: string;
  referralCode?: string;
}) {
  if (!input.username && !input.email && !input.phone) {
    return { error: "IDENTIFIER_REQUIRED" as const };
  }
  const passwordHash = await bcrypt.hash(input.password, 10);

  let referredBy: mongoose.Types.ObjectId | undefined;
  if (input.referralCode) {
    const referrer = await UserModel.findOne({
      referralCode: input.referralCode.trim().toUpperCase()
    }).select("_id role").lean<ReferrerLean>();
    if (referrer && referrer.role !== "customer") {
      referredBy = referrer._id;
    }
  }

  try {
    const doc = await UserModel.create({
      username: input.username ? normUsername(input.username) : undefined,
      email: input.email ? normEmail(input.email) : undefined,
      phone: input.phone ? normIdentifier(input.phone) : undefined,
      fullName: input.fullName?.trim() || undefined,
      gender: input.gender || undefined,
      passwordHash,
      role: "customer",
      isActive: true,
      referredBy,
      publicToken: randomBytes(20).toString("hex")
    });
    return { ok: true as const, userId: doc._id.toString(), role: doc.role };
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) return { error: "DUPLICATE_IDENTIFIER" as const };
    throw e;
  }
}

export async function createStaffUserByAdmin(input: {
  username: string;
  password: string;
  role: "admin" | "cs" | "finance" | "clinicStaff";
  clinicId?: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const clinicId =
    input.role === "clinicStaff" && input.clinicId && mongoose.isValidObjectId(input.clinicId)
      ? new mongoose.Types.ObjectId(input.clinicId)
      : undefined;

  try {
    const doc = await UserModel.create({
      username: normUsername(input.username),
      passwordHash,
      role: input.role,
      clinicId,
      isActive: true,
      publicToken: randomBytes(20).toString("hex")
    });
    return { ok: true as const, userId: doc._id.toString(), role: doc.role };
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) return { error: "DUPLICATE_IDENTIFIER" as const };
    throw e;
  }
}

export async function loginWithPassword(input: { identifier: string; password: string }) {
  const identifier = normIdentifier(input.identifier);
  const identLower = identifier.toLowerCase();
  const user = await UserModel.findOne({
    $or: [{ username: identLower }, { email: identLower }, { phone: identifier }]
  }).select("_id role isActive passwordHash clinicId").lean<LoginUserLean>();

  if (!user) return { error: "INVALID_CREDENTIALS" as const };
  if (user.isActive === false) return { error: "ACCOUNT_DISABLED" as const };

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) return { error: "INVALID_CREDENTIALS" as const };

  return {
    ok: true as const,
    userId: String(user._id),
    role: user.role,
    clinicId: user.clinicId ? String(user.clinicId) : undefined
  };
}

