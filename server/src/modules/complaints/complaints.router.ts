import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";

interface Complaint {
  id: string;
  userId: string;
  category: string;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "escalated" | "resolved" | "closed";
  assignedDept?: string;
  createdAt: string;
  updatedAt: string;
  updates: { by: string; note: string; status: string; at: string }[];
}

const complaints = new Map<string, Complaint>();
let seq = 0;

const CreateSchema = z.object({
  category: z.enum(["service_quality", "billing", "scheduling", "cashback", "clinic", "other"]),
  subject: z.string().min(3),
  description: z.string().min(10),
});

const UpdateSchema = z.object({
  status: z.enum(["in_progress", "escalated", "resolved", "closed"]).optional(),
  note: z.string().min(1),
});

export const complaintsRouter = Router();

// Customer submits complaint
complaintsRouter.post("/me", authRequired, (req, res) => {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const id = `complaint_${++seq}_${Date.now().toString(16)}`;
  const now = new Date().toISOString();
  const complaint: Complaint = {
    id,
    userId: req.auth!.userId,
    category: parsed.data.category,
    subject: parsed.data.subject,
    description: parsed.data.description,
    status: "open",
    createdAt: now,
    updatedAt: now,
    updates: [],
  };
  complaints.set(id, complaint);
  return res.status(201).json({ complaint });
});

// Customer lists own complaints
complaintsRouter.get("/me", authRequired, (req, res) => {
  const items = Array.from(complaints.values())
    .filter((c) => c.userId === req.auth!.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ items });
});

// CS/Admin list all complaints
complaintsRouter.get("/all", authRequired, requireRole(["cs", "admin"]), (_req, res) => {
  const items = Array.from(complaints.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return res.json({ items, total: items.length });
});

// CS/Admin update complaint
complaintsRouter.post("/:id/update", authRequired, requireRole(["cs", "admin"]), (req, res) => {
  const complaint = complaints.get(req.params.id);
  if (!complaint) return res.status(404).json({ error: "NOT_FOUND" });

  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

  const now = new Date().toISOString();
  if (parsed.data.status) complaint.status = parsed.data.status;
  complaint.updatedAt = now;
  complaint.updates.push({
    by: req.auth!.userId,
    note: parsed.data.note,
    status: parsed.data.status || complaint.status,
    at: now,
  });

  return res.json({ complaint });
});
