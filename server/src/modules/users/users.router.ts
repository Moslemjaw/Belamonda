import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserModel } from "../../models/user.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { PaymentModel } from "../../models/payment.model.js";
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
}

const STAFF_ROLES = ["admin", "cs", "finance", "legal"] as const;

usersRouter.get("/admin", authRequired, requireRole([...STAFF_ROLES]), async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const role = typeof req.query.role === "string" ? req.query.role : "";
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const filter: mongoose.FilterQuery<UserLean> = {};
    if (role && role !== "all") filter.role = role;
    if (status === "active") filter.isActive = true;
    if (status === "disabled") filter.isActive = false;
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
usersRouter.get("/admin/:id/profile", authRequired, requireRole([...STAFF_ROLES]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "INVALID_ID" });

    const [user, wallet, txns, kyc, memberships, payments, sessions, bookingSessions] = await Promise.all([
      UserModel.findById(id).lean<UserLean>(),
      WalletModel.findOne({ userId: id }).lean(),
      WalletTxnModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      KycSubmissionModel.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
      UserOfferModel.find({ $or: [{ userId: id }, { sharedWith: id }] }).sort({ createdAt: -1 }).lean(),
      PaymentModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      BookingRequestModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      BookingSessionModel.find({ userId: id }).sort({ scheduledAt: -1 }).lean()
    ]);

    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    // Enrich memberships & scheduled sessions with offer names
    const offerIds = [...new Set([
      ...memberships.map((m: any) => String(m.offerId)),
      ...bookingSessions.map((s: any) => String(s.offerId))
    ].filter(Boolean))];
    const offers = offerIds.length
      ? await OfferModel.find({ _id: { $in: offerIds } }).select("name nameAr maxSessions").lean<{ _id: mongoose.Types.ObjectId; name: string; nameAr?: string; maxSessions?: number }[]>()
      : [];
    const offerMap: Record<string, { name: string; nameAr?: string; maxSessions?: number }> = {};
    offers.forEach((o) => { offerMap[String(o._id)] = { name: o.name, nameAr: o.nameAr, maxSessions: o.maxSessions }; });

    const membershipItems = memberships.map((m: any) => ({
      id: String(m._id),
      offerId: String(m.offerId),
      offerName: offerMap[String(m.offerId)]?.name ?? "—",
      offerNameAr: offerMap[String(m.offerId)]?.nameAr,
      maxSessions: offerMap[String(m.offerId)]?.maxSessions,
      clinicId: m.clinicId ? String(m.clinicId) : undefined,
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
    }));

    // Enrich payments with offer names
    const paymentOfferIds = [...new Set(payments.map((p: any) => String(p.offerId)).filter(Boolean))];
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
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive !== false,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : undefined,
        belmondoPlan: user.belmondoPlan ?? "basic",
        belmondoProExpiresAt: user.belmondoProExpiresAt ? new Date(user.belmondoProExpiresAt).toISOString() : undefined,
        belmondoProCommitmentEndsAt: user.belmondoProCommitmentEndsAt ? new Date(user.belmondoProCommitmentEndsAt).toISOString() : undefined,
        belmondoProPaymentType: user.belmondoProPaymentType
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

// Per-user Excel export — admin / finance
usersRouter.get("/admin/:id/export", authRequired, requireRole(["admin", "finance"]), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: "INVALID_ID" });

    const [user, memberships, payments, txns] = await Promise.all([
      UserModel.findById(id).lean<UserLean>(),
      UserOfferModel.find({ $or: [{ userId: id }, { sharedWith: id }] }).sort({ createdAt: -1 }).lean(),
      PaymentModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
      WalletTxnModel.find({ userId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const offerIds = [...new Set([
      ...memberships.map((m: any) => String(m.offerId)),
      ...payments.map((p: any) => String(p.offerId))
    ].filter(Boolean))];
    const offers = offerIds.length
      ? await OfferModel.find({ _id: { $in: offerIds } }).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string }[]>()
      : [];
    const offerMap: Record<string, string> = {};
    offers.forEach((o) => { offerMap[String(o._id)] = o.name; });

    const wb = XLSX.utils.book_new();

    // Sheet 1: Memberships
    const membershipRows = memberships.map((m: any) => ({
      "Membership ID": String(m._id),
      "Offer": offerMap[String(m.offerId)] ?? "—",
      "Status": m.status,
      "Purchase Mode": m.purchaseMode ?? "—",
      "Sessions Used": m.sessionsUsed ?? 0,
      "Installments Paid": m.installmentsPaid ?? 0,
      "Total Installments": m.installmentCount ?? "—",
      "Amount (KWD)": m.paymentAmountKwd ?? "—",
      "Activated": m.activatedAt ? new Date(m.activatedAt).toLocaleDateString() : "—",
      "Expires": m.expiresAt ? new Date(m.expiresAt).toLocaleDateString() : "—",
      "Created": m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membershipRows), "Memberships");

    // Sheet 2: Payments
    const paymentRows = payments.map((p: any) => ({
      "Payment ID": String(p._id),
      "Offer": offerMap[String(p.offerId)] ?? "—",
      "Amount (KWD)": p.amountKwd,
      "Gross (KWD)": p.grossAmountKwd ?? p.amountKwd,
      "Cashback Applied (KWD)": p.cashbackAppliedKwd ?? "0.000",
      "Method": p.method,
      "Purpose": p.purpose,
      "Status": p.status,
      "Installment #": p.installmentNumber ?? "—",
      "Confirmed At": p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString() : "—",
      "Created": (p as any).createdAt ? new Date((p as any).createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), "Payments");

    // Sheet 3: Cashback Transactions
    const txnRows = (txns as any[]).map((t) => ({
      "Txn ID": String(t._id),
      "Type": t.type,
      "Amount (KWD)": t.amountKwd,
      "Reason": t.reason ?? "—",
      "Date": t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), "Cashback Txns");

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
    const users = await UserModel.find({}).sort({ createdAt: -1 }).lean<UserLean[]>();
    const payments = await PaymentModel.find({ status: "completed" }).sort({ createdAt: -1 }).lean();
    const memberships = await UserOfferModel.find({}).sort({ createdAt: -1 }).lean();
    const txns = await WalletTxnModel.find({}).sort({ createdAt: -1 }).lean();

    // Build user lookup map for enriching other sheets
    const userMap: Record<string, { fullName: string; phone: string; username: string }> = {};
    users.forEach((u) => {
      userMap[String(u._id)] = {
        fullName: u.fullName ?? u.username ?? "—",
        phone: u.phone ?? "—",
        username: u.username ?? "—",
      };
    });

    const offerIds = [...new Set([
      ...memberships.map((m: any) => String(m.offerId)),
      ...payments.map((p: any) => String(p.offerId))
    ].filter(Boolean))];
    const offers = offerIds.length
      ? await OfferModel.find({ _id: { $in: offerIds } }).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string }[]>()
      : [];
    const offerMap: Record<string, string> = {};
    offers.forEach((o) => { offerMap[String(o._id)] = o.name; });

    const wb = XLSX.utils.book_new();

    // Sheet 1: All Users
    const userRows = users.map((u) => ({
      "User ID": String(u._id),
      "Full Name": u.fullName ?? "—",
      "Username": u.username ?? "—",
      "Phone": u.phone ?? "—",
      "Email": u.email ?? "—",
      "Role": u.role ?? "—",
      "Status": u.isActive !== false ? "Active" : "Disabled",
      "Joined": u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userRows), "Users");

    // Sheet 2: All Memberships
    const membershipRows = memberships.map((m: any) => ({
      "Membership ID": String(m._id),
      "User ID": m.userId,
      "Full Name": userMap[m.userId]?.fullName ?? "—",
      "Phone": userMap[m.userId]?.phone ?? "—",
      "Offer": offerMap[String(m.offerId)] ?? "—",
      "Status": m.status,
      "Purchase Mode": m.purchaseMode ?? "—",
      "Sessions Used": m.sessionsUsed ?? 0,
      "Installments Paid": m.installmentsPaid ?? 0,
      "Total Installments": m.installmentCount ?? "—",
      "Amount (KWD)": m.paymentAmountKwd ?? "—",
      "Activated": m.activatedAt ? new Date(m.activatedAt).toLocaleDateString() : "—",
      "Created": m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membershipRows), "Memberships");

    // Sheet 3: All Payments
    const paymentRows = payments.map((p: any) => ({
      "Payment ID": String(p._id),
      "User ID": p.userId,
      "Full Name": userMap[p.userId]?.fullName ?? "—",
      "Phone": userMap[p.userId]?.phone ?? "—",
      "Offer": offerMap[String(p.offerId)] ?? "—",
      "Amount (KWD)": p.amountKwd,
      "Gross (KWD)": p.grossAmountKwd ?? p.amountKwd,
      "Cashback Applied (KWD)": p.cashbackAppliedKwd ?? "0.000",
      "Method": p.method,
      "Purpose": p.purpose,
      "Status": p.status,
      "Confirmed At": p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString() : "—",
      "Created": p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paymentRows), "Payments");

    // Sheet 4: Cashback Transactions
    const txnRows = (txns as any[]).map((t) => ({
      "Txn ID": String(t._id),
      "User ID": t.userId,
      "Full Name": userMap[t.userId]?.fullName ?? "—",
      "Phone": userMap[t.userId]?.phone ?? "—",
      "Type": t.type,
      "Amount (KWD)": t.amountKwd,
      "Reason": t.reason ?? "—",
      "Date": t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows), "Cashback Txns");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
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
    const { paymentOption } = req.body;
    if (paymentOption !== "monthly" && paymentOption !== "advance") {
      return res.status(400).json({ error: "Invalid payment option" });
    }

    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");

    // Check if user already has a pending request
    const existing = await SubscriptionRequestModel.findOne({ userId: req.auth!.userId, status: "pending" });
    if (existing) {
      return res.status(400).json({ error: "You already have a pending subscription request." });
    }

    const amountKwd = paymentOption === "advance" ? "37.500" : "12.500";

    const doc = await SubscriptionRequestModel.create({
      userId: req.auth!.userId,
      paymentOption,
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
usersRouter.get("/subscription-requests", authRequired, requireRole(["admin", "cs", "finance"]), async (req, res, next) => {
  try {
    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const status = req.query.status as string || "pending";
    const filter = status === "all" ? {} : { status };
    const items = await SubscriptionRequestModel.find(filter).sort({ createdAt: -1 }).lean();

    // Enrich with user info
    const userIds = [...new Set(items.map((i: any) => i.userId))];
    const users = await UserModel.find({ _id: { $in: userIds } }).select("username phone email").lean();
    const userMap: Record<string, any> = {};
    users.forEach((u: any) => { userMap[u._id.toString()] = u; });

    return res.json({
      items: items.map((r: any) => ({
        id: r._id.toString(),
        userId: r.userId,
        userName: userMap[r.userId]?.username || "—",
        userPhone: userMap[r.userId]?.phone || "—",
        paymentOption: r.paymentOption,
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

// CS/Admin: Mark subscription as paid → activate Pro
usersRouter.post("/subscription-requests/:id/approve", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
  try {
    const { SubscriptionRequestModel } = await import("../../models/subscriptionRequest.model.js");
    const { id } = req.params;

    const doc = await SubscriptionRequestModel.findOneAndUpdate(
      { _id: id, status: "pending" },
      { status: "paid", reviewedBy: req.auth!.userId, reviewedAt: new Date() },
      { new: true }
    );

    if (!doc) return res.status(404).json({ error: "Request not found or already processed" });

    // Activate Pro subscription
    const monthsToAdd = doc.paymentOption === "advance" ? 3 : 1;
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + monthsToAdd);

    const commitmentEndsAt = new Date();
    commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + 3);

    await UserModel.findByIdAndUpdate(doc.userId, {
      $set: {
        belmondoPlan: "pro",
        belmondoProPaymentType: doc.paymentOption,
        belmondoProExpiresAt: expiresAt,
        belmondoProCommitmentEndsAt: commitmentEndsAt
      }
    });

    const { PaymentModel } = await import("../../models/payment.model.js");
    await PaymentModel.create({
      userId: doc.userId,
      amountKwd: doc.amountKwd,
      grossAmountKwd: doc.amountKwd,
      method: "other",
      purpose: "manual_entry",
      provider: "cs",
      status: "completed",
      isManual: true,
      manualLabel: `Belmondo Pro Subscription (${doc.paymentOption})`,
      confirmedBy: req.auth!.userId,
      confirmedAt: new Date()
    });

    return res.json({ success: true, request: doc });
  } catch (e) {
    next(e);
  }
});

// CS/Admin: Reject subscription request
usersRouter.post("/subscription-requests/:id/reject", authRequired, requireRole(["admin", "cs"]), async (req, res, next) => {
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
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/admin/manual-enroll", authRequired, requireRole(["admin", "cs", "legal"]), async (req, res, next) => {
  try {
    const enrollmentSchema = z.object({
      offerId: z.string().min(1),
      clinicId: z.string().optional(),
      purchaseMode: z.enum(["full", "installments", "deposit"]).optional(),
      amountPaidKwd: z.string().optional(),
      method: z.enum(["bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "other"]).optional(),
      isVerified: z.boolean().optional(),
      installmentCount: z.number().optional()
    });

    const parsed = z.object({
      phone: z.string().min(1, "Phone is required"),
      fullName: z.string().min(1, "Name is required"),
      email: z.string().optional().or(z.literal("")),
      password: z.string().optional().or(z.literal("")),
      // Legacy single-offer fields (backward compat)
      offerId: z.string().optional(),
      clinicId: z.string().optional(),
      purchaseMode: z.enum(["full", "installments", "deposit"]).optional(),
      amountPaidKwd: z.string().optional(),
      method: z.enum(["bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "other"]).optional(),
      isVerified: z.boolean().optional(),
      installmentCount: z.number().optional(),
      // Multiple enrollments
      enrollments: z.array(enrollmentSchema).optional(),
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const d = parsed.data;

    let user = await UserModel.findOne({ phone: d.phone }).lean<UserLean>();
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
      user = created.toObject() as UserLean;
    }

    // Build enrollments list: either from new enrollments[] array or legacy single offerId
    type EnrollmentItem = { offerId: string; clinicId?: string; purchaseMode?: string; amountPaidKwd?: string; method?: string; isVerified?: boolean; installmentCount?: number };
    let enrollments: EnrollmentItem[] = [];
    if (d.enrollments && d.enrollments.length > 0) {
      enrollments = d.enrollments;
    } else if (d.offerId) {
      enrollments = [{ offerId: d.offerId, clinicId: d.clinicId, purchaseMode: d.purchaseMode, amountPaidKwd: d.amountPaidKwd, method: d.method, isVerified: d.isVerified, installmentCount: d.installmentCount }];
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
      const paymentStatus = isVerified ? "completed" : "pending";
      const expiresAt = new Date(now.getTime() + (offer.validityDays || 30) * 24 * 60 * 60 * 1000);

      let schedule: any[] = [];
      if (purchaseMode === "installments") {
        const count = en.installmentCount === 3 ? 3 : 2;
        const total = parseFloat(offer.subscriptionPriceKwd || "0");
        const baseEach = Math.floor((total * 1000) / count) / 1000;
        const remainder = total - (baseEach * count);
        for (let i = 0; i < count; i++) {
          const amt = baseEach + (i === 0 ? remainder : 0);
          schedule.push({ number: i + 1, amountKwd: amt.toFixed(3), dueDate: new Date(now.getTime() + i * 30 * 24 * 60 * 60 * 1000), paid: i === 0 && isVerified, paidAt: (i === 0 && isVerified) ? now : null });
        }
      }

      const uo = await UserOfferModel.create({
        userId: String(user._id), offerId: offer._id, clinicId: en.clinicId || undefined,
        status: uoStatus, purchaseMode, paymentMethod: method, paymentAmountKwd: amountKwd, cashbackAppliedKwd: "0.000",
        installmentCount: purchaseMode === "installments" ? (en.installmentCount === 3 ? 3 : 2) : undefined,
        installmentsPaid: (purchaseMode === "installments" && isVerified) ? 1 : 0,
        installmentSchedule: purchaseMode === "installments" ? schedule : undefined,
        nextInstallmentDueAt: purchaseMode === "installments" ? schedule[isVerified ? 1 : 0]?.dueDate : undefined,
        membershipType: offer.membershipType,
        activatedAt: (uoStatus === "active") ? now : undefined, expiresAt: (uoStatus === "active") ? expiresAt : undefined,
        paymentConfirmedBy: isVerified ? req.auth!.userId : undefined, paymentConfirmedAt: isVerified ? now : undefined,
      });

      const payment = await PaymentModel.create({
        userId: String(user._id), offerId: offer._id, userOfferId: uo._id,
        amountKwd, grossAmountKwd: amountKwd, cashbackAppliedKwd: "0.000", method,
        purpose: purchaseMode === "installments" ? "installment" : (purchaseMode === "deposit" ? "deposit" : "enrollment_full"),
        status: paymentStatus, provider: "manual", isManual: true, manualLabel: "Admin Manual Enroll",
        confirmedBy: isVerified ? req.auth!.userId : undefined, confirmedAt: isVerified ? now : undefined,
        createdByUserId: req.auth!.userId, clinicId: en.clinicId || undefined,
        installmentNumber: purchaseMode === "installments" ? 1 : undefined,
      });

      if (purchaseMode === "installments" && isVerified && schedule.length > 0) {
        schedule[0].paymentId = payment._id;
        await UserOfferModel.findByIdAndUpdate(uo._id, { $set: { installmentSchedule: schedule, paymentId: payment._id } });
      } else if (uoStatus === "active" || uoStatus === "reserved") {
        await UserOfferModel.findByIdAndUpdate(uo._id, { $set: { paymentId: payment._id } });
      }

      await applyOfferMembershipToUserOffer(String(uo._id), String(offer._id));
      results.push({ offerId: en.offerId, userOfferId: String(uo._id), paymentId: String(payment._id) });
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

usersRouter.patch("/admin/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const parsed = z
      .object({
        role: z.enum(["customer", "admin", "cs", "finance", "clinicStaff", "legal"]).optional(),
        isActive: z.boolean().optional(),
        clinicId: z.string().optional()
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const before = await UserModel.findById(req.params.id)
      .select("_id username email phone role clinicId isActive").lean<UserLean>();
    if (!before) return res.status(404).json({ error: "NOT_FOUND" });

    const patch: UserPatch = {};
    if (parsed.data.role) patch.role = parsed.data.role;
    if (parsed.data.isActive != null) patch.isActive = parsed.data.isActive;
    if (parsed.data.clinicId != null) {
      patch.clinicId = parsed.data.clinicId ? new mongoose.Types.ObjectId(parsed.data.clinicId) : undefined;
    }

    const doc = await UserModel.findByIdAndUpdate(req.params.id, patch, { new: true })
      .select("_id username email phone role clinicId isActive")
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
      beforeState: { role: before.role, isActive: before.isActive !== false },
      afterState:  { role: doc.role,    isActive: doc.isActive !== false },
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
        isActive: doc.isActive !== false
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
      paymentOption: z.enum(["monthly", "advance"]).optional(),
      method: z.enum(["bank_transfer", "cash", "pos", "enet", "wallet", "other"]).optional()
    }).safeParse(req.body);

    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    
    const { plan, paymentOption, method } = parsed.data;

    const user = await UserModel.findById(id).lean<UserLean>();
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    if (plan === "pro") {
      if (!paymentOption) return res.status(400).json({ error: "Payment option is required for Pro plan." });
      if (!method) return res.status(400).json({ error: "Payment method is required." });

      const amountKwd = paymentOption === "monthly" ? "12.500" : "37.500";
      const now = new Date();
      const expiresAt = new Date(now);
      if (paymentOption === "monthly") {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 3);
      }
      
      const commitmentEndsAt = new Date(now);
      commitmentEndsAt.setMonth(commitmentEndsAt.getMonth() + 3);

      // Create payment ledger record
      await PaymentModel.create({
        userId: id,
        amountKwd,
        grossAmountKwd: amountKwd,
        cashbackAppliedKwd: "0.000",
        method,
        purpose: "manual_entry",
        manualLabel: "Belmondo Pro Subscription",
        status: "completed",
        provider: "manual",
        isManual: true,
        confirmedBy: req.auth!.userId,
        confirmedAt: now,
        createdByUserId: req.auth!.userId
      });

      const updated = await UserModel.findByIdAndUpdate(id, {
        belmondoPlan: "pro",
        belmondoProPaymentType: paymentOption,
        belmondoProExpiresAt: expiresAt,
        belmondoProCommitmentEndsAt: commitmentEndsAt
      }, { new: true }).lean<UserLean>();

      return res.json({ success: true, user: updated });
    } else {
      // Downgrade to basic
      const updated = await UserModel.findByIdAndUpdate(id, {
        belmondoPlan: "basic",
        $unset: { belmondoProPaymentType: "", belmondoProExpiresAt: "", belmondoProCommitmentEndsAt: "" }
      }, { new: true }).lean<UserLean>();

      return res.json({ success: true, user: updated });
    }
  } catch (e) {
    next(e);
  }
});

