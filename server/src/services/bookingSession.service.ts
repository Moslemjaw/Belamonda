import mongoose from "mongoose";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { serializeBookingSession } from "../utils/serialize.js";
import { linkPaymentToBookingIfFirst } from "./payment.service.js";
import { incrementMetric } from "./metric.service.js";

export async function createSession(input: {
  userOfferId: string;
  userId: string;
  offerId: string;
  clinicId: string;
  scheduledAt: string;
  scheduledBy: string;
  notes?: string;
  paymentId?: string;
}) {
  const doc = await BookingSessionModel.create({
    userOfferId: new mongoose.Types.ObjectId(input.userOfferId),
    userId: input.userId,
    offerId: new mongoose.Types.ObjectId(input.offerId),
    clinicId: new mongoose.Types.ObjectId(input.clinicId),
    scheduledAt: new Date(input.scheduledAt),
    scheduledBy: input.scheduledBy,
    notes: input.notes,
    status: "scheduled",
    ...(input.paymentId && mongoose.isValidObjectId(input.paymentId)
      ? { paymentId: new mongoose.Types.ObjectId(input.paymentId) }
      : {})
  });
  await linkPaymentToBookingIfFirst(input.userOfferId, doc._id.toString());
  return serializeBookingSession(doc.toObject() as any);
}

export async function getSession(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await BookingSessionModel.findById(id).lean();
  return doc ? serializeBookingSession(doc as any) : null;
}

export async function listByClinic(clinicId: string, fromIso: string, toIso: string) {
  if (!mongoose.isValidObjectId(clinicId)) return [];
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const rows = await BookingSessionModel.find({
    clinicId: new mongoose.Types.ObjectId(clinicId),
    scheduledAt: { $gte: from, $lte: to }
  })
    .sort({ scheduledAt: 1 })
    .lean();
  return rows.map((r) => serializeBookingSession(r as any));
}

export async function listByUser(userId: string) {
  const rows = await BookingSessionModel.find({ userId }).sort({ scheduledAt: -1 }).lean();
  return rows.map((r) => serializeBookingSession(r as any));
}

export async function listByUserOffer(userOfferId: string) {
  if (!mongoose.isValidObjectId(userOfferId)) return [];
  const rows = await BookingSessionModel.find({
    userOfferId: new mongoose.Types.ObjectId(userOfferId)
  })
    .sort({ scheduledAt: 1 })
    .lean();
  return rows.map((r) => serializeBookingSession(r as any));
}

export async function lastCompletedAt(userOfferId: string, userId?: string): Promise<string | null> {
  if (!mongoose.isValidObjectId(userOfferId)) return null;
  const query: any = {
    userOfferId: new mongoose.Types.ObjectId(userOfferId),
    status: "completed",
    completedAt: { $exists: true }
  };
  if (userId) query.userId = userId;
  const doc = (await BookingSessionModel.findOne(query)
    .sort({ completedAt: -1 })
    .lean()) as { completedAt?: Date } | null;
  return doc?.completedAt ? new Date(doc.completedAt).toISOString() : null;
}

export async function isSlotTaken(clinicId: string, scheduledAtIso: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(clinicId)) return false;
  const exists = await BookingSessionModel.exists({
    clinicId: new mongoose.Types.ObjectId(clinicId),
    scheduledAt: new Date(scheduledAtIso),
    status: { $ne: "cancelled" }
  });
  return !!exists;
}

export async function markSession(input: {
  sessionId: string;
  status: "completed" | "no_show" | "cancelled";
  markedBy: string;
  notes?: string;
  cashbackUnlockedKwd?: string;
}) {
  if (!mongoose.isValidObjectId(input.sessionId)) return null;
  const s = await BookingSessionModel.findById(input.sessionId);
  if (!s) return null;
  
  const wasCompleted = s.status === "completed";
  
  s.status = input.status;
  s.markedBy = input.markedBy;
  s.notes = input.notes;
  if (input.status === "completed") {
    s.completedAt = new Date();
    s.cashbackUnlockedKwd = input.cashbackUnlockedKwd;
  }
  await s.save();
  
  if (input.status === "completed" && !wasCompleted) {
    await incrementMetric({ totalSessionsCompleted: 1 });
  } else if (input.status !== "completed" && wasCompleted) {
    await incrementMetric({ totalSessionsCompleted: -1 });
  }
  
  return serializeBookingSession(s.toObject() as any);
}
