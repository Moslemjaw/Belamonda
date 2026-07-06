import { Router } from "express";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { findPaymentByUserOffer, listPaymentsAdmin, sumCompletedPaymentsKwd } from "../../services/payment.service.js";
import { listPendingPaymentsQueue } from "../../services/userOffer.service.js";
import { listClinics } from "../../services/clinic.service.js";
import { listByClinic } from "../../services/bookingSession.service.js";
import * as offerService from "../../services/offer.service.js";
import { OfferModel } from "../../models/offer.model.js";
import { kycStore } from "../kyc/kyc.store.js";

export const dashboardsRouter = Router();

dashboardsRouter.get("/admin/payments", authRequired, requireRole(["admin", "finance"]), async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listPaymentsAdmin({ status, page, limit });
    return res.json(result);
  } catch (e) {
    next(e);
  }
});

dashboardsRouter.get("/finance/summary", authRequired, requireRole(["finance", "admin"]), async (_req, res, next) => {
  try {
    const [revenueKwd, pendingQueue, activeClinics, offersRes] = await Promise.all([
      sumCompletedPaymentsKwd(),
      listPendingPaymentsQueue(),
      listClinics({ activeOnly: true }),
      offerService.listOffersPublic({})
    ]);

    function parseKwdOuter(s: string) {
      const [a, b = "000"] = s.split(".");
      return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
    }

    // Batch fetch all offers for pending queue
    const pendingOfferIds = [...new Set(pendingQueue.map((uo: any) => uo.offerId).filter(Boolean))].filter((id) => mongoose.isValidObjectId(id));
    const pendingOffers = await OfferModel.find({ _id: { $in: pendingOfferIds } }).select("subscriptionPriceKwd").lean();
    const offerPriceMap = Object.fromEntries(pendingOffers.map((o: any) => [o._id.toString(), o.subscriptionPriceKwd]));

    let pendingMils = 0;
    for (const uo of pendingQueue) {
      const price = offerPriceMap[String(uo.offerId)];
      if (price) pendingMils += parseKwdOuter(price);
    }

    // Batch fetch all wallets for users
    const users = new Set<string>();
    for (const p of pendingQueue) users.add(p.userId);
    const recentSample = await listPaymentsAdmin({ limit: 100, page: 1 });
    for (const p of recentSample.items) {
      if (p.userId) users.add(p.userId);
    }

    const userIdsArr = Array.from(users);
    const { WalletModel, WalletTxnModel } = await import("../../models/kyc.model.js");
    const [wallets, txns] = await Promise.all([
      WalletModel.find({ userId: { $in: userIdsArr } }).lean(),
      WalletTxnModel.find({ userId: { $in: userIdsArr }, type: "deduction" }).select("amountKwd").lean()
    ]);

    let lockedMils = 0;
    let unlockedMils = 0;
    let utilizedMils = 0;
    for (const w of wallets as any[]) {
      lockedMils += parseKwdOuter(w.lockedKwd || "0.000");
      unlockedMils += parseKwdOuter(w.unlockedKwd || "0.000");
    }
    for (const t of txns as any[]) {
      utilizedMils += parseKwdOuter(t.amountKwd || "0.000");
    }

    function fmt(mils: number) {
      const a = Math.floor(Math.abs(mils) / 1000);
      const b = String(Math.abs(mils) % 1000).padStart(3, "0");
      return `${mils < 0 ? "-" : ""}${a}.${b}`;
    }

    const liabilityMils = lockedMils + unlockedMils - utilizedMils;

    return res.json({
      snapshot: {
        totalRevenue: revenueKwd,
        revenueKwd,
        pendingPaymentsKwd: fmt(pendingMils),
        pendingPaymentsCount: pendingQueue.length,
        totalCashbackLocked: fmt(lockedMils),
        totalCashbackUnlocked: fmt(unlockedMils),
        totalCashbackUtilized: fmt(utilizedMils),
        netCashbackLiabilityKwd: fmt(liabilityMils),
        sessionsToday: 0,
        sessionsThisMonth: 0,
        activeClinicsCount: activeClinics.length,
        activeOffersCount: offersRes.items.length
      }
    });
  } catch (e) {
    next(e);
  }
});

dashboardsRouter.get("/clinic/overview", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    let clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : "";
    if (req.auth!.role === "clinicStaff") {
      clinicId = req.auth!.clinicId ?? "";
    }
    if (!mongoose.isValidObjectId(clinicId)) {
      return res.status(400).json({ error: "INVALID_CLINIC_ID" });
    }
    const now = new Date();
    const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = await listByClinic(clinicId, from, to);
    const upcoming = sessions.filter((s) => s.status === "scheduled" && new Date(s.scheduledAt) >= now);

    const withPayments = await Promise.all(
      sessions.map(async (s) => ({
        session: s,
        payment: await findPaymentByUserOffer(s.userOfferId)
      }))
    );

    return res.json({
      clinicId,
      range: { from, to },
      counts: {
        sessionsInRange: sessions.length,
        upcomingScheduled: upcoming.length,
        completed: sessions.filter((s) => s.status === "completed").length
      },
      upcoming,
      sessionsWithPayments: withPayments
    });
  } catch (e) {
    next(e);
  }
});
