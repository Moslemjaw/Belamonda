import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { reportingStore } from "./reporting.store.js";
import { computeFinanceSnapshot } from "./analytics.service.js";

const CreateReportSchema = z.object({
  type: z.enum(["daily_summary", "weekly_pl", "monthly_cashback_liability", "yearly_revenue", "custom"]),
  from: z.string().datetime(),
  to: z.string().datetime()
});

export const reportingRouter = Router();

reportingRouter.get("/finance/snapshot", authRequired, requireRole(["finance", "admin"]), async (_req, res, next) => {
  try {
    const snapshot = await computeFinanceSnapshot();
    return res.json({ snapshot });
  } catch (e) {
    next(e);
  }
});

reportingRouter.post("/finance/reports", authRequired, requireRole(["finance", "admin"]), async (req, res, next) => {
  try {
    const parsed = CreateReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const report = reportingStore.create({ requestedBy: req.auth!.userId, ...parsed.data });
    reportingStore.setProcessing(report.id);

    try {
      const snapshot = await computeFinanceSnapshot();
      const result = {
        generatedAt: new Date().toISOString(),
        type: report.type,
        from: report.from,
        to: report.to,
        snapshot
      };
      reportingStore.setReady(report.id, result);
    } catch (e) {
      reportingStore.setFailed(report.id, e instanceof Error ? e.message : "UNKNOWN");
    }

    return res.status(202).json({ reportId: report.id });
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/reports", authRequired, requireRole(["finance", "admin"]), (req, res) => {
  return res.json({ items: reportingStore.listByUser(req.auth!.userId) });
});

reportingRouter.get("/finance/reports/:id", authRequired, requireRole(["finance", "admin"]), (req, res) => {
  const r = reportingStore.get(req.params.id);
  if (!r) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ report: r });
});
