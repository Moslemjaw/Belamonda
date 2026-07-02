import type { SessionStatus } from "@belamonda/shared";

export type SessionRecord = {
  id: string;
  userOfferId: string;
  userId: string;
  offerId: string;
  clinicId: string;
  scheduledAt: string; // ISO
  status: SessionStatus; // scheduled|completed|no_show|cancelled
  createdAt: string;
  scheduledBy: string; // CS user id
  completedAt?: string;
  markedBy?: string; // clinic staff id
  notes?: string;
  cashbackUnlockedKwd?: string;
  extraItems?: { name: string; priceKwd: string; qty: number }[];
  totalBillKwd?: string;
  finalPaidKwd?: string;
};

import { BookingSessionModel } from "../../models/bookingSession.model.js";

function mapDoc(doc: any): SessionRecord {
  return {
    id: String(doc._id),
    userOfferId: doc.userOfferId,
    userId: doc.userId,
    offerId: doc.offerId,
    clinicId: doc.clinicId,
    scheduledAt: doc.scheduledAt.toISOString(),
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    scheduledBy: doc.scheduledBy,
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : undefined,
    markedBy: doc.markedBy,
    notes: doc.notes,
    cashbackUnlockedKwd: doc.cashbackUnlockedKwd,
    extraItems: doc.extraItems,
    totalBillKwd: doc.totalBillKwd,
    finalPaidKwd: doc.finalPaidKwd
  };
}

export const sessionsStore = {
  async create(input: Omit<SessionRecord, "id" | "createdAt" | "status">): Promise<SessionRecord> {
    const doc = await BookingSessionModel.create({
      ...input,
      status: "scheduled"
    });
    return mapDoc(doc);
  },

  async get(id: string): Promise<SessionRecord | null> {
    const doc = await BookingSessionModel.findById(id);
    return doc ? mapDoc(doc) : null;
  },

  async listByClinic(clinicId: string, fromIso: string, toIso: string): Promise<SessionRecord[]> {
    const docs = await BookingSessionModel.find({
      clinicId,
      scheduledAt: { $gte: new Date(fromIso), $lte: new Date(toIso) }
    }).sort({ scheduledAt: 1 });
    return docs.map(mapDoc);
  },

  async listMissedByClinic(clinicId: string): Promise<SessionRecord[]> {
    const docs = await BookingSessionModel.find({
      clinicId,
      status: "no_show"
    }).sort({ scheduledAt: -1 });
    return docs.map(mapDoc);
  },

  async listByUser(userId: string): Promise<SessionRecord[]> {
    const docs = await BookingSessionModel.find({ userId }).sort({ scheduledAt: -1 });
    return docs.map(mapDoc);
  },

  async listByUserOffer(userOfferId: string): Promise<SessionRecord[]> {
    const docs = await BookingSessionModel.find({ userOfferId }).sort({ scheduledAt: 1 });
    return docs.map(mapDoc);
  },

  async lastCompletedAt(userOfferId: string, userId?: string): Promise<string | null> {
    const query: any = {
      userOfferId,
      status: "completed",
      completedAt: { $exists: true }
    };
    if (userId) query.userId = userId;

    const doc = await BookingSessionModel.findOne(query).sort({ completedAt: -1 });

    const { UserOfferModel } = await import("../../models/userOffer.model.js");
    const uo = await UserOfferModel.findById(userOfferId).select("lastManualSessionAt").lean();

    const d1 = doc?.completedAt ? new Date(doc.completedAt).getTime() : 0;
    const d2 = uo && (uo as any).lastManualSessionAt ? new Date((uo as any).lastManualSessionAt).getTime() : 0;

    if (d1 === 0 && d2 === 0) return null;
    return new Date(Math.max(d1, d2)).toISOString();
  },

  async countCommitted(userOfferId: string): Promise<number> {
    return BookingSessionModel.countDocuments({
      userOfferId,
      status: { $ne: "cancelled" }
    });
  },

  async isSlotTaken(clinicId: string, scheduledAtIso: string): Promise<boolean> {
    const count = await BookingSessionModel.countDocuments({
      clinicId,
      scheduledAt: new Date(scheduledAtIso),
      status: { $ne: "cancelled" }
    });
    return count > 0;
  },

  async listScheduledBetween(from: Date, to: Date): Promise<SessionRecord[]> {
    const docs = await BookingSessionModel.find({
      status: "scheduled",
      scheduledAt: { $gte: from, $lte: to }
    });
    return docs.map(mapDoc);
  },

  async mark(input: {
    sessionId: string;
    status: "completed" | "no_show" | "cancelled";
    markedBy: string;
    notes?: string;
    cashbackUnlockedKwd?: string;
    extraItems?: { name: string; priceKwd: string; qty: number }[];
    totalBillKwd?: string;
    finalPaidKwd?: string;
  }): Promise<SessionRecord | null> {
    const update: any = {
      status: input.status,
      markedBy: input.markedBy
    };
    if (input.notes) update.notes = input.notes;
    if (input.status === "completed") {
      update.completedAt = new Date();
      if (input.cashbackUnlockedKwd) update.cashbackUnlockedKwd = input.cashbackUnlockedKwd;
      if (input.extraItems) update.extraItems = input.extraItems;
      if (input.totalBillKwd) update.totalBillKwd = input.totalBillKwd;
      if (input.finalPaidKwd) update.finalPaidKwd = input.finalPaidKwd;
    }
    const doc = await BookingSessionModel.findByIdAndUpdate(
      input.sessionId,
      { $set: update },
      { new: true }
    );
    return doc ? mapDoc(doc) : null;
  },

  async reschedule(input: {
    sessionId: string;
    scheduledAt: string;
    rescheduledBy: string;
    notes?: string;
  }): Promise<SessionRecord | null> {
    const update: any = {
      scheduledAt: new Date(input.scheduledAt),
      scheduledBy: input.rescheduledBy,
      status: "scheduled"
    };
    if (input.notes) update.notes = input.notes;
    const doc = await BookingSessionModel.findByIdAndUpdate(
      input.sessionId,
      { $set: update },
      { new: true }
    );
    return doc ? mapDoc(doc) : null;
  }
};

