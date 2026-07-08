import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { signAccessToken } from "./token.js";
import { kycStore } from "../kyc/kyc.store.js";
import { registerCustomer, loginWithPassword, createStaffUserByAdmin, requestPasswordReset, resetPasswordWithOTP } from "../../services/auth.service.js";

export const authRouter = Router();

const RegisterSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().min(6),
  fullName: z.string().min(2),
  gender: z.enum(["female", "male", "other"]).optional(),
  password: z.string().min(8),
  referralCode: z.string().optional()
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const r = await registerCustomer(parsed.data);
    if ("error" in r) return res.status(409).json({ error: r.error });

    // keep existing local wallet behavior for now
    await kycStore.ensureUser(r.userId, r.role);
    const token = signAccessToken({ sub: r.userId, role: r.role as any });
    return res.status(201).json({ accessToken: token, role: r.role, userId: r.userId });
  } catch (e) {
    next(e);
  }
});

const LoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1)
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const r = await loginWithPassword(parsed.data);
    if ("error" in r) return res.status(401).json({ error: r.error });

    await kycStore.ensureUser(r.userId, r.role);
    const token = signAccessToken({ sub: r.userId, role: r.role as any, clinicId: r.clinicId });
    return res.json({ accessToken: token, role: r.role, userId: r.userId, clinicId: r.clinicId });
  } catch (e) {
    next(e);
  }
});

const ForgotPasswordSchema = z.object({
  phone: z.string().min(6)
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const parsed = ForgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    await requestPasswordReset(parsed.data.phone);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const ResetPasswordSchema = z.object({
  phone: z.string().min(6),
  otp: z.string().min(6),
  newPassword: z.string().min(8)
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const parsed = ResetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const r = await resetPasswordWithOTP(parsed.data.phone, parsed.data.otp, parsed.data.newPassword);
    if ("error" in r) return res.status(400).json({ error: r.error });

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const AdminCreateUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(["admin", "cs", "finance", "clinicStaff", "legal", "cs_director"]),
  clinicId: z.string().optional()
});

authRouter.post("/admin/create-user", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = AdminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const r = await createStaffUserByAdmin(parsed.data);
    if ("error" in r) return res.status(409).json({ error: r.error });

    return res.status(201).json({ user: r });
  } catch (e) {
    next(e);
  }
});

const ImpersonateUserSchema = z.object({
  userId: z.string().min(1)
});

authRouter.post("/admin/impersonate-user", authRequired, requireRole(["admin", "finance", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = ImpersonateUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const { UserModel } = await import("../../models/user.model.js");
    const user = await (UserModel as any).findById(parsed.data.userId).select("role clinicId").lean() as any;
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const role = (user.role ?? "customer") as string;
    const clinicId: string | undefined = user.clinicId;
    const token = signAccessToken({ sub: parsed.data.userId, role: role as any, clinicId });

    return res.json({ accessToken: token, role, userId: parsed.data.userId, clinicId });
  } catch (e) {
    next(e);
  }
});

const ImpersonateSchema = z.object({
  clinicId: z.string().min(1)
});

authRouter.post("/admin/impersonate", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = ImpersonateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    
    const clinicId = parsed.data.clinicId;
    const { UserModel } = await import("../../models/user.model.js");
    const staffUser = await (UserModel as any).findOne({ clinicId, role: "clinicStaff" }).select("_id").lean() as any;
    
    const sub = staffUser ? String(staffUser._id) : `impersonated_${clinicId}`;
    const token = signAccessToken({ sub, role: "clinicStaff" as any, clinicId });
    
    return res.json({ accessToken: token, role: "clinicStaff", clinicId, userId: sub });
  } catch (e) {
    next(e);
  }
});

const RecoverAccountSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8)
});

authRouter.post("/recover-account", async (req, res, next) => {
  try {
    const parsed = RecoverAccountSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const jwt = await import("jsonwebtoken");
    const secret = process.env.JWT_SECRET || "fallback_secret_change_me";
    
    let decoded: any;
    try {
      decoded = jwt.verify(parsed.data.token, secret);
    } catch (err) {
      return res.status(400).json({ error: "INVALID_OR_EXPIRED_TOKEN" });
    }

    if (decoded.purpose !== "recovery" || !decoded.userId) {
      return res.status(400).json({ error: "INVALID_TOKEN_PURPOSE" });
    }

    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(parsed.data.newPassword, 10);
    
    const { UserModel } = await import("../../models/user.model.js");
    const user = await UserModel.findByIdAndUpdate(decoded.userId, { passwordHash });
    
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
