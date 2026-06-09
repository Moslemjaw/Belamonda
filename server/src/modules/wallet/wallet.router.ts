import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { kycStore } from "../kyc/kyc.store.js";
import { notifyCashbackUpdated } from "../notifications/notifications.service.js";

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

walletRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const w = await kycStore.getWallet(req.auth!.userId);
    const txns = await kycStore.listWalletTxns(req.auth!.userId);
    const wallet = w
      ? {
          userId: w.userId,
          unlockedBalance: w.unlockedKwd,
          lockedBalance: w.lockedKwd,
          ceiling: w.ceilingKwd,
          unlockedKwd: w.unlockedKwd,
          lockedKwd: w.lockedKwd,
          ceilingKwd: w.ceilingKwd,
          createdAt: w.createdAt
        }
      : null;
    return res.json({ wallet, txns });
  } catch (e) {
    next(e);
  }
});

// CS applies unlocked cashback deduction (SRS §4.3.3, FR-21/22)
walletRouter.post("/cs/deduct", authRequired, requireRole(["cs", "admin", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = DeductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const result = await kycStore.deductUnlocked({
      userId: parsed.data.userId,
      amountKwd: parsed.data.amountKwd,
      reference: parsed.data.reference,
      createdBy: { kind: "cs", id: req.auth!.userId }
    });

    if ("error" in result) return res.status(409).json({ error: result.error });

    const wallet = await kycStore.getWallet(parsed.data.userId);
    if (wallet) {
      notifyCashbackUpdated(
        parsed.data.userId,
        wallet.unlockedKwd,
        `-${parsed.data.amountKwd}`,
        `deducted by CS (ref: ${parsed.data.reference.id})`
      );
    }

    return res.json(result);
  } catch (e) {
    next(e);
  }
});

// Admin manual adjustment with mandatory reason (SRS FR-13)
walletRouter.post("/admin/adjust", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = AdminAdjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const result = await kycStore.adjustUnlocked({
      userId: parsed.data.userId,
      amountKwd: parsed.data.amountKwd,
      reason: parsed.data.reason,
      createdById: req.auth!.userId
    });

    if ("error" in result) return res.status(409).json({ error: result.error });

    const wallet = await kycStore.getWallet(parsed.data.userId);
    if (wallet) {
      notifyCashbackUpdated(
        parsed.data.userId,
        wallet.unlockedKwd,
        parsed.data.amountKwd,
        parsed.data.reason
      );
    }

    return res.json(result);
  } catch (e) {
    next(e);
  }
});
