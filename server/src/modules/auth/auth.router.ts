import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { signAccessToken } from "./token.js";
import { kycStore } from "../kyc/kyc.store.js";
import { registerCustomer, loginWithPassword, createStaffUserByAdmin } from "../../services/auth.service.js";

export const authRouter = Router();

const RegisterSchema = z.object({
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
  password: z.string().min(8)
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const r = await registerCustomer(parsed.data);
    if ("error" in r) return res.status(409).json({ error: r.error });

    // keep existing local wallet behavior for now
    kycStore.ensureUser(r.userId, r.role);
    const token = signAccessToken({ sub: r.userId, role: r.role as any });
    return res.status(201).json({ accessToken: token });
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

    kycStore.ensureUser(r.userId, r.role);
    const token = signAccessToken({ sub: r.userId, role: r.role as any });
    return res.json({ accessToken: token, role: r.role, userId: r.userId, clinicId: r.clinicId });
  } catch (e) {
    next(e);
  }
});

const AdminCreateUserSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  role: z.enum(["admin", "cs", "finance", "clinicStaff"]),
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

