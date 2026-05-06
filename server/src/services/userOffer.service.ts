import mongoose from "mongoose";
import { UserOfferModel } from "../models/userOffer.model.js";
import { serializeUserOffer } from "../utils/serialize.js";

export async function expireStalePendingPayments(): Promise<void> {
  await UserOfferModel.updateMany(
    { status: "pending_payment", pendingExpiresAt: { $lt: new Date() } },
    { $set: { status: "expired" }, $unset: { pendingExpiresAt: 1 } }
  );
}

export async function createPending(input: { userId: string; offerId: string; clinicId: string; paymentMethod?: string; paymentAmountKwd?: string }) {
  await expireStalePendingPayments();
  const pendingExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const doc = await UserOfferModel.create({
    userId: input.userId,
    offerId: new mongoose.Types.ObjectId(input.offerId),
    clinicId: new mongoose.Types.ObjectId(input.clinicId),
    status: "pending_payment",
    pendingExpiresAt,
    sessionsUsed: 0,
    paymentMethod: input.paymentMethod,
    paymentAmountKwd: input.paymentAmountKwd
  });
  return serializeUserOffer(doc.toObject() as any);
}

export async function getUserOffer(id: string) {
  await expireStalePendingPayments();
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await UserOfferModel.findById(id).lean();
  return doc ? serializeUserOffer(doc as any) : null;
}

export async function listUserOffersByUser(userId: string) {
  await expireStalePendingPayments();
  const rows = await UserOfferModel.find({ userId }).sort({ createdAt: -1 }).lean();
  return rows.map((r) => serializeUserOffer(r as any));
}

export async function listPendingPaymentsQueue() {
  await expireStalePendingPayments();
  const rows = await UserOfferModel.find({ status: "pending_payment" }).sort({ createdAt: 1 }).lean();
  return rows.map((r) => serializeUserOffer(r as any));
}

export async function countActiveAndPendingForOffer(offerId: string) {
  await expireStalePendingPayments();
  if (!mongoose.isValidObjectId(offerId)) return 0;
  return UserOfferModel.countDocuments({
    offerId: new mongoose.Types.ObjectId(offerId),
    status: { $in: ["pending_payment", "active"] }
  });
}

export async function confirmPaymentAndActivate(input: {
  userOfferId: string;
  confirmedBy: string;
  proofRef: string;
  method: string;
  amountKwd: string;
  activatedAt: string;
  expiresAt: string;
  paymentId: string;
}) {
  await expireStalePendingPayments();
  if (!mongoose.isValidObjectId(input.userOfferId)) return null;

  const updated = await UserOfferModel.findOneAndUpdate(
    {
      _id: input.userOfferId,
      status: "pending_payment"
    },
    {
      $set: {
        status: "active",
        paymentConfirmedBy: input.confirmedBy,
        paymentConfirmedAt: new Date(),
        paymentProofRef: input.proofRef,
        paymentMethod: input.method,
        paymentAmountKwd: input.amountKwd,
        activatedAt: new Date(input.activatedAt),
        expiresAt: new Date(input.expiresAt),
        paymentId: new mongoose.Types.ObjectId(input.paymentId)
      },
      $unset: { pendingExpiresAt: "" }
    },
    { new: true }
  ).lean();

  if (!updated) {
    const exists = await UserOfferModel.findById(input.userOfferId).lean();
    if (!exists) return null;
    return { error: "NOT_PENDING" as const };
  }

  return serializeUserOffer(updated as any);
}

export async function incrementSessionsUsed(userOfferId: string) {
  if (!mongoose.isValidObjectId(userOfferId)) return null;
  const doc = await UserOfferModel.findByIdAndUpdate(
    userOfferId,
    { $inc: { sessionsUsed: 1 } },
    { new: true }
  ).lean();
  return doc ? serializeUserOffer(doc as any) : null;
}
