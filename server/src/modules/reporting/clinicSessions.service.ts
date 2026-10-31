import mongoose from "mongoose";
import { BookingSessionModel } from "../../models/bookingSession.model.js";
import { BookingRequestModel } from "../../models/bookingRequest.model.js";
import { PaymentModel } from "../../models/payment.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { ClinicModel } from "../../models/clinic.model.js";
import { UserModel } from "../../models/user.model.js";
import { kwDateRange } from "../../utils/kwDate.js";
import { kwdToMils, milsToKwd } from "../../utils/money.js";

/**
 * Monthly clinic sessions report: the sessions that happened at each clinic
 * (completed or no-show) in a period. No clinic percentages or payouts.
 */

/** Statuses that mean the session's time has passed and it was marked. */
export const HAPPENED_STATUSES = ["completed", "no_show"] as const;

type Extra = { name?: string; priceKwd?: string; qty?: number };

export type SessionSource = {
  session: {
    _id: unknown;
    clinicId?: unknown;
    userId?: string;
    userOfferId?: unknown;
    scheduledAt?: Date | string;
    completedAt?: Date | string;
    status: string;
    sessionPriceKwd?: string;
    totalBillKwd?: string;
    finalPaidKwd?: string;
    extraItems?: Extra[];
    clinicPaymentStatus?: string;
    paidToClinicAt?: Date | string;
  };
  request?: {
    sessionPriceKwd?: string;
    cashbackDeductedKwd?: string;
    totalBillKwd?: string;
    finalPaidKwd?: string;
    extraItems?: Extra[];
    isStandalone?: boolean;
    standaloneName?: string;
    clinicPaymentStatus?: string;
  };
  payment?: { amountKwd?: string; cashbackAppliedKwd?: string; grossAmountKwd?: string; status?: string };
  clinic?: { nameEn?: string; nameAr?: string };
  customer?: { fullName?: string; phone?: string };
  membership?: { status?: string; isStandalone?: boolean };
  offerName?: string;
};

export type ClinicSessionRow = {
  sessionId: string;
  clinicId: string;
  clinicNameEn: string;
  clinicNameAr: string;
  date: string;
  customerName: string;
  customerPhone: string;
  packageName: string;
  isStandalone: boolean;
  membershipCancelled: boolean;
  extras: string;
  status: string;
  sessionValueKwd: string;
  cashbackKwd: string;
  paidAtClinicKwd: string;
  clinicMarkedPaid: boolean;
  /** Belamonda has paid the clinic for this session. */
  paidToClinic: boolean;
};

export type ClinicSessionsSummary = {
  clinicId: string;
  clinicNameEn: string;
  clinicNameAr: string;
  completed: number;
  noShow: number;
  sessionValueKwd: string;
  cashbackKwd: string;
  paidAtClinicKwd: string;
  paidToClinicCount: number;
};

/** Turn one session (plus its linked request/payment) into a report row. */
export function buildSessionRow(src: SessionSource): ClinicSessionRow {
  const s = src.session;
  const r = src.request ?? {};
  const extras = (s.extraItems?.length ? s.extraItems : r.extraItems) ?? [];
  const extrasMils = extras.reduce((sum, e) => sum + kwdToMils(e.priceKwd) * (e.qty || 1), 0);

  // Session value = the session price plus extras. Marking a session completed stores a bill of
  // the extras only ("0.000" when there are none), so a stored bill can't replace the price;
  // the clinic POS stores the full bill on the request.
  const price = s.sessionPriceKwd ?? r.sessionPriceKwd ?? src.payment?.grossAmountKwd;
  const valueMils = Math.max(kwdToMils(price) + extrasMils, kwdToMils(s.totalBillKwd), kwdToMils(r.totalBillKwd));

  // Cashback used at the visit: recorded on the request or payment, else the gap between the
  // session's stored bill and what it says was paid.
  const sessionCashbackMils = Math.max(0, kwdToMils(s.totalBillKwd) - kwdToMils(s.finalPaidKwd));
  const cashbackMils = Math.min(
    valueMils,
    kwdToMils(r.cashbackDeductedKwd ?? src.payment?.cashbackAppliedKwd) || sessionCashbackMils
  );
  const paidMils = Math.max(0, valueMils - cashbackMils);

  const isStandalone = !!(r.isStandalone || src.membership?.isStandalone);
  // Money only changes hands for sessions that actually took place.
  const happened = s.status === "completed";

  return {
    sessionId: String(s._id),
    clinicId: String(s.clinicId ?? ""),
    clinicNameEn: src.clinic?.nameEn ?? "",
    clinicNameAr: src.clinic?.nameAr ?? "",
    date: s.scheduledAt ? new Date(s.scheduledAt).toISOString() : "",
    customerName: src.customer?.fullName || s.userId || "",
    customerPhone: src.customer?.phone ?? "",
    packageName: isStandalone ? r.standaloneName || src.offerName || "Standalone session" : src.offerName ?? "",
    isStandalone,
    membershipCancelled: src.membership?.status === "cancelled",
    extras: extras.map((e) => `${e.name ?? ""}${(e.qty ?? 1) > 1 ? ` x${e.qty}` : ""}`).filter(Boolean).join(", "),
    status: s.status,
    sessionValueKwd: milsToKwd(happened ? valueMils : 0),
    cashbackKwd: milsToKwd(happened ? cashbackMils : 0),
    paidAtClinicKwd: milsToKwd(happened ? paidMils : 0),
    clinicMarkedPaid: s.clinicPaymentStatus === "paid" || r.clinicPaymentStatus === "paid",
    paidToClinic: happened && !!s.paidToClinicAt,
  };
}

/** Per-clinic totals plus a grand total, sorted by session value. */
export function summarizeClinicSessions(rows: ClinicSessionRow[]) {
  const map = new Map<string, ClinicSessionsSummary & { _v: number; _c: number; _p: number }>();
  for (const row of rows) {
    const cur =
      map.get(row.clinicId) ??
      {
        clinicId: row.clinicId,
        clinicNameEn: row.clinicNameEn,
        clinicNameAr: row.clinicNameAr,
        completed: 0,
        noShow: 0,
        sessionValueKwd: "0.000",
        cashbackKwd: "0.000",
        paidAtClinicKwd: "0.000",
        paidToClinicCount: 0,
        _v: 0,
        _c: 0,
        _p: 0,
      };
    if (row.status === "completed") cur.completed++;
    if (row.status === "no_show") cur.noShow++;
    cur._v += kwdToMils(row.sessionValueKwd);
    cur._c += kwdToMils(row.cashbackKwd);
    cur._p += kwdToMils(row.paidAtClinicKwd);
    if (row.paidToClinic) cur.paidToClinicCount++;
    map.set(row.clinicId, cur);
  }

  const clinics: ClinicSessionsSummary[] = [...map.values()]
    .sort((a, b) => b._v - a._v || b.completed - a.completed)
    .map(({ _v, _c, _p, ...c }) => ({
      ...c,
      sessionValueKwd: milsToKwd(_v),
      cashbackKwd: milsToKwd(_c),
      paidAtClinicKwd: milsToKwd(_p),
    }));

  const totalMils = (k: "sessionValueKwd" | "cashbackKwd" | "paidAtClinicKwd") =>
    milsToKwd(clinics.reduce((sum, c) => sum + kwdToMils(c[k]), 0));

  return {
    clinics,
    totals: {
      completed: clinics.reduce((n, c) => n + c.completed, 0),
      noShow: clinics.reduce((n, c) => n + c.noShow, 0),
      sessionValueKwd: totalMils("sessionValueKwd"),
      cashbackKwd: totalMils("cashbackKwd"),
      paidAtClinicKwd: totalMils("paidAtClinicKwd"),
      paidToClinicCount: clinics.reduce((n, c) => n + c.paidToClinicCount, 0),
    },
  };
}

const isOid = (s: unknown) => typeof s === "string" && /^[a-f0-9]{24}$/i.test(s);

/** Sessions that happened in the period (Kuwait dates), optionally for one clinic. */
export async function computeClinicSessionsReport(filters: { from?: string; to?: string; clinicId?: string } = {}) {
  const q: Record<string, unknown> = { status: { $in: [...HAPPENED_STATUSES] } };
  const range = kwDateRange(filters.from, filters.to);
  if (range) q.scheduledAt = range;
  if (filters.clinicId) {
    if (!mongoose.isValidObjectId(filters.clinicId)) return { clinics: [], totals: summarizeClinicSessions([]).totals, rows: [] };
    q.clinicId = new mongoose.Types.ObjectId(filters.clinicId);
  }

  const sessions = (await BookingSessionModel.find(q).sort({ scheduledAt: 1 }).lean()) as any[];
  const sessionIds = sessions.map((s) => String(s._id));
  const requestIds = sessions.map((s) => s.bookingRequestId).filter(Boolean);

  const requests = (sessionIds.length
    ? await BookingRequestModel.find({ $or: [{ scheduledSessionId: { $in: sessionIds } }, { _id: { $in: requestIds } }] })
        .select("scheduledSessionId sessionPaymentId sessionPriceKwd cashbackDeductedKwd totalBillKwd finalPaidKwd extraItems isStandalone standaloneName clinicPaymentStatus")
        .lean()
    : []) as any[];
  const reqById = new Map(requests.map((r) => [String(r._id), r]));
  const reqBySession = new Map(requests.filter((r) => r.scheduledSessionId).map((r) => [String(r.scheduledSessionId), r]));
  const requestFor = (s: any) => (s.bookingRequestId && reqById.get(String(s.bookingRequestId))) || reqBySession.get(String(s._id));

  const paymentIds = [
    ...sessions.map((s) => s.paymentId),
    ...requests.map((r) => r.sessionPaymentId),
  ].filter((id) => id && mongoose.isValidObjectId(String(id)));
  const membershipIds = [...new Set(sessions.map((s) => String(s.userOfferId)).filter(isOid))];
  const clinicIds = [...new Set(sessions.map((s) => String(s.clinicId)).filter(isOid))];
  const userIds = [...new Set(sessions.map((s) => s.userId).filter(Boolean))];

  const [payments, memberships, clinics, users] = await Promise.all([
    paymentIds.length ? PaymentModel.find({ _id: { $in: paymentIds } }).select("amountKwd cashbackAppliedKwd grossAmountKwd status").lean() : [],
    membershipIds.length ? UserOfferModel.find({ _id: { $in: membershipIds } }).select("offerId status isStandalone").lean() : [],
    clinicIds.length ? ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn nameAr").lean() : [],
    userIds.length
      ? UserModel.find({ $or: [{ _id: { $in: userIds.filter(isOid) } }, { username: { $in: userIds } }] }).select("username fullName phone").lean()
      : [],
  ]);
  const offerIds = [...new Set([...(memberships as any[]).map((m) => String(m.offerId)), ...sessions.map((x) => String(x.offerId))].filter(isOid))];
  const offers = offerIds.length ? ((await OfferModel.find({ _id: { $in: offerIds } }).select("name").lean()) as any[]) : [];

  const paymentById = new Map((payments as any[]).map((p) => [String(p._id), p]));
  const membershipById = new Map((memberships as any[]).map((m) => [String(m._id), m]));
  const clinicById = new Map((clinics as any[]).map((c) => [String(c._id), c]));
  const offerName = new Map(offers.map((o) => [String(o._id), o.name as string]));
  const userById = new Map<string, any>();
  for (const u of users as any[]) {
    userById.set(String(u._id), u);
    if (u.username) userById.set(u.username, u);
  }

  const rows = sessions.map((s) => {
    const request = requestFor(s);
    const membership = membershipById.get(String(s.userOfferId));
    const payment = paymentById.get(String(s.paymentId ?? request?.sessionPaymentId ?? ""));
    return buildSessionRow({
      session: s,
      request,
      payment,
      clinic: clinicById.get(String(s.clinicId)),
      customer: userById.get(s.userId),
      membership,
      offerName: offerName.get(String(membership?.offerId ?? s.offerId)),
    });
  });

  return { ...summarizeClinicSessions(rows), rows };
}
