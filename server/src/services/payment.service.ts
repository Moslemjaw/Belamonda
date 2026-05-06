import mongoose from "mongoose";
import { PaymentModel } from "../models/payment.model.js";
import { serializePayment } from "../utils/serialize.js";

export async function createCompletedEnrollmentPayment(input: {
  userId: string;
  offerId: string;
  userOfferId: string;
  amountKwd: string;
  method: "bank_transfer" | "cash" | "pos" | "other";
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
    status: "completed",
    proofRef: input.proofRef,
    confirmedBy: input.confirmedBy,
    confirmedAt: new Date()
  });
  return serializePayment(doc.toObject() as any);
}

export async function linkPaymentToBookingIfFirst(userOfferId: string, bookingId: string) {
  if (!mongoose.isValidObjectId(userOfferId) || !mongoose.isValidObjectId(bookingId)) return;
  const pay = await PaymentModel.findOne({
    userOfferId: new mongoose.Types.ObjectId(userOfferId),
    status: "completed",
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
export async function sumCompletedPaymentsKwd(): Promise<string> {
  const rows = await PaymentModel.find({ status: "completed" }).select("amountKwd").lean();
  let mils = 0;
  for (const r of rows) mils += parseKwdMils(r.amountKwd);
  return fmtKwdFromMils(mils);
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
