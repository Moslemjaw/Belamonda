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

export function idString(id: Types.ObjectId | string | undefined | null): string {
  if (!id) return "";
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
    contactName: (doc as any).contactName,
    contactPhone: (doc as any).contactPhone,
    contactEmail: (doc as any).contactEmail,
    categoryTags: doc.categoryTags ?? [],
    operatingHours: doc.operatingHours,
    active: doc.active,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt)
  };
}

export function serializeOffer(doc: OfferDoc, categorySlug?: string | null) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    nameAr: (doc as any).nameAr,
    subtitle: (doc as any).subtitle,
    type: doc.type,
    offerKind: (doc as any).offerKind,
    membershipType: (doc as any).membershipType,
    category: (doc.category ?? categorySlug ?? "other") as string,
    categoryIds: (doc.categoryIds ?? []).map((c) => idString(c as Types.ObjectId)),
    status: (doc as any).status ?? (doc.active ? "active" : "draft"),
    active: doc.active,
    visibility: (doc as any).visibility ?? "public",
    featured: doc.featured,
    sortOrder: (doc as any).sortOrder ?? 0,
    clinicId: idString(doc.clinicId as Types.ObjectId),
    clinicIds: ((doc as any).clinicIds ?? []).map((c: Types.ObjectId | string) => idString(c as Types.ObjectId)),
    clinicLocked: (doc as any).clinicLocked,
    requireBranchSelection: (doc as any).requireBranchSelection ?? true,
    clinicTransferFeeKwd: (doc as any).clinicTransferFeeKwd ?? "0.000",
    doctorIds: (doc as any).doctorIds ?? [],
    subscriptionPriceKwd: doc.subscriptionPriceKwd,
    perVisitPriceKwd: doc.perVisitPriceKwd,
    originalClinicPriceKwd: doc.originalClinicPriceKwd,
    validityDays: doc.validityDays,
    maxSessions: doc.maxSessions,
    sessionIntervalDays: doc.sessionIntervalDays ?? 0,
    sessionExpiryMonths: (doc as any).sessionExpiryMonths ?? 0,
    maxBookingsPerWeek: (doc as any).maxBookingsPerWeek,
    maxActiveSessions: (doc as any).maxActiveSessions,
    bookingMode: (doc as any).bookingMode ?? "instant",
    enrollmentCap: doc.enrollmentCap,
    enrolledCount: doc.enrolledCount ?? 0,
    startDate: doc.startDate ? new Date(doc.startDate).toISOString() : undefined,
    endDate: doc.endDate ? new Date(doc.endDate).toISOString() : undefined,
    offerExpirationDate: (doc as any).offerExpirationDate
      ? new Date((doc as any).offerExpirationDate).toISOString()
      : undefined,
    isGroupOffer: (doc as any).isGroupOffer ?? false,
    groupSizeRequired: (doc as any).groupSizeRequired,
    groupRewardType: (doc as any).groupRewardType,
    groupRewardValue: (doc as any).groupRewardValue,
    description: doc.description,
    terms: doc.terms,
    imageUrl: doc.imageUrl,
    bannerUrl: (doc as any).bannerUrl,
    tagsEn: doc.tagsEn ?? [],
    tagsAr: doc.tagsAr ?? [],
    allowFullPayment: doc.allowFullPayment ?? true,
    allowInstallments: doc.allowInstallments ?? false,
    maxInstallments: doc.maxInstallments ?? 1,
    allowDeposit: doc.allowDeposit ?? false,
    depositAmountKwd: doc.depositAmountKwd ?? "0.000",
    allowENet: (doc as any).allowENet ?? false,
    fullPaymentEFormId: (doc as any).fullPaymentEFormId ? idString((doc as any).fullPaymentEFormId as Types.ObjectId) : undefined,
    installmentsEFormId: (doc as any).installmentsEFormId ? idString((doc as any).installmentsEFormId as Types.ObjectId) : undefined,
    depositEFormId: (doc as any).depositEFormId ? idString((doc as any).depositEFormId as Types.ObjectId) : undefined,
    enetEFormId: (doc as any).enetEFormId ? idString((doc as any).enetEFormId as Types.ObjectId) : undefined,
    payPerSession: doc.payPerSession ?? false,
    sessionPriceKwd: doc.sessionPriceKwd,
    clinicOverrides: ((doc as any).branchSessionPrices ?? (doc as any).clinicOverrides ?? []).map((b: any) => ({
      clinicId: b.clinicId,
      sessionPriceKwd: b.sessionPriceKwd
    })),
    signupCashbackKwd: doc.signupCashbackKwd ?? "0.000",
    cashbackActivationFeeKwd: doc.cashbackActivationFeeKwd ?? "0.000",
    cashbackPerSessionKwd: doc.cashbackPerSessionKwd ?? "0.000",
    cashbackEligible: doc.cashbackEligible ?? true,
    maxCashbackPerPurchaseKwd: doc.maxCashbackPerPurchaseKwd,
    isCashbackOnly: doc.isCashbackOnly ?? false,
    branchSubscriptionPrices: ((doc as any).branchSubscriptionPrices ?? []).map((b: any) => ({
      clinicId: b.clinicId,
      priceKwd: b.priceKwd
    })),
    allowExtraPaidSessions: (doc as any).allowExtraPaidSessions ?? false,
    extraSessionPriceKwd: (doc as any).extraSessionPriceKwd,
    allowAppointmentBooking: doc.allowAppointmentBooking ?? true,
    branchExtraSessionPrices: ((doc as any).branchExtraSessionPrices ?? []).map((b: any) => ({
      clinicId: b.clinicId,
      priceKwd: b.priceKwd
    })),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt)
  };
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
    paymentId: doc.paymentId ? idString(doc.paymentId as Types.ObjectId) : undefined,
    purchaseMode: doc.purchaseMode,
    cashbackAppliedKwd: doc.cashbackAppliedKwd,
    installmentCount: doc.installmentCount,
    installmentsPaid: doc.installmentsPaid,
    installmentSchedule: (doc.installmentSchedule ?? []).map((s) => ({
      number: s.number,
      amountKwd: s.amountKwd,
      dueDate: s.dueDate ? new Date(s.dueDate).toISOString() : undefined,
      paid: !!s.paid,
      paidAt: s.paidAt ? new Date(s.paidAt).toISOString() : undefined
    })),
    nextInstallmentDueAt: doc.nextInstallmentDueAt
      ? new Date(doc.nextInstallmentDueAt).toISOString()
      : undefined,
    depositAmountKwd: doc.depositAmountKwd,
    depositPaidAt: doc.depositPaidAt
      ? new Date(doc.depositPaidAt).toISOString()
      : undefined,
    reservationExpiresAt: doc.reservationExpiresAt
      ? new Date(doc.reservationExpiresAt).toISOString()
      : undefined,
    reservationCompletionExpectedAt: doc.reservationCompletionExpectedAt
      ? new Date(doc.reservationCompletionExpectedAt).toISOString()
      : undefined,
    reservationPreferredPlan: doc.reservationPreferredPlan,
    enetStatus: doc.enetStatus,
    enetTxnRef: doc.enetTxnRef,
    isStandalone: !!doc.isStandalone,
    // Membership type & group fields
    membershipType: (doc as any).membershipType ?? undefined,
    cashbackBalanceKwd: (doc as any).cashbackBalanceKwd ?? undefined,
    totalSignupCashbackKwd: (doc as any).totalSignupCashbackKwd ?? undefined,
    cashbackGrantedKwd: (doc as any).cashbackGrantedKwd ?? "0.000",
    groupInviteCode: (doc as any).groupInviteCode ?? undefined,
    sharedWith: (doc as any).sharedWith ?? [],
    maxSessions: (doc as any).maxSessions ?? undefined,
    lastManualSessionAt: (doc as any).lastManualSessionAt ? new Date((doc as any).lastManualSessionAt).toISOString() : undefined,
    shortId: (doc as any).shortId ?? undefined
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
    grossAmountKwd: doc.grossAmountKwd,
    cashbackAppliedKwd: doc.cashbackAppliedKwd,
    currency: doc.currency,
    method: doc.method,
    status: doc.status,
    purpose: doc.purpose,
    provider: doc.provider,
    providerRef: doc.providerRef,
    installmentNumber: doc.installmentNumber,
    failureReason: doc.failureReason,
    proofRef: doc.proofRef,
    confirmedBy: doc.confirmedBy,
    confirmedAt: doc.confirmedAt ? new Date(doc.confirmedAt).toISOString() : undefined,
    bookingRequestId: (doc as { bookingRequestId?: string }).bookingRequestId,
    customerWalletBalanceAfterKwd: (doc as { customerWalletBalanceAfterKwd?: string }).customerWalletBalanceAfterKwd,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)
  };
}
