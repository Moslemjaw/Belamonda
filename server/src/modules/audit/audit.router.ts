import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { AuditLogModel } from "../../models/auditLog.model.js";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";

export const auditRouter = Router();

auditRouter.get("/", authRequired, requireRole(["admin"]), async (req, res) => {
  const querySchema = z.object({
    page:             z.string().optional().transform(v => Math.max(1, parseInt(v ?? "1", 10))),
    limit:            z.string().optional().transform(v => Math.min(100, parseInt(v ?? "50", 10))),
    actorRole:        z.string().optional(),
    actionType:       z.string().optional(),
    targetEntityType: z.string().optional(),
    search:           z.string().optional(),
    startDate:        z.string().optional(),
    endDate:          z.string().optional(),
  });

  try {
    const { page, limit, actorRole, actionType, targetEntityType, search, startDate, endDate } =
      querySchema.parse(req.query);

    const query: any = {};
    if (actorRole)        query.actorRole = actorRole;
    if (actionType)       query.actionType = { $regex: actionType, $options: "i" };
    if (targetEntityType) query.targetEntityType = targetEntityType;
    if (search) {
      query.$or = [
        { actionType:        { $regex: search, $options: "i" } },
        { targetEntityType:  { $regex: search, $options: "i" } },
        { "metadata.note":   { $regex: search, $options: "i" } },
      ];
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const skip  = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(query),
    ]);

    const { UserModel } = await import("../../models/user.model.js");
    const { OfferModel } = await import("../../models/offer.model.js");
    const { PaymentModel } = await import("../../models/payment.model.js");
    const { KycSubmissionModel } = await import("../../models/kyc.model.js");

    const userIds = new Set<string>();
    const offerIds = new Set<string>();
    const paymentIds = new Set<string>();
    const kycIds = new Set<string>();

    items.forEach(i => {
      if (i.actorId !== "system" && mongoose.isValidObjectId(i.actorId)) userIds.add(String(i.actorId));
      const tid = String(i.targetEntityId);
      if (mongoose.isValidObjectId(tid)) {
        if (i.targetEntityType === "User") userIds.add(tid);
        if (i.targetEntityType === "Offer") offerIds.add(tid);
        if (i.targetEntityType === "Payment") paymentIds.add(tid);
        if (i.targetEntityType === "KycSubmission") kycIds.add(tid);
      }
    });

    const [offersList, paymentsList, kycList] = await Promise.all([
      OfferModel.find({ _id: { $in: [...offerIds] } }).select("name").lean(),
      PaymentModel.find({ _id: { $in: [...paymentIds] } }).select("amountKwd purpose").lean(),
      KycSubmissionModel.find({ _id: { $in: [...kycIds] } }).select("userId").lean(),
    ]);

    kycList.forEach((k: any) => userIds.add(k.userId));
    const usersList = await UserModel.find({ _id: { $in: [...userIds] } }).select("fullName phone").lean();

    const entityNames = new Map<string, string>();
    usersList.forEach((u: any) => entityNames.set(`User:${u._id}`, u.fullName || u.phone || String(u._id)));
    offersList.forEach((o: any) => entityNames.set(`Offer:${o._id}`, o.name || String(o._id)));
    paymentsList.forEach((p: any) => entityNames.set(`Payment:${p._id}`, `${p.amountKwd} KWD (${p.purpose.replace(/_/g, " ")})`));
    kycList.forEach((k: any) => entityNames.set(`KycSubmission:${k._id}`, entityNames.get(`User:${k.userId}`) || String(k._id)));

    res.json({
      items: items.map(i => {
        const actorId = String(i.actorId);
        const targetId = String(i.targetEntityId);
        return {
          id:               String(i._id),
          actorId,
          actorName:        actorId === "system" ? "System" : (entityNames.get(`User:${actorId}`) || "Unknown User"),
          actorRole:        i.actorRole,
          actionType:       i.actionType,
          targetEntityType: i.targetEntityType,
          targetEntityId:   targetId,
          targetEntityName: entityNames.get(`${i.targetEntityType}:${targetId}`) || null,
          beforeState:      i.beforeState,
          afterState:       i.afterState,
          metadata:         i.metadata,
          createdAt:        i.createdAt,
        };
      }),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid query parameters" });
  }
});
