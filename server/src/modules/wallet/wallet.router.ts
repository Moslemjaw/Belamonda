import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { kycStore } from "../kyc/kyc.store.js";

const KwdString = z.string().regex(/^\\d+(\\.\\d{3})$/);

const DeductSchema = z.object({
  userId: z.string().min(1),
  amountKwd: KwdString,
  reference: z.object({ kind: z.enum(["session", "userOffer"]), id: z.string().min(1) })
});

const AdminAdjustSchema = z.object({
  userId: z.string().min(1),
  amountKwd: z.string().regex(/^-?\\d+(\\.\\d{3})$/),
  reason: z.string().min(3)
});

export const walletRouter = Router();

walletRouter.get("/me", authRequired, (req, res) => {
  const wallet = kycStore.getWallet(req.auth!.userId);
  const txns = kycStore.listWalletTxns(req.auth!.userId);
  return res.json({ wallet, txns });
});

// CS applies unlocked cashback deduction (SRS §4.3.3, FR-21/22)
walletRouter.post("/cs/deduct", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const parsed = DeductSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const result = kycStore.deductUnlocked({
    userId: parsed.data.userId,
    amountKwd: parsed.data.amountKwd,
    reference: parsed.data.reference,
    createdBy: { kind: "cs", id: req.auth!.userId }
  });

  if ("error" in result) return res.status(409).json({ error: result.error });
  return res.json(result);
});

// Admin manual adjustment with mandatory reason (SRS FR-13)
walletRouter.post("/admin/adjust", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = AdminAdjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const result = kycStore.adjustUnlocked({
    userId: parsed.data.userId,
    amountKwd: parsed.data.amountKwd,
    reason: parsed.data.reason,
    createdById: req.auth!.userId
  });

  if ("error" in result) return res.status(409).json({ error: result.error });
  return res.json(result);
});

