import { Router } from "express";
import mongoose from "mongoose";
import QRCode from "qrcode";
import { getHomePayload } from "../../services/public.service.js";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserModel } from "../../models/user.model.js";
import { UserOfferModel, type UserOfferDoc } from "../../models/userOffer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { kycStore } from "../kyc/kyc.store.js";
import { randomBytes } from "crypto";

export const publicRouter = Router();

publicRouter.get("/home", async (_req, res, next) => {
  try {
    const payload = await getHomePayload();
    return res.json(payload);
  } catch (e) {
    next(e);
  }
});

interface UserCardFields {
  _id: mongoose.Types.ObjectId;
  username?: string;
  fullName?: string;
  role: string;
  publicToken?: string;
  createdAt?: Date;
}

interface PopulatedOffer extends Omit<UserOfferDoc, "offerId"> {
  offerId: { _id: mongoose.Types.ObjectId; name: string } | mongoose.Types.ObjectId;
}

function offerName(o: PopulatedOffer): string | null {
  if (o.offerId && typeof o.offerId === "object" && "name" in o.offerId) {
    return (o.offerId as { name: string }).name;
  }
  return null;
}

function offerIdStr(o: PopulatedOffer): string {
  if (o.offerId && typeof o.offerId === "object" && "_id" in o.offerId) {
    return String((o.offerId as { _id: mongoose.Types.ObjectId })._id);
  }
  return String(o.offerId);
}

async function buildFullCardData(user: UserCardFields) {
  const userId = String(user._id);

  const [activeOffers, recentSessions, activeSessionCount] = await Promise.all([
    UserOfferModel.find({ userId, status: "active" })
      .populate<{ offerId: { _id: mongoose.Types.ObjectId; name: string } }>("offerId", "name")
      .lean() as unknown as Promise<PopulatedOffer[]>,
    BookingSessionModel.find({ userId })
      .select("scheduledAt status completedAt")
      .sort({ scheduledAt: -1 })
      .limit(10)
      .lean<Array<{ _id: mongoose.Types.ObjectId; scheduledAt: Date; status: string; completedAt?: Date }>>(),
    BookingSessionModel.countDocuments({ userId, status: "scheduled" })
  ]);

  const kycUser = await kycStore.getUser(userId);
  const wallet = await kycStore.getWallet(userId);
  const displayName = user.fullName || user.username || "Member";

  return {
    userId,
    displayName,
    memberSince: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : null,
    kycVerified: kycUser?.verificationStatus === "approved",
    activeOffers: activeOffers.map((o) => ({
      offerId: offerIdStr(o),
      offerName: offerName(o),
      activatedAt: o.activatedAt ? new Date(o.activatedAt).toISOString().slice(0, 10) : null,
      expiresAt: o.expiresAt ? new Date(o.expiresAt).toISOString().slice(0, 10) : null,
      sessionsUsed: o.sessionsUsed ?? 0
    })),
    activeSessionCount,
    recentSessions: recentSessions.map((s) => ({
      scheduledAt: new Date(s.scheduledAt).toISOString().slice(0, 10),
      status: s.status,
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString().slice(0, 10) : null
    })),
    cashbackUnlockedKwd: wallet?.unlockedKwd ?? "0.000",
    cashbackLockedKwd: wallet?.lockedKwd ?? "0.000",
    publicToken: user.publicToken
  };
}

publicRouter.get("/qr/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    const base = typeof req.query.base === "string" ? req.query.base : "";

    if (!token || token.length < 10) return res.status(400).json({ error: "INVALID_TOKEN" });

    const user = await UserModel.findOne({ publicToken: token }).select("_id role").lean<{ _id: mongoose.Types.ObjectId; role: string }>();
    if (!user || user.role !== "customer") return res.status(404).json({ error: "NOT_FOUND" });

    const verifyUrl = base ? `${base}/verify/${token}` : `/verify/${token}`;
    const png = await QRCode.toBuffer(verifyUrl, { width: 300, margin: 2, color: { dark: "#1a1a1a", light: "#ffffff" } });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(png);
  } catch (e) {
    next(e);
  }
});

publicRouter.get("/customer/:token", async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) return res.status(400).json({ error: "INVALID_TOKEN" });

    const user = await UserModel.findOne({ publicToken: token })
      .select("_id username fullName role publicToken createdAt")
      .lean<UserCardFields>();

    if (!user || user.role !== "customer") return res.status(404).json({ error: "NOT_FOUND" });

    const userId = String(user._id);
    const [activeOfferCount, activeSessionCount] = await Promise.all([
      UserOfferModel.countDocuments({ userId, status: "active" }),
      BookingSessionModel.countDocuments({ userId, status: "scheduled" })
    ]);

    const kycUser = await kycStore.getUser(userId);
    const displayName = (user.fullName || user.username || "Member").split(" ")[0];

    return res.json({
      displayName,
      memberSince: user.createdAt ? new Date(user.createdAt).toISOString().slice(0, 10) : null,
      kycVerified: kycUser?.verificationStatus === "approved",
      activeOfferCount,
      activeSessionCount
    });
  } catch (e) {
    next(e);
  }
});

publicRouter.get("/me/card", authRequired, async (req, res, next) => {
  try {
    const userId = req.auth!.userId;

    let user = await UserModel.findById(userId)
      .select("_id username fullName publicToken createdAt role")
      .lean<UserCardFields>();

    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    if (!user.publicToken) {
      let token: string;
      let attempts = 0;
      do {
        token = randomBytes(20).toString("hex");
        attempts++;
      } while (attempts < 5 && (await UserModel.exists({ publicToken: token })));

      await UserModel.findByIdAndUpdate(userId, { $set: { publicToken: token } });
      user = { ...user, publicToken: token };
    }

    const card = await buildFullCardData(user);
    return res.json({ card });
  } catch (e) {
    next(e);
  }
});

publicRouter.get("/admin/customer/:userId/card", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: "INVALID_ID" });

    let user = await UserModel.findById(userId)
      .select("_id username fullName publicToken createdAt role")
      .lean<UserCardFields>();

    if (!user || user.role !== "customer") return res.status(404).json({ error: "NOT_FOUND" });

    if (!user.publicToken) {
      let token: string;
      let attempts = 0;
      do {
        token = randomBytes(20).toString("hex");
        attempts++;
      } while (attempts < 5 && (await UserModel.exists({ publicToken: token })));
      await UserModel.findByIdAndUpdate(userId, { $set: { publicToken: token } });
      user = { ...user, publicToken: token };
    }

    const card = await buildFullCardData(user);
    return res.json({ card });
  } catch (e) {
    next(e);
  }
});
