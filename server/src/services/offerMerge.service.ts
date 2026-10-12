// Merge duplicate offers (memberships) into one, without changing anything for customers.
//
// Everything that points at a duplicate is moved to the kept offer in one transaction:
// memberships, booking requests, sessions, payments, clinic-change requests, promotions,
// e-form targets and e-form submissions. The duplicates are then hidden (never hard-deleted)
// and remember which offer they were merged into. A dry run reports exactly what would move.
import mongoose from "mongoose";
import { OfferModel } from "../models/offer.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { BookingRequestModel } from "../models/bookingRequest.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { PaymentModel } from "../models/payment.model.js";
import { ClinicChangeRequestModel } from "../models/clinicChangeRequest.model.js";
import { PromotionModel } from "../models/promotion.model.js";
import { EFormModel, EFormSubmissionModel } from "../models/eform.model.js";
import { withTransaction } from "../db/transaction.js";
import { ApiError } from "../utils/apiError.js";
import { logAuditAction } from "./audit.service.js";
import { clearAdminOffersCache } from "./offer.service.js";

/** Read live from the offer for EXISTING memberships — a difference would change them. */
const AFFECTS_EXISTING = [
  "maxSessions", "sessionIntervalDays", "cashbackPerSessionKwd", "payPerSession", "sessionPriceKwd",
  "branchSessionPrices", "clinicOverrides", "allowExtraPaidSessions", "extraSessionPriceKwd",
  "branchExtraSessionPrices", "bookingFlow", "membershipType", "isGroupOffer", "groupSizeRequired",
  "groupRewardType", "clinicLocked", "clinicTransferFeeKwd", "allowAppointmentBooking",
  "signupCashbackKwd", "subscriptionPriceKwd", "isCashbackOnly"
] as const;

/** Only used when someone buys — a difference affects future purchases only. */
const PURCHASE_ONLY = [
  "allowFullPayment", "allowInstallments", "maxInstallments", "allowDeposit", "depositAmountKwd",
  "allowENet", "fullPaymentEFormId", "installmentsEFormId", "depositEFormId", "enetEFormId",
  "validityDays", "requireBranchSelection", "clinicId", "clinicIds", "visibility", "category", "categoryIds"
] as const;

type Diff = { field: string; kept: unknown; duplicate: unknown; offerId: string };

function norm(v: unknown): string {
  return JSON.stringify(v ?? null, (_k, x) => (x && typeof x === "object" && x._bsontype === "ObjectId" ? String(x) : x));
}

export async function mergeOffers(input: {
  keepId: string;
  mergeIds: string[];
  dryRun?: boolean;
  acceptDifferences?: boolean;
  actor: { userId: string; role: string };
}) {
  const mergeIds = [...new Set(input.mergeIds.map(String))].filter((id) => id !== String(input.keepId));
  if (!mongoose.isValidObjectId(input.keepId) || mergeIds.length === 0 || !mergeIds.every((id) => mongoose.isValidObjectId(id))) {
    throw new ApiError(400, "INVALID_OFFER_IDS");
  }
  const keepOid = new mongoose.Types.ObjectId(input.keepId);
  const mergeOids = mergeIds.map((id) => new mongoose.Types.ObjectId(id));

  const [keep, dups] = await Promise.all([
    OfferModel.findById(keepOid).lean<any>(),
    OfferModel.find({ _id: { $in: mergeOids } }).lean<any[]>()
  ]);
  if (!keep) throw new ApiError(404, "KEEP_OFFER_NOT_FOUND");
  if (keep.mergedInto) throw new ApiError(409, "KEEP_OFFER_ALREADY_MERGED");
  if (dups.length !== mergeIds.length) throw new ApiError(404, "DUPLICATE_OFFER_NOT_FOUND");

  // What would move
  const [memberships, activeMemberships, bookingRequests, sessions, payments, clinicChanges, promotions, formsTargeting, submissions] =
    await Promise.all([
      UserOfferModel.countDocuments({ offerId: { $in: mergeOids } }),
      UserOfferModel.countDocuments({ offerId: { $in: mergeOids }, status: { $in: ["active", "pending_payment", "reserved"] } }),
      BookingRequestModel.countDocuments({ offerId: { $in: mergeIds } }),
      BookingSessionModel.countDocuments({ offerId: { $in: mergeOids } }),
      PaymentModel.countDocuments({ offerId: { $in: mergeOids } }),
      ClinicChangeRequestModel.countDocuments({ offerId: { $in: mergeOids } }),
      PromotionModel.countDocuments({ offerIds: { $in: mergeOids } }),
      EFormModel.countDocuments({ targets: { $elemMatch: { kind: "offer", refId: { $in: mergeIds } } } }),
      EFormSubmissionModel.countDocuments({ targetKind: "offer", targetRefId: { $in: mergeIds } })
    ]);

  // Settings differences between the kept offer and each duplicate
  const affectsExisting: Diff[] = [];
  const purchaseOnly: Diff[] = [];
  for (const d of dups) {
    for (const f of AFFECTS_EXISTING) if (norm(keep[f]) !== norm(d[f])) affectsExisting.push({ field: f, kept: keep[f] ?? null, duplicate: d[f] ?? null, offerId: String(d._id) });
    for (const f of PURCHASE_ONLY) if (norm(keep[f]) !== norm(d[f])) purchaseOnly.push({ field: f, kept: keep[f] ?? null, duplicate: d[f] ?? null, offerId: String(d._id) });
  }

  // E-forms the kept offer requires before booking that moved customers never had to sign
  const keepBookingForms = await EFormModel.find({
    archived: { $ne: true },
    requireBeforeBooking: true,
    targets: { $elemMatch: { kind: "offer", refId: String(keepOid) } }
  }).select("title targets").lean<any[]>();
  const newBookingForms = keepBookingForms
    .filter((f) => !mergeIds.every((id) => (f.targets ?? []).some((t: any) => t.kind === "offer" && t.refId === id)))
    .map((f) => ({ id: String(f._id), title: f.title }));

  const report = {
    keep: { id: String(keep._id), name: keep.name },
    duplicates: dups.map((d) => ({ id: String(d._id), name: d.name })),
    moves: { memberships, activeMemberships, bookingRequests, sessions, payments, clinicChanges, promotions, formsTargeting, submissions },
    differences: { affectsExisting, purchaseOnly },
    newBookingForms,
    // Differences only matter for customers who are actually moved
    needsConfirmation: memberships > 0 && (affectsExisting.length > 0 || newBookingForms.length > 0)
  };

  if (input.dryRun) return { dryRun: true as const, ...report };
  if (report.needsConfirmation && !input.acceptDifferences) {
    throw new ApiError(409, "MERGE_CHANGES_EXISTING_MEMBERSHIPS", report as unknown as Record<string, unknown>);
  }

  await withTransaction(async () => {
    await UserOfferModel.updateMany({ offerId: { $in: mergeOids } }, { $set: { offerId: keepOid } });
    await BookingRequestModel.updateMany({ offerId: { $in: mergeIds } }, { $set: { offerId: String(keepOid) } });
    await BookingSessionModel.updateMany({ offerId: { $in: mergeOids } }, { $set: { offerId: keepOid } });
    await PaymentModel.updateMany({ offerId: { $in: mergeOids } }, { $set: { offerId: keepOid } });
    await ClinicChangeRequestModel.updateMany({ offerId: { $in: mergeOids } }, { $set: { offerId: keepOid } });
    await EFormSubmissionModel.updateMany({ targetKind: "offer", targetRefId: { $in: mergeIds } }, { $set: { targetRefId: String(keepOid) } });

    // Promotions: swap duplicates for the kept offer, without listing it twice
    const promos = await PromotionModel.find({ offerIds: { $in: mergeOids } }).select("offerIds").lean<any[]>();
    for (const p of promos) {
      const ids = [...new Set((p.offerIds ?? []).map((x: unknown) => (mergeIds.includes(String(x)) ? String(keepOid) : String(x))))];
      await PromotionModel.updateOne({ _id: p._id }, { $set: { offerIds: ids.map((x) => new mongoose.Types.ObjectId(x as string)) } });
    }
    // E-forms: retarget to the kept offer, without duplicate targets
    const forms = await EFormModel.find({ targets: { $elemMatch: { kind: "offer", refId: { $in: mergeIds } } } }).select("targets").lean<any[]>();
    for (const f of forms) {
      const seen = new Set<string>();
      const targets = (f.targets ?? [])
        .map((t: any) => (t.kind === "offer" && mergeIds.includes(t.refId) ? { kind: "offer", refId: String(keepOid) } : { kind: t.kind, refId: t.refId }))
        .filter((t: any) => (seen.has(`${t.kind}:${t.refId}`) ? false : (seen.add(`${t.kind}:${t.refId}`), true)));
      await EFormModel.updateOne({ _id: f._id }, { $set: { targets } });
    }

    // Retire the duplicates (hidden, never hard-deleted)
    await OfferModel.updateMany(
      { _id: { $in: mergeOids } },
      { $set: { status: "hidden", active: false, featured: false, mergedInto: keepOid, mergedAt: new Date() } }
    );
    await logAuditAction({
      actorId: input.actor.userId,
      actorRole: input.actor.role as any,
      actionType: "offers_merged",
      targetEntityType: "Offer",
      targetEntityId: keepOid,
      beforeState: { duplicates: report.duplicates },
      afterState: { keep: report.keep },
      metadata: { moves: report.moves, acceptedDifferences: report.differences.affectsExisting.length > 0 }
    });
  });
  clearAdminOffersCache();
  return { dryRun: false as const, merged: true, ...report };
}
