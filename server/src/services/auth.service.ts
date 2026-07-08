import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { UserModel } from "../models/user.model.js";
import { OtpModel } from "../models/otp.model.js";
import { sendSMS, sendWhatsAppOTP } from "./twilio.service.js";
import { incrementMetric } from "./metric.service.js";

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
    if (referrer) {
      referredBy = referrer._id;
    }
  }

  try {
    const searchConditions: any[] = [];
    if (input.username) searchConditions.push({ username: normUsername(input.username) });
    if (input.email) searchConditions.push({ email: normEmail(input.email) });
    if (input.phone) searchConditions.push({ phone: normIdentifier(input.phone) });

    if (searchConditions.length > 0) {
      const existingUser = await UserModel.findOne({ $or: searchConditions }).select("_id").lean();
      if (existingUser) {
        return { error: "DUPLICATE_IDENTIFIER" as const };
      }
    }

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
    
    // Only increment totalUsers for actual customers
    await incrementMetric({ totalUsers: 1 });
    
    return { ok: true as const, userId: doc._id.toString(), role: doc.role };
  } catch (e: unknown) {
    if ((e as { code?: number }).code === 11000) return { error: "DUPLICATE_IDENTIFIER" as const };
    throw e;
  }
}

export async function createStaffUserByAdmin(input: {
  username: string;
  password: string;
  role: "admin" | "cs" | "finance" | "clinicStaff" | "legal" | "cs_director";
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

export async function requestPasswordReset(phone: string) {
  const normPhone = normIdentifier(phone);
  
  // Strip +965 prefix for DB lookup (users may be stored with or without it)
  const barePhone = normPhone.replace(/^\+965/, "");
  const withPrefix = `+965${barePhone}`;
  
  // Try both formats to find the user
  const user = await UserModel.findOne({
    $or: [{ phone: normPhone }, { phone: barePhone }, { phone: withPrefix }]
  }).select("_id").lean();
  
  if (!user) {
    // For security reasons, don't reveal if user exists or not, just return success
    return { ok: true as const };
  }

  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  console.log(`[AUTH] Generated OTP for ${normPhone}: ${code}`);

  // Delete any existing OTPs for this phone to prevent spam
  await OtpModel.deleteMany({ phone: { $in: [normPhone, barePhone, withPrefix] } });

  // Save new OTP with the normalized phone (as sent from client)
  await OtpModel.create({ phone: normPhone, code });

  // Send WhatsApp OTP — Twilio requires E.164 format
  try {
    const e164Phone = withPrefix;
    await sendWhatsAppOTP(e164Phone, code);
    console.log("OTP WhatsApp dispatched to", e164Phone);
  } catch (err) {
    console.error("Failed to send OTP WhatsApp, falling back to SMS:", err);
    try {
      await sendSMS(withPrefix, `Your Belamonda OTP is: ${code}`);
      console.log("OTP SMS dispatched to", withPrefix);
    } catch (smsErr) {
      console.error("Failed to send OTP SMS as well:", smsErr);
    }
  }

  return { ok: true as const };
}

export async function resetPasswordWithOTP(phone: string, otp: string, newPassword: string) {
  const normPhone = normIdentifier(phone);
  const barePhone = normPhone.replace(/^\+965/, "");
  const withPrefix = `+965${barePhone}`;
  
  // Find OTP — try all phone formats
  const otpRecord = await OtpModel.findOne({
    phone: { $in: [normPhone, barePhone, withPrefix] },
    code: otp
  });
  if (!otpRecord) {
    return { error: "INVALID_OTP" as const };
  }

  // Find User — try all phone formats
  const user = await UserModel.findOne({
    $or: [{ phone: normPhone }, { phone: barePhone }, { phone: withPrefix }]
  });
  if (!user) {
    return { error: "USER_NOT_FOUND" as const };
  }

  // Update password
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();

  // Delete all OTPs for this phone
  await OtpModel.deleteMany({ phone: { $in: [normPhone, barePhone, withPrefix] } });

  return { ok: true as const };
}
