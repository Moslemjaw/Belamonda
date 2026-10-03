// Admin / CS back-office routes (/admin/*).
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as userOfferService from "../../services/userOffer.service.js";
import { kycStore } from "../kyc/kyc.store.js";
import { bookingRequestsStore } from "./bookingRequests.store.js";
import type { AppointmentStatus } from "@belamonda/shared";
import { UserModel } from "../../models/user.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { ScanLogModel } from "../../models/scanLog.model.js";
import { logAuditAction } from "../../services/audit.service.js";
import { kwdToMils } from "../../utils/money.js";
import { withTransaction } from "../../db/transaction.js";
import { canActOnClinic, getUserClinicId, postSystemMessage } from "./scheduling.helpers.js";

export const adminRoutes = Router();

// ── Admin Sessions Log ────────────────────────────────────────────────────────
adminRoutes.get("/admin/sessions-log", authRequired, requireRole(["admin", "cs_director", "legal", "cs", "clinicStaff"]), async (req, res, next) => {
  try {
    const { from, to, status, clinicId, search } = req.query;
    const sessionQuery: any = {};
    const requestQuery: any = { status: { $ne: "confirmed" } };

    // Clinic scoping — clinic staff only ever see their own clinic
    let targetClinicId = clinicId;
    if (req.auth!.role === "clinicStaff") {
      const myClinicId = req.auth!.userId.startsWith("impersonated_")
        ? req.auth!.userId.replace("impersonated_", "")
        : req.auth!.clinicId || (await getUserClinicId(req.auth!.userId));
      if (!myClinicId) return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
      targetClinicId = myClinicId;
    }

    if (targetClinicId && targetClinicId !== "all") {
      const cIdStr = String(targetClinicId);
      const clinicMatch = mongoose.isValidObjectId(cIdStr)
        ? { $in: [cIdStr, new mongoose.Types.ObjectId(cIdStr)] }
        : cIdStr;
      sessionQuery.clinicId = clinicMatch;
      requestQuery.clinicId = clinicMatch;
    }

    // Date filtering
    if (from || to) {
      const dateFilter: any = {};
      if (from) dateFilter.$gte = new Date(from as string);
      if (to) dateFilter.$lte = new Date(to as string);

      sessionQuery.scheduledAt = dateFilter;
      requestQuery.$or = [
        { proposedAt: dateFilter },
        { preferredAt: dateFilter },
        { createdAt: dateFilter }
      ];
    } else {
      sessionQuery.scheduledAt = { $gte: new Date("2026-01-01T00:00:00Z") };
      requestQuery.createdAt = { $gte: new Date("2026-01-01T00:00:00Z") };
    }

    // Search filtering (customer name, phone, user shortId, or session shortId)
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      const matchingUsers = await UserModel.find({
        $or: [
          { fullName: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { shortId: { $regex: q, $options: "i" } }
        ]
      }).select("_id").lean();

      const matchingUserIds = matchingUsers.map((u: any) => u._id.toString());

      const userCondSession = {
        $or: [
          { userId: { $in: matchingUserIds } },
          { shortId: { $regex: q, $options: "i" } }
        ]
      };
      const userCondRequest = {
        $or: [
          { userId: { $in: matchingUserIds } }
        ]
      };

      sessionQuery.$and = sessionQuery.$and ? [...sessionQuery.$and, userCondSession] : [userCondSession];
      requestQuery.$and = requestQuery.$and ? [...requestQuery.$and, userCondRequest] : [userCondRequest];
    }

    if (status && status !== "all") {
      if (status === "no_show") {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const noShowSessionCondition = {
          $or: [
            { status: "no_show" },
            {
              status: { $nin: ["completed", "cancelled", "rejected", "slot_assigned"] },
              scheduledAt: { $lt: startOfToday }
            }
          ]
        };
        sessionQuery.$and = sessionQuery.$and ? [...sessionQuery.$and, noShowSessionCondition] : [noShowSessionCondition];

        const noShowRequestCondition = {
          $or: [
            { status: "no_show" },
            {
              status: { $nin: ["completed", "cancelled", "rejected", "slot_assigned"] },
              $or: [
                { proposedAt: { $lt: startOfToday } },
                { preferredAt: { $lt: startOfToday } },
                { createdAt: { $lt: startOfToday } }
              ]
            }
          ]
        };
        requestQuery.$and = requestQuery.$and ? [...requestQuery.$and, noShowRequestCondition] : [noShowRequestCondition];
      } else {
        sessionQuery.status = status;
        requestQuery.status = status;
      }
    }

    const isSessionStatus = !status || status === "all" || ["scheduled", "completed", "no_show", "cancelled"].includes(status as string);
    const isRequestStatus = !status || status === "all" || ["request_received", "slot_assigned", "scheduled", "cancelled", "no_show", "checked_in", "completed"].includes(status as string);

    const [sessionDocs, rawRequestDocs] = await Promise.all([
      isSessionStatus
        ? BookingSessionModel.find(sessionQuery)
            .select("userId clinicId scheduledAt status offerId sessionPriceKwd clinicPaymentStatus bookingRequestId notes markedBy createdAt")
            .sort({ scheduledAt: -1 })
            .limit(1000)
            .lean()
        : Promise.resolve([]),
      isRequestStatus
        ? BookingRequestModel.find(requestQuery)
            .select("userId clinicId status offerId sessionPriceKwd clinicPaymentStatus scheduledSessionId notes createdAt preferredAt proposedAt bookingRoute isStandalone standaloneName")
            .sort({ createdAt: -1 })
            .limit(1000)
            .lean()
        : Promise.resolve([])
    ]);

    const requestDocs = rawRequestDocs.filter((r: any) => !r.scheduledSessionId);

    const userIds = [
      ...sessionDocs.map((i: any) => i.userId),
      ...requestDocs.map((i: any) => i.userId)
    ];
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

    const offerIds = [
      ...sessionDocs.map((i: any) => i.offerId),
      ...requestDocs.map((i: any) => i.offerId)
    ];
    const uniqueOfferIds = [...new Set(offerIds.filter(id => !!id && mongoose.isValidObjectId(id)))];

    const sessionIds = sessionDocs.map((s: any) => s._id.toString());
    const reqIdsFromSessions = sessionDocs.map(s => (s as any).bookingRequestId).filter(Boolean);
    const reqSessionIds = requestDocs.map(r => r.scheduledSessionId).filter(Boolean);

    const markedByIds = [...new Set(sessionDocs.map((s: any) => s.markedBy).filter(Boolean))];
    const validMarkedByIds = markedByIds.filter(id => mongoose.isValidObjectId(id));

    // Parallelize all secondary lookups concurrently
    const [users, offerDocs, requestsForSessions, sessionsForRequests, userScans, markedByUsers] = await Promise.all([
      uniqueUserIds.length > 0
        ? UserModel.find({
            $or: [
              { _id: { $in: uniqueUserIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
              { _id: { $in: uniqueUserIds } }
            ]
          }).select("_id fullName phone").lean()
        : Promise.resolve([]),
      uniqueOfferIds.length > 0
        ? OfferModel.find({ _id: { $in: uniqueOfferIds } }).select("_id titleAr titleEn title name").lean()
        : Promise.resolve([]),
      (sessionIds.length > 0 || reqIdsFromSessions.length > 0)
        ? BookingRequestModel.find({
            $or: [
              { scheduledSessionId: { $in: sessionIds } },
              { _id: { $in: reqIdsFromSessions } }
            ]
          }).select("_id scheduledSessionId clinicPaymentStatus sessionPriceKwd").lean()
        : Promise.resolve([]),
      reqSessionIds.length > 0
        ? BookingSessionModel.find({ _id: { $in: reqSessionIds } }).select("_id status clinicPaymentStatus").lean()
        : Promise.resolve([]),
      uniqueUserIds.length > 0
        ? ScanLogModel.find({
            userId: { $in: uniqueUserIds.map(String) }
          }).select("userId").lean()
        : Promise.resolve([]),
      validMarkedByIds.length > 0
        ? UserModel.find({
            _id: { $in: validMarkedByIds.map(id => new mongoose.Types.ObjectId(id)) }
          }).select("_id fullName role").lean()
        : Promise.resolve([])
    ]);

    const userMap = new Map(users.map((u: any) => [u._id.toString(), { fullName: u.fullName, phone: u.phone }]));
    const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), (o as any).titleAr || (o as any).titleEn || (o as any).title || (o as any).name]));

    const requestsBySessionMap = new Map<string, any>();
    for (const r of requestsForSessions) {
      if ((r as any).scheduledSessionId) requestsBySessionMap.set(String((r as any).scheduledSessionId), r);
      if ((r as any)._id) requestsBySessionMap.set(String((r as any)._id), r);
    }

    const sessionsByReqMap = new Map(sessionsForRequests.map((s: any) => [s._id.toString(), s]));

    const scanCountMap = new Map<string, number>();
    for (const sc of userScans) {
      const uid = (sc as any).userId?.toString();
      if (uid) scanCountMap.set(uid, (scanCountMap.get(uid) || 0) + 1);
    }

    const markedByMap = new Map(markedByUsers.map((u: any) => [u._id.toString(), (u as any).fullName || ((u as any).role === 'admin' ? 'Admin' : (u as any).role)]));

    const enrichedSessions = sessionDocs.map((doc: any) => {
      const req = requestsBySessionMap.get(doc._id.toString()) || (doc.bookingRequestId ? requestsBySessionMap.get(doc.bookingRequestId.toString()) : null);
      const sStatus = doc.status;
      const isPaid = doc.clinicPaymentStatus === "paid" || req?.clinicPaymentStatus === "paid";
      const pStatus = isPaid ? "paid" : "pending";
      
      let combinedStatus = "";
      if (sStatus === "completed" && pStatus === "paid") combinedStatus = "Completed";
      else if (sStatus === "completed" && pStatus !== "paid") combinedStatus = "Missing POS";
      else if (sStatus !== "completed" && pStatus === "paid") combinedStatus = "Missing Came";
      else combinedStatus = "Missing Both";

      return {
        id: doc._id.toString(),
        type: "session",
        userId: doc.userId,
        clinicId: doc.clinicId,
        scheduledAt: doc.scheduledAt?.toISOString() || null,
        status: doc.status,
        customerName: userMap.get(doc.userId)?.fullName || null,
        customerPhone: userMap.get(doc.userId)?.phone || null,
        offerName: doc.offerId ? (offerMap.get(doc.offerId.toString()) || "Unknown Offer") : "Standalone Booking",
        createdAt: doc.createdAt?.toISOString() || doc.scheduledAt?.toISOString() || null,
        combinedSessionStatus: combinedStatus,
        clinicPaymentStatus: pStatus,
        requestId: req?._id?.toString(),
        sessionPriceKwd: doc.sessionPriceKwd || req?.sessionPriceKwd || null,
        isHistorical: doc.notes === "Historical session logged during enrollment",
        scanCount: scanCountMap.get(doc.userId?.toString()) || 0,
        hasScanHistory: (scanCountMap.get(doc.userId?.toString()) || 0) > 0,
        markedBy: doc.markedBy || null,
        markedByName: doc.markedBy ? (markedByMap.get(doc.markedBy) || doc.markedBy) : null
      };
    });

    const enrichedRequests = requestDocs.map((doc: any) => {
      const sess = doc.scheduledSessionId ? sessionsByReqMap.get(doc.scheduledSessionId.toString()) : null;
      const sStatus = sess?.status;
      const isPaid = doc.clinicPaymentStatus === "paid" || sess?.clinicPaymentStatus === "paid";
      const pStatus = isPaid ? "paid" : "pending";
      
      let combinedStatus = "";
      if (sStatus === "completed" && pStatus === "paid") combinedStatus = "Completed";
      else if (sStatus === "completed" && pStatus !== "paid") combinedStatus = "Missing POS";
      else if (sStatus !== "completed" && pStatus === "paid") combinedStatus = "Missing Came";
      else combinedStatus = "Missing Both";

      return {
        id: doc._id.toString(),
        type: "request",
        userId: doc.userId,
        clinicId: doc.clinicId,
        scheduledAt: doc.proposedAt?.toISOString() || doc.preferredAt?.toISOString() || doc.createdAt?.toISOString() || null,
        status: doc.status,
        customerName: userMap.get(doc.userId)?.fullName || null,
        customerPhone: userMap.get(doc.userId)?.phone || null,
        offerName: doc.offerId ? (offerMap.get(doc.offerId.toString()) || "Unknown Offer") : "Standalone Booking",
        createdAt: doc.createdAt?.toISOString() || doc.proposedAt?.toISOString() || null,
        combinedSessionStatus: combinedStatus,
        clinicPaymentStatus: pStatus,
        sessionPriceKwd: doc.sessionPriceKwd || null,
        scanCount: scanCountMap.get(doc.userId?.toString()) || 0,
        hasScanHistory: (scanCountMap.get(doc.userId?.toString()) || 0) > 0
      };
    });

    const allItems = [...enrichedSessions, ...enrichedRequests];
    allItems.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    return res.json({ items: allItems.slice(0, 2000) });
  } catch (e: any) {
    console.error("[sessions-log] Error:", e.message, e.stack?.split("\n").slice(0, 5).join("\n"));
    next(e);
  }
});

// ── Session row detail: booking requests + scans for a user ───────────────────
adminRoutes.get("/admin/session-details", authRequired, requireRole(["admin", "cs_director", "legal", "cs"]), async (req, res, next) => {
  try {
    const userId = typeof req.query.userId === "string" ? req.query.userId.trim() : "";
    if (!userId) return res.json({ requests: [], scans: [] });

    // Booking requests for this user
    const requestDocs = await BookingRequestModel.find({
      $or: [{ userId }, ...(mongoose.isValidObjectId(userId) ? [{ userId: new mongoose.Types.ObjectId(userId) }] : [])]
    }).sort({ createdAt: -1 }).lean();

    // Scans for this user
    const scanDocs = await ScanLogModel.find({
      $or: [{ userId }, ...(mongoose.isValidObjectId(userId) ? [{ userId: new mongoose.Types.ObjectId(userId) }] : [])]
    }).sort({ scannedAt: -1 }).lean();

    // Clinic lookup
    const allClinicIds = [
      ...requestDocs.map(r => r.clinicId),
      ...scanDocs.map(sc => sc.clinicId)
    ].filter(Boolean);
    const uniqueClinicIds = [...new Set(allClinicIds.map(id => id.toString()))];
    const clinicDocs = uniqueClinicIds.length > 0
      ? await ClinicModel.find({
          $or: [
            { _id: { $in: uniqueClinicIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { id: { $in: uniqueClinicIds } }
          ]
        }).lean()
      : [];
    const clinicMap = new Map<string, { nameEn: string; nameAr: string }>();
    for (const c of clinicDocs) {
      const cid = (c as any)._id.toString();
      clinicMap.set(cid, { nameEn: (c as any).nameEn || (c as any).name || cid, nameAr: (c as any).nameAr || (c as any).name || cid });
      if ((c as any).id) clinicMap.set(String((c as any).id), clinicMap.get(cid)!);
    }

    // Offer lookup
    const offerIds = [...new Set(requestDocs.map(r => r.offerId).filter(Boolean))];
    const offerDocs = offerIds.length > 0 ? await OfferModel.find({ _id: { $in: offerIds } }).lean() : [];
    const offerMap = new Map(offerDocs.map((o: any) => [o._id.toString(), o.titleAr || o.titleEn || o.title || o.name || "Offer"]));

    // Scanned by user lookup
    const scannedByIds = [...new Set(scanDocs.map(s => s.scannedByUserId).filter(Boolean))];
    const staffDocs = scannedByIds.length > 0
      ? await UserModel.find({
          $or: [
            { _id: { $in: scannedByIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { _id: { $in: scannedByIds } }
          ]
        }).select("fullName username").lean()
      : [];
    const staffMap = new Map(staffDocs.map((st: any) => [st._id.toString(), st.fullName || st.username || "Staff"]));

    // Linked sessions status lookup for guaranteed consistency
    const reqSessionIds = requestDocs.map(r => r.scheduledSessionId).filter(Boolean);
    const linkedSessions = reqSessionIds.length > 0
      ? await BookingSessionModel.find({
          $or: [
            { _id: { $in: reqSessionIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { _id: { $in: reqSessionIds } }
          ]
        }).select("_id status").lean()
      : [];
    const linkedSessionStatusMap = new Map((linkedSessions as any[]).map(s => [s._id.toString(), s.status]));

    const requests = requestDocs.map((r: any) => {
      const c = clinicMap.get(r.clinicId?.toString()) || { nameEn: "Clinic", nameAr: "العيادة" };
      const linkedSessStatus = r.scheduledSessionId ? linkedSessionStatusMap.get(r.scheduledSessionId.toString()) : null;
      const effectiveStatus = (linkedSessStatus === "completed" || r.status === "completed") ? "completed" : r.status;
      return {
        id: r._id.toString(),
        clinicNameEn: c.nameEn,
        clinicNameAr: c.nameAr,
        offerName: r.offerId ? (offerMap.get(r.offerId.toString()) || "Booking") : (r.standaloneName || "Booking"),
        status: effectiveStatus,
        adminSuggestedAt: r.adminSuggestedAt || r.proposedAt || null,
        clinicScheduledAt: r.clinicScheduledAt || (['scheduled', 'completed', 'checked_in', 'in_progress', 'no_show'].includes(effectiveStatus) && r.proposedAt ? r.proposedAt : null),
        shownAt: r.shownAt || null,
        createdAt: r.createdAt || null
      };
    });

    const scans = scanDocs.map((sc: any) => {
      const c = clinicMap.get(sc.clinicId?.toString()) || { nameEn: "Clinic", nameAr: "العيادة" };
      return {
        id: sc._id.toString(),
        clinicNameEn: c.nameEn,
        clinicNameAr: c.nameAr,
        offerName: sc.offerName || "Membership",
        scannedAt: sc.scannedAt || sc.createdAt || null,
        status: sc.status || "attended",
        scannedBy: staffMap.get(sc.scannedByUserId?.toString()) || "Clinic Staff"
      };
    });

    return res.json({ requests, scans });
  } catch (e) {
    next(e);
  }
});

// ── Customer 360 Session Status (Sessions + Requests + Scans) ────────────────
adminRoutes.get("/admin/customer-session-status", authRequired, requireRole(["admin", "cs_director", "legal", "cs"]), async (req, res, next) => {
  try {
    const q = (typeof req.query.query === "string" ? req.query.query : (typeof req.query.q === "string" ? req.query.q : "")).trim();
    const userIdParam = typeof req.query.userId === "string" ? req.query.userId.trim() : "";

    if (!q && !userIdParam) {
      return res.json({
        targetUser: null,
        matchedUsers: [],
        sessions: [],
        requests: [],
        scans: [],
        memberships: [],
        stats: null
      });
    }

    let targetUser: any = null;
    let matchedUsers: any[] = [];

    if (userIdParam && mongoose.isValidObjectId(userIdParam)) {
      targetUser = await UserModel.findById(userIdParam).lean();
    }

    if (!targetUser && q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const cleanPhone = q.replace(/[^0-9]/g, "");

      const userSearchConditions: any[] = [
        { fullName: { $regex: escapedQ, $options: "i" } },
        { username: { $regex: escapedQ, $options: "i" } },
        { shortId: { $regex: escapedQ, $options: "i" } }
      ];
      if (cleanPhone.length >= 3) {
        userSearchConditions.push({ phone: { $regex: cleanPhone } });
      }
      if (mongoose.isValidObjectId(q)) {
        userSearchConditions.push({ _id: new mongoose.Types.ObjectId(q) });
      }

      matchedUsers = await UserModel.find({ $or: userSearchConditions })
        .select("_id fullName phone shortId email gender verificationStatus createdAt")
        .limit(10)
        .lean();

      if (matchedUsers.length > 0) {
        targetUser = matchedUsers[0];
      }
    }

    if (!targetUser) {
      return res.json({
        targetUser: null,
        matchedUsers: [],
        sessions: [],
        requests: [],
        scans: [],
        memberships: [],
        stats: null
      });
    }

    const userIdStr = targetUser._id.toString();
    const userObjId = targetUser._id;

    // 1. Memberships (UserOffers)
    const userOffers = await UserOfferModel.find({
      $or: [{ userId: userIdStr }, { userId: userObjId }]
    }).lean();

    const offerIds = [...new Set(userOffers.map(uo => uo.offerId).filter(Boolean))];
    const offers = offerIds.length > 0 ? await OfferModel.find({ _id: { $in: offerIds } }).lean() : [];
    const offerMap = new Map(offers.map((o: any) => [o._id.toString(), o.titleAr || o.titleEn || o.title || o.name || "Unknown Offer"]));

    const enrichedMemberships = userOffers.map((uo: any) => ({
      id: uo._id.toString(),
      offerId: uo.offerId?.toString(),
      offerName: offerMap.get(uo.offerId?.toString()) || uo.offerName || "Membership",
      membershipType: uo.membershipType,
      status: uo.status,
      maxSessions: uo.maxSessions ?? null,
      sessionsUsed: uo.sessionsUsed ?? 0,
      createdAt: uo.createdAt ? new Date(uo.createdAt).toISOString() : null,
      validUntil: uo.validUntil ? new Date(uo.validUntil).toISOString() : null,
      cashbackBalanceKwd: uo.cashbackBalanceKwd || "0.000"
    }));

    // 2. Sessions (BookingSessions)
    const sessions = await BookingSessionModel.find({
      $or: [{ userId: userIdStr }, { userId: userObjId }]
    }).sort({ scheduledAt: -1 }).lean();

    // 3. Requests (BookingRequests)
    const requests = await BookingRequestModel.find({
      $or: [{ userId: userIdStr }, { userId: userObjId }]
    }).sort({ createdAt: -1 }).lean();

    // 4. Scans (ScanLogs)
    const scans = await ScanLogModel.find({
      $or: [{ userId: userIdStr }, { userId: userObjId }]
    }).sort({ scannedAt: -1 }).lean();

    // Clinic lookup for all items
    const allClinicIds = [
      ...sessions.map(s => s.clinicId),
      ...requests.map(r => r.clinicId),
      ...scans.map(sc => sc.clinicId)
    ].filter(Boolean);
    const uniqueClinicIds = [...new Set(allClinicIds.map(id => id.toString()))];
    const clinicDocs = uniqueClinicIds.length > 0
      ? await ClinicModel.find({
          $or: [
            { _id: { $in: uniqueClinicIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { id: { $in: uniqueClinicIds } }
          ]
        }).lean()
      : [];
    const clinicMap = new Map<string, { nameEn: string; nameAr: string }>();
    for (const c of clinicDocs) {
      const cid = (c as any)._id.toString();
      clinicMap.set(cid, { nameEn: (c as any).nameEn || (c as any).name || cid, nameAr: (c as any).nameAr || (c as any).name || cid });
      if ((c as any).id) {
        clinicMap.set(String((c as any).id), { nameEn: (c as any).nameEn || (c as any).name || cid, nameAr: (c as any).nameAr || (c as any).name || cid });
      }
    }

    // Scanned by user lookup
    const scannedByUserIds = [...new Set(scans.map(s => s.scannedByUserId).filter(Boolean))];
    const staffDocs = scannedByUserIds.length > 0
      ? await UserModel.find({
          $or: [
            { _id: { $in: scannedByUserIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { _id: { $in: scannedByUserIds } }
          ]
        }).select("fullName username role").lean()
      : [];
    const staffMap = new Map(staffDocs.map((st: any) => [st._id.toString(), st.fullName || st.username || "Staff"]));

    // Enrich sessions
    const enrichedSessions = sessions.map((s: any) => {
      const c = clinicMap.get(s.clinicId?.toString()) || { nameEn: s.clinicId?.toString() || "Clinic", nameAr: s.clinicId?.toString() || "العيادة" };
      const offName = s.offerId ? (offerMap.get(s.offerId.toString()) || "Session") : (s.standaloneName || "Standalone Session");
      return {
        id: s._id.toString(),
        shortId: s.shortId || null,
        clinicId: s.clinicId?.toString(),
        clinicNameEn: c.nameEn,
        clinicNameAr: c.nameAr,
        offerName: offName,
        scheduledAt: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : null,
        status: s.status,
        clinicPaymentStatus: s.clinicPaymentStatus || "pending",
        sessionPriceKwd: s.sessionPriceKwd || "0.000",
        finalPaidKwd: s.finalPaidKwd || null,
        notes: s.notes || null,
        completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
        createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null
      };
    });

    // Enrich requests
    const enrichedRequests = requests.map((r: any) => {
      const c = clinicMap.get(r.clinicId?.toString()) || { nameEn: r.clinicId?.toString() || "Clinic", nameAr: r.clinicId?.toString() || "العيادة" };
      const offName = r.offerId ? (offerMap.get(r.offerId.toString()) || r.standaloneName || "Booking") : (r.standaloneName || "Booking");
      return {
        id: r._id.toString(),
        clinicId: r.clinicId?.toString(),
        clinicNameEn: c.nameEn,
        clinicNameAr: c.nameAr,
        offerName: offName,
        status: r.status,
        adminSuggestedAt: r.adminSuggestedAt ? new Date(r.adminSuggestedAt).toISOString() : (r.proposedAt ? new Date(r.proposedAt).toISOString() : null),
        clinicScheduledAt: r.clinicScheduledAt ? new Date(r.clinicScheduledAt).toISOString() : (['scheduled', 'completed', 'checked_in', 'in_progress', 'no_show'].includes(r.status) && r.proposedAt ? new Date(r.proposedAt).toISOString() : null),
        shownAt: r.shownAt ? new Date(r.shownAt).toISOString() : null,
        scheduledSessionId: r.scheduledSessionId || null,
        notes: r.notes || null,
        clinicPaymentStatus: r.clinicPaymentStatus || "pending",
        bookingRoute: r.bookingRoute || "cs",
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null
      };
    });

    // Enrich scans
    const enrichedScans = scans.map((sc: any) => {
      const c = clinicMap.get(sc.clinicId?.toString()) || { nameEn: sc.clinicId?.toString() || "Clinic", nameAr: sc.clinicId?.toString() || "العيادة" };
      return {
        id: sc._id.toString(),
        clinicId: sc.clinicId?.toString(),
        clinicNameEn: c.nameEn,
        clinicNameAr: c.nameAr,
        offerName: sc.offerName || (sc.userOfferId ? offerMap.get(sc.userOfferId.toString()) : null) || "Membership",
        scannedAt: sc.scannedAt ? new Date(sc.scannedAt).toISOString() : (sc.createdAt ? new Date(sc.createdAt).toISOString() : null),
        status: sc.status || "attended",
        hadScheduledSession: !!sc.hadScheduledSession,
        scannedBy: staffMap.get(sc.scannedByUserId?.toString()) || "Clinic Staff"
      };
    });

    const stats = {
      totalSessions: enrichedSessions.length,
      completedSessions: enrichedSessions.filter(s => s.status === "completed").length,
      scheduledSessions: enrichedSessions.filter(s => s.status === "scheduled").length,
      cancelledSessions: enrichedSessions.filter(s => s.status === "cancelled").length,
      totalRequests: enrichedRequests.length,
      completedRequests: enrichedRequests.filter(r => r.status === "completed").length,
      cancelledRequests: enrichedRequests.filter(r => r.status === "cancelled").length,
      totalScans: enrichedScans.length,
      attendedScans: enrichedScans.filter(sc => sc.status === "attended").length,
      totalMemberships: enrichedMemberships.length,
      activeMemberships: enrichedMemberships.filter(m => m.status === "active").length
    };

    return res.json({
      targetUser: {
        id: targetUser._id.toString(),
        fullName: targetUser.fullName || targetUser.username || "Customer",
        phone: targetUser.phone || "",
        shortId: targetUser.shortId || "",
        email: targetUser.email || "",
        gender: targetUser.gender || "",
        verificationStatus: targetUser.verificationStatus || "unverified",
        createdAt: targetUser.createdAt ? new Date(targetUser.createdAt).toISOString() : null
      },
      matchedUsers: matchedUsers.map((u: any) => ({
        id: u._id.toString(),
        fullName: u.fullName || u.username || "Customer",
        phone: u.phone || "",
        shortId: u.shortId || ""
      })),
      memberships: enrichedMemberships,
      sessions: enrichedSessions,
      requests: enrichedRequests,
      scans: enrichedScans,
      stats
    });
  } catch (e) {
    next(e);
  }
});

// ── Admin overview of all booking requests ────────────────────────────────
adminRoutes.get("/admin/requests", authRequired, requireRole(["admin", "cs_director", "legal", "cs", "clinicStaff"]), async (req, res, next) => {
  try {
    const userRole = req.auth?.role;
    const userClinicId = req.auth?.clinicId;

    const status = (typeof req.query.status === "string" ? req.query.status : "all") as AppointmentStatus | "all" | "open";
    let clinicId = typeof req.query.clinicId === "string" ? req.query.clinicId : undefined;
    if (userRole === "clinicStaff" && userClinicId) {
      clinicId = userClinicId.toString();
    }

    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 0;

    const items = await bookingRequestsStore.list({
      status,
      clinicId,
      ...(limit > 0 ? { limit, skip: Math.max(0, (page - 1) * limit) } : {})
    });
    
    // Batch-fetch all unique user IDs and clinic IDs in parallel safely
    const uniqueUserIds = [...new Set(items.map(it => it.userId))].filter(Boolean);
    const validUserObjectIds = uniqueUserIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));
    const uniqueClinicIds = [...new Set(items.map(it => it.clinicId))].filter(id => Boolean(id) && mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

    const [userDocs, clinicDocs] = await Promise.all([
      validUserObjectIds.length
        ? UserModel.find({ _id: { $in: validUserObjectIds } }).select("fullName phone username shortId").lean()
        : Promise.resolve([]),
      uniqueClinicIds.length
        ? ClinicModel.find({ _id: { $in: uniqueClinicIds } }).select("nameEn nameAr").lean()
        : Promise.resolve([])
    ]);

    const usersMap = new Map<string, { fullName?: string; phone?: string; username?: string; shortId?: string }>();
    for (const u of userDocs as any[]) {
      const uid = u._id.toString();
      usersMap.set(uid, {
        fullName: u.fullName,
        phone: u.phone,
        username: u.username,
        shortId: u.shortId
      });
    }

    const clinicMap = new Map((clinicDocs as any[]).map(c => [c._id.toString(), c]));

    const enriched = items.map((it) => {
      const c = clinicMap.get(it.clinicId) || {};
      const uInfo = usersMap.get(it.userId);
      return { 
        ...it, 
        clinicNameEn: (c as any).nameEn, 
        clinicNameAr: (c as any).nameAr,
        userName: uInfo?.fullName || uInfo?.username || it.userId,
        userPhone: uInfo?.phone || "",
        userShortId: uInfo?.shortId || "",
        adminSuggestedAt: it.adminSuggestedAt || it.proposedAt || null,
        clinicScheduledAt: it.clinicScheduledAt || (['scheduled', 'completed', 'checked_in', 'in_progress', 'no_show'].includes(it.status) ? it.proposedAt : null),
        shownAt: it.shownAt || null
      };
    });

    return res.json({ items: enriched });
  } catch (err: any) {
    console.error("[/admin/requests] Error:", err);
    return res.status(500).json({ error: "INTERNAL_ERROR", items: [] });
  }
});

// ── Admin / CS: manually adjust sessionsUsed on a membership ────────────────
adminRoutes.post("/admin/user-offers/:uoId/adjust-sessions", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const delta = typeof req.body?.delta === "number" ? Math.round(req.body.delta) : 0;
    const dateStr = typeof req.body?.date === "string" ? req.body.date : null;
    
    if (delta === 0 || Math.abs(delta) > 1) return res.status(400).json({ error: "INVALID_DELTA" });
    if (!mongoose.isValidObjectId(req.params.uoId)) return res.status(400).json({ error: "INVALID_ID" });

    const uo = await UserOfferModel.findById(req.params.uoId).lean();
    if (!uo) return res.status(404).json({ error: "NOT_FOUND" });

    const current = (uo as any).sessionsUsed ?? 0;
    const nextVal = Math.max(0, current + delta);
    if (nextVal === current) return res.json({ ok: true, sessionsUsed: current });

    const updateFields: any = { sessionsUsed: nextVal };
    if (delta > 0 && dateStr) {
      updateFields.lastManualSessionAt = new Date(dateStr);
    }
    await UserOfferModel.findByIdAndUpdate(req.params.uoId, { $set: updateFields });

    if (delta > 0 && dateStr) {
      let clinicId = (uo as any).clinicId;
      if (!clinicId) {
        const { ClinicModel } = await import("../../models/clinic.model.js");
        const defaultClinic = await ClinicModel.findOne().lean();
        clinicId = (defaultClinic as any)?._id;
      }
      
      if (clinicId) {
        await BookingSessionModel.create({
          userId: (uo as any).userId,
          offerId: (uo as any).offerId,
          userOfferId: req.params.uoId,
          clinicId: clinicId,
          status: "completed",
          scheduledAt: new Date(dateStr),
          completedAt: new Date(dateStr),
          scheduledBy: req.auth!.userId,
          notes: "Historical/Manual session increment"
        });
      }
    }

    return res.json({ ok: true, sessionsUsed: nextVal });
  } catch (e) {
    next(e);
  }
});

// ── Admin: Edit Date on any session or booking request (regardless of status) ──
adminRoutes.post("/admin/sessions-log/:id/edit-date", authRequired, requireRole(["admin", "cs", "legal", "cs_director", "clinicStaff"]), async (req, res, next) => {
  try {
    const { scheduledAt, type } = req.body;
    if (!scheduledAt || isNaN(new Date(scheduledAt).getTime())) {
      return res.status(400).json({ error: "INVALID_DATE" });
    }
    const newDate = new Date(scheduledAt);
    const id = req.params.id;

    // Clinic staff may only move appointments that belong to their own clinic.
    const target = mongoose.isValidObjectId(id)
      ? ((await BookingSessionModel.findById(id).select("clinicId scheduledAt status").lean()) as any) ??
        ((await BookingRequestModel.findById(id).select("clinicId proposedAt status").lean()) as any)
      : null;
    if (req.auth!.role === "clinicStaff") {
      if (!target || !(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, String(target.clinicId)))) {
        return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
      }
    }

    let updated = false;

    if (type === "session" || (mongoose.isValidObjectId(id) && await BookingSessionModel.exists({ _id: id }))) {
      const bs = await BookingSessionModel.findById(id);
      if (bs) {
        bs.scheduledAt = newDate;
        if (bs.status === "completed") {
          bs.completedAt = newDate;
        }
        if (bs.status === "no_show") {
          bs.status = "scheduled";
        }
        await bs.save();
        updated = true;

        const reqFilter: any = {
          $or: [
            ...(bs.bookingRequestId ? [{ _id: bs.bookingRequestId }] : []),
            { scheduledSessionId: bs._id.toString() }
          ]
        };
        await BookingRequestModel.updateMany(reqFilter, {
          $set: {
            proposedAt: newDate,
            clinicScheduledAt: newDate,
            adminSuggestedAt: newDate,
            preferredAt: newDate,
            ...(bs.status === "no_show" ? { status: "slot_assigned" } : {})
          }
        });
      }
    }

    if (!updated && (type === "request" || (mongoose.isValidObjectId(id) && await BookingRequestModel.exists({ _id: id })))) {
      const breq = await BookingRequestModel.findById(id);
      if (breq) {
        breq.proposedAt = newDate;
        breq.clinicScheduledAt = newDate;
        breq.adminSuggestedAt = newDate;
        breq.preferredAt = newDate;
        if (breq.status === "no_show") {
          breq.status = "slot_assigned";
        }
        await breq.save();
        updated = true;

        if (breq.scheduledSessionId) {
          const sess = await BookingSessionModel.findById(breq.scheduledSessionId);
          if (sess) {
            sess.scheduledAt = newDate;
            if (sess.status === "no_show") sess.status = "scheduled";
            if (sess.status === "completed") sess.completedAt = newDate;
            await sess.save();
          }
        }
      }
    }

    if (!updated && mongoose.isValidObjectId(id)) {
      const [bs, breq] = await Promise.all([
        BookingSessionModel.findById(id),
        BookingRequestModel.findById(id)
      ]);
      if (bs) {
        bs.scheduledAt = newDate;
        if (bs.status === "completed") bs.completedAt = newDate;
        if (bs.status === "no_show") bs.status = "scheduled";
        await bs.save();
        const reqFilter: any = {
          $or: [
            ...(bs.bookingRequestId ? [{ _id: bs.bookingRequestId }] : []),
            { scheduledSessionId: bs._id.toString() }
          ]
        };
        await BookingRequestModel.updateMany(reqFilter, {
          $set: {
            proposedAt: newDate,
            clinicScheduledAt: newDate,
            adminSuggestedAt: newDate,
            preferredAt: newDate
          }
        });
        updated = true;
      } else if (breq) {
        breq.proposedAt = newDate;
        breq.clinicScheduledAt = newDate;
        breq.adminSuggestedAt = newDate;
        breq.preferredAt = newDate;
        if (breq.status === "no_show") breq.status = "slot_assigned";
        await breq.save();
        if (breq.scheduledSessionId) {
          const sess = await BookingSessionModel.findById(breq.scheduledSessionId);
          if (sess) {
            sess.scheduledAt = newDate;
            if (sess.status === "no_show") sess.status = "scheduled";
            if (sess.status === "completed") sess.completedAt = newDate;
            await sess.save();
          }
        }
        updated = true;
      }
    }

    if (!updated) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    await logAuditAction({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role as any,
      actionType: "edit_appointment_date",
      targetEntityType: target?.scheduledAt !== undefined ? "BookingSession" : "BookingRequest",
      targetEntityId: id,
      beforeState: { scheduledAt: target?.scheduledAt ?? target?.proposedAt, status: target?.status },
      afterState: { scheduledAt: newDate.toISOString() },
      metadata: { notes: req.body?.notes }
    });

    return res.json({ ok: true, scheduledAt: newDate.toISOString() });
  } catch (e) {
    next(e);
  }
});

// ── Admin: Mark Attended on any session or booking request (including standalone) ──
adminRoutes.post(
  "/admin/sessions-log/:id/mark-attended",
  authRequired,
  requireRole(["admin", "cs", "legal", "cs_director"]),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { type, notes } = req.body;
      const now = new Date();
      const nowIso = now.toISOString();
      let updated = false;

      // 1. Try BookingSession
      if (type === "session" || (mongoose.isValidObjectId(id) && await BookingSessionModel.exists({ _id: id }))) {
        const bs = await BookingSessionModel.findById(id);
        if (bs) {
          bs.status = "completed";
          bs.completedAt = now;
          if (notes) bs.notes = bs.notes ? `${bs.notes} | ${notes}` : notes;
          await bs.save();
          updated = true;

          // Sync linked booking requests
          const reqFilter: any = {
            $or: [
              ...(bs.bookingRequestId ? [{ _id: bs.bookingRequestId }] : []),
              { scheduledSessionId: bs._id.toString() }
            ]
          };
          await BookingRequestModel.updateMany(reqFilter, {
            $set: {
              status: "completed",
              shownAt: nowIso
            }
          });

          if (req.auth?.userId) {
            await logAuditAction({
              actorId: req.auth.userId,
              actorRole: req.auth.role as any,
              actionType: "admin_manual_session_complete",
              targetEntityType: "BookingSession",
              targetEntityId: bs._id.toString(),
              beforeState: { status: bs.status },
              afterState: { status: "completed" },
              metadata: {
                shortId: (bs as any).shortId || bs._id.toString(),
                userId: bs.userId,
                clinicId: bs.clinicId,
                notes
              }
            });
          }
        }
      }

      // 2. Try BookingRequest (standalone or request-only)
      if (!updated && (type === "request" || (mongoose.isValidObjectId(id) && await BookingRequestModel.exists({ _id: id })))) {
        const breq = await BookingRequestModel.findById(id);
        if (breq) {
          breq.status = "completed";
          (breq as any).shownAt = now;
          breq.confirmedAt = breq.confirmedAt || now;
          if (notes) breq.notes = breq.notes ? `${breq.notes} | ${notes}` : notes;
          await breq.save();
          updated = true;

          // Sync linked session if exists
          if (breq.scheduledSessionId) {
            const bs = await BookingSessionModel.findById(breq.scheduledSessionId);
            if (bs) {
              bs.status = "completed";
              bs.completedAt = now;
              await bs.save();
            }
          }

          if (req.auth?.userId) {
            await logAuditAction({
              actorId: req.auth.userId,
              actorRole: req.auth.role as any,
              actionType: "admin_manual_session_complete",
              targetEntityType: "BookingRequest",
              targetEntityId: breq._id.toString(),
              beforeState: { status: breq.status },
              afterState: { status: "completed" },
              metadata: {
                userId: breq.userId,
                clinicId: breq.clinicId,
                notes
              }
            });
          }
        }
      }

      // Fallback: search both
      if (!updated && mongoose.isValidObjectId(id)) {
        const [bs, breq] = await Promise.all([
          BookingSessionModel.findById(id),
          BookingRequestModel.findById(id)
        ]);
        if (bs) {
          bs.status = "completed";
          bs.completedAt = now;
          if (notes) bs.notes = bs.notes ? `${bs.notes} | ${notes}` : notes;
          await bs.save();
          const reqFilter: any = {
            $or: [
              ...(bs.bookingRequestId ? [{ _id: bs.bookingRequestId }] : []),
              { scheduledSessionId: bs._id.toString() }
            ]
          };
          await BookingRequestModel.updateMany(reqFilter, {
            $set: { status: "completed", shownAt: nowIso }
          });
          updated = true;
        } else if (breq) {
          breq.status = "completed";
          (breq as any).shownAt = now;
          breq.confirmedAt = breq.confirmedAt || now;
          if (notes) breq.notes = breq.notes ? `${breq.notes} | ${notes}` : notes;
          await breq.save();
          if (breq.scheduledSessionId) {
            const sess = await BookingSessionModel.findById(breq.scheduledSessionId);
            if (sess) {
              sess.status = "completed";
              sess.completedAt = now;
              await sess.save();
            }
          }
          updated = true;
        }
      }

      if (!updated) {
        return res.status(404).json({ error: "NOT_FOUND" });
      }

      return res.json({ ok: true, status: "completed" });
    } catch (e) {
      next(e);
    }
  }
);

// ── Admin: Mark No-Show on any session or booking request ──
adminRoutes.post(
  "/admin/sessions-log/:id/mark-no-show",
  authRequired,
  requireRole(["admin", "cs", "legal", "cs_director"]),
  async (req, res, next) => {
    try {
      const id = req.params.id;
      const { type, notes } = req.body;
      let updated = false;

      if (type === "session" || (mongoose.isValidObjectId(id) && await BookingSessionModel.exists({ _id: id }))) {
        const bs = await BookingSessionModel.findById(id);
        if (bs) {
          bs.status = "no_show";
          (bs as any).completedAt = undefined;
          if (notes) bs.notes = bs.notes ? `${bs.notes} | ${notes}` : notes;
          await bs.save();
          updated = true;

          const reqFilter: any = {
            $or: [
              ...(bs.bookingRequestId ? [{ _id: bs.bookingRequestId }] : []),
              { scheduledSessionId: bs._id.toString() }
            ]
          };
          await BookingRequestModel.updateMany(reqFilter, {
            $set: { status: "no_show" }
          });
        }
      }

      if (!updated && (type === "request" || (mongoose.isValidObjectId(id) && await BookingRequestModel.exists({ _id: id })))) {
        const breq = await BookingRequestModel.findById(id);
        if (breq) {
          breq.status = "no_show";
          if (notes) breq.notes = breq.notes ? `${breq.notes} | ${notes}` : notes;
          await breq.save();
          updated = true;

          if (breq.scheduledSessionId) {
            const bs = await BookingSessionModel.findById(breq.scheduledSessionId);
            if (bs) {
              bs.status = "no_show";
              (bs as any).completedAt = undefined;
              await bs.save();
            }
          }
        }
      }

      if (!updated && mongoose.isValidObjectId(id)) {
        const [bs, breq] = await Promise.all([
          BookingSessionModel.findById(id),
          BookingRequestModel.findById(id)
        ]);
        if (bs) {
          bs.status = "no_show";
          (bs as any).completedAt = undefined;
          await bs.save();
          const reqFilter: any = {
            $or: [
              ...(bs.bookingRequestId ? [{ _id: bs.bookingRequestId }] : []),
              { scheduledSessionId: bs._id.toString() }
            ]
          };
          await BookingRequestModel.updateMany(reqFilter, { $set: { status: "no_show" } });
          updated = true;
        } else if (breq) {
          breq.status = "no_show";
          await breq.save();
          if (breq.scheduledSessionId) {
            const sess = await BookingSessionModel.findById(breq.scheduledSessionId);
            if (sess) {
              sess.status = "no_show";
              (sess as any).completedAt = undefined;
              await sess.save();
            }
          }
          updated = true;
        }
      }

      if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
      return res.json({ ok: true, status: "no_show" });
    } catch (e) {
      next(e);
    }
  }
);

adminRoutes.post("/admin/grant-session", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      clinicId: z.string().min(1),
      treatmentName: z.string().min(1),
      isPaid: z.boolean().default(false),
      priceKwd: z.string().default("0.000"),
      scheduledAt: z.string().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { userId, clinicId, treatmentName, isPaid, priceKwd, scheduledAt } = parsed.data;

    let offer = await OfferModel.findOne({ name: treatmentName, status: "hidden", offerKind: "treatment" });
    if (!offer) {
      offer = await OfferModel.create({
        name: treatmentName,
        type: "A",
        offerKind: "treatment",
        status: "hidden",
        active: true,
        maxSessions: 1,
        subscriptionPriceKwd: priceKwd,
        category: "all"
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const uo = await UserOfferModel.create({
      userId,
      offerId: offer._id,
      clinicId: new mongoose.Types.ObjectId(clinicId),
      status: "active",
      purchaseMode: "full",
      isStandalone: true,
      sessionsUsed: 0,
      activatedAt: now,
      expiresAt,
      paymentAmountKwd: priceKwd,
      paymentMethod: isPaid ? "cash" : "free",
      paymentConfirmedBy: req.auth!.userId,
      paymentConfirmedAt: now
    });

    const schedDate = scheduledAt ? new Date(scheduledAt) : now;
    const session = await BookingSessionModel.create({
      userOfferId: uo._id,
      userId,
      offerId: offer._id,
      clinicId: new mongoose.Types.ObjectId(clinicId),
      scheduledAt: schedDate,
      status: "scheduled",
      scheduledBy: req.auth!.userId,
    });

    const { BookingRequestModel } = await import("../../models/bookingRequest.model.js");
    await BookingRequestModel.create({
      userOfferId: String(uo._id),
      userId,
      offerId: String(offer._id),
      clinicId: clinicId,
      status: "confirmed",
      scheduledSessionId: String(session._id),
      clinicPaymentStatus: isPaid ? "paid" : "payment_pending",
      sessionPriceKwd: priceKwd,
      isStandalone: true,
      standaloneName: treatmentName,
      preferredAt: schedDate,
      confirmedAt: now,
      confirmedBy: req.auth!.userId
    });

    return res.status(201).json({ ok: true, userOfferId: String(uo._id), sessionId: String(session._id) });
  } catch (e) {
    next(e);
  }
});

adminRoutes.post("/admin/sessions/:sessionId/change-clinic", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      clinicId: z.string().min(1),
      isPaid: z.boolean().default(false),
      feeAmount: z.string().default("5.000")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { clinicId, isPaid, feeAmount } = parsed.data;
    if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });

    const session = await BookingSessionModel.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "SESSION_NOT_FOUND" });

    if (isPaid) {
      const resAdjust = await kycStore.adjustUnlocked({
        userId: session.userId,
        amountKwd: `-${feeAmount}`,
        reason: `Clinic change fee for session: ${session.shortId || session._id}`,
        createdById: req.auth!.userId
      });
      if (resAdjust && "error" in resAdjust) {
        if (resAdjust.error === "UNLOCKED_BELOW_ZERO") {
          return res.status(400).json({ error: "INSUFFICIENT_FUNDS" });
        }
        return res.status(400).json({ error: resAdjust.error });
      }
    }

    session.clinicId = new mongoose.Types.ObjectId(clinicId);
    await session.save();

    return res.json({ ok: true, clinicId: String(session.clinicId) });
  } catch (e) {
    next(e);
  }
});

adminRoutes.post("/admin/requests/:requestId/change-clinic", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const schema = z.object({
      clinicId: z.string().min(1),
      isPaid: z.boolean().default(false),
      feeAmount: z.string().default("5.000")
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT", details: parsed.error.issues });

    const { clinicId, isPaid, feeAmount } = parsed.data;
    if (!mongoose.isValidObjectId(clinicId)) return res.status(400).json({ error: "INVALID_CLINIC_ID" });

    const breq = await BookingRequestModel.findById(req.params.requestId);
    if (!breq) return res.status(404).json({ error: "REQUEST_NOT_FOUND" });

    if (isPaid) {
      const resAdjust = await kycStore.adjustUnlocked({
        userId: breq.userId,
        amountKwd: `-${feeAmount}`,
        reason: `Clinic change fee for booking request: ${breq.shortId || breq._id}`,
        createdById: req.auth!.userId
      });
      if (resAdjust && "error" in resAdjust) {
        if (resAdjust.error === "UNLOCKED_BELOW_ZERO") {
          return res.status(400).json({ error: "INSUFFICIENT_FUNDS" });
        }
        return res.status(400).json({ error: resAdjust.error });
      }
    }

    breq.clinicId = new mongoose.Types.ObjectId(clinicId);
    await breq.save();

    return res.json({ ok: true, clinicId: String(breq.clinicId) });
  } catch (e) {
    next(e);
  }
});

// ── Admin reverts a booking request back to under_review ────────────────────
adminRoutes.post("/admin/requests/:requestId/revert", authRequired, requireRole(["cs", "legal", "admin", "cs_director"]), async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.requestId);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });

    const updated = await withTransaction(async () => {
      // Delete the associated session if one was created
      if (breq.scheduledSessionId && mongoose.isValidObjectId(breq.scheduledSessionId)) {
        await BookingSessionModel.findByIdAndDelete(breq.scheduledSessionId);

        // Decrement sessionsUsed on the user offer (only for non-standalone)
        if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
          const uo = await UserOfferModel.findById(breq.userOfferId);
          if (uo && (uo.sessionsUsed ?? 0) > 0) {
            await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: -1 } });
          }
        }
      }

      // Refund cashback if it was deducted
      if (breq.cashbackDeductedKwd && parseFloat(breq.cashbackDeductedKwd) > 0) {
        const refund = parseFloat(breq.cashbackDeductedKwd);
        if (breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
          await userOfferService.adjustCashbackBalance(breq.userOfferId, kwdToMils(refund));
        }
        await kycStore.adjustUnlocked({
          userId: breq.userId,
          amountKwd: refund.toFixed(3),
          reason: "Refund from reverted booking",
          createdById: req.auth!.userId
        });
      }

      // Revert the request status back to under_review
      return bookingRequestsStore.update(breq.id, {
        status: "request_received",
        confirmedAt: undefined,
        confirmedBy: undefined,
        scheduledSessionId: undefined,
        clinicPaymentStatus: undefined,
        clinicPaymentMarkedAt: undefined,
        clinicPaymentMarkedBy: undefined,
      });
    });

    if (updated?.conversationId) {
      await postSystemMessage(
        updated.conversationId,
        "booking_reverted",
        `Booking reverted to pending by admin.`,
        { bookingRequestId: updated.id },
        req.auth!.userId
      );
    }

    return res.json({ ok: true, request: updated });
  } catch (e) {
    next(e);
  }
});

// ── Admin: Delete all historical session documents ──────────────────────────
adminRoutes.delete("/admin/historical-sessions", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const result = await BookingSessionModel.deleteMany({
      $or: [
        { notes: "Historical session logged during enrollment" },
        { scheduledAt: { $lt: new Date("2026-07-01T00:00:00Z") } }
      ]
    });
    return res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e) {
    next(e);
  }
});

// ── Admin: update notes on a booking request ────────────────────────────────
adminRoutes.post("/admin/requests/:requestId/update-notes", authRequired, requireRole(["admin", "cs", "legal", "cs_director"]), async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.requestId);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });
    const { notes } = req.body as { notes?: string };
    if (typeof notes !== "string") return res.status(400).json({ error: "NOTES_REQUIRED" });
    const updated = await bookingRequestsStore.update(breq.id, { notes });
    return res.json({ ok: true, request: updated });
  } catch (e) {
    next(e);
  }
});

// ── Admin / Clinic: delete a booking request ────────────────────────────────
adminRoutes.delete("/admin/requests/:requestId", authRequired, requireRole(["admin", "cs", "legal", "cs_director", "clinicStaff"]), async (req, res, next) => {
  try {
    const breq = await bookingRequestsStore.get(req.params.requestId);
    if (!breq) return res.status(404).json({ error: "NOT_FOUND" });

    if (req.auth!.role === "clinicStaff" && !(await canActOnClinic({ userId: req.auth!.userId, role: req.auth!.role }, breq.clinicId))) {
      return res.status(403).json({ error: "FORBIDDEN_CLINIC" });
    }

    await withTransaction(async () => {
      if (breq.scheduledSessionId && mongoose.isValidObjectId(breq.scheduledSessionId)) {
        await BookingSessionModel.findByIdAndDelete(breq.scheduledSessionId);

        if (!breq.isStandalone && breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
          const uo = await UserOfferModel.findById(breq.userOfferId);
          if (uo && (uo.sessionsUsed ?? 0) > 0) {
            await UserOfferModel.findByIdAndUpdate(breq.userOfferId, { $inc: { sessionsUsed: -1 } });
          }
        }
      }

      if (breq.cashbackDeductedKwd && parseFloat(breq.cashbackDeductedKwd) > 0) {
        const refund = parseFloat(breq.cashbackDeductedKwd);
        if (breq.userOfferId && mongoose.isValidObjectId(breq.userOfferId)) {
          await userOfferService.adjustCashbackBalance(breq.userOfferId, kwdToMils(refund));
        }
        await kycStore.adjustUnlocked({
          userId: breq.userId,
          amountKwd: refund.toFixed(3),
          reason: "Refund from deleted booking",
          createdById: req.auth!.userId
        });
      }

      await BookingRequestModel.findByIdAndDelete(breq.id);
    });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ── Admin: Get scan logs history ───────────────────────────────────────────
adminRoutes.get("/admin/scan-logs", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const { clinicId, offerId, search } = req.query;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));

    const filter: any = {};

    if (clinicId && typeof clinicId === "string" && clinicId.trim()) {
      filter.clinicId = clinicId.trim();
    }

    if (offerId && typeof offerId === "string" && offerId.trim()) {
      const trimmedOfferId = offerId.trim();
      const matchingUserOffers = await UserOfferModel.find({
        $or: [
          { offerId: mongoose.isValidObjectId(trimmedOfferId) ? new mongoose.Types.ObjectId(trimmedOfferId) : trimmedOfferId },
          { _id: mongoose.isValidObjectId(trimmedOfferId) ? new mongoose.Types.ObjectId(trimmedOfferId) : trimmedOfferId }
        ]
      }).select("_id").lean();
      const uoIds = matchingUserOffers.map((uo: any) => String(uo._id));
      uoIds.push(trimmedOfferId);
      filter.userOfferId = { $in: uoIds };
    }

    if (search && typeof search === "string" && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const matchingUsers = await UserModel.find({
        $or: [
          { fullName: searchRegex },
          { phone: searchRegex },
          { username: searchRegex }
        ]
      }).select("_id").lean();
      const userIds = matchingUsers.map((u: any) => String(u._id));
      filter.userId = { $in: userIds };
    }

    const skip = (page - 1) * limit;

    const [total, rawLogs] = await Promise.all([
      ScanLogModel.countDocuments(filter),
      ScanLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const customerUserIds = [...new Set(rawLogs.map((l: any) => l.userId).filter(Boolean))];
    const scannerUserIds = [...new Set(rawLogs.map((l: any) => l.scannedByUserId).filter(Boolean))];
    const allUserIds = [...new Set([...customerUserIds, ...scannerUserIds])];

    const clinicIds = [...new Set(rawLogs.map((l: any) => l.clinicId).filter((id): id is string => Boolean(id) && id !== "admin"))];

    const validUserObjIds = allUserIds.filter((id) => mongoose.isValidObjectId(id));
    const validClinicObjIds = clinicIds.filter((id) => mongoose.isValidObjectId(id));

    const [users, clinics] = await Promise.all([
      validUserObjIds.length ? UserModel.find({ _id: { $in: validUserObjIds } }).select("_id fullName username phone").lean() : [],
      validClinicObjIds.length ? ClinicModel.find({ _id: { $in: validClinicObjIds } }).select("_id nameEn nameAr").lean() : []
    ]);

    const userMap = new Map<string, { name: string; phone?: string }>();
    for (const u of users as any[]) {
      const name = u.fullName || u.username || "Unknown";
      userMap.set(String(u._id), { name, phone: u.phone });
    }

    const clinicMap = new Map<string, { nameEn: string; nameAr: string }>();
    for (const c of clinics as any[]) {
      clinicMap.set(String(c._id), { nameEn: c.nameEn || "", nameAr: c.nameAr || "" });
    }

    const items = rawLogs.map((log: any) => {
      const customer = userMap.get(log.userId);
      const scanner = userMap.get(log.scannedByUserId);
      const clinic = clinicMap.get(log.clinicId);

      return {
        ...log,
        id: String(log._id),
        userName: customer?.name ?? "Unknown",
        userPhone: customer?.phone ?? null,
        scannedByName: scanner?.name ?? log.scannedByUserId,
        clinicNameEn: clinic?.nameEn ?? (log.clinicId === "admin" ? "Admin" : ""),
        clinicNameAr: clinic?.nameAr ?? (log.clinicId === "admin" ? "Admin" : ""),
        offerName: log.offerName ?? null,
      };
    });

    const pages = Math.ceil(total / limit) || 1;

    return res.json({
      items,
      total,
      page,
      pages
    });
  } catch (e) {
    next(e);
  }
});
