import mongoose from "mongoose";
import { UserModel } from "../../models/user.model.js";
import { UserOfferModel } from "../../models/userOffer.model.js";
import { OfferModel } from "../../models/offer.model.js";
import { PaymentModel } from "../../models/payment.model.js";
import { notifyReferralFirstPurchase } from "../notifications/notifications.service.js";

interface UserLean {
  _id: mongoose.Types.ObjectId;
  username?: string;
  fullName?: string;
  role?: string;
  isActive?: boolean;
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  referralNotified?: boolean;
}

interface UserOfferLean {
  _id: mongoose.Types.ObjectId;
  offerId?: mongoose.Types.ObjectId;
  paymentAmountKwd?: string;
  depositAmountKwd?: string;
}

interface PaymentLean {
  _id: mongoose.Types.ObjectId;
  amountKwd: string;
}

interface OfferLean {
  _id: mongoose.Types.ObjectId;
  name?: string;
}

async function generateUniqueCode(username?: string): Promise<string> {
  const base = ((username || "BELA") as string)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4)
    .padEnd(4, "X");
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const code = `${base}${suffix}`;
    const existing = await UserModel.exists({ referralCode: code });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  if (!mongoose.isValidObjectId(userId)) throw new Error("Invalid userId");
  const user = await UserModel.findById(userId)
    .select("username referralCode")
    .lean<UserLean>();
  if (!user) throw new Error("User not found");
  if (user.referralCode) return user.referralCode;

  // Concurrent requests can race past the check above. We generate a code and
  // write it only when referralCode is still unset ($exists: false). On a
  // duplicate-key collision (11000) we re-read the code that the winning
  // writer stored — data integrity is always preserved by the unique index.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = await generateUniqueCode(user.username);
    try {
      const updated = await UserModel.findOneAndUpdate(
        { _id: userId, referralCode: { $exists: false } },
        { $set: { referralCode: code } },
        { new: true }
      ).select("referralCode").lean<UserLean>();
      if (updated?.referralCode) return updated.referralCode;
      // Another concurrent writer already set the code — read what they stored.
      const fresh = await UserModel.findById(userId).select("referralCode").lean<UserLean>();
      if (fresh?.referralCode) return fresh.referralCode;
    } catch (err: unknown) {
      const isDupKey = typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
      if (!isDupKey || attempt === 2) throw err;
      // Duplicate-key: another writer raced us. Re-read on next iteration.
    }
  }
  throw new Error("Could not create referral code after retries");
}

const ELIGIBLE_REFERRER_ROLES = ["admin", "cs", "finance", "clinicStaff", "cs_director"];

export async function getReferralStats(referrerId: string) {
  if (!mongoose.isValidObjectId(referrerId)) return { referredCount: 0, convertedCount: 0, totalAmountKwd: "0.000", referredUsers: [] };
  const referrer = await UserModel.findById(referrerId).select("role").lean<UserLean>();
  if (!referrer) {
    return { referredCount: 0, convertedCount: 0, totalAmountKwd: "0.000", referredUsers: [] };
  }

  interface ReferredUserLean {
    _id: mongoose.Types.ObjectId;
    username?: string;
    fullName?: string;
    createdAt?: Date;
  }

  const referredUsers = await UserModel.find(
    { referredBy: new mongoose.Types.ObjectId(referrerId) },
    { _id: 1, username: 1, fullName: 1, createdAt: 1 }
  ).lean<ReferredUserLean[]>();

  if (!referredUsers.length) return { referredCount: 0, convertedCount: 0, totalAmountKwd: "0.000", referredUsers: [] };

  const referredIds = referredUsers.map((u) => u._id.toString());

  // "Converted" = fully activated purchase (active or expired).
  // "Reserved" (deposit-only) is intentionally excluded here; the customer
  // has not yet completed full payment so they are not counted as converted.
  const convertedUserIds = await UserOfferModel.distinct("userId", {
    userId: { $in: referredIds },
    status: { $in: ["active", "expired"] }
  }) as string[];

  const paymentAgg = await PaymentModel.aggregate([
    { $match: { userId: { $in: referredIds }, status: "completed" } },
    {
      $group: {
        _id: null,
        totalAmountKwd: {
          $sum: {
            $convert: { input: "$amountKwd", to: "double", onError: 0, onNull: 0 }
          }
        }
      }
    }
  ]);

  const payAgg = paymentAgg[0] as { totalAmountKwd: number } | undefined;

  return {
    referredCount: referredUsers.length,
    convertedCount: convertedUserIds.length,
    totalAmountKwd: payAgg ? Number(payAgg.totalAmountKwd).toFixed(3) : "0.000",
    referredUsers: referredUsers.map((u) => ({
      id: String(u._id),
      username: u.username,
      fullName: u.fullName,
      joinedAt: u.createdAt
    }))
  };
}

interface StaffReferralRow {
  userId: string;
  username?: string;
  role?: string;
  referralCode?: string;
  referredCount: number;
  convertedCount: number;
  totalAmountKwd: string;
}

/**
 * Batch-loads referral stats for every eligible staff user in 4 fixed queries
 * regardless of staff count, eliminating the N+1 pattern in /referral/admin/all.
 */
export async function getAllStaffReferralStats(): Promise<StaffReferralRow[]> {
  const staffUsers = await UserModel.find(
    { role: { $in: ELIGIBLE_REFERRER_ROLES } },
    { _id: 1, username: 1, role: 1, referralCode: 1 }
  ).lean<UserLean[]>();

  if (!staffUsers.length) return [];

  const staffIds = staffUsers.map((u) => u._id);

  // Query 1: referred user counts per referrer
  interface ReferredAgg { _id: string; count: number; userIds: string[] }
  const referredAgg = await UserModel.aggregate<ReferredAgg>([
    { $match: { referredBy: { $in: staffIds } } },
    { $group: { _id: { $toString: "$referredBy" }, count: { $sum: 1 }, userIds: { $push: { $toString: "$_id" } } } }
  ]);
  const referredMap = new Map<string, { count: number; userIds: string[] }>(
    referredAgg.map((r) => [r._id, { count: r.count, userIds: r.userIds }])
  );

  // Collect all referred user IDs for downstream queries
  const allReferredIds = referredAgg.flatMap((r) => r.userIds);

  // Build userId → referrerId map for in-memory attribution (avoids $lookup type mismatch)
  const userToReferrer = new Map<string, string>();
  for (const entry of referredAgg) {
    for (const uid of entry.userIds) userToReferrer.set(uid, entry._id);
  }

  // Query 2: distinct referred userIds that have a qualifying offer.
  // "Converted" = fully activated purchase only (active/expired).
  // Deposit-reserved offers are intentionally excluded from conversion metrics;
  // the customer has not yet completed full payment.
  const convertedUserIds = allReferredIds.length
    ? (await UserOfferModel.distinct("userId", {
        userId: { $in: allReferredIds },
        status: { $in: ["active", "expired"] }
      }) as string[])
    : [];

  // Accumulate converted counts per referrer in memory
  const convertedMap = new Map<string, number>();
  for (const uid of convertedUserIds) {
    const refId = userToReferrer.get(uid);
    if (refId) convertedMap.set(refId, (convertedMap.get(refId) ?? 0) + 1);
  }

  // Query 3: completed payment totals per referred cohort, keyed to referrer
  interface PayByUserAgg { _id: string; total: number }
  const payByUserAgg = allReferredIds.length
    ? await PaymentModel.aggregate<PayByUserAgg>([
        { $match: { userId: { $in: allReferredIds }, status: "completed" } },
        {
          $group: {
            _id: "$userId",
            total: { $sum: { $convert: { input: "$amountKwd", to: "double", onError: 0, onNull: 0 } } }
          }
        }
      ])
    : [];
  // Accumulate payment totals per referrer
  const payMap = new Map<string, number>();
  for (const row of payByUserAgg) {
    const refId = userToReferrer.get(row._id);
    if (refId) payMap.set(refId, (payMap.get(refId) ?? 0) + row.total);
  }

  return staffUsers.map((u) => {
    const rid = String(u._id);
    const referred = referredMap.get(rid);
    return {
      userId: rid,
      username: u.username,
      role: u.role,
      referralCode: u.referralCode,
      referredCount: referred?.count ?? 0,
      convertedCount: convertedMap.get(rid) ?? 0,
      totalAmountKwd: Number(payMap.get(rid) ?? 0).toFixed(3)
    };
  });
}

// "Successful" = fully activated purchase.
// "reserved" (deposit-only) is excluded: the customer has not yet completed
// full payment. The notification fires when they later convert via /deposit/convert,
// at which point the status transitions to "active".
const SUCCESSFUL_OFFER_STATUSES = ["active", "expired"];

// Called fire-and-forget (`void`) from checkout routes after the HTTP response is
// sent. Delivery is not guaranteed on process crash, but the `referralNotified`
// flag resets on inner failure, so the notification will retry on the customer's
// next qualifying checkout event. A durable job queue can replace this later.
export async function handleFirstPurchaseReferral(userId: string): Promise<void> {
  try {
    const successfulCount = await UserOfferModel.countDocuments({
      userId,
      status: { $in: SUCCESSFUL_OFFER_STATUSES }
    });
    if (successfulCount !== 1) return;

    const user = await UserModel.findOneAndUpdate(
      { _id: userId, referredBy: { $exists: true }, referralNotified: { $ne: true } },
      { $set: { referralNotified: true } },
      { new: false }
    ).lean<UserLean>();
    if (!user?.referredBy) return;

    try {
      const referrerId = String(user.referredBy);
      const userOffer = await UserOfferModel.findOne({
        userId,
        status: { $in: SUCCESSFUL_OFFER_STATUSES }
      }).lean<UserOfferLean>();

      let offerName = "an offer";
      if (userOffer?.offerId) {
        const offer = await OfferModel.findById(userOffer.offerId)
          .select("name")
          .lean<OfferLean>();
        if (offer?.name) offerName = offer.name;
      }

      const customerName = user.fullName || user.username || userId;
      // Use the LATEST completed payment on this offer, not the earliest.
      // For deposit-then-convert flows: the deposit payment is recorded first
      // (createdAt earlier), and the conversion payment is recorded later.
      // The notification fires only after the offer reaches active/expired status,
      // so at that point the latest payment IS the activation/conversion payment.
      const activationPayment = userOffer
        ? await PaymentModel.findOne({ userOfferId: userOffer._id, status: "completed" })
            .select("amountKwd")
            .sort({ createdAt: -1 })
            .lean<PaymentLean>()
        : null;
      const amountKwd =
        activationPayment?.amountKwd ||
        userOffer?.paymentAmountKwd ||
        userOffer?.depositAmountKwd ||
        "—";
      const customerStatus = user.isActive !== false ? "active" : "disabled";
      notifyReferralFirstPurchase(referrerId, customerName, offerName, amountKwd, customerStatus);
    } catch (innerErr) {
      console.error("[referral] Downstream notification work failed for userId=%s; resetting flag for retry:", userId, innerErr);
      await UserModel.findByIdAndUpdate(userId, { $set: { referralNotified: false } }).catch((resetErr) => {
        console.error("[referral] Failed to reset referralNotified flag for userId=%s:", userId, resetErr);
      });
    }
  } catch (err) {
    console.error("[referral] handleFirstPurchaseReferral failed for userId=%s:", userId, err);
  }
}
