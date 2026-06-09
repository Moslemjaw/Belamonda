import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { TaskModel, TaskUpdateModel } from "../../models/task.model.js";

const DeptSchema = z.enum(["admin", "cs", "finance", "clinic"]);

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["red", "yellow", "green"]),
  assignedDepartments: z.array(DeptSchema).min(1),
  dueDate: z.string().datetime(),
  attachmentRef: z.string().optional()
});

const AdminUpdateSchema = CreateTaskSchema.partial().extend({
  status: z.enum(["todo", "in_progress", "completed", "archived"]).optional()
});

const StaffUpdateSchema = z.object({
  statusChange: z.enum(["in_progress", "completed"]).optional(),
  notes: z.string().min(1).optional()
});

function serializeTask(t: any) {
  return {
    id: String(t._id),
    title: t.title,
    description: t.description,
    priority: t.priority,
    assignedDepartments: t.assignedDepartments ?? [],
    dueDate: new Date(t.dueDate).toISOString(),
    status: t.status,
    attachmentRef: t.attachmentRef,
    createdBy: t.createdBy,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : undefined
  };
}

function serializeUpdate(u: any) {
  return {
    id: String(u._id),
    taskId: String(u.taskId),
    updatedBy: u.updatedBy,
    statusChange: u.statusChange,
    notes: u.notes,
    updatedAt: u.createdAt ? new Date(u.createdAt).toISOString() : undefined
  };
}

export const tasksRouter = Router();

tasksRouter.post("/admin", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = CreateTaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const doc = await TaskModel.create({
      ...parsed.data,
      dueDate: new Date(parsed.data.dueDate),
      createdBy: req.auth!.userId,
      status: "todo"
    });
    return res.status(201).json({ task: serializeTask(doc.toObject()) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.get("/admin", authRequired, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const rows = await TaskModel.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ items: rows.map(serializeTask) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.patch("/admin/:taskId", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    const parsed = AdminUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    if (!mongoose.isValidObjectId(req.params.taskId)) return res.status(400).json({ error: "INVALID_ID" });
    const patch: any = { ...parsed.data };
    if (patch.dueDate) patch.dueDate = new Date(patch.dueDate);
    const doc = await TaskModel.findByIdAndUpdate(req.params.taskId, patch, { new: true }).lean();
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ task: serializeTask(doc) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.get("/dept/:dept/today", authRequired, async (req, res, next) => {
  try {
    const dept = DeptSchema.safeParse(req.params.dept);
    if (!dept.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const rows = await TaskModel.find({
      assignedDepartments: dept.data,
      dueDate: { $gte: start, $lt: end },
      status: { $ne: "archived" }
    })
      .sort({ dueDate: 1 })
      .lean();
    return res.json({ items: rows.map(serializeTask) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.get("/dept/:dept/all", authRequired, async (req, res, next) => {
  try {
    const dept = DeptSchema.safeParse(req.params.dept);
    if (!dept.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    const rows = await TaskModel.find({ assignedDepartments: dept.data }).sort({ createdAt: -1 }).lean();
    return res.json({ items: rows.map(serializeTask) });
  } catch (e) {
    next(e);
  }
});

tasksRouter.post("/dept/:dept/:taskId/update", authRequired, async (req, res, next) => {
  try {
    const dept = DeptSchema.safeParse(req.params.dept);
    if (!dept.success) return res.status(400).json({ error: "VALIDATION_ERROR" });

    const parsed = StaffUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    if (!mongoose.isValidObjectId(req.params.taskId)) return res.status(400).json({ error: "INVALID_ID" });

    const task = await TaskModel.findById(req.params.taskId).lean();
    if (!task) return res.status(404).json({ error: "NOT_FOUND" });
    if (!(task as any).assignedDepartments?.includes(dept.data)) return res.status(403).json({ error: "FORBIDDEN" });

    const upd = await TaskUpdateModel.create({
      taskId: new mongoose.Types.ObjectId(req.params.taskId),
      updatedBy: req.auth!.userId,
      statusChange: parsed.data.statusChange,
      notes: parsed.data.notes
    });
    if (parsed.data.statusChange) {
      await TaskModel.findByIdAndUpdate(req.params.taskId, { status: parsed.data.statusChange });
    }

    const updatedTask = await TaskModel.findById(req.params.taskId).lean();
    const updates = await TaskUpdateModel.find({ taskId: req.params.taskId }).sort({ createdAt: -1 }).lean();
    return res.json({
      task: updatedTask ? serializeTask(updatedTask) : null,
      update: serializeUpdate(upd.toObject()),
      updates: updates.map(serializeUpdate)
    });
  } catch (e) {
    next(e);
  }
});

tasksRouter.get("/admin/:taskId/updates", authRequired, requireRole(["admin"]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.taskId)) return res.status(400).json({ error: "INVALID_ID" });
    const task = await TaskModel.findById(req.params.taskId).lean();
    if (!task) return res.status(404).json({ error: "NOT_FOUND" });
    const updates = await TaskUpdateModel.find({ taskId: req.params.taskId }).sort({ createdAt: -1 }).lean();
    return res.json({ task: serializeTask(task), updates: updates.map(serializeUpdate) });
  } catch (e) {
    next(e);
  }
});

