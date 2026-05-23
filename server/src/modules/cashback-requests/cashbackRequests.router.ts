import { Router } from "express";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { CashbackRequestModel } from "../../models/cashbackRequest.model.js";
import { UserModel } from "../../models/user.model.js";
import { WalletModel } from "../../models/kyc.model.js";
import { kycStore } from "../kyc/kyc.store.js";
import { env } from "../../config/env.js";

cloudinary.config({
  cloud_name: "dyxzbgiic",
  api_key: "525168948871956",
  api_secret: "q4Qf-Y32H9yVJYm-G-m1ufJ15Ns"
});

export const cashbackRequestsRouter = Router();

async function uploadInvoiceToCloudinary(base64Image: string): Promise<string> {
  if (!base64Image.startsWith("data:image")) return base64Image;
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: "invoice_documents"
  });
  return result.secure_url;
}

cashbackRequestsRouter.post("/submit", authRequired, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const { invoiceAmountKwd, invoiceImageBase64 } = req.body;

    if (!invoiceAmountKwd || !invoiceImageBase64) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await UserModel.findById(userId).select("belmondoPlan belmondoProExpiresAt");
    if (!user || user.belmondoPlan !== "pro") {
      return res.status(403).json({ error: "Only Belmondo Pro users can submit invoices for cashback." });
    }

    // Check expiry
    if (user.belmondoProExpiresAt && new Date() > user.belmondoProExpiresAt) {
      return res.status(403).json({ error: "Your Belmondo Pro subscription has expired." });
    }

    const amount = parseFloat(invoiceAmountKwd);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid invoice amount" });
    }

    const cashbackAmount = (amount * 3).toFixed(3); // 3x Cashback!

    const invoiceImageRef = await uploadInvoiceToCloudinary(invoiceImageBase64);

    const doc = await CashbackRequestModel.create({
      userId,
      invoiceImageRef,
      invoiceAmountKwd: amount.toFixed(3),
      cashbackAmountKwd: cashbackAmount,
      status: "pending"
    });

    return res.json({ request: doc });
  } catch (e) {
    next(e);
  }
});

cashbackRequestsRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;
    const items = await CashbackRequestModel.find({ userId }).sort({ createdAt: -1 }).lean();
    
    return res.json({
      items: items.map((doc: any) => ({
        id: doc._id.toString(),
        invoiceImageRef: doc.invoiceImageRef,
        invoiceAmountKwd: doc.invoiceAmountKwd,
        cashbackAmountKwd: doc.cashbackAmountKwd,
        status: doc.status,
        rejectionReason: doc.rejectionReason,
        createdAt: doc.createdAt
      }))
    });
  } catch (e) {
    next(e);
  }
});

const LEGAL_ROLES = ["legal", "admin", "cs"] as const;

cashbackRequestsRouter.get("/legal/queue", authRequired, requireRole([...LEGAL_ROLES]), async (req, res, next) => {
  try {
    const status = req.query.status as string || "pending";
    const filter = status === "all" ? {} : { status };
    
    const items = await CashbackRequestModel.find(filter).sort({ createdAt: -1 }).lean();
    
    // Enrich with user info
    const userIds = [...new Set(items.map((i: any) => i.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } }).select("username fullName phone").lean();
    const wallets = await WalletModel.find({ userId: { $in: userIds } }).select("userId unlockedKwd").lean();
    const userMap: Record<string, any> = {};
    users.forEach((u: any) => { userMap[u._id.toString()] = u; });
    const walletMap: Record<string, string> = {};
    wallets.forEach((w: any) => { walletMap[w.userId] = w.unlockedKwd; });

    return res.json({
      items: items.map((doc: any) => {
        const uId = doc.userId?.toString();
        return {
          id: doc._id.toString(),
          userId: doc.userId,
          userName: (uId && userMap[uId]?.fullName) || (uId && userMap[uId]?.username) || "—",
          userPhone: (uId && userMap[uId]?.phone) || "—",
          userCashbackBalance: (uId && walletMap[uId]) || "0.000",
          invoiceImageRef: doc.invoiceImageRef,
          invoiceAmountKwd: doc.invoiceAmountKwd,
          cashbackAmountKwd: doc.cashbackAmountKwd,
          status: doc.status,
          rejectionReason: doc.rejectionReason,
          createdAt: doc.createdAt
        };
      })
    });
  } catch (e) {
    next(e);
  }
});

cashbackRequestsRouter.post("/legal/:id/approve", authRequired, requireRole([...LEGAL_ROLES]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid ID" });

    const { finalCashbackKwd } = req.body;
    const updatePayload: any = { status: "accepted", reviewedBy: req.auth!.userId, reviewedAt: new Date() };
    if (finalCashbackKwd) {
      updatePayload.cashbackAmountKwd = finalCashbackKwd;
    }

    const doc = await CashbackRequestModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      updatePayload,
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Request not found or not pending" });

    // Reward cashback
    const result = await kycStore.rewardInvoiceCashback({
      userId: doc.userId,
      amountKwd: doc.cashbackAmountKwd,
      requestId: doc._id.toString(),
      createdById: req.auth!.userId
    });

    if (result.error) {
      // Revert if wallet error
      await CashbackRequestModel.findByIdAndUpdate(id, { status: "pending", $unset: { reviewedBy: "", reviewedAt: "" } });
      return res.status(400).json({ error: result.error });
    }

    return res.json({ success: true, request: doc });
  } catch (e) {
    next(e);
  }
});

cashbackRequestsRouter.post("/legal/:id/reject", authRequired, requireRole([...LEGAL_ROLES]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "Invalid ID" });
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: "Rejection reason is required" });

    const doc = await CashbackRequestModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "rejected", rejectionReason: reason, reviewedBy: req.auth!.userId, reviewedAt: new Date() },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Request not found or not pending" });

    return res.json({ success: true, request: doc });
  } catch (e) {
    next(e);
  }
});
