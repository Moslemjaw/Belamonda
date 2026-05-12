import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { reportingStore } from "./reporting.store.js";
import {
  computeFinanceSnapshot,
  computePaymentsBreakdown,
  computeFinanceTimeseries,
  computeRevenueByOffer,
  computeRevenueByUser,
  computeRevenueByReferral,
  computeInstallmentsAnalytics,
  exportFinanceCsv,
  exportFinanceXlsx,
} from "./analytics.service.js";

const CreateReportSchema = z.object({
  type: z.enum(["daily_summary", "weekly_pl", "monthly_cashback_liability", "yearly_revenue", "custom"]),
  from: z.string().datetime(),
  to: z.string().datetime()
});

export const reportingRouter = Router();

const FINANCE_ROLES: ("finance" | "admin")[] = ["finance", "admin"];

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

reportingRouter.get("/finance/payments-breakdown", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computePaymentsBreakdown({
      status: str(req.query.status),
      method: str(req.query.method),
      purpose: str(req.query.purpose),
      from: str(req.query.from),
      to: str(req.query.to),
    });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/snapshot", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const snapshot = await computeFinanceSnapshot({ from: str(req.query.from), to: str(req.query.to) });
    return res.json({ snapshot });
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/timeseries", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const period = str(req.query.period) as any;
    const allowed = ["daily", "weekly", "monthly", "yearly"];
    if (!allowed.includes(period)) return res.status(400).json({ error: "INVALID_PERIOD" });
    const data = await computeFinanceTimeseries({ period, from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/by-offer", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computeRevenueByOffer({ from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/by-user", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computeRevenueByUser({ from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/by-referral", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computeRevenueByReferral({ from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/installments", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computeInstallmentsAnalytics({ from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/export", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const kind = str(req.query.kind) as any;
    const allowed = ["payments", "offers", "users", "referrals", "installments"];
    if (!allowed.includes(kind)) return res.status(400).json({ error: "INVALID_KIND" });
    const format = (str(req.query.format) || "csv").toLowerCase();
    if (format !== "csv" && format !== "xlsx") return res.status(400).json({ error: "INVALID_FORMAT" });

    if (format === "xlsx") {
      const xlsx = await exportFinanceXlsx(kind, { from: str(req.query.from), to: str(req.query.to) }, { rtl: true });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="finance-${kind}-${new Date().toISOString().slice(0,10)}.xlsx"`);
      return res.send(xlsx);
    }

    const csv = await exportFinanceCsv(kind, { from: str(req.query.from), to: str(req.query.to) });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="finance-${kind}-${new Date().toISOString().slice(0,10)}.csv"`);
    return res.send(csv);
  } catch (e) {
    next(e);
  }
});

reportingRouter.post("/finance/reports", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const parsed = CreateReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });

    const report = reportingStore.create({ requestedBy: req.auth!.userId, ...parsed.data });
    reportingStore.setProcessing(report.id);

    try {
      const snapshot = await computeFinanceSnapshot({ from: parsed.data.from, to: parsed.data.to });
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

reportingRouter.get("/finance/reports", authRequired, requireRole(FINANCE_ROLES), (req, res) => {
  return res.json({ items: reportingStore.listByUser(req.auth!.userId) });
});

reportingRouter.get("/finance/reports/:id", authRequired, requireRole(FINANCE_ROLES), (req, res) => {
  const r = reportingStore.get(req.params.id);
  if (!r) return res.status(404).json({ error: "NOT_FOUND" });
  // Authz: only the requester or an admin may read a report (prevents IDOR)
  if (r.requestedBy !== req.auth!.userId && req.auth!.role !== "admin") {
    return res.status(403).json({ error: "FORBIDDEN" });
  }
  return res.json({ report: r });
});
