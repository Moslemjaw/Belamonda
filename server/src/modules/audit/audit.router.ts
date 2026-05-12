import { Router } from "express";
import { z } from "zod";
import { AuditLogModel } from "../../models/auditLog.model.js";

export const auditRouter = Router();

// Only Admins can access this
auditRouter.get("/", async (req, res) => {
  const user = (req as any).user;
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const querySchema = z.object({
    page: z.string().optional().transform(v => parseInt(v ?? "1", 10)),
    limit: z.string().optional().transform(v => parseInt(v ?? "50", 10)),
    actorRole: z.string().optional(),
    actionType: z.string().optional(),
    targetEntityType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  });

  try {
    const { page, limit, actorRole, actionType, targetEntityType, startDate, endDate } = querySchema.parse(req.query);
    const query: any = {};

    if (actorRole) query.actorRole = actorRole;
    if (actionType) query.actionType = actionType;
    if (targetEntityType) query.targetEntityType = targetEntityType;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const items = await AuditLogModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const total = await AuditLogModel.countDocuments(query);

    res.json({
      items: items.map(i => ({
        id: i._id.toString(),
        actorId: i.actorId.toString(),
        actorRole: i.actorRole,
        actionType: i.actionType,
        targetEntityType: i.targetEntityType,
        targetEntityId: i.targetEntityId.toString(),
        beforeState: i.beforeState,
        afterState: i.afterState,
        metadata: i.metadata,
        createdAt: i.createdAt
      })),
      total,
      page,
      limit
    });
  } catch (error) {
    res.status(400).json({ error: "Invalid query parameters" });
  }
});
