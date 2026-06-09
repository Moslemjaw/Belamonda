import { Router } from "express";
import { z } from "zod";
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

    res.json({
      items: items.map(i => ({
        id:               String(i._id),
        actorId:          String(i.actorId),
        actorRole:        i.actorRole,
        actionType:       i.actionType,
        targetEntityType: i.targetEntityType,
        targetEntityId:   String(i.targetEntityId),
        beforeState:      i.beforeState,
        afterState:       i.afterState,
        metadata:         i.metadata,
        createdAt:        i.createdAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid query parameters" });
  }
});
