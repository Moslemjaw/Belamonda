import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { UserModel } from "../../models/user.model.js";

export const usersRouter = Router();

usersRouter.get("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const role = typeof req.query.role === "string" ? req.query.role : "";
    const status = typeof req.query.status === "string" ? req.query.status : ""; // active|disabled|all

    const filter: any = {};
    if (role && role !== "all") filter.role = role;
    if (status === "active") filter.isActive = true;
    if (status === "disabled") filter.isActive = false;
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } }
      ];
    }

    const rows = await UserModel.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    const items = rows.map((u: any) => ({
      id: String(u._id),
      username: u.username,
      email: u.email,
      phone: u.phone,
      role: u.role,
      clinicId: u.clinicId ? String(u.clinicId) : undefined,
      isActive: u.isActive !== false,
      createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined,
      updatedAt: u.updatedAt ? new Date(u.updatedAt).toISOString() : undefined
    }));
    return res.json({ items });
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

    const patch: any = {};
    if (parsed.data.role) patch.role = parsed.data.role;
    if (parsed.data.isActive != null) patch.isActive = parsed.data.isActive;
    if (parsed.data.clinicId != null) {
      patch.clinicId = parsed.data.clinicId ? new mongoose.Types.ObjectId(parsed.data.clinicId) : undefined;
    }

    const doc = await UserModel.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({
      user: {
        id: String((doc as any)._id),
        username: (doc as any).username,
        email: (doc as any).email,
        phone: (doc as any).phone,
        role: (doc as any).role,
        clinicId: (doc as any).clinicId ? String((doc as any).clinicId) : undefined,
        isActive: (doc as any).isActive !== false
      }
    });
  } catch (e) {
    next(e);
  }
});

