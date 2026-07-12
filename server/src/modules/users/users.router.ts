import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserModel } from "../../models/user.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel, type OfferDoc } from "../../models/offer.model.js";
import { incrementMetric } from "../../services/metric.service.js";
import { PaymentModel } from "../../models/payment.model.js";
import { EFormModel } from "../../models/eform.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { KycSubmissionModel, WalletModel, WalletTxnModel } from "../../models/kyc.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";

export const usersRouter = Router();

interface UserLean {
  _id: mongoose.Types.ObjectId;
  username?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  clinicId?: mongoose.Types.ObjectId;
  isActive?: boolean;
  referredBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  civilIdNumberMasked?: string;
  isConfirmationCallDone?: boolean;
  belmondoPlan?: "basic" | "pro";
  belmondoProExpiresAt?: Date;
  belmondoProCommitmentEndsAt?: Date;
  belmondoProPaymentType?: "monthly" | "advance";
}

interface ReferrerLean {
  _id: mongoose.Types.ObjectId;
  username?: string;
}

interface UserPatch {
  role?: string;
  isActive?: boolean;
  clinicId?: mongoose.Types.ObjectId;
  isConfirmationCallDone?: boolean;
}

const STAFF_ROLES = ["admin", "cs", "finance", "legal", "cs_director"] as const;

usersRouter.get("/admin", authRequired, requireRole([...STAFF_ROLES]), async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const role = typeof req.query.role === "string" ? req.query.role : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const filter: mongoose.FilterQuery<UserLean> = {};
    if (role && role !== "all") filter.role = role;
    if (status === "active") filter.isActive = true;
    if (status === "disabled") filter.isActive = false;

    const fromStr = typeof req.query.from === "string" ? req.query.from : undefined;
    const toStr = typeof req.query.to === "string" ? req.query.to : undefined;
    if (fromStr || toStr) {
      filter.createdAt = {};
      if (fromStr) filter.createdAt.$gte = new Date(fromStr);
      if (toStr) filter.createdAt.$lte = new Date(new Date(toStr).setUTCHours(23, 59, 59, 999));
    }

    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { fullName: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } }
      ];
    }

    const rows = await UserModel.find(filter).sort({ createdAt: -1 }).limit(500).lean<UserLean[]>();

    const referrerIds = [...new Set(
      rows.filter((u) => u.referredBy).map((u) => String(u.referredBy))
    )];
    const referrerMap: Record<string, string> = {};
    if (referrerIds.length) {
      const referrers = await UserModel.find(
        { _id: { $in: referrerIds } },
        { _id: 1, username: 1 }
      ).lean<ReferrerLean[]>();
      referrers.forEach((r) => { referrerMap[String(r._id)] = r.username ?? ""; });
    }

    const items = rows.map((u) => ({
      id: String(u._id),
      username: u.username,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      clinicId: u.clinicId ? String(u.clinicId) : undefined,
      isActive: u.isActive !== false,
      isConfirmationCallDone: u.isConfirmationCallDone ?? false,
      civilIdNumberMasked: u.civilIdNumberMasked,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : undefined,
      referredByUsername: u.referredBy ? (referrerMap[String(u.referredBy)] ?? null) : null
    }));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// Comprehensive user profile — admin / CS / finance
usersRouter.get("/admin/:id/profile", authRequired, requireRole([...STAFF_ROLES, "clinicStaff"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "INVALID_ID" });

    const [user, wallet, txns, kyc, memberships, payments, sessions, bookingSessions] = await Promise.all([
      UserModel.findById(id).lean<UserLean>(),
      WalletModel.findOne({ userId: id }).lean(),
      WalletTxnModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      KycSubmissionModel.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
      UserOfferModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
      PaymentModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      BookingRequestModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      BookingSessionModel.find({ userId: id }).sort({ scheduledAt: -1 }).lean()
    ]);

    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    // Enrich memberships & scheduled sessions with offer names
    const offerIds = [...new Set([
      ...memberships.map((m: any) => m.offerId ? String(m.offerId) : undefined),
      ...bookingSessions.map((s: any) => s.offerId ? String(s.offerId) : undefined),
      ...sessions.map((s: any) => s.offerId ? String(s.offerId) : undefined)
    ].filter(Boolean))];
    const offers = offerIds.length
      ? await OfferModel.find({ _id: { $in: offerIds } }).select("name nameAr maxSessions").lean<{ _id: mongoose.Types.ObjectId; name: string; nameAr?: string; maxSessions?: number }[]>()
      : [];
    const offerMap: Record<string, { name: string; nameAr?: string; maxSessions?: number }> = {};
    offers.forEach((o) => { offerMap[String(o._id)] = { name: o.name, nameAr: o.nameAr, maxSessions: o.maxSessions }; });

    // Enrich memberships with clinic names
    const membershipClinicIds = [...new Set(memberships.map((m: any) => m.clinicId ? String(m.clinicId) : undefined).filter(Boolean))].filter((cid) => mongoose.isValidObjectId(cid!));
    const membershipClinics = membershipClinicIds.length
      ? await ClinicModel.find({ _id: { $in: membershipClinicIds } }).select("nameEn nameAr").lean()
      : [];
    const membershipClinicMap: Record<string, { nameEn?: string; nameAr?: string }> = {};
    membershipClinics.forEach((c: any) => { membershipClinicMap[String(c._id)] = { nameEn: c.nameEn, nameAr: c.nameAr }; });

    const membershipItems = memberships.map((m: any) => {
      const clinicInfo: any = m.clinicId ? (membershipClinicMap[String(m.clinicId)] || {}) : {};
      return {
        id: String(m._id),
        offerId: String(m.offerId),
        offerName: offerMap[String(m.offerId)]?.name ?? "—",
        offerNameAr: offerMap[String(m.offerId)]?.nameAr,
        maxSessions: offerMap[String(m.offerId)]?.maxSessions,
        clinicId: m.clinicId ? String(m.clinicId) : undefined,
        clinicNameEn: clinicInfo.nameEn || undefined,
        clinicNameAr: clinicInfo.nameAr || undefined,
        status: m.status,
        purchaseMode: m.purchaseMode,
        sessionsUsed: m.sessionsUsed ?? 0,
        installmentCount: m.installmentCount,
        installmentsPaid: m.installmentsPaid ?? 0,
        paymentAmountKwd: m.paymentAmountKwd,
        activatedAt: m.activatedAt ? new Date(m.activatedAt).toISOString() : undefined,
        expiresAt: m.expiresAt ? new Date(m.expiresAt).toISOString() : undefined,
        createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
        installmentSchedule: m.installmentSchedule,
        nextInstallmentDueAt: m.nextInstallmentDueAt ? new Date(m.nextInstallmentDueAt).toISOString() : undefined,
        cashbackBalanceKwd: m.cashbackBalanceKwd,
        depositAmountKwd: m.depositAmountKwd,
        depositPaidAt: m.depositPaidAt ? new Date(m.depositPaidAt).toISOString() : undefined,
        reservationExpiresAt: m.reservationExpiresAt ? new Date(m.reservationExpiresAt).toISOString() : undefined,
      };
    });

    // Enrich payments with offer names
    const paymentOfferIds = [...new Set(payments.map((p: any) => p.offerId ? String(p.offerId) : undefined).filter(Boolean))];
    const paymentOffers = paymentOfferIds.length
      ? await OfferModel.find({ _id: { $in: paymentOfferIds } }).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string }[]>()
      : [];
    const paymentOfferMap: Record<string, string> = {};
    paymentOffers.forEach((o) => { paymentOfferMap[String(o._id)] = o.name; });

    const paymentItems = payments.map((p: any) => ({
      id: String(p._id),
      offerName: paymentOfferMap[String(p.offerId)] ?? "—",
      amountKwd: p.amountKwd,
      grossAmountKwd: p.grossAmountKwd,
      cashbackAppliedKwd: p.cashbackAppliedKwd,
      method: p.method,
      purpose: p.purpose,
      status: p.status,
      installmentNumber: p.installmentNumber,
      confirmedAt: p.confirmedAt ? new Date(p.confirmedAt).toISOString() : undefined,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
    }));

    const sessionItems = (sessions as any[]).map((s: any) => ({
      id: String(s._id),
      status: s.status,
      clinicId: s.clinicId,
      userOfferId: s.userOfferId ? String(s.userOfferId) : undefined,
      offerId: s.offerId ? String(s.offerId) : undefined,
      offerName: s.isStandalone ? s.standaloneName : (offerMap[String(s.offerId)]?.name ?? "—"),
      offerNameAr: s.isStandalone ? s.standaloneName : offerMap[String(s.offerId)]?.nameAr,
      requestedAt: s.createdAt ? new Date(s.createdAt).toISOString() : undefined,
    }));

    const bookingSessionsList = bookingSessions.map((s: any) => ({
      id: String(s._id),
      status: s.status,
      clinicId: s.clinicId ? String(s.clinicId) : undefined,
      userOfferId: s.userOfferId ? String(s.userOfferId) : undefined,
      offerId: s.offerId ? String(s.offerId) : undefined,
      offerName: offerMap[String(s.offerId)]?.name ?? "—",
      offerNameAr: offerMap[String(s.offerId)]?.nameAr,
      scheduledAt: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : undefined,
      shortId: s.shortId,
    }));

    const kycItem = kyc.length > 0 ? {
      id: String((kyc[0] as any)._id),
      status: (kyc[0] as any).status,
      civilIdNumberMasked: (kyc[0] as any).civilIdNumberMasked,
      civilIdFrontRef: (kyc[0] as any).civilIdFrontRef,
      civilIdBackRef: (kyc[0] as any).civilIdBackRef,
      signatureRef: (kyc[0] as any).signatureRef,
      createdAt: (kyc[0] as any).createdAt ? new Date((kyc[0] as any).createdAt).toISOString() : undefined,
      reviewedAt: (kyc[0] as any).reviewedAt ? new Date((kyc[0] as any).reviewedAt).toISOString() : undefined,
      rejectionReason: (kyc[0] as any).rejectionReason,
    } : null;

    const walletItem = wallet ? {
      unlockedKwd: (wallet as any).unlockedKwd,
      lockedKwd: (wallet as any).lockedKwd,
      ceilingKwd: (wallet as any).ceilingKwd,
      txns: (txns as any[]).map((t) => ({
        id: String(t._id),
        type: t.type,
        amountKwd: t.amountKwd,
        reason: t.reason,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined,
      }))
    } : null;

    return res.json({
      user: {
        id: String(user._id),
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive !== false,
        isConfirmationCallDone: user.isConfirmationCallDone ?? false,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
        belmondoPlan: user.belmondoPlan ?? "basic",
        belmondoProExpiresAt: user.belmondoProExpiresAt ? new Date(user.belmondoProExpiresAt).toISOString() : undefined,
        belmondoProCommitmentEndsAt: user.belmondoProCommitmentEndsAt ? new Date(user.belmondoProCommitmentEndsAt).toISOString() : undefined,
        belmondoProPaymentType: user.belmondoProPaymentType,
        staffNotes: (user as any).staffNotes?.map((n: any) => ({
          id: String(n._id),
          text: n.text,
          createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : undefined,
          authorName: n.authorName || "Staff"
        })) || []
      },
      wallet: walletItem,
      kyc: kycItem,
      memberships: membershipItems,
      payments: paymentItems,
      sessions: sessionItems,
      bookingSessions: bookingSessionsList,
    });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/admin/:id/notes", authRequired, requireRole([...STAFF_ROLES]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "INVALID_ID" });
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ error: "INVALID_TEXT" });
    }

    const me = await UserModel.findById(req.auth!.userId).lean() as any;
    const newNote = {
      text: text.trim(),
      createdAt: new Date(),
      authorId: req.auth!.userId,
      authorName: me ? (me.fullName || me.username || "Staff") : "Staff"
    };

    const updatedUser = await UserModel.findByIdAndUpdate(
      id,
      { $push: { staffNotes: newNote } },
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ error: "NOT_FOUND" });

    return res.json({ success: true, note: updatedUser.staffNotes?.[updatedUser.staffNotes.length - 1] });
  } catch (e) {
    next(e);
  }
});

// Per-user Excel export — admin / finance
usersRouter.get("/admin/:id/export", authRequired, requireRole(["admin", "finance", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "INVALID_ID" });

    const [user, memberships, payments, txns, bookingSessions, bookingRequests] = await Promise.all([
      UserModel.findById(id).lean<UserLean>(),
      UserOfferModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
      PaymentModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
      WalletTxnModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
      BookingSessionModel.find({ userId: id }).sort({ scheduledAt: -1 }).lean(),
      BookingRequestModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const offerIds = [...new Set([
      ...memberships.map((m: any) => m.offerId ? String(m.offerId) : undefined),
      ...payments.map((p: any) => p.offerId ? String(p.offerId) : undefined),
      ...bookingSessions.map((s: any) => s.offerId ? String(s.offerId) : undefined)
    ].filter(Boolean))];
    const offers = offerIds.length
      ? await OfferModel.find({ _id: { $in: offerIds } }).select("name nameAr").lean<{ _id: mongoose.Types.ObjectId; name: string; nameAr?: string }[]>()
      : [];
    const offerMap: Record<string, string> = {};
    offers.forEach((o) => { offerMap[String(o._id)] = o.nameAr ? `${o.name} - ${o.nameAr}` : o.name; });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Overview
    const overviewRows = [{
      "Full Name": user.fullName ?? "—",
      "Phone": user.phone ?? "—",
      "Email": user.email ?? "—",
      "Civil ID": user.civilIdNumberMasked ?? "—",
      "Role": user.role ?? "—",
      "Status": user.isActive ? "Active" : "Disabled",
      "Account Created": user.createdAt ? new Date(user.createdAt).toLocaleString() : "—",
      "Total Memberships": memberships.length,
      "Total Payments": payments.length,
      "Total Sessions": bookingSessions.length,
    }];
    const overviewSheet = XLSX.utils.json_to_sheet(overviewRows);
    overviewSheet["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, overviewSheet, "Overview");

    // Sheet 2: Memberships
    const membershipRows = memberships.map((m: any) => ({
      "Offer": offerMap[String(m.offerId)] ?? "—",
      "Status": m.status,
      "Purchase Mode": m.purchaseMode ?? "—",
      "Sessions Used": m.sessionsUsed ?? 0,
      "Installments Paid": `${m.installmentsPaid ?? 0} / ${m.installmentCount ?? "—"}`,
      "Amount (KWD)": m.paymentAmountKwd ?? "0.000",
      "Activated At": m.activatedAt ? new Date(m.activatedAt).toLocaleString() : "—",
      "Expires At": m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : "—",
      "Next Installment": m.nextInstallmentDueAt ? new Date(m.nextInstallmentDueAt).toLocaleDateString() : "—",
      "Membership ID": String(m._id),
    }));
    const membershipSheet = XLSX.utils.json_to_sheet(membershipRows);
    membershipSheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, membershipSheet, "Memberships");

    // Sheet 3: Sessions (BookingSessions)
    const sessionRows = bookingSessions.map((s: any) => ({
      "Offer": offerMap[String(s.offerId)] ?? "—",
      "Status": s.status,
      "Scheduled At": s.scheduledAt ? new Date(s.scheduledAt).toLocaleString() : "—",
      "Short ID": s.shortId ?? "—",
      "Clinic ID": s.clinicId ? String(s.clinicId) : "—",
      "Created At": s.createdAt ? new Date(s.createdAt).toLocaleString() : "—",
    }));
    const sessionSheet = XLSX.utils.json_to_sheet(sessionRows);
    sessionSheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, sessionSheet, "Sessions");

    // Sheet 4: Payments
    const paymentRows = payments.map((p: any) => ({
      "Offer": offerMap[String(p.offerId)] ?? "—",
      "Amount (KWD)": p.amountKwd ?? "0.000",
      "Gross (KWD)": p.grossAmountKwd ?? p.amountKwd ?? "0.000",
      "Cashback Applied (KWD)": p.cashbackAppliedKwd ?? "0.000",
      "Method": p.method,
      "Purpose": p.purpose,
      "Status": p.status,
      "Confirmed At": p.confirmedAt ? new Date(p.confirmedAt).toLocaleString() : "—",
      "Payment ID": String(p._id),
    }));
    const paymentSheet = XLSX.utils.json_to_sheet(paymentRows);
    paymentSheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, paymentSheet, "Payments");

    // Sheet 5: Cashback Transactions
    const txnRows = (txns as any[]).map((t) => ({
      "Type": t.type,
      "Amount (KWD)": t.amountKwd,
      "Reason": t.reason ?? "—",
      "Date": t.createdAt ? new Date(t.createdAt).toLocaleString() : "—",
      "Txn ID": String(t._id),
    }));
    const txnSheet = XLSX.utils.json_to_sheet(txnRows);
    txnSheet["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, txnSheet, "Cashback Txns");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const username = user.username ?? id;
    res.setHeader("Content-Disposition", `attachment; filename="user_${username}_report.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (e) {
    next(e);
  }
});

// All-users Excel export — admin / finance
usersRouter.get("/admin/export/all", authRequired, requireRole(["admin", "finance"]), async (req, res, next) => {
  try {
    const { exportComprehensiveReportXlsx } = await import("../reporting/analytics.service.js");
    const buf = await exportComprehensiveReportXlsx({}, { rtl: true });

    res.setHeader("Content-Disposition", `attachment; filename="belamonda_all_users_report.xlsx"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buf);
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const doc = await UserModel.findById(req.auth!.userId)
      .select("_id username email phone fullName gender")
      .lean() as any;
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({
      user: {
        id: String(doc._id),
        username: doc.username,
        email: doc.email,
        phone: doc.phone,
        fullName: doc.fullName,
        gender: doc.gender,
      }
    });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/me/subscription", authRequired, async (req, res, next) => {
  try {
    const { planId, paymentOption } = req.body;
    if (!planId && !paymentOption) {
      return res.status(400).json({ error: "Invalid subscription option" });
    }

    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const { SubscriptionPlanModel } = await import("../../models/subscriptionPlan.model.js");

    // Check if user already has a pending request
    const existing = await SubscriptionRequestModel.findOne({ userId: req.auth!.userId, status: "pending" });
    if (existing) {
      return res.status(400).json({ error: "You already have a pending subscription request." });
    }

    let amountKwd = "0.000";
    if (planId) {
      const plan = await SubscriptionPlanModel.findById(planId).lean() as any;
      if (!plan || !plan.isActive) return res.status(400).json({ error: "Invalid or inactive plan" });
      amountKwd = plan.price.toFixed(3);
    } else {
      amountKwd = paymentOption === "advance" ? "37.500" : "12.500";
    }

    const doc = await SubscriptionRequestModel.create({
      userId: req.auth!.userId,
      paymentOption,
      planId,
      amountKwd,
      status: "pending"
    });

    return res.json({ success: true, request: doc });
  } catch (e) {
    next(e);
  }
});

// Get my subscription request status
usersRouter.get("/me/subscription", authRequired, async (req, res, next) => {
  try {
    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const requests = await SubscriptionRequestModel.find({ userId: req.auth!.userId }).sort({ createdAt: -1 }).lean();
    return res.json({
      items: requests.map((r: any) => ({
        id: r._id.toString(),
        paymentOption: r.paymentOption,
        planId: r.planId,
        amountKwd: r.amountKwd,
        status: r.status,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt
      }))
    });
  } catch (e) {
    next(e);
  }
});

// CS/Admin: Get all subscription requests queue
usersRouter.get("/subscription-requests", authRequired, requireRole(["admin", "cs", "finance", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const status = req.query.status as string || "pending";
    const filter = status === "all" ? {} : { status };
    const items = await SubscriptionRequestModel.find(filter).sort({ createdAt: -1 }).lean();

    // Enrich with user info
    const userIds = [...new Set(items.map((i: any) => i.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } }).select("username fullName phone email").lean();
    const userMap: Record<string, any> = {};
    users.forEach((u: any) => { userMap[u._id.toString()] = u; });

    return res.json({
      items: items.map((r: any) => {
        const uId = r.userId?.toString();
        return {
          id: r._id.toString(),
          userId: r.userId,
          userName: (uId && userMap[uId]?.fullName) || (uId && userMap[uId]?.username) || "—",
          userPhone: (uId && userMap[uId]?.phone) || "—",
          paymentOption: r.paymentOption,
          planId: r.planId,
          amountKwd: r.amountKwd,
          status: r.status,
          rejectionReason: r.rejectionReason,
          createdAt: r.createdAt,
          reviewedAt: r.reviewedAt
        };
      })
    });
  } catch (e) {
    next(e);
  }
});

// CS/Admin: Mark subscription as paid → activate Pro
usersRouter.post("/subscription-requests/:id/approve", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const { SubscriptionPlanModel } = await import("../../models/subscriptionPlan.model.js");
    const { id } = req.params;

    const doc = await SubscriptionRequestModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "paid", reviewedBy: req.auth!.userId, reviewedAt: new Date() },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Request not found or already processed" });

    let monthsToAdd = doc.paymentOption === "advance" ? 3 : 1;
    let commitMonths = 3;
    let label = `Belmondo Pro Subscription (${doc.paymentOption || 'Legacy'})`;

    if (doc.planId) {
      const plan = await SubscriptionPlanModel.findById(doc.planId).lean() as any;
      if (plan) {
        monthsToAdd = plan.durationMonths;
        commitMonths = plan.minimumCommitmentMonths;
        label = `Belmondo Pro Subscription (${plan.nameEn})`;
      }
    }

    // Activate Pro subscription
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + monthsToAdd);

    const commitmentEndsAt = new Date();
    commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + commitMonths);

    const updateQuery: any = {
      belmondoPlan: "pro",
      belmondoProExpiresAt: expiresAt,
      belmondoProCommitmentEndsAt: commitmentEndsAt
    };

    if (doc.planId) updateQuery.belmondoProPlanId = doc.planId;
    if (doc.paymentOption) updateQuery.belmondoProPaymentType = doc.paymentOption;

    await UserModel.findByIdAndUpdate(doc.userId, { $set: updateQuery });

    const { PaymentModel } = await import("../../models/payment.model.js");
    await PaymentModel.create({
      userId: doc.userId,
      amountKwd: doc.amountKwd,
      grossAmountKwd: doc.amountKwd,
      method: "other",
      purpose: "manual_entry",
      provider: "cs",
      status: "paid",
      isManual: true,
      manualLabel: label,
      confirmedBy: req.auth!.userId,
      confirmedAt: new Date()
    });

    return res.json({ success: true, request: doc });
  } catch (e) {
    next(e);
  }
});

// CS/Admin: Reject subscription request
usersRouter.post("/subscription-requests/:id/reject", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const { id } = req.params;
    const { reason } = req.body;

    const doc = await SubscriptionRequestModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "rejected", rejectionReason: reason || "Rejected", reviewedBy: req.auth!.userId, reviewedAt: new Date() },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Request not found or already processed" });

    return res.json({ success: true, request: doc });
  } catch (e) {
    next(e);
  }
});

usersRouter.patch("/me", authRequired, async (req, res, next) => {
  try {
    const parsed = z
      .object({
        username: z.string().optional().or(z.literal("")),
        fullName: z.string().optional().or(z.literal("")),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().optional().or(z.literal("")),
        newPassword: z.string().min(6).optional().or(z.literal("")),
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const patch: Record<string, any> = {};
    if (parsed.data.username !== undefined) patch.username = parsed.data.username;
    if (parsed.data.fullName !== undefined) patch.fullName = parsed.data.fullName;
    if (parsed.data.email !== undefined) patch.email = parsed.data.email;
    if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
    if (parsed.data.newPassword) patch.passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

    const doc = await UserModel.findByIdAndUpdate(req.auth!.userId, patch, { new: true })
      .select("_id username email phone fullName")
      .lean() as any;
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    
    return res.json({
      user: {
        id: String(doc._id),
        username: doc.username,
        email: doc.email,
        phone: doc.phone,
        fullName: doc.fullName
      }
    });
  } catch (e: any) {
    if (e.code === 11000) {
      const field = Object.keys(e.keyValue || {})[0] || "field";
      return res.status(409).json({ error: `That ${field} is already in use by another account.` });
    }
    next(e);
  }
});

usersRouter.post("/admin/manual-enroll", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const enrollmentSchema = z.object({
      offerId: z.string().min(1),
      clinicId: z.string().optional(),
      purchaseMode: z.enum(["full", "installments", "deposit", "free", "discount"]).optional(),
      amountPaidKwd: z.string().optional(),
      method: z.enum(["bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "free_package", "other"]).optional(),
      isVerified: z.boolean().optional(),
      installmentCount: z.number().optional(),
      customInstallments: z.array(z.object({
        dueDate: z.string(),
        amountKwd: z.string(),
        isPaid: z.boolean(),
        method: z.string()
      })).optional(),
      historicalSessions: z.array(z.object({
        date: z.string()
      })).optional()
    });

    const parsed = z.object({
      userId: z.string().optional(),
      phone: z.string().min(1, "Phone is required"),
      fullName: z.string().min(1, "Name is required"),
      email: z.string().optional().or(z.literal("")),
      password: z.string().optional().or(z.literal("")),
      // Legacy single-offer fields (backward compat)
      offerId: z.string().optional(),
      clinicId: z.string().optional(),
      purchaseMode: z.enum(["full", "installments", "deposit", "free", "discount"]).optional(),
      amountPaidKwd: z.string().optional(),
      method: z.enum(["bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "free_package", "other"]).optional(),
      isVerified: z.boolean().optional(),
      installmentCount: z.number().optional(),
      historicalSessions: z.array(z.object({ date: z.string() })).optional(),
      // Multiple enrollments
      enrollments: z.array(enrollmentSchema).optional(),
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const d = parsed.data;

    let user: UserLean | null = null;
    if (d.userId && mongoose.isValidObjectId(d.userId)) {
      user = await UserModel.findById(d.userId).lean<UserLean>();
    }
    if (!user && d.phone) {
      user = await UserModel.findOne({ phone: d.phone }).lean<UserLean>();
    }
    if (!user) {
      const passwordHash = d.password
        ? await bcrypt.hash(d.password, 10)
        : await bcrypt.hash(d.phone, 10); // default password = phone number
      const created = await UserModel.create({
        phone: d.phone,
        fullName: d.fullName,
        username: d.phone,
        email: d.email || undefined,
        passwordHash,
        role: "customer",
        isActive: true,
      });
      await incrementMetric({ totalUsers: 1 });
      user = created.toObject() as UserLean;
    }

    // Build enrollments list: either from new enrollments[] array or legacy single offerId
    type EnrollmentItem = { offerId: string; clinicId?: string; purchaseMode?: string; amountPaidKwd?: string; method?: string; isVerified?: boolean; installmentCount?: number; customInstallments?: any[]; historicalSessions?: { date: string }[] };
    let enrollments: EnrollmentItem[] = [];
    if (d.enrollments && d.enrollments.length > 0) {
      enrollments = d.enrollments;
    } else if (d.offerId) {
      enrollments = [{ offerId: d.offerId, clinicId: d.clinicId, purchaseMode: d.purchaseMode, amountPaidKwd: d.amountPaidKwd, method: d.method, isVerified: d.isVerified, installmentCount: d.installmentCount, historicalSessions: d.historicalSessions }];
    }

    if (enrollments.length === 0) {
      return res.json({ message: "User created/found", user: { id: String(user._id), phone: user.phone, fullName: user.fullName } });
    }

    const results: any[] = [];
    const { applyOfferMembershipToUserOffer } = await import("../../services/userOffer.service.js");

    for (const en of enrollments) {
      const offer = await OfferModel.findById(en.offerId).lean() as any;
      if (!offer) { results.push({ offerId: en.offerId, error: "OFFER_NOT_FOUND" }); continue; }

      const now = new Date();
      const purchaseMode = en.purchaseMode || "full";
      const method = en.method || "cash";
      const isVerified = en.isVerified ?? true;
      const amountKwd = parseFloat(en.amountPaidKwd || "0").toFixed(3);

      let uoStatus = isVerified ? (purchaseMode === "deposit" ? "reserved" : "active") : "pending_payment";
      const expiresAt = new Date(now.getTime() + (offer.validityDays || 30) * 24 * 60 * 60 * 1000);

      let schedule: any[] = [];
      let calculatedTotalPaidKwd = 0;
      let installmentsPaidCount = 0;

      if (purchaseMode === "installments") {
        if (en.customInstallments && en.customInstallments.length > 0) {
          schedule = en.customInstallments.map((inst: any, i: number) => {
            const paid = inst.isPaid && isVerified;
            if (paid) {
              calculatedTotalPaidKwd += parseFloat(inst.amountKwd || "0");
              installmentsPaidCount++;
            }
            return {
              number: i + 1,
              amountKwd: parseFloat(inst.amountKwd || "0").toFixed(3),
              dueDate: new Date(inst.dueDate),
              paid,
              paidAt: paid ? now : null,
              method: inst.method
            };
          });
        } else {
          // fallback to old logic
          const count = en.installmentCount || 2;
          const total = parseFloat(offer.subscriptionPriceKwd || "0");
          const baseEach = Math.floor((total * 1000) / count) / 1000;
          const remainder = total - (baseEach * count);
          for (let i = 0; i < count; i++) {
            const amt = baseEach + (i === 0 ? remainder : 0);
            const paid = i === 0 && isVerified;
            if (paid) {
              calculatedTotalPaidKwd += amt;
              installmentsPaidCount++;
            }
            schedule.push({ number: i + 1, amountKwd: amt.toFixed(3), dueDate: new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000), paid, paidAt: paid ? now : null, method: paid ? method : undefined });
          }
        }
      }

      let finalAmountKwd = purchaseMode === "installments" 
        ? calculatedTotalPaidKwd.toFixed(3) 
        : amountKwd;
      let finalMethod = purchaseMode === "installments" ? "other" : method;

      if (purchaseMode === "free") {
        finalAmountKwd = "0.000";
        finalMethod = "free_package";
      }

      const uo = await UserOfferModel.create({
        userId: String(user._id), offerId: offer._id, clinicId: en.clinicId || undefined,
        status: uoStatus, purchaseMode, paymentMethod: finalMethod, paymentAmountKwd: finalAmountKwd, cashbackAppliedKwd: "0.000",
        installmentCount: purchaseMode === "installments" ? schedule.length : undefined,
        installmentsPaid: purchaseMode === "installments" ? installmentsPaidCount : 0,
        sessionsUsed: en.historicalSessions?.length || 0,
        installmentSchedule: purchaseMode === "installments" ? schedule : undefined,
        nextInstallmentDueAt: purchaseMode === "installments" ? schedule.find(s => !s.paid)?.dueDate : undefined,
        membershipType: offer.membershipType,
        activatedAt: (uoStatus === "active") ? now : undefined, expiresAt: (uoStatus === "active") ? expiresAt : undefined,
        paymentConfirmedBy: isVerified ? req.auth!.userId : undefined, paymentConfirmedAt: isVerified ? now : undefined,
      });

      let firstPaymentId = null;

      if (purchaseMode === "installments") {
        for (let i = 0; i < schedule.length; i++) {
          const inst = schedule[i];
          if (inst.paid) {
            const payment = await PaymentModel.create({
              userId: String(user._id), offerId: offer._id, userOfferId: uo._id,
              amountKwd: inst.amountKwd, grossAmountKwd: inst.amountKwd, cashbackAppliedKwd: "0.000", method: inst.method || "other",
              purpose: "installment",
              status: "paid", provider: "manual", isManual: true, manualLabel: "Admin Manual Enroll - Installment",
              confirmedBy: req.auth!.userId, confirmedAt: now,
              createdByUserId: req.auth!.userId, clinicId: en.clinicId || undefined,
              installmentNumber: inst.number,
            });
            schedule[i].paymentId = payment._id;
            if (!firstPaymentId) firstPaymentId = payment._id;
          }
        }
        await UserOfferModel.findByIdAndUpdate(uo._id, { $set: { installmentSchedule: schedule, paymentId: firstPaymentId } });
      } else {
        const payment = await PaymentModel.create({
          userId: String(user._id), offerId: offer._id, userOfferId: uo._id,
          amountKwd: finalAmountKwd, grossAmountKwd: finalAmountKwd, cashbackAppliedKwd: "0.000", method: finalMethod,
          purpose: purchaseMode === "deposit" ? "deposit" : "enrollment_full",
          status: isVerified ? "paid" : "payment_pending", provider: "manual", isManual: true, manualLabel: "Admin Manual Enroll",
          confirmedBy: isVerified ? req.auth!.userId : undefined, confirmedAt: isVerified ? now : undefined,
          createdByUserId: req.auth!.userId, clinicId: en.clinicId || undefined,
        });
        firstPaymentId = payment._id;
        await UserOfferModel.findByIdAndUpdate(uo._id, { $set: { paymentId: payment._id } });
      }

      // Historical sessions: only the sessionsUsed counter on UserOffer matters.
      // We no longer create BookingSession documents for historical sessions.

      await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));

      // Grant cashback for manual enrollments (same as regular checkout)
      if (isVerified && uoStatus === "active") {
        const { grantCashbackForPayment } = await import("../../services/checkout.service.js");
        if (purchaseMode === "installments") {
          // Grant proportionally for each paid installment
          for (let i = 0; i < installmentsPaidCount; i++) {
            await grantCashbackForPayment(String(user._id), offer, String(uo._id), i + 1, schedule.length);
          }
        } else {
          // Full payment — grant all at once
          await grantCashbackForPayment(String(user._id), offer, String(uo._id), 1, 1);
        }
      }

      results.push({ offerId: en.offerId, userOfferId: String(uo._id), paymentId: firstPaymentId ? String(firstPaymentId) : undefined });
    }

    return res.json({
      message: "Enrollment successful",
      user: { id: String(user._id), phone: user.phone, fullName: user.fullName },
      enrollments: results
    });
  } catch (e) {
    next(e);
  }
});

usersRouter.patch("/admin/:id", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const parsed = z
      .object({
        role: z.enum(["customer", "admin", "cs", "finance", "clinicStaff", "legal", "cs_director"]).optional(),
        isActive: z.boolean().optional(),
        clinicId: z.string().optional(),
        isConfirmationCallDone: z.boolean().optional()
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const before = await UserModel.findById(req.params.id)
      .select("_id username email phone role clinicId isActive isConfirmationCallDone").lean<UserLean>();
    if (!before) return res.status(404).json({ error: "NOT_FOUND" });

    const patch: UserPatch = {};
    if (parsed.data.role) patch.role = parsed.data.role;
    if (parsed.data.isActive != null) patch.isActive = parsed.data.isActive;
    if (parsed.data.isConfirmationCallDone != null) patch.isConfirmationCallDone = parsed.data.isConfirmationCallDone;
    if (parsed.data.clinicId != null) {
      patch.clinicId = parsed.data.clinicId ? new mongoose.Types.ObjectId(parsed.data.clinicId) : undefined;
    }

    const doc = await UserModel.findByIdAndUpdate(req.params.id, patch, { new: true })
      .select("_id username email phone role clinicId isActive isConfirmationCallDone")
      .lean<UserLean>();
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });

    // Determine action type
    let actionType = "update_user";
    if (parsed.data.isActive === false) actionType = "freeze_user";
    else if (parsed.data.isActive === true) actionType = "unfreeze_user";
    else if (parsed.data.role) actionType = "change_user_role";

    const { logAuditAction } = await import("../../services/audit.service.js");
    await logAuditAction({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role as any,
      actionType,
      targetEntityType: "User",
      targetEntityId: req.params.id,
      beforeState: { role: before.role, isActive: before.isActive !== false, isConfirmationCallDone: before.isConfirmationCallDone },
      afterState:  { role: doc.role,    isActive: doc.isActive !== false, isConfirmationCallDone: doc.isConfirmationCallDone },
      metadata: { username: doc.username ?? "" },
    });

    return res.json({
      user: {
        id: String(doc._id),
        username: doc.username,
        email: doc.email,
        phone: doc.phone,
        role: doc.role,
        clinicId: doc.clinicId ? String(doc.clinicId) : undefined,
        isActive: doc.isActive !== false,
        isConfirmationCallDone: doc.isConfirmationCallDone ?? false
      }
    });
  } catch (e) {
    next(e);
  }
});

usersRouter.patch("/admin/:id/subscription", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "INVALID_ID" });

    const parsed = z.object({
      plan: z.enum(["basic", "pro"]),
      planId: z.string().optional(),
      method: z.enum(["bank_transfer", "cash", "pos", "enet", "wallet", "free_package", "other"]).optional()
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    
    const { plan, planId, method } = parsed.data;

    const user = await UserModel.findById(id).lean<UserLean>();
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    if (plan === "pro") {
      if (!planId) return res.status(400).json({ error: "Plan ID is required for Pro plan." });
      if (!method) return res.status(400).json({ error: "Payment method is required." });

      const { SubscriptionPlanModel } = await import("../../models/subscriptionPlan.model.js");
      const subscriptionPlan = await SubscriptionPlanModel.findById(planId).lean() as any;
      if (!subscriptionPlan || !subscriptionPlan.isActive) {
         return res.status(400).json({ error: "Invalid or inactive subscription plan." });
      }

      const amountKwd = subscriptionPlan.price.toFixed(3);
      const now = new Date();
      
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + subscriptionPlan.durationMonths);
      
      const commitmentEndsAt = new Date(now);
      commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + subscriptionPlan.minimumCommitmentMonths);

      // Create payment ledger record
      await PaymentModel.create({
        userId: id,
        amountKwd,
        grossAmountKwd: amountKwd,
        cashbackAppliedKwd: "0.000",
        method,
        purpose: "manual_entry",
        manualLabel: `Belmondo Pro Subscription (${subscriptionPlan.nameEn})`,
        status: "paid",
        provider: "manual",
        isManual: true,
        confirmedBy: req.auth!.userId,
        confirmedAt: now,
        createdByUserId: req.auth!.userId
      });

      const updated = await UserModel.findByIdAndUpdate(id, {
        belmondoPlan: "pro",
        belmondoProPlanId: new mongoose.Types.ObjectId(planId),
        belmondoProExpiresAt: expiresAt,
        belmondoProCommitmentEndsAt: commitmentEndsAt
      }, { new: true }).lean<UserLean>();

      return res.json({ success: true, user: updated });
    } else {
      // Downgrade to basic
      const updated = await UserModel.findByIdAndUpdate(id, {
        belmondoPlan: "basic",
        $unset: { belmondoProPlanId: "", belmondoProPaymentType: "", belmondoProExpiresAt: "", belmondoProCommitmentEndsAt: "" }
      }, { new: true }).lean<UserLean>();

      return res.json({ success: true, user: updated });
    }
  } catch (e) {
    next(e);
  }
});

usersRouter.delete("/:id/all-data", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(500).json({ error: "DB_NOT_CONNECTED" });
    }

    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const collection = db.collection(col.name);
      await collection.deleteMany({ userId: id });
      await collection.deleteMany({ userId: objectId });
      
      // Also delete the user from the users collection itself
      if (col.name === "users") {
        await collection.deleteOne({ _id: objectId });
      }
    }

    return res.json({ success: true, message: "User and all related data deleted successfully." });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/admin/:id/recovery-link", authRequired, requireRole(["admin", "cs", "cs_director", "legal"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "INVALID_ID" });
    }

    const user = await UserModel.findById(id).lean();
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const payload = { userId: id, purpose: "recovery" };
    // Using a strong secret from env or fallback
    const secret = process.env.JWT_SECRET || "fallback_secret_change_me";
    const token = jwt.sign(payload, secret, { expiresIn: "24h" });

    const clientOrigin = process.env.CLIENT_ORIGIN || "https://belamonda.onrender.com";
    const recoveryUrl = `${clientOrigin}/recover-account?token=${token}`;

    return res.json({ success: true, url: recoveryUrl });
  } catch (e) {
    next(e);
  }
});
