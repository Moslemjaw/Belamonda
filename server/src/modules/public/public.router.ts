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
  civilIdNumberMasked?: string;
  belmondoPlan?: string;
  belmondoProExpiresAt?: Date;
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
    civilIdNumberMasked: user.civilIdNumberMasked ?? kycUser?.civilIdNumberMasked ?? null,
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
    publicToken: user.publicToken,
    belmondoPlan: user.belmondoPlan ?? "basic",
    belmondoProExpiresAt: user.belmondoProExpiresAt ? new Date(user.belmondoProExpiresAt).toISOString().slice(0, 10) : null
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
      .select("_id username fullName publicToken createdAt role civilIdNumberMasked belmondoPlan belmondoProExpiresAt")
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

publicRouter.get("/admin/customer/:userId/card", authRequired, requireRole(["admin", "cs", "legal"]), async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: "INVALID_ID" });

    let user = await UserModel.findById(userId)
      .select("_id username fullName publicToken createdAt role civilIdNumberMasked belmondoPlan belmondoProExpiresAt")
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

// ===========================================================================
// CLINIC SCANNER — look up customer by publicToken (for clinic QR scan)
// ===========================================================================

publicRouter.get("/clinic/scan/:token", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) return res.status(400).json({ error: "INVALID_TOKEN" });

    const user = await UserModel.findOne({ publicToken: token })
      .select("_id username fullName role publicToken createdAt phone email belmondoPlan belmondoProExpiresAt")
      .lean<UserCardFields & { phone?: string; email?: string }>();

    if (!user || user.role !== "customer") return res.status(404).json({ error: "CUSTOMER_NOT_FOUND" });

    const card = await buildFullCardData(user);
    const userId = String(user._id);

    // KYC documents
    const { KycSubmissionModel } = await import("../../models/kyc.model.js");
    const kycDocs = await KycSubmissionModel.find({ userId }).sort({ createdAt: -1 }).limit(1).lean();
    const kycDoc = kycDocs[0] as any;
    const kyc = kycDoc ? {
      status: kycDoc.status,
      civilIdNumberMasked: kycDoc.civilIdNumberMasked,
      civilIdFrontRef: kycDoc.civilIdFrontRef,
      civilIdBackRef: kycDoc.civilIdBackRef,
      signatureRef: kycDoc.signatureRef,
      createdAt: kycDoc.createdAt ? new Date(kycDoc.createdAt).toISOString() : null,
      reviewedAt: kycDoc.reviewedAt ? new Date(kycDoc.reviewedAt).toISOString() : null,
      rejectionReason: kycDoc.rejectionReason ?? null,
    } : null;

    // All memberships (not just active)
    const { OfferModel } = await import("../../models/offer.model.js");
    const allOffers = await UserOfferModel.find({ $or: [{ userId }, { sharedWith: userId }] })
      .sort({ createdAt: -1 }).lean();
    const offerIds = [...new Set(allOffers.map((o: any) => String(o.offerId)).filter(Boolean))];
    const offers = offerIds.length ? await OfferModel.find({ _id: { $in: offerIds } }).select("name nameAr cashbackPerSessionKwd").lean() : [];
    const offerMap: Record<string, any> = {};
    (offers as any[]).forEach((o: any) => { offerMap[String(o._id)] = o; });

    const memberships = allOffers.map((m: any) => ({
      id: String(m._id),
      offerId: String(m.offerId),
      offerName: offerMap[String(m.offerId)]?.name ?? "—",
      status: m.status,
      purchaseMode: m.purchaseMode,
      sessionsUsed: m.sessionsUsed ?? 0,
      maxSessions: m.maxSessions ?? null,
      installmentCount: m.installmentCount,
      installmentsPaid: m.installmentsPaid ?? 0,
      paymentAmountKwd: m.paymentAmountKwd,
      paymentMethod: m.paymentMethod,
      activatedAt: m.activatedAt ? new Date(m.activatedAt).toISOString().slice(0, 10) : null,
      expiresAt: m.expiresAt ? new Date(m.expiresAt).toISOString().slice(0, 10) : null,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : null,
    }));

    // Payment history
    const { PaymentModel } = await import("../../models/payment.model.js");
    const payments = await PaymentModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
    const paymentItems = (payments as any[]).map((p: any) => ({
      id: String(p._id),
      amountKwd: p.amountKwd,
      method: p.method,
      purpose: p.purpose,
      status: p.status,
      installmentNumber: p.installmentNumber ?? null,
      confirmedAt: p.confirmedAt ? new Date(p.confirmedAt).toISOString() : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    }));

    // Clinic-specific sessions for this customer
    const clinicId = req.auth!.clinicId;
    let clinicSessions: any[] = [];
    if (clinicId) {
      const sessions = await BookingSessionModel.find({
        userId,
        clinicId: mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : clinicId,
      })
        .populate<{ offerId: { _id: any; cashbackPerSessionKwd?: string } }>("offerId", "cashbackPerSessionKwd")
        .sort({ scheduledAt: -1 })
        .limit(20)
        .lean();

      clinicSessions = sessions.map((s: any) => ({
        id: s._id.toString(),
        scheduledAt: s.scheduledAt,
        status: s.status,
        notes: s.notes ?? null,
        completedAt: s.completedAt ?? null,
        cashbackUnlockedKwd: s.cashbackUnlockedKwd ?? null,
        maxSessionCashbackKwd: s.offerId?.cashbackPerSessionKwd ?? null,
      }));
    }

    // Also check booking requests for mark-paid
    const { BookingRequestModel } = await import("../../models/bookingRequest.model.js");
    let clinicBookings: any[] = [];
    if (clinicId) {
      const bookings = await BookingRequestModel.find({
        userId,
        clinicId: mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : clinicId,
      })
        .sort({ createdAt: -1 })
        .limit(20).lean();

      // BookingRequest.offerId is a String, not an ObjectId ref, so we manually look up offers
      const bookingOfferIds = [...new Set((bookings as any[]).map((b: any) => b.offerId).filter(Boolean))];
      const bookingOffers = bookingOfferIds.length
        ? await OfferModel.find({ _id: { $in: bookingOfferIds } }).select("cashbackPerSessionKwd name").lean()
        : [];
      const bookingOfferMap: Record<string, { cb: string; name: string }> = {};
      (bookingOffers as any[]).forEach((o: any) => { 
        bookingOfferMap[String(o._id)] = { 
          cb: o.cashbackPerSessionKwd ?? "0.000",
          name: o.name ?? ""
        }; 
      });

      clinicBookings = (bookings as any[]).map((b: any) => ({
        id: String(b._id),
        status: b.status,
        clinicPaymentStatus: b.clinicPaymentStatus ?? "pending",
        sessionPriceKwd: b.sessionPriceKwd ?? null,
        clinicTakeKwd: b.clinicTakeKwd ?? null,
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
        cashbackDeductedKwd: b.cashbackDeductedKwd ?? null,
        maxSessionCashbackKwd: b.cashbackDeductedKwd ?? bookingOfferMap[String(b.offerId)]?.cb ?? null,
        offerName: b.standaloneName || bookingOfferMap[String(b.offerId)]?.name || null,
      }));
    }

    let clinicProducts: any[] = [];
    if (clinicId) {
      const { ClinicSessionOfferingModel } = await import("../../models/clinicSessionOffering.model.js");
      const { SessionTypeModel } = await import("../../models/sessionType.model.js");
      
      const offerings = await ClinicSessionOfferingModel.find({ clinicId, isActive: true }).lean();
      const sessionTypeIds = offerings.map((o: any) => o.sessionTypeId);
      const sessionTypes = await SessionTypeModel.find({ _id: { $in: sessionTypeIds } }).lean();
      const stMap = new Map((sessionTypes as any[]).map((st) => [String(st._id), st]));

      clinicProducts = offerings.map((o: any) => {
        const st = stMap.get(String(o.sessionTypeId));
        return {
          id: String(o._id),
          name: st ? (st.nameAr || st.nameEn) : "Unknown",
          priceKwd: o.priceKwd || "0.000",
          cashbackDeductionKwd: o.cashbackDeductionKwd || "0.000"
        };
      });
    }

    return res.json({
      card: {
        ...card,
        phone: (user as any).phone ?? null,
        email: (user as any).email ?? null,
      },
      kyc,
      memberships,
      payments: paymentItems,
      clinicSessions,
      clinicBookings,
      clinicProducts,
    });
  } catch (e) {
    next(e);
  }
});

import { z } from "zod";

const AdjustWalletSchema = z.object({
  userId: z.string().min(1),
  amountKwd: z.string().min(1),
  reason: z.string().min(1)
});

publicRouter.post("/clinic/wallet/adjust", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const parsed = AdjustWalletSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });

    const { userId, amountKwd, reason } = parsed.data;

    const resAdjust = await kycStore.adjustUnlocked({
      userId,
      amountKwd,
      reason,
      createdById: req.auth!.userId
    });

    if (resAdjust && "error" in resAdjust) {
      return res.status(400).json({ error: resAdjust.error });
    }

    return res.json({ ok: true, wallet: resAdjust.wallet });
  } catch (e) {
    next(e);
  }
});

