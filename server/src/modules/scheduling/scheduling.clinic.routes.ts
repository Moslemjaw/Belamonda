// Clinic dashboards and session marking (/clinic/*).
import { Router } from "express";
import { kwDateTime } from "../../utils/kwDate.js";
import mongoose from "mongoose";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { sessionsStore } from "./sessions.store.js";
import { bookingRequestsStore } from "./bookingRequests.store.js";
import { UserModel } from "../../models/user.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { ScanLogModel } from "../../models/scanLog.model.js";
import { notifyBookingCancelled, notifySessionCompletedCashback } from "../notifications/notifications.service.js";
import { notifyChatRelatedUsers } from "../notifications/notifications.service.chat.js";
import { logAuditAction } from "../../services/audit.service.js";
import { kwdToMils } from "../../utils/money.js";
import { withTransaction } from "../../db/transaction.js";
import { ApiError } from "../../utils/apiError.js";
import { MarkSchema, canActOnClinic, checkStaffIntervalConstraint, findCsUserIds, findFinanceUserIds, loadOffer, loadUserOffer, postSystemMessage } from "./scheduling.helpers.js";

export const clinicRoutes = Router();

// ── Monthly session stats for KPI cards ────────────────────────────────────
clinicRoutes.get("/clinic/:clinicId/stats", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, req.params.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }
    const clinicId = req.params.clinicId;

    // Current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const baseFilter: any = { clinicId, scheduledAt: { $gte: startOfMonth, $lt: endOfMonth } };

    const [total, scheduled, completed, no_show, cancelled] = await Promise.all([
      BookingSessionModel.countDocuments(baseFilter),
      BookingSessionModel.countDocuments({ ...baseFilter, status: "scheduled" }),
      BookingSessionModel.countDocuments({ ...baseFilter, status: "completed" }),
      BookingSessionModel.countDocuments({ ...baseFilter, status: "no_show" }),
      BookingSessionModel.countDocuments({ ...baseFilter, status: "cancelled" }),
    ]);

    return res.json({ stats: { total, scheduled, completed, no_show, cancelled } });
  } catch (e) {
    next(e);
  }
});

clinicRoutes.get("/clinic/:clinicId/schedule", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, req.params.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }
    const from = typeof req.query.from === "string" ? req.query.from : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = typeof req.query.to === "string" ? req.query.to : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const clinicId = req.params.clinicId;
    const clinicObjId = mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : null;
    const clinicMatch = clinicObjId ? { $in: [clinicId, clinicObjId, String(clinicId)] } : clinicId;
    const sessions = await sessionsStore.listByClinic(req.params.clinicId, from, to);

    const fromDate = new Date(from);
    const toDate = new Date(to);

    const standaloneRequests = await BookingRequestModel.find({
      clinicId: clinicMatch,
      status: { $in: ["scheduled", "slot_accepted", "confirmed"] },
      $and: [
        {
          $or: [
            { scheduledSessionId: { $exists: false } },
            { scheduledSessionId: null },
            { scheduledSessionId: "" }
          ]
        },
        {
          $or: [
            { clinicScheduledAt: { $gte: fromDate, $lte: toDate } },
            { proposedAt: { $gte: fromDate, $lte: toDate } },
            { preferredAt: { $gte: fromDate, $lte: toDate } },
            { createdAt: { $gte: fromDate, $lte: toDate } },
          ]
        }
      ]
    }).lean();

    if (sessions.length === 0 && standaloneRequests.length === 0) return res.json({ items: [] });

    // ── Collect unique IDs for batch lookups ─────────────────────────────
    const uniqueUserIds       = [...new Set([...sessions.map(s => s.userId), ...standaloneRequests.map((r: any) => r.userId?.toString())].filter(Boolean))];
    const uniqueUserOfferIds  = [...new Set([...sessions.map(s => s.userOfferId), ...standaloneRequests.map((r: any) => r.userOfferId?.toString())].filter(id => id && mongoose.isValidObjectId(id)))];
    const validSessionIds     = sessions.map(s => s.id).filter(id => mongoose.isValidObjectId(id));

    // ── Round 1: 4 parallel batch queries ────────────────────────────────
    const [userDocs, userOfferDocs, breqDocs, lastCompletedAgg] = await Promise.all([
      // 1. All users in one query
      uniqueUserIds.length > 0
        ? UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()
        : Promise.resolve([]),
      // 2. All UserOffers in one query
      uniqueUserOfferIds.length > 0
        ? UserOfferModel.find({ _id: { $in: uniqueUserOfferIds } }).lean()
        : Promise.resolve([]),
      // 3. All BookingRequests by scheduledSessionId in one query
      validSessionIds.length > 0
        ? BookingRequestModel.find({ scheduledSessionId: { $in: validSessionIds } })
            .select("_id scheduledSessionId clinicPaymentStatus sessionPriceKwd cashbackDeductedKwd isStandalone membershipType").lean()
        : Promise.resolve([]),
      // 4. Last completed session per userOffer — one aggregate instead of N findOne queries
      uniqueUserOfferIds.length > 0
        ? BookingSessionModel.aggregate([
            { $match: { userOfferId: { $in: uniqueUserOfferIds }, status: "completed", completedAt: { $exists: true } } },
            { $sort: { completedAt: -1 } },
            { $group: { _id: "$userOfferId", completedAt: { $first: "$completedAt" } } }
          ])
        : Promise.resolve([]),
    ]);

    const userMap        = new Map((userDocs as any[]).map(u => [u._id.toString(), u]));
    const uoMap          = new Map((userOfferDocs as any[]).map(uo => [uo._id.toString(), uo]));
    const breqBySession  = new Map((breqDocs as any[]).map(b => [b.scheduledSessionId?.toString(), b]));
    const lastCompletedMap = new Map((lastCompletedAgg as any[]).map(d => [d._id?.toString(), d.completedAt as Date | null]));

    // ── Round 2: batch-fetch offers (need uoMap first for offerIds) ───────
    const uniqueOfferIds = [...new Set((userOfferDocs as any[]).map(uo => uo.offerId?.toString()).filter(Boolean))];
    const offerDocs = uniqueOfferIds.length > 0
      ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean()
      : [];
    const offerMap = new Map((offerDocs as any[]).map(o => [o._id.toString(), o]));

    // ── Build response — pure in-memory, zero additional DB calls ─────────
    const sessionItems = sessions.map((s) => {
      const uoDoc    = mongoose.isValidObjectId(s.userOfferId) ? uoMap.get(s.userOfferId) : null;
      const offerDoc = uoDoc ? offerMap.get(uoDoc.offerId?.toString()) : null;
      const breq     = breqBySession.get(s.id);
      let lastCompleted: Date | null = null;
      if (uoDoc) {
        const d1 = lastCompletedMap.get(uoDoc._id.toString());
        const d2 = (uoDoc as any).lastManualSessionAt ? new Date((uoDoc as any).lastManualSessionAt) : null;
        if (d1 && d2) lastCompleted = new Date(Math.max(d1.getTime(), d2.getTime()));
        else if (d1) lastCompleted = d1;
        else if (d2) lastCompleted = d2;
      }

      const intervalDays = (offerDoc?.sessionIntervalDays ?? 0) as number;
      const intervalMet =
        !lastCompleted || intervalDays === 0
          ? true
          : new Date(s.scheduledAt) >= new Date(new Date(lastCompleted).getTime() + intervalDays * 24 * 60 * 60 * 1000);

      const user = userMap.get(s.userId);
      return {
        ...s,
        customerName: (user as any)?.fullName ?? null,
        customerPhone: (user as any)?.phone ?? null,
        offerName: breq?.standaloneName ?? (offerDoc as any)?.name ?? null,
        bookingRequestId: breq?._id?.toString() ?? null,
        clinicPaymentStatus: breq?.clinicPaymentStatus ?? "pending",
        sessionPriceKwd: breq?.sessionPriceKwd ?? null,
        cashbackDeductedKwd: breq?.cashbackDeductedKwd ?? null,
        membershipType: breq?.membershipType ?? uoDoc?.membershipType ?? "none",
        isStandalone: breq?.isStandalone ?? false,
        eligibility: {
          offerActive: uoDoc?.status === "active",
          paymentConfirmed: uoDoc?.status === "active",
          intervalMet,
        },
      };
    });

    const sessionIds = new Set(sessions.map(s => s.id));
    const requestItems = standaloneRequests
      .filter((r: any) => !sessionIds.has(r._id.toString()))
      .map((r: any) => {
        const uoDoc    = r.userOfferId && mongoose.isValidObjectId(r.userOfferId) ? uoMap.get(r.userOfferId) : null;
        const offerDoc = uoDoc ? offerMap.get(uoDoc.offerId?.toString()) : null;
        const user     = userMap.get(r.userId?.toString());
        const scheduledDate = r.clinicScheduledAt ?? r.adminSuggestedAt ?? r.proposedAt ?? r.preferredAt ?? r.createdAt;
        return {
          id: r._id.toString(),
          type: "request",
          userId: r.userId,
          clinicId: r.clinicId,
          userOfferId: r.userOfferId ?? null,
          scheduledAt: scheduledDate instanceof Date ? scheduledDate.toISOString() : (scheduledDate ? new Date(scheduledDate).toISOString() : new Date().toISOString()),
          status: r.status,
          customerName: (user as any)?.fullName ?? null,
          customerPhone: (user as any)?.phone ?? null,
          offerName: r.standaloneName ?? (offerDoc as any)?.name ?? "Standalone Booking",
          bookingRequestId: r._id.toString(),
          clinicPaymentStatus: r.clinicPaymentStatus ?? "pending",
          sessionPriceKwd: r.sessionPriceKwd ?? null,
          cashbackDeductedKwd: r.cashbackDeductedKwd ?? null,
          membershipType: r.membershipType ?? uoDoc?.membershipType ?? "none",
          isStandalone: r.isStandalone ?? true,
          eligibility: {
            offerActive: uoDoc?.status === "active",
            paymentConfirmed: uoDoc?.status === "active",
            intervalMet: true,
          },
        };
      });

    const items = [...sessionItems, ...requestItems].sort((a: any, b: any) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ── Clinic today expected scans & attendance status ───────────────────────────
clinicRoutes.get("/clinic/:clinicId/today-expected-scans", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const { clinicId } = req.params;
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    // Determine today bounds in Kuwait Time (UTC+3)
    const now = new Date();
    const kuwaitOffsetMs = 3 * 60 * 60 * 1000;
    const kuwaitNow = new Date(now.getTime() + kuwaitOffsetMs);
    const startOfTodayKuwaitUtc = new Date(Date.UTC(kuwaitNow.getUTCFullYear(), kuwaitNow.getUTCMonth(), kuwaitNow.getUTCDate()) - kuwaitOffsetMs);
    const endOfTodayKuwaitUtc = new Date(startOfTodayKuwaitUtc.getTime() + 24 * 60 * 60 * 1000 - 1);

    const clinicObjId = mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : null;
    const clinicMatch = clinicObjId ? { $in: [clinicId, clinicObjId] } : clinicId;

    // Round 1: Fetch sessions, requests, and today's scans concurrently in parallel
    const [sessions, requests, todayScans] = await Promise.all([
      BookingSessionModel.find({
        clinicId: clinicMatch,
        status: { $nin: ["slot_assigned", "request_received", "cancelled", "rejected"] },
        scheduledAt: { $gte: startOfTodayKuwaitUtc, $lte: endOfTodayKuwaitUtc }
      }).select("_id userId offerId standaloneName scheduledAt status").sort({ scheduledAt: 1 }).lean(),

      BookingRequestModel.find({
        clinicId: clinicMatch,
        status: { $in: ["scheduled", "completed", "checked_in", "in_progress"] },
        $or: [
          { clinicScheduledAt: { $gte: startOfTodayKuwaitUtc, $lte: endOfTodayKuwaitUtc } },
          { proposedAt: { $gte: startOfTodayKuwaitUtc, $lte: endOfTodayKuwaitUtc } }
        ]
      }).select("_id userId offerId standaloneName scheduledSessionId clinicScheduledAt proposedAt adminSuggestedAt status").sort({ clinicScheduledAt: 1, proposedAt: 1 }).lean(),

      ScanLogModel.find({
        clinicId: clinicMatch,
        scannedAt: { $gte: startOfTodayKuwaitUtc, $lte: endOfTodayKuwaitUtc },
        status: "attended"
      }).select("userId scannedAt status").sort({ scannedAt: -1 }).lean()
    ]);

    // Filter requests not already linked to an existing session
    const sessionIdsSet = new Set(sessions.map((s: any) => s._id.toString()));
    const standaloneRequests = requests.filter((r: any) => !r.scheduledSessionId || !sessionIdsSet.has(r.scheduledSessionId.toString()));

    const allUserIds = [
      ...sessions.map((s: any) => s.userId),
      ...standaloneRequests.map((r: any) => r.userId)
    ].filter(Boolean);
    const uniqueUserIds = [...new Set(allUserIds.map(id => id.toString()))];

    const allOfferIds = [
      ...sessions.map((s: any) => s.offerId?.toString()),
      ...standaloneRequests.map((r: any) => r.offerId?.toString())
    ].filter(Boolean);
    const uniqueOfferIds = [...new Set(allOfferIds)];

    // Round 2: Fetch users and offers concurrently in parallel
    const [users, offerDocs] = await Promise.all([
      uniqueUserIds.length > 0
        ? UserModel.find({
            $or: [
              { _id: { $in: uniqueUserIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
              { _id: { $in: uniqueUserIds } }
            ]
          }).select("_id fullName phone publicToken shortId").lean()
        : Promise.resolve([]),
      uniqueOfferIds.length > 0
        ? OfferModel.find({ _id: { $in: uniqueOfferIds.filter(id => mongoose.isValidObjectId(id)) } }).select("_id name titleAr titleEn").lean()
        : Promise.resolve([])
    ]);

    const userMap = new Map((users as any[]).map(u => [u._id.toString(), u]));
    const offerMap = new Map((offerDocs as any[]).map(o => [o._id.toString(), (o as any).titleAr || (o as any).titleEn || (o as any).name]));

    const scanMap = new Map<string, any>();
    for (const sc of todayScans) {
      if ((sc as any).userId && !scanMap.has((sc as any).userId.toString())) {
        scanMap.set((sc as any).userId.toString(), sc);
      }
    }

    const items: any[] = [];

    for (const s of sessions as any[]) {
      if (s.status === "slot_assigned") continue;
      const user = userMap.get(s.userId?.toString());
      const scan = scanMap.get(s.userId?.toString());
      const offerName = s.offerId ? (offerMap.get(s.offerId.toString()) || "Session") : (s.standaloneName || "Session");

      let attendanceStatus = "awaiting";
      if (s.status === "completed" || (scan && (scan as any).status === "attended")) {
        attendanceStatus = "attended";
      } else if (s.status === "checked_in" || s.status === "in_progress") {
        attendanceStatus = "checked_in";
      } else if (s.status === "no_show") {
        attendanceStatus = "no_show";
      } else if (s.status === "cancelled") {
        attendanceStatus = "cancelled";
      }

      items.push({
        id: s._id.toString(),
        type: "session",
        sessionId: s._id.toString(),
        userId: s.userId?.toString(),
        customerName: (user as any)?.fullName || "Customer",
        customerPhone: (user as any)?.phone || "",
        publicToken: (user as any)?.publicToken || null,
        offerName,
        scheduledAt: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : null,
        status: s.status,
        attendanceStatus,
        hasScannedToday: !!scan,
        scannedAt: scan?.scannedAt ? new Date(scan.scannedAt).toISOString() : null
      });
    }

    for (const r of standaloneRequests as any[]) {
      if (r.status === "slot_assigned") continue;
      const user = userMap.get(r.userId?.toString());
      const scan = scanMap.get(r.userId?.toString());
      const offerName = r.offerId ? (offerMap.get(r.offerId.toString()) || r.standaloneName || "Booking") : (r.standaloneName || "Booking");
      const schedAt = r.clinicScheduledAt || r.proposedAt || r.adminSuggestedAt;

      let attendanceStatus = "awaiting";
      if (r.status === "completed" || (scan && (scan as any).status === "attended")) {
        attendanceStatus = "attended";
      } else if (r.status === "checked_in" || r.status === "in_progress") {
        attendanceStatus = "checked_in";
      } else if (r.status === "no_show") {
        attendanceStatus = "no_show";
      } else if (r.status === "cancelled") {
        attendanceStatus = "cancelled";
      }

      items.push({
        id: r._id.toString(),
        type: "request",
        requestId: r._id.toString(),
        userId: r.userId?.toString(),
        customerName: (user as any)?.fullName || "Customer",
        customerPhone: (user as any)?.phone || "",
        publicToken: (user as any)?.publicToken || null,
        offerName,
        scheduledAt: schedAt ? new Date(schedAt).toISOString() : null,
        status: r.status,
        attendanceStatus,
        hasScannedToday: !!scan,
        scannedAt: scan?.scannedAt ? new Date(scan.scannedAt).toISOString() : null
      });
    }

    items.sort((a, b) => {
      if (!a.scheduledAt) return 1;
      if (!b.scheduledAt) return -1;
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
    });

    const stats = {
      total: items.length,
      attended: items.filter(i => i.attendanceStatus === "attended").length,
      awaiting: items.filter(i => i.attendanceStatus === "awaiting" || i.attendanceStatus === "checked_in").length,
      noShow: items.filter(i => i.attendanceStatus === "no_show").length,
      cancelled: items.filter(i => i.attendanceStatus === "cancelled").length
    };

    return res.json({ items, stats });
  } catch (e) {
    next(e);
  }
});

// ── Clinic missed sessions view (Mongo-aware) ────────────────────────────
clinicRoutes.get("/clinic/:clinicId/missed-sessions", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, req.params.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }
    const { clinicId } = req.params;
    const now = new Date();

    // 1. BookingSession-based missed sessions (past scheduled or no_show)
    const sessions = await sessionsStore.listMissedByClinic(clinicId);

    // 2. Standalone BookingRequest past items (not linked to a session)
    const clinicObjId = mongoose.isValidObjectId(clinicId) ? new mongoose.Types.ObjectId(clinicId) : null;
    const clinicMatch = clinicObjId ? { $in: [clinicId, clinicObjId] } : clinicId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const standaloneRequests = await BookingRequestModel.find({
      clinicId: clinicMatch,
      status: { $nin: ["completed", "cancelled", "rejected", "slot_assigned", "request_received"] },
      $and: [
        {
          $or: [
            { scheduledSessionId: { $exists: false } },
            { scheduledSessionId: null },
            { scheduledSessionId: "" }
          ]
        },
        {
          $or: [
            { status: "no_show" },
            { proposedAt: { $lt: startOfToday } },
            { clinicScheduledAt: { $lt: startOfToday } },
            { adminSuggestedAt: { $lt: startOfToday } }
          ]
        }
      ]
    }).sort({ proposedAt: -1, clinicScheduledAt: -1, createdAt: -1 }).lean();

    const sessionIds = new Set(sessions.map(s => s.id));

    const uniqueUserIds       = [...new Set([...sessions.map(s => s.userId), ...standaloneRequests.map((r: any) => r.userId)])];
    const uniqueUserOfferIds  = [...new Set([...sessions.map(s => s.userOfferId), ...standaloneRequests.map((r: any) => r.userOfferId)].filter(id => mongoose.isValidObjectId(id)))];
    const validSessionIds     = sessions.map(s => s.id).filter(id => mongoose.isValidObjectId(id));

    const [userDocs, userOfferDocs, breqDocs] = await Promise.all([
      uniqueUserIds.length > 0
        ? UserModel.find({ _id: { $in: uniqueUserIds } }).select("_id fullName phone").lean()
        : Promise.resolve([]),
      uniqueUserOfferIds.length > 0
        ? UserOfferModel.find({ _id: { $in: uniqueUserOfferIds } }).lean()
        : Promise.resolve([]),
      validSessionIds.length > 0
        ? BookingRequestModel.find({ scheduledSessionId: { $in: validSessionIds } })
            .select("_id scheduledSessionId isStandalone membershipType adminSuggestedAt notes standaloneName").lean()
        : Promise.resolve([]),
    ]);

    const userMap        = new Map((userDocs as any[]).map(u => [u._id.toString(), u]));
    const uoMap          = new Map((userOfferDocs as any[]).map(uo => [uo._id.toString(), uo]));
    const breqBySession  = new Map((breqDocs as any[]).map(b => [b.scheduledSessionId?.toString(), b]));

    const uniqueOfferIds = [...new Set((userOfferDocs as any[]).map(uo => uo.offerId?.toString()).filter(Boolean))];
    const offerDocs = uniqueOfferIds.length > 0
      ? await OfferModel.find({ _id: { $in: uniqueOfferIds } }).lean()
      : [];
    const offerMap = new Map((offerDocs as any[]).map(o => [o._id.toString(), o]));

    // Build session-based items
    const sessionItems = sessions.map((s) => {
      const uoDoc    = mongoose.isValidObjectId(s.userOfferId) ? uoMap.get(s.userOfferId) : null;
      const offerDoc = uoDoc ? offerMap.get(uoDoc.offerId?.toString()) : null;
      const breq     = breqBySession.get(s.id);
      const user = userMap.get(s.userId);
      return {
        ...s,
        type: "session",
        customerName: (user as any)?.fullName ?? null,
        customerPhone: (user as any)?.phone ?? null,
        offerName: breq?.standaloneName ?? (offerDoc as any)?.name ?? null,
        bookingRequestId: breq?._id?.toString() ?? null,
        membershipType: breq?.membershipType ?? uoDoc?.membershipType ?? "none",
        isStandalone: breq?.isStandalone ?? false,
        adminSuggestedAt: breq?.adminSuggestedAt ?? null,
        notes: breq?.notes ?? null,
      };
    });

    // Build request-based items (standalone)
    const requestItems = standaloneRequests
      .filter((r: any) => !sessionIds.has(r._id.toString()))
      .map((r: any) => {
        const uoDoc    = r.userOfferId && mongoose.isValidObjectId(r.userOfferId) ? uoMap.get(r.userOfferId) : null;
        const offerDoc = uoDoc ? offerMap.get(uoDoc.offerId?.toString()) : null;
        const user = userMap.get(r.userId?.toString());
        return {
          id: r._id.toString(),
          type: "request",
          userId: r.userId,
          userOfferId: r.userOfferId,
          clinicId: r.clinicId,
          status: r.status,
          scheduledAt: r.clinicScheduledAt ?? r.adminSuggestedAt ?? r.proposedAt ?? r.preferredAt,
          customerName: (user as any)?.fullName ?? null,
          customerPhone: (user as any)?.phone ?? null,
          offerName: r.standaloneName ?? (offerDoc as any)?.name ?? null,
          bookingRequestId: r._id.toString(),
          membershipType: r.membershipType ?? uoDoc?.membershipType ?? "none",
          isStandalone: r.isStandalone ?? true,
          adminSuggestedAt: r.adminSuggestedAt ?? null,
          notes: r.notes ?? null,
        };
      });

    const items = [...sessionItems, ...requestItems].sort((a: any, b: any) =>
      new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime()
    );

    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

// ── Clinic marks a session status (Mongo-aware) ────────────────────────────
clinicRoutes.post("/clinic/sessions/:sessionId/mark", authRequired, requireRole(["clinicStaff", "admin"]), async (req, res, next) => {
  try {
    const parsed = MarkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const session = await sessionsStore.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, String(session.clinicId)))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    const uo = session.userOfferId ? await loadUserOffer(session.userOfferId) : null;
    
    // For cancellations, skip offer validation — allow cancelling orphaned or expired sessions
    if (parsed.data.status === "cancelled") {
      const { result, breq } = await withTransaction(async () => {
        const result = await sessionsStore.mark({
          sessionId: req.params.sessionId,
          status: "cancelled",
          markedBy: req.auth!.userId,
          notes: parsed.data.notes
        });

        if (session.userOfferId && mongoose.isValidObjectId(session.userOfferId)) {
          await UserOfferModel.findOneAndUpdate(
            { _id: session.userOfferId, sessionsUsed: { $gt: 0 } },
            { $inc: { sessionsUsed: -1 } }
          );
        }
        const breq = await bookingRequestsStore.findBySessionId(session.id);
        if (breq) {
          await bookingRequestsStore.update(breq.id, { status: "cancelled" });
        }
        return { result, breq };
      });
      const csIds = await findCsUserIds();
      const financeIds = await findFinanceUserIds();
      notifyChatRelatedUsers({
        userIds: Array.from(new Set([...csIds, ...financeIds])),
        kind: "booking_cancelled",
        body: `Clinic cancelled session ${session.id}. Session quota restored for customer.`,
        payload: { bookingRequestId: breq?.id, sessionId: session.id }
      });
      notifyBookingCancelled(session.userId, result!.id);

      return res.json({ session: result });
    }

    if (session.userOfferId) {
      // A session booked inside the membership validity can still be marked after the
      // membership expires (e.g. the clinic records yesterday's visit today).
      const withinValidity = !!uo?.expiresAt && new Date(session.scheduledAt) <= new Date(uo.expiresAt);
      if (!uo || !(uo.status === "active" || (uo.status === "expired" && withinValidity))) {
        return res.status(409).json({ error: "OFFER_NOT_ACTIVE" });
      }
      const offer = await loadOffer(uo.offerId);
      if (!offer) return res.status(400).json({ error: "OFFER_NOT_FOUND" });
    }

    let cashbackUnlocked = "0.000";
    if (parsed.data.status === "completed") {
      if (req.auth?.role === "clinicStaff") {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const hasScan = await ScanLogModel.exists({
          userId: session.userId,
          clinicId: req.auth.clinicId || session.clinicId,
          scannedAt: { $gte: twentyFourHoursAgo }
        });
        if (!hasScan) {
          return res.status(403).json({
            error: "SCAN_REQUIRED",
            message: "Clinic staff cannot mark sessions as completed manually. Attendance must be recorded via QR card scan."
          });
        }
      }

      // Validate that session scheduledAt date is not in the future (after today)
      if (session.scheduledAt) {
        const schedDate = new Date(session.scheduledAt);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (schedDate > endOfToday && req.auth?.role !== "admin") {
          return res.status(400).json({
            error: "FUTURE_SESSION_NOT_ALLOWED",
            message: "Cannot mark a session as completed before its scheduled date."
          });
        }
      }

      if (uo) {
        const offer = await loadOffer(uo.offerId);
        if (offer) cashbackUnlocked = offer.cashbackPerSessionKwd ?? "0.000";
      }
    }

    // Reward, POS deduction, session status and booking-request sync commit together, so a
    // failed deduction can no longer leave the reward granted (and granted again on retry).
    const updated = await withTransaction(async () => {
      // If offer exists, unlock cashback
      if (parsed.data.status === "completed" && uo && parseFloat(cashbackUnlocked) > 0) {
        await kycStore.rewardSessionCashback({
          userId: uo.userId,
          amountKwd: cashbackUnlocked,
          sessionId: session.id,
          createdById: "system"
        });
      }

      if (parsed.data.status === "completed" && parsed.data.cashbackToDeductKwd && parseFloat(parsed.data.cashbackToDeductKwd) > 0) {
        const deductionAmount = parseFloat(parsed.data.cashbackToDeductKwd);
        const resAdjust = await kycStore.deductUnlocked({
          userId: session.userId,
          amountKwd: deductionAmount.toFixed(3),
          reference: { kind: "session", id: session.id },
          createdBy: { kind: "admin", id: req.auth!.userId }
        });
        if ("error" in resAdjust) {
          throw new ApiError(400, resAdjust.error ?? "CASHBACK_DEDUCTION_FAILED");
        }
        if (session.userOfferId) {
          await userOfferService.adjustCashbackBalance(session.userOfferId, -kwdToMils(deductionAmount), { onlyIfSet: true });
        }
      }

      let totalBillKwd: string | undefined;
      let finalPaidKwd: string | undefined;
      if (parsed.data.status === "completed") {
         const extraSum = parsed.data.extraItems?.reduce((sum, item) => sum + parseFloat(item.priceKwd) * item.qty, 0) || 0;
         totalBillKwd = extraSum.toFixed(3);
         const cbDeduct = parseFloat(parsed.data.cashbackToDeductKwd || "0");
         finalPaidKwd = Math.max(0, extraSum - cbDeduct).toFixed(3);
      }

      const updated = await sessionsStore.mark({
        sessionId: session.id,
        status: parsed.data.status,
        markedBy: req.auth!.userId,
        notes: parsed.data.notes,
        cashbackUnlockedKwd: parsed.data.status === "completed" ? cashbackUnlocked : undefined,
        extraItems: parsed.data.extraItems,
        totalBillKwd,
        finalPaidKwd
      });

      if (updated?.status === "completed") {
        // Auto-sync all associated booking requests status & shownAt timestamp
        const nowIso = new Date().toISOString();
        const sessObjId = mongoose.isValidObjectId(session.id) ? new mongoose.Types.ObjectId(session.id) : null;
        await BookingRequestModel.updateMany(
          {
            $or: [
              { scheduledSessionId: session.id },
              ...(sessObjId ? [{ scheduledSessionId: sessObjId }] : []),
              { _id: session.id },
              ...(sessObjId ? [{ _id: sessObjId }] : [])
            ]
          },
          {
            $set: {
              status: "completed",
              shownAt: nowIso
            }
          }
        );

        // NOTE: Removed code that was overwriting scheduledAt with completedAt.
        // The original scheduledAt should always be preserved.

        if (req.auth?.userId) {
          await logAuditAction({
            actorId: req.auth.userId,
            actorRole: req.auth.role as any,
            actionType: "admin_manual_session_complete",
            targetEntityType: "BookingSession",
            targetEntityId: session.id,
            beforeState: { status: session.status },
            afterState: { status: "completed" },
            metadata: {
              shortId: (session as any).shortId || session.id,
              userId: session.userId,
              clinicId: session.clinicId,
              notes: parsed.data.notes
            }
          });
        }
      }

      if (updated?.status === "no_show") {
        const breq = await bookingRequestsStore.findBySessionId(session.id);
        if (breq) {
          await bookingRequestsStore.update(breq.id, { status: "no_show" });
        }
      }
      return updated;
    });

    if (updated?.status === "completed" && uo && parseFloat(cashbackUnlocked) > 0) {
      notifySessionCompletedCashback(uo.userId, updated.id, cashbackUnlocked);
    }
    return res.json({ session: updated });
  } catch (e) {
    next(e);
  }
});

// ── Clinic staff: customer context for a booking request ──────────────────
clinicRoutes.get("/clinic/requests/:id/customer-context", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.id);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });

    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    const uo = await loadUserOffer(breq.userOfferId!);
    if (!uo) return res.status(404).json({ error: "USER_OFFER_NOT_FOUND" });

    const offer = await loadOffer(uo.offerId);
    const wallet = await kycStore.getWallet(uo.userId);

    let paymentLabel: string;
    if (uo.purchaseMode === "installments") {
      const paid = uo.installmentsPaid ?? 0;
      const total = uo.installmentCount ?? 0;
      paymentLabel = total > 0 ? `installments (${paid}/${total} paid)` : "installments";
    } else if (uo.purchaseMode === "deposit") {
      paymentLabel = uo.status === "reserved" ? "deposit reserved" : "deposit paid";
    } else {
      paymentLabel = uo.status === "active" ? "paid in full" : uo.status;
    }

    return res.json({
      context: {
        paymentMode: uo.purchaseMode ?? "full",
        paymentLabel,
        paymentStatus: uo.status,
        installmentsPaid: uo.installmentsPaid ?? null,
        installmentCount: uo.installmentCount ?? null,
        sessionsUsed: uo.sessionsUsed ?? 0,
        maxSessions: offer?.maxSessions ?? null,
        cashbackUnlockedKwd: wallet?.unlockedKwd ?? "0.000",
        cashbackLockedKwd: wallet?.lockedKwd ?? "0.000"
      }
    });
  } catch (e) {
    next(e);
  }
});

// ── Clinic staff: reschedule a confirmed session ────────────────────────────
const RescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  forceOverride: z.boolean().optional()
});

clinicRoutes.post("/clinic/sessions/:sessionId/reschedule", authRequired, requireRole(["clinicStaff", "admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const parsed = RescheduleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const session = await sessionsStore.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, String(session.clinicId)))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    if (session.status !== "scheduled" && session.status !== "no_show") {
      return res.status(409).json({ error: "INVALID_STATE", detail: "Only scheduled or missed sessions can be rescheduled" });
    }

    if (session.userOfferId) {
      const check = await checkStaffIntervalConstraint({
        userOfferId: session.userOfferId,
        userId: session.userId,
        targetDate: new Date(parsed.data.scheduledAt),
        forceOverride: parsed.data.forceOverride,
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        actionContext: "clinic_reschedule"
      });
      if (!check.allowed) {
        return res.status(409).json(check);
      }
    }

    // if (parsed.data.scheduledAt !== session.scheduledAt && await sessionsStore.isSlotTaken(session.clinicId, parsed.data.scheduledAt)) {
    //   return res.status(409).json({ error: "SLOT_TAKEN" });
    // }

    const updated = await sessionsStore.reschedule({
      sessionId: session.id,
      scheduledAt: parsed.data.scheduledAt,
      rescheduledBy: req.auth!.userId,
      notes: parsed.data.notes
    });

    const breq = await bookingRequestsStore.findBySessionId(session.id);
    // Keep the booking request (history pages) in step with the session: a missed
    // session that is rescheduled is scheduled again.
    if (breq) {
      await BookingRequestModel.findByIdAndUpdate(breq.id, {
        $set: {
          status: "scheduled",
          clinicScheduledAt: new Date(parsed.data.scheduledAt),
          proposedAt: new Date(parsed.data.scheduledAt)
        }
      });
    }
    await logAuditAction({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role as any,
      actionType: "reschedule_session",
      targetEntityType: "BookingSession",
      targetEntityId: session.id,
      beforeState: { scheduledAt: session.scheduledAt, status: session.status },
      afterState: { scheduledAt: parsed.data.scheduledAt, status: "scheduled" },
      metadata: { bookingRequestId: breq?.id, notes: parsed.data.notes }
    });
    if (breq?.conversationId) {
      postSystemMessage(
        breq.conversationId,
        "slot_proposed",
        `Session rescheduled to ${kwDateTime(parsed.data.scheduledAt)}${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
        { sessionId: session.id, scheduledAt: parsed.data.scheduledAt },
        req.auth!.userId
      );
    }

    notifyChatRelatedUsers({
      userIds: [session.userId],
      kind: "booking_slot_proposed",
      body: `Your session has been rescheduled to ${kwDateTime(parsed.data.scheduledAt)}`,
      payload: { sessionId: session.id }
    });

    return res.json({ session: updated });
  } catch (e) {
    next(e);
  }
});
