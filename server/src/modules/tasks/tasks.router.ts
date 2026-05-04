import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { tasksStore } from "./tasks.store.js";

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

export const tasksRouter = Router();

// Admin CRUD-lite
tasksRouter.post("/admin", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const task = tasksStore.create({ ...parsed.data, createdBy: req.auth!.userId });
  return res.status(201).json({ task });
});

tasksRouter.get("/admin", authRequired, requireRole(["admin"]), (_req, res) => {
  return res.json({ items: tasksStore.listAll() });
});

tasksRouter.patch("/admin/:taskId", authRequired, requireRole(["admin"]), (req, res) => {
  const parsed = AdminUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
  const task = tasksStore.updateAdmin(req.params.taskId, parsed.data as any);
  if (!task) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ task });
});

// Department views (Today's Tasks panel per SRS §5.6)
tasksRouter.get("/dept/:dept/today", authRequired, (req, res) => {
  const dept = DeptSchema.safeParse(req.params.dept);
  if (!dept.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  return res.json({ items: tasksStore.listTodaysForDepartment(dept.data) });
});

tasksRouter.get("/dept/:dept/all", authRequired, (req, res) => {
  const dept = DeptSchema.safeParse(req.params.dept);
  if (!dept.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
  return res.json({ items: tasksStore.listForDepartment(dept.data) });
});

// Staff updates: status + notes (cannot delete/reassign)
tasksRouter.post("/dept/:dept/:taskId/update", authRequired, (req, res) => {
  const dept = DeptSchema.safeParse(req.params.dept);
  if (!dept.success) return res.status(400).json({ error: "VALIDATION_ERROR" });

  const parsed = StaffUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const task = tasksStore.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: "NOT_FOUND" });
  if (!task.assignedDepartments.includes(dept.data)) return res.status(403).json({ error: "FORBIDDEN" });

  const upd = tasksStore.addUpdate(req.params.taskId, {
    updatedBy: req.auth!.userId,
    statusChange: parsed.data.statusChange,
    notes: parsed.data.notes
  });
  if (!upd) return res.status(404).json({ error: "NOT_FOUND" });

  return res.json({ task: tasksStore.get(req.params.taskId), update: upd, updates: tasksStore.getUpdates(req.params.taskId) });
});

tasksRouter.get("/admin/:taskId/updates", authRequired, requireRole(["admin"]), (req, res) => {
  const task = tasksStore.get(req.params.taskId);
  if (!task) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ task, updates: tasksStore.getUpdates(req.params.taskId) });
});

