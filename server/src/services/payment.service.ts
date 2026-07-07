import mongoose from "mongoose";
import { PaymentModel } from "../models/payment.model.js";
import { serializePayment } from "../utils/serialize.js";
import { incrementMetric } from "./metric.service.js";


export async function createCompletedEnrollmentPayment(input: {
  userId: string;
  offerId: string;
  userOfferId: string;
  amountKwd: string;
  method: "bank_transfer" | "cash" | "pos" | "free_package" | "other";
  proofRef: string;
  confirmedBy: string;
}) {
  const doc = await PaymentModel.create({
    userId: input.userId,
    offerId: new mongoose.Types.ObjectId(input.offerId),
    userOfferId: new mongoose.Types.ObjectId(input.userOfferId),
    amountKwd: input.amountKwd,
    currency: "KWD",
    method: input.method,
    status: "paid",
    proofRef: input.proofRef,
    confirmedBy: input.confirmedBy,
    confirmedAt: new Date()
  });
  
  const kwdVal = parseFloat(input.amountKwd) || 0;
  const mils = Math.round(kwdVal * 1000);
  
  // Enrollment is a membership sold. Since manual enrollments don't currently have cashback tracked in this function, gross = net
  await incrementMetric({
    totalRevenueMils: mils,
    totalGrossRevenueMils: mils,
    totalCashbackAppliedMils: 0,
    totalMembershipsSold: 1,
    totalMembershipRevenueMils: mils,
    totalGrossMembershipRevenueMils: mils,
  });
  
  return serializePayment(doc.toObject() as any);
}

export async function createSessionPayment(input: {
  userId: string;
  offerId: string;
  userOfferId: string;
  amountKwd: string;
  grossAmountKwd?: string;
  cashbackAppliedKwd?: string;
  bookingRequestId: string;
}) {
  const doc = await PaymentModel.create({
    userId: input.userId,
    offerId: new mongoose.Types.ObjectId(input.offerId),
    userOfferId: new mongoose.Types.ObjectId(input.userOfferId),
    amountKwd: input.amountKwd,
    grossAmountKwd: input.grossAmountKwd,
    cashbackAppliedKwd: input.cashbackAppliedKwd,
    currency: "KWD",
    method: "card_mock",
    purpose: "session_payment",
    status: "pending",
    provider: "mock",
    bookingRequestId: input.bookingRequestId
  });
  return serializePayment(doc.toObject() as any);
}

export async function confirmSessionPayment(paymentId: string) {
  const doc = await PaymentModel.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { status: "paid", confirmedAt: new Date(), confirmedBy: "customer" },
    { new: true }
  ).lean();
  if (!doc) throw new Error("Session payment not found or already processed");
  
  const netKwd = parseFloat((doc as any).amountKwd) || 0;
  const cbKwd = parseFloat((doc as any).cashbackAppliedKwd) || 0;
  const grossKwdStr = (doc as any).grossAmountKwd;
  const grossKwd = grossKwdStr ? parseFloat(grossKwdStr) : netKwd + cbKwd;
  
  const netMils = Math.round(netKwd * 1000);
  const cbMils = Math.round(cbKwd * 1000);
  const grossMils = Math.round(grossKwd * 1000);
  
  await incrementMetric({
    totalRevenueMils: netMils,
    totalGrossRevenueMils: grossMils,
    totalCashbackAppliedMils: cbMils,
    totalStandaloneSessionsSold: 1,
    totalStandaloneSessionRevenueMils: netMils,
    totalGrossStandaloneSessionRevenueMils: grossMils,
  });
  
  return serializePayment(doc as any);
}

export async function linkPaymentToBookingIfFirst(userOfferId: string, bookingId: string) {
  if (!mongoose.isValidObjectId(userOfferId) || !mongoose.isValidObjectId(bookingId)) return;
  const pay = await PaymentModel.findOne({
    userOfferId: new mongoose.Types.ObjectId(userOfferId),
    status: "paid",
    $or: [{ bookingId: { $exists: false } }, { bookingId: null }]
  });
  if (!pay) return;
  pay.bookingId = new mongoose.Types.ObjectId(bookingId);
  await pay.save();
}

export async function listPaymentsAdmin(filters: { status?: string; userId?: string; page?: number; limit?: number }) {
  const q: mongoose.FilterQuery<typeof PaymentModel> = {};
  if (filters.status) q.status = filters.status;
  if (filters.userId) q.userId = filters.userId;
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    PaymentModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    PaymentModel.countDocuments(q)
  ]);
  return {
    items: items.map((p) => serializePayment(p as any)),
    total,
    page,
    limit
  };
}

export async function listPaymentsByUser(userId: string) {
  const rows = await PaymentModel.find({ userId }).sort({ createdAt: -1 }).lean();
  return rows.map((p) => serializePayment(p as any));
}

function parseKwdMils(s: string): number {
  const [a, b = "000"] = s.split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

function fmtKwdFromMils(mils: number): string {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  const a = Math.floor(abs / 1000);
  const b = String(abs % 1000).padStart(3, "0");
  return `${sign}${a}.${b}`;
}

/** Sum all completed payment amounts (KWD string). */
let _sumCompletedPromise: Promise<string> | null = null;
let _sumCompletedCache: { data: string; ts: number } | null = null;
const SUM_CACHE_TTL = 60_000;

export async function sumCompletedPaymentsKwd() {
  if (_sumCompletedCache && Date.now() - _sumCompletedCache.ts < SUM_CACHE_TTL) {
    return _sumCompletedCache.data;
  }
  if (_sumCompletedPromise) return _sumCompletedPromise;

  const promise = (async () => {
    const all = await PaymentModel.find({ status: "paid" }).select("amountKwd cashbackAppliedKwd grossAmountKwd").lean();
    let totalMils = 0;
    for (const p of all) {
      const net = parseKwdMils(p.amountKwd);
      const cb = parseKwdMils(p.cashbackAppliedKwd || "0.000");
      const gross = p.grossAmountKwd ? parseKwdMils(p.grossAmountKwd) : net + cb;
      totalMils += gross;
    }
    const result = fmtKwdFromMils(totalMils);
    _sumCompletedCache = { data: result, ts: Date.now() };
    _sumCompletedPromise = null;
    return result;
  })();

  _sumCompletedPromise = promise;
  return promise;
}

export async function findPaymentByUserOffer(userOfferId: string) {
  if (!mongoose.isValidObjectId(userOfferId)) return null;
  const doc = await PaymentModel.findOne({
    userOfferId: new mongoose.Types.ObjectId(userOfferId)
  })
    .sort({ createdAt: -1 })
    .lean();
  return doc ? serializePayment(doc as any) : null;
}
