import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { authRequired } from "../../middlewares/authRequired.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { reportingStore } from "./reporting.store.js";
import { PaymentModel } from "../../models/payment.model.js";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { logAuditAction } from "../../services/audit.service.js";
import {
  computeFinanceSnapshot,
  computePaymentsBreakdown,
  computeFinanceTimeseries,
  computeRevenueByOffer,
  computeRevenueByUser,
  computeRevenueByReferral,
  computeInstallmentsAnalytics,
  exportFinanceXlsx,
  computeClinicDetail,
  exportClinicReportXlsx,
  exportClinicSessionsXlsx,
} from "./analytics.service.js";
import { reconcileMetrics } from "../../services/reconciliation.service.js";
import { manualEntryQuery } from "../../services/financeRevenue.js";
import { kwDateRange } from "../../utils/kwDate.js";
import { computePackageRevenue } from "./revenue.service.js";
import { buildFinanceReport, isFinanceReportType } from "./financeReports.service.js";
import { renderReportPdf, renderReportXlsx } from "./reportRender.js";
import { computeClinicSessionsReport } from "./clinicSessions.service.js";

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
      type: str(req.query.type),
      customer: str(req.query.customer),
      from: str(req.query.from),
      to: str(req.query.to),
    });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

// Package revenue: money received for packages in the period, minus refunds,
// plus what is still unpaid on packages sold in the period and granted packages.
reportingRouter.get("/finance/revenue", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const g = str(req.query.granularity);
    const granularity = g === "weekly" || g === "monthly" ? g : "daily";
    return res.json(await computePackageRevenue({ from: str(req.query.from), to: str(req.query.to), granularity }));
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

reportingRouter.get("/finance/export", authRequired, requireRole([...FINANCE_ROLES, "cs_director"]), async (req, res, next) => {
  try {
    const kind = str(req.query.kind) as any;
    if (req.auth!.role === "cs_director" && kind !== "referrals") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    // Only the referrals sheet is left here (CS director widget); finance reports use /finance/report.
    if (kind !== "referrals") return res.status(400).json({ error: "INVALID_KIND" });
    const xlsx = await exportFinanceXlsx(kind, { from: str(req.query.from), to: str(req.query.to) }, { rtl: true });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="finance-${kind}-${new Date().toISOString().slice(0,10)}.xlsx"`);
    return res.send(xlsx);
  } catch (e) {
    next(e);
  }
});

const isDateOrEmpty = (v?: string) => !v || !Number.isNaN(Date.parse(v));

// Finance reports: the same document is the on-screen preview and the Excel/PDF download.
reportingRouter.get("/finance/report", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const type = str(req.query.type);
    if (!isFinanceReportType(type)) return res.status(400).json({ error: "INVALID_TYPE" });
    if (!isDateOrEmpty(str(req.query.from)) || !isDateOrEmpty(str(req.query.to))) return res.status(400).json({ error: "INVALID_DATE" });
    return res.json(await buildFinanceReport(type, { from: str(req.query.from), to: str(req.query.to) }));
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/report/export", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const type = str(req.query.type);
    const format = str(req.query.format) ?? "xlsx";
    if (!isFinanceReportType(type)) return res.status(400).json({ error: "INVALID_TYPE" });
    if (format !== "xlsx" && format !== "pdf") return res.status(400).json({ error: "INVALID_FORMAT" });
    if (!isDateOrEmpty(str(req.query.from)) || !isDateOrEmpty(str(req.query.to))) return res.status(400).json({ error: "INVALID_DATE" });
    const period = { from: str(req.query.from), to: str(req.query.to) };
    const doc = await buildFinanceReport(type, period);
    const name = `belamonda-${type.replace(/_/g, "-")}-${doc.from}_${doc.to}.${format}`;
    let body: Buffer;
    if (format === "pdf") body = await renderReportPdf(doc);
    // The clinic sessions workbook has one sheet per clinic, built in Phase 2.
    else if (type === "clinic_sessions") body = await exportClinicSessionsXlsx({ from: doc.from, to: doc.to });
    else body = await renderReportXlsx(doc);
    res.setHeader(
      "Content-Type",
      format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    return res.send(body);
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

// Monthly clinic sessions report: sessions that happened (completed / no-show) per clinic.
reportingRouter.get("/finance/clinic-sessions", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const data = await computeClinicSessionsReport({ from: str(req.query.from), to: str(req.query.to), clinicId: str(req.query.clinicId) });
    return res.json(data);
  } catch (e) {
    next(e);
  }
});

// Finance ticks a completed session once Belamonda has paid the clinic for it.
reportingRouter.put("/finance/clinic-sessions/:id/paid-to-clinic", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const parsed = z.object({ paid: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "VALIDATION_ERROR" });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "NOT_FOUND" });
    const session = await BookingSessionModel.findById(req.params.id).select("status paidToClinicAt").lean<{ status: string; paidToClinicAt?: Date } | null>();
    if (!session) return res.status(404).json({ error: "NOT_FOUND" });
    if (session.status !== "completed") return res.status(409).json({ error: "SESSION_NOT_COMPLETED" });

    const { paid } = parsed.data;
    if (paid !== !!session.paidToClinicAt) {
      await BookingSessionModel.updateOne(
        { _id: req.params.id },
        paid
          ? { $set: { paidToClinicAt: new Date(), paidToClinicBy: req.auth!.userId } }
          : { $unset: { paidToClinicAt: 1, paidToClinicBy: 1 } }
      );
      await logAuditAction({
        actorId: req.auth!.userId,
        actorRole: req.auth!.role as any,
        actionType: paid ? "session_paid_to_clinic" : "session_paid_to_clinic_undone",
        targetEntityType: "BookingSession",
        targetEntityId: req.params.id,
        beforeState: { paidToClinic: !paid },
        afterState: { paidToClinic: paid },
      });
    }
    return res.json({ ok: true, paidToClinic: paid });
  } catch (e) {
    next(e);
  }
});

reportingRouter.get("/finance/clinic-sessions/export", authRequired, requireRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const from = str(req.query.from);
    const to = str(req.query.to);
    const xlsx = await exportClinicSessionsXlsx({ from, to, clinicId: str(req.query.clinicId) });
    const stamp = [from?.slice(0, 10), to?.slice(0, 10)].filter(Boolean).join("_") || new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="clinic-sessions-${stamp}.xlsx"`);
    return res.send(xlsx);
  } catch (e) {
    next(e);
  }
});

// ===========================================================================
// MANUAL PAYMENT ENTRIES — finance backup entries
// ===========================================================================

const ManualPaymentSchema = z.object({
  amountKwd: z.string().regex(/^\d+(\.\d{1,3})?$/, "Invalid amount"),
  // Customers pay only through a payment link sent by the Belamonda team.
  method: z.enum(["link", "bank_transfer", "cash", "pos", "card_mock", "enet", "wallet", "free_package", "other"]).default("link"),
  purpose: z.enum(["enrollment_full", "installment", "deposit", "deposit_balance", "enrollment_enet", "session_payment", "manual_entry"]).default("manual_entry"),
  // "completed"/"pending" are older labels from the form; the payment record only accepts paid/payment_pending.
  status: z
    .enum(["paid", "payment_pending", "failed", "refunded", "completed", "pending"])
    .default("paid")
    .transform((v) => (v === "completed" ? "paid" : v === "pending" ? "payment_pending" : v)),
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
    const q: any = { ...manualEntryQuery };
    const range = kwDateRange(str(req.query.from), str(req.query.to));
    if (range) q.createdAt = range;
    const docs = await PaymentModel.find(q).populate("clinicId", "nameEn").sort({ createdAt: -1 }).limit(limit).lean();
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
    const doc = await PaymentModel.findOneAndDelete({ _id: req.params.id, ...manualEntryQuery });
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
    const filters = { from: str(req.query.from), to: str(req.query.to) };
    const clinicDetail = await computeClinicDetail(clinicId, filters);
    const clinicSlug = (clinicDetail.clinic?.nameEn ?? clinicId).replace(/\s+/g, "-").toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const xlsx = await exportClinicReportXlsx(clinicId, filters);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="clinic-${clinicSlug}-${dateStr}.xlsx"`);
    return res.send(xlsx);
  } catch (e) { next(e); }
});

// ── Admin: Trigger manual reconciliation ─────────────────────────────────────
reportingRouter.post("/admin/reconcile-metrics", authRequired, requireRole(["admin", "finance"]), async (req, res, next) => {
  try {
    await reconcileMetrics();
    res.json({ ok: true, message: "Metrics reconciliation completed successfully" });
  } catch (e) { next(e); }
});

// ── Admin: Get current global metric values ───────────────────────────────────
reportingRouter.get("/admin/metrics/global", authRequired, requireRole(["admin", "finance"]), async (req, res, next) => {
  try {
    const { SystemMetricModel } = await import("../../models/metric.model.js");
    const global = await SystemMetricModel.findById("global").lean();
    res.json({ ok: true, data: global });
  } catch (e) { next(e); }
});
