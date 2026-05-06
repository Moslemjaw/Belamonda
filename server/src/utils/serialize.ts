import type { Types } from "mongoose";
import type { ClinicDoc } from "../models/clinic.model.js";
import type { OfferDoc } from "../models/offer.model.js";
import type { UserOfferDoc } from "../models/userOffer.model.js";
import type { BookingSessionDoc } from "../models/bookingSession.model.js";
import type { PaymentDoc } from "../models/payment.model.js";

/** Lean / hydrated category document */
export type CategoryLike = {
  _id: Types.ObjectId;
  nameAr: string;
  nameEn: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export function idString(id: Types.ObjectId | string): string {
  return typeof id === "string" ? id : id.toString();
}

export function serializeCategory(doc: CategoryLike) {
  return {
    id: doc._id.toString(),
    nameAr: doc.nameAr,
    nameEn: doc.nameEn,
    slug: doc.slug,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)
  };
}

export function serializeClinic(doc: ClinicDoc) {
  return {
    id: doc._id.toString(),
    nameEn: doc.nameEn,
    nameAr: doc.nameAr,
    address: doc.address,
    lat: doc.lat,
    lng: doc.lng,
    phone: doc.phone,
    categoryTags: doc.categoryTags ?? [],
    operatingHours: doc.operatingHours,
    active: doc.active,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt)
  };
}

export function serializeOffer(doc: OfferDoc, categorySlug?: string | null) {
  const base = {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    category: (doc.category ?? categorySlug ?? "other") as string,
    categoryIds: (doc.categoryIds ?? []).map((c) => idString(c as Types.ObjectId)),
    clinicId: idString(doc.clinicId as Types.ObjectId),
    subscriptionPriceKwd: doc.subscriptionPriceKwd,
    validityDays: doc.validityDays,
    imageUrl: (doc as any).imageUrl,
    isCashbackOnly: !!(doc as any).isCashbackOnly,
    signupCashbackKwd: (doc as any).signupCashbackKwd ?? "0.000",
    cashbackActivationFeeKwd: (doc as any).cashbackActivationFeeKwd ?? "0.000",
    tagsEn: (doc as any).tagsEn ?? [],
    tagsAr: (doc as any).tagsAr ?? [],
    allowFullPayment: (doc as any).allowFullPayment ?? true,
    allowInstallments: (doc as any).allowInstallments ?? false,
    maxInstallments: (doc as any).maxInstallments ?? 1,
    allowDeposit: (doc as any).allowDeposit ?? false,
    depositAmountKwd: (doc as any).depositAmountKwd ?? "0.000",
    cashbackPerSessionKwd: doc.cashbackPerSessionKwd ?? "0.000",
    sessionIntervalDays: doc.sessionIntervalDays ?? 0,
    maxSessions: doc.maxSessions,
    active: doc.active,
    featured: doc.featured,
    enrollmentCap: doc.enrollmentCap,
    enrolledCount: doc.enrolledCount ?? 0,
    startDate: doc.startDate ? new Date(doc.startDate).toISOString() : undefined,
    endDate: doc.endDate ? new Date(doc.endDate).toISOString() : undefined,
    description: doc.description,
    terms: doc.terms,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    ...(doc.type === "B"
      ? {
          perVisitPriceKwd: doc.perVisitPriceKwd,
          originalClinicPriceKwd: doc.originalClinicPriceKwd
        }
      : {})
  };
  return base;
}

export function serializeUserOffer(doc: UserOfferDoc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    offerId: idString(doc.offerId as Types.ObjectId),
    clinicId: idString(doc.clinicId as Types.ObjectId),
    status: doc.status,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    pendingExpiresAt: doc.pendingExpiresAt ? new Date(doc.pendingExpiresAt).toISOString() : undefined,
    activatedAt: doc.activatedAt ? new Date(doc.activatedAt).toISOString() : undefined,
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : undefined,
    sessionsUsed: doc.sessionsUsed,
    paymentConfirmedBy: doc.paymentConfirmedBy,
    paymentConfirmedAt: doc.paymentConfirmedAt ? new Date(doc.paymentConfirmedAt).toISOString() : undefined,
    paymentProofRef: doc.paymentProofRef,
    paymentMethod: doc.paymentMethod,
    paymentAmountKwd: doc.paymentAmountKwd,
    paymentId: doc.paymentId ? idString(doc.paymentId as Types.ObjectId) : undefined
  };
}

export function serializeBookingSession(doc: BookingSessionDoc) {
  return {
    id: doc._id.toString(),
    userOfferId: idString(doc.userOfferId as Types.ObjectId),
    userId: doc.userId,
    offerId: idString(doc.offerId as Types.ObjectId),
    clinicId: idString(doc.clinicId as Types.ObjectId),
    scheduledAt: new Date(doc.scheduledAt).toISOString(),
    status: doc.status,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    scheduledBy: doc.scheduledBy,
    completedAt: doc.completedAt ? new Date(doc.completedAt).toISOString() : undefined,
    markedBy: doc.markedBy,
    notes: doc.notes,
    cashbackUnlockedKwd: doc.cashbackUnlockedKwd,
    paymentId: doc.paymentId ? idString(doc.paymentId as Types.ObjectId) : undefined
  };
}

export function serializePayment(doc: PaymentDoc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    offerId: idString(doc.offerId as Types.ObjectId),
    userOfferId: idString(doc.userOfferId as Types.ObjectId),
    bookingId: doc.bookingId ? idString(doc.bookingId as Types.ObjectId) : undefined,
    amountKwd: doc.amountKwd,
    currency: doc.currency,
    method: doc.method,
    status: doc.status,
    proofRef: doc.proofRef,
    confirmedBy: doc.confirmedBy,
    confirmedAt: doc.confirmedAt ? new Date(doc.confirmedAt).toISOString() : undefined,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)
  };
}
