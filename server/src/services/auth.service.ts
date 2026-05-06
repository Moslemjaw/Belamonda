import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model.js";

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
  password: string;
}) {
  if (!input.username && !input.email && !input.phone) {
    return { error: "IDENTIFIER_REQUIRED" as const };
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const doc = await UserModel.create({
      username: input.username ? normUsername(input.username) : undefined,
      email: input.email ? normEmail(input.email) : undefined,
      phone: input.phone ? normIdentifier(input.phone) : undefined,
      passwordHash,
      role: "customer",
      isActive: true
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
      isActive: true
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
  const user = (await UserModel.findOne({
    $or: [{ username: identLower }, { email: identLower }, { phone: identifier }]
  }).lean()) as any;

  if (!user) return { error: "INVALID_CREDENTIALS" as const };
  if (user.isActive === false) return { error: "ACCOUNT_DISABLED" as const };

  const ok = await bcrypt.compare(input.password, String(user.passwordHash));
  if (!ok) return { error: "INVALID_CREDENTIALS" as const };

  return {
    ok: true as const,
    userId: String(user._id),
    role: user.role as string,
    clinicId: user.clinicId ? String(user.clinicId) : undefined
  };
}

