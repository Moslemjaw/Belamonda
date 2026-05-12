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

const STAFF_ROLES = ["admin", "cs", "finance"] as const;

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

    const [user, wallet, txns, kyc, memberships, payments, sessions] = await Promise.all([
      UserModel.findById(id).lean<UserLean>(),
      WalletModel.findOne({ userId: id }).lean(),
      WalletTxnModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      KycSubmissionModel.find({ userId: id }).sort({ createdAt: -1 }).limit(5).lean(),
      UserOfferModel.find({ $or: [{ userId: id }, { sharedWith: id }] }).sort({ createdAt: -1 }).lean(),
      PaymentModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean(),
      BookingRequestModel.find({ userId: id }).sort({ createdAt: -1 }).limit(200).lean()
    ]);

    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    // Enrich memberships with offer names
    const offerIds = [...new Set(memberships.map((m: any) => String(m.offerId)).filter(Boolean))];
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
      },
      wallet: walletItem,
      kyc: kycItem,
      memberships: membershipItems,
      payments: paymentItems,
      sessions: sessionItems,
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
      "Username": u.username ?? "—",
      "Email": u.email ?? "—",
      "Phone": u.phone ?? "—",
      "Role": u.role ?? "—",
      "Status": u.isActive !== false ? "Active" : "Disabled",
      "Joined": u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(userRows), "Users");

    // Sheet 2: All Memberships
    const membershipRows = memberships.map((m: any) => ({
      "Membership ID": String(m._id),
      "User ID": m.userId,
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

usersRouter.patch("/admin/:id", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const parsed = z
      .object({
        role: z.enum(["customer", "admin", "cs", "finance", "clinicStaff"]).optional(),
        isActive: z.boolean().optional(),
        clinicId: z.string().optional()
      })
      .safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

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
