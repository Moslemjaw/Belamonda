import { Router } from "express";
import { z } from "zod";
import { signAccessToken } from "./token.js";

// Local-only MVP auth:
// - "login" accepts role + userId so we can build dashboards fast.
// - Later we’ll replace with phone/email OTP + refresh rotation + MFA (per SRS).

const LoginSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["customer", "admin", "cs", "finance", "clinicStaff"])
});

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const token = signAccessToken({ sub: parsed.data.userId, role: parsed.data.role });
  return res.json({ accessToken: token });
});

