import type { AppointmentStatus, PaymentStatus } from "@belamonda/shared";

export type BookingRequestRecord = {
  id: string;
  userOfferId?: string;
  userId: string;
  offerId?: string;   // optional — standalone bookings may not have a DB offer id yet
  clinicId: string;
  status: AppointmentStatus;
  isStandalone?: boolean;
  bookingRoute?: "cs" | "clinic";
  standaloneName?: string;
  preferredAt?: string;
  proposedAt?: string;
  proposedBy?: string;
  acceptedAt?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  scheduledSessionId?: string;
  sessionPaymentId?: string;
  sessionPriceKwd?: string;
  cashbackDeductedKwd?: string;
  membershipType?: string;
  hadCashback?: boolean;
  clinicPaymentStatus?: PaymentStatus;
  clinicPaymentMarkedAt?: string;
  clinicPaymentMarkedBy?: string;
  notes?: string;
  conversationId?: string;
  extraItems?: { name: string; priceKwd: string; qty: number }[];
  totalBillKwd?: string;
  finalPaidKwd?: string;
  createdAt: string;
  updatedAt: string;
};

import { BookingRequestModel } from "../../models/bookingRequest.model.js";

function mapDoc(doc: any): BookingRequestRecord {
  return {
    id: String(doc._id),
    userOfferId: doc.userOfferId,
    userId: doc.userId,
    offerId: doc.offerId,
    clinicId: doc.clinicId,
    status: doc.status,
    isStandalone: doc.isStandalone,
    bookingRoute: doc.bookingRoute,
    standaloneName: doc.standaloneName,
    preferredAt: doc.preferredAt ? doc.preferredAt.toISOString() : undefined,
    proposedAt: doc.proposedAt ? doc.proposedAt.toISOString() : undefined,
    proposedBy: doc.proposedBy,
    acceptedAt: doc.acceptedAt ? doc.acceptedAt.toISOString() : undefined,
    confirmedAt: doc.confirmedAt ? doc.confirmedAt.toISOString() : undefined,
    confirmedBy: doc.confirmedBy,
    rejectedAt: doc.rejectedAt ? doc.rejectedAt.toISOString() : undefined,
    rejectedBy: doc.rejectedBy,
    rejectionReason: doc.rejectionReason,
    scheduledSessionId: doc.scheduledSessionId,
    sessionPaymentId: doc.sessionPaymentId,
    sessionPriceKwd: doc.sessionPriceKwd,
    cashbackDeductedKwd: doc.cashbackDeductedKwd,
    membershipType: doc.membershipType,
    hadCashback: doc.hadCashback,
    clinicPaymentStatus: doc.clinicPaymentStatus,
    clinicPaymentMarkedAt: doc.clinicPaymentMarkedAt ? doc.clinicPaymentMarkedAt.toISOString() : undefined,
    clinicPaymentMarkedBy: doc.clinicPaymentMarkedBy,
    notes: doc.notes,
    conversationId: doc.conversationId,
    extraItems: doc.extraItems,
    totalBillKwd: doc.totalBillKwd,
    finalPaidKwd: doc.finalPaidKwd,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const bookingRequestsStore = {
  async create(input: {
    userOfferId?: string;
    userId: string;
    offerId?: string;
    clinicId: string;
    isStandalone?: boolean;
    bookingRoute?: "cs" | "clinic";
    standaloneName?: string;
    membershipType?: string;
    hadCashback?: boolean;
    sessionPriceKwd?: string;
    cashbackDeductedKwd?: string;
    preferredAt?: string;
    notes?: string;
  }): Promise<BookingRequestRecord> {
    const doc = await BookingRequestModel.create({
      ...input,
      status: "request_received",
    });
    return mapDoc(doc);
  },

  async get(id: string): Promise<BookingRequestRecord | null> {
    const doc = await BookingRequestModel.findById(id);
    return doc ? mapDoc(doc) : null;
  },

  async list(filter?: {
    status?: AppointmentStatus | "all" | "open";
    clinicId?: string;
    userId?: string;
    isStandalone?: boolean;
    bookingRoute?: "cs" | "clinic";
  }): Promise<BookingRequestRecord[]> {
    const query: any = {};
    
    if (filter?.status && filter.status !== "all") {
      if (filter.status === "open") {
        query.status = { $in: ["request_received", "slot_assigned", "slot_proposed"] };
      } else {
        query.status = filter.status;
      }
    }
    if (filter?.clinicId) query.clinicId = filter.clinicId;
    if (filter?.userId) query.userId = filter.userId;
    if (filter?.isStandalone !== undefined) query.isStandalone = filter.isStandalone;
    if (filter?.bookingRoute) query.bookingRoute = filter.bookingRoute;

    const docs = await BookingRequestModel.find(query).sort({ createdAt: -1 });
    return docs.map(mapDoc);
  },

  async update(id: string, patch: Partial<BookingRequestRecord>): Promise<BookingRequestRecord | null> {
    const doc = await BookingRequestModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true }
    );
    return doc ? mapDoc(doc) : null;
  },

  async setConversation(id: string, conversationId: string): Promise<BookingRequestRecord | null> {
    return this.update(id, { conversationId });
  },

  async findBySessionId(sessionId: string): Promise<BookingRequestRecord | null> {
    const doc = await BookingRequestModel.findOne({ scheduledSessionId: sessionId });
    return doc ? mapDoc(doc) : null;
  },

  async findByConversationId(conversationId: string): Promise<BookingRequestRecord | null> {
    const doc = await BookingRequestModel.findOne({ conversationId });
    return doc ? mapDoc(doc) : null;
  }
};
