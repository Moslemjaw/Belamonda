import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { reportingStore } from "./reporting.store.js";
import { PaymentModel } from "../../models/payment.model.js";
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
  computeClinicSummaries,
  computeClinicDetail,
  exportClinicReportCsv,
  exportClinicReportXlsx,
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

// ===========================================================================
// CLINIC SUMMARIES — all clinics (Finance view)
// ===========================================================================

reportingRouter.get("/finance/by-clinic", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computeClinicSummaries({ from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) { next(e); }
});

reportingRouter.get("/finance/clinic-detail", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const clinicId = str(req.query.clinicId);
    if (!clinicId) return res.status(400).json({ error: "clinicId required" });
    const data = await computeClinicDetail(clinicId, { from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) { next(e); }
});

reportingRouter.get("/finance/clinic-export", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const clinicId = str(req.query.clinicId);
    if (!clinicId) return res.status(400).json({ error: "clinicId required" });
    const format = (str(req.query.format) || "csv").toLowerCase();
    const filters = { from: str(req.query.from), to: str(req.query.to) };
    const clinicDetail = await computeClinicDetail(clinicId, filters);
    const clinicSlug = (clinicDetail.clinic?.nameEn ?? clinicId).replace(/\s+/g, "-").toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      const xlsx = await exportClinicReportXlsx(clinicId, filters);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="clinic-${clinicSlug}-${dateStr}.xlsx"`);
      return res.send(xlsx);
    }
    const csv = await exportClinicReportCsv(clinicId, filters);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="clinic-${clinicSlug}-${dateStr}.csv"`);
    return res.send(csv);
  } catch (e) { next(e); }
});

// ===========================================================================
// MANUAL PAYMENT ENTRIES — finance backup entries
// ===========================================================================

const ManualPaymentSchema = z.object({
  amountKwd: z.string().regex(/^\d+(\.\d{1,3})?$/, "Invalid amount"),
  method: z.enum(["bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "other"]),
  purpose: z.enum(["enrollment_full", "installment", "deposit", "deposit_balance", "enrollment_enet", "session_payment", "manual_entry"]).default("manual_entry"),
  status: z.enum(["completed", "pending", "failed", "refunded"]).default("completed"),
  manualLabel: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  providerRef: z.string().max(200).optional(),
  userId: z.string().optional(),
  paymentDate: z.string().datetime().optional(),
  clinicId: z.string().optional(),
});

reportingRouter.post("/finance/manual-payment", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const parsed = ManualPaymentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR", details: parsed.error.flatten() });
    const d = parsed.data;

    // Normalise to 3 decimal places
    const amountKwd = parseFloat(d.amountKwd).toFixed(3);

    const doc = await PaymentModel.create({
      amountKwd,
      grossAmountKwd: amountKwd,
      cashbackAppliedKwd: "0.000",
      method: d.method,
      purpose: d.purpose,
      status: d.status,
      provider: "manual",
      isManual: true,
      manualLabel: d.manualLabel || undefined,
      notes: d.notes || undefined,
      providerRef: d.providerRef || undefined,
      userId: d.userId || "manual",
      createdByUserId: req.auth!.userId,
      confirmedBy: req.auth!.userId,
      confirmedAt: new Date(),
      clinicId: d.clinicId || undefined,
      ...(d.paymentDate ? { createdAt: new Date(d.paymentDate) } : {}),
    });

    return res.status(201).json({ payment: { id: doc._id.toString(), amountKwd: doc.amountKwd, method: doc.method, status: doc.status, isManual: true, createdAt: doc.createdAt } });
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/manual-payments", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const limit = Math.min(500, Number(str(req.query.limit)) || 200);
    const docs = await PaymentModel.find({ isManual: true }).populate("clinicId", "nameEn").sort({ createdAt: -1 }).limit(limit).lean();
    const items = docs.map((d: any) => ({
      id: d._id.toString(),
      amountKwd: d.amountKwd,
      method: d.method,
      purpose: d.purpose,
      status: d.status,
      manualLabel: d.manualLabel,
      notes: d.notes,
      providerRef: d.providerRef,
      userId: d.userId,
      clinicNameEn: d.clinicId?.nameEn,
      createdByUserId: d.createdByUserId,
      createdAt: d.createdAt,
    }));
    return res.json({ items });
  } catch (e) {
    next(e);
  }
});

reportingRouter.delete("/finance/manual-payment/:id", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "INVALID_ID" });
    const doc = await PaymentModel.findOneAndDelete({ _id: req.params.id, isManual: true });
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ===========================================================================
// CLINIC STAFF — own clinic detail + export (uses req.auth.clinicId)
// ===========================================================================

const CLINIC_ROLES: ("clinicStaff" | "admin")[] = ["clinicStaff", "admin"];

reportingRouter.get("/clinic/summary", authRequired, requireRole(CLINIC_ROLES), async (req, res, next) => {
  try {
    const clinicId = req.auth!.clinicId ?? str(req.query.clinicId);
    if (!clinicId) return res.status(400).json({ error: "No clinic associated with this account" });
    const data = await computeClinicDetail(clinicId, { from: str(req.query.from), to: str(req.query.to) });
    return res.json(data);
  } catch (e) { next(e); }
});

reportingRouter.get("/clinic/invoices", authRequired, requireRole(CLINIC_ROLES), async (req, res, next) => {
  try {
    const clinicId = req.auth!.clinicId ?? str(req.query.clinicId);
    if (!clinicId) return res.status(400).json({ error: "No clinic associated with this account" });
    const data = await computeClinicDetail(clinicId, { from: str(req.query.from), to: str(req.query.to) });
    return res.json({ invoices: data.invoices, summary: data.summary, clinic: data.clinic });
  } catch (e) { next(e); }
});

reportingRouter.get("/clinic/export", authRequired, requireRole(CLINIC_ROLES), async (req, res, next) => {
  try {
    const clinicId = req.auth!.clinicId ?? str(req.query.clinicId);
    if (!clinicId) return res.status(400).json({ error: "No clinic associated with this account" });
    const format = (str(req.query.format) || "csv").toLowerCase();
    const filters = { from: str(req.query.from), to: str(req.query.to) };
    const clinicDetail = await computeClinicDetail(clinicId, filters);
    const clinicSlug = (clinicDetail.clinic?.nameEn ?? clinicId).replace(/\s+/g, "-").toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      const xlsx = await exportClinicReportXlsx(clinicId, filters);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="clinic-${clinicSlug}-${dateStr}.xlsx"`);
      return res.send(xlsx);
    }
    const csv = await exportClinicReportCsv(clinicId, filters);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="clinic-${clinicSlug}-${dateStr}.csv"`);
    return res.send(csv);
  } catch (e) { next(e); }
});
