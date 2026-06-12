/**
 * Remove duplicate memberships and duplicate cashback wallet transactions.
 *
 * Duplicate membership = same (userId, offerId) where more than one document
 * has a "live" status (active | pending_payment | reserved).
 * We keep the NEWEST (by createdAt) and delete the rest.
 *
 * Duplicate cashback = same (userId, reference.id, type) in WalletTxn for
 * offer_cashback_credit / installment_unlock / signup_bonus.
 * We keep the NEWEST and delete the rest.
 *
 * After cleanup we also recalculate the wallet balances from the remaining
 * transactions to make sure they are consistent.
 *
 * Usage:  npx tsx scripts/remove_duplicates.ts [--dry-run]
 */
import "dotenv/config";
import { connectMongo } from "../src/db/mongo.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";
import mongoose from "mongoose";

const DRY_RUN = process.argv.includes("--dry-run");

function fmtKwd(mils: number) {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  const a = Math.floor(abs / 1000);
  const b = String(abs % 1000).padStart(3, "0");
  return `${sign}${a}.${b}`;
}
function parseKwd(s: string) {
  const [a, b = "000"] = s.split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

async function removeDuplicateMemberships() {
  console.log("\n═══ STEP 1: Detecting duplicate memberships ═══\n");

  const liveStatuses = ["active", "pending_payment", "reserved"];

  // Find groups of (userId, offerId) that have more than one live UserOffer
  const dupes = await UserOfferModel.aggregate([
    { $match: { status: { $in: liveStatuses } } },
    {
      $group: {
        _id: { userId: "$userId", offerId: "$offerId" },
        count: { $sum: 1 },
        docs: {
          $push: {
            id: "$_id",
            status: "$status",
            createdAt: "$createdAt",
            sessionsUsed: "$sessionsUsed",
            installmentsPaid: "$installmentsPaid",
          },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { "_id.userId": 1 } },
  ]);

  if (dupes.length === 0) {
    console.log("  ✅ No duplicate memberships found.");
    return;
  }

  let totalRemoved = 0;

  for (const group of dupes) {
    const { userId, offerId } = group._id;
    const docs = group.docs as {
      id: mongoose.Types.ObjectId;
      status: string;
      createdAt: Date;
      sessionsUsed: number;
      installmentsPaid: number;
    }[];

    // Sort: prefer active > pending_payment > reserved, then newest
    const statusPriority: Record<string, number> = { active: 0, pending_payment: 1, reserved: 2 };
    docs.sort((a, b) => {
      const sp = (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
      if (sp !== 0) return sp;
      // Same status – keep the one with more sessions used
      if ((a.sessionsUsed ?? 0) !== (b.sessionsUsed ?? 0)) return (b.sessionsUsed ?? 0) - (a.sessionsUsed ?? 0);
      // Then newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const keep = docs[0];
    const toRemove = docs.slice(1);

    console.log(`  User ${userId} / Offer ${offerId}:`);
    console.log(`    KEEP   ${keep.id} (status=${keep.status}, sessions=${keep.sessionsUsed ?? 0})`);
    for (const r of toRemove) {
      console.log(`    DELETE ${r.id} (status=${r.status}, sessions=${r.sessionsUsed ?? 0})`);
    }

    if (!DRY_RUN) {
      const idsToDelete = toRemove.map((r) => r.id);
      await UserOfferModel.deleteMany({ _id: { $in: idsToDelete } });
    }
    totalRemoved += toRemove.length;
  }

  console.log(`\n  ${DRY_RUN ? "[DRY RUN] Would remove" : "Removed"} ${totalRemoved} duplicate membership(s) across ${dupes.length} user–offer pair(s).`);
}

async function removeDuplicateCashback() {
  console.log("\n═══ STEP 2: Detecting duplicate cashback transactions ═══\n");

  const cashbackTypes = ["offer_cashback_credit", "installment_unlock", "signup_bonus"];

  const dupes = await WalletTxnModel.aggregate([
    { $match: { type: { $in: cashbackTypes } } },
    {
      $group: {
        _id: { userId: "$userId", type: "$type", refId: "$reference.id" },
        count: { $sum: 1 },
        docs: {
          $push: {
            id: "$_id",
            amountKwd: "$amountKwd",
            createdAt: "$createdAt",
          },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { "_id.userId": 1 } },
  ]);

  if (dupes.length === 0) {
    console.log("  ✅ No duplicate cashback transactions found.");
    return;
  }

  let totalRemoved = 0;
  const affectedUserIds = new Set<string>();

  for (const group of dupes) {
    const { userId, type, refId } = group._id;
    const docs = group.docs as { id: mongoose.Types.ObjectId; amountKwd: string; createdAt: Date }[];

    // Keep newest
    docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const keep = docs[0];
    const toRemove = docs.slice(1);

    console.log(`  User ${userId} / type=${type} / ref=${refId}:`);
    console.log(`    KEEP   ${keep.id} (${keep.amountKwd} KWD)`);
    for (const r of toRemove) {
      console.log(`    DELETE ${r.id} (${r.amountKwd} KWD)`);
    }

    if (!DRY_RUN) {
      const idsToDelete = toRemove.map((r) => r.id);
      await WalletTxnModel.deleteMany({ _id: { $in: idsToDelete } });
    }
    totalRemoved += toRemove.length;
    affectedUserIds.add(userId);
  }

  console.log(`\n  ${DRY_RUN ? "[DRY RUN] Would remove" : "Removed"} ${totalRemoved} duplicate cashback txn(s) across ${dupes.length} group(s).`);

  // Recalculate wallet balances for affected users
  if (!DRY_RUN && affectedUserIds.size > 0) {
    console.log("\n═══ STEP 3: Recalculating wallet balances for affected users ═══\n");
    for (const userId of affectedUserIds) {
      const wallet = await WalletModel.findOne({ userId });
      if (!wallet) continue;

      // Recalculate from remaining transactions
      const txns = await WalletTxnModel.find({ userId }).sort({ createdAt: 1 }).lean();
      let ceiling = 0;
      let locked = 0;
      let unlocked = 0;

      for (const txn of txns as any[]) {
        const amt = parseKwd(txn.amountKwd);
        switch (txn.type) {
          case "offer_cashback_credit":
            // Credits go to locked and increase ceiling
            locked += amt;
            ceiling += amt;
            break;
          case "installment_unlock":
          case "signup_bonus":
            // Move from locked to unlocked
            locked -= amt;
            unlocked += amt;
            break;
          case "unlock":
            locked -= amt;
            unlocked += amt;
            break;
          case "deduction":
            unlocked -= amt;
            break;
          case "adjustment":
            unlocked += amt; // amt can be negative
            break;
          case "session_reward":
          case "invoice_reward":
            unlocked += amt;
            ceiling += amt;
            break;
          case "forfeited_due_to_ceiling":
            // No balance change, just tracking
            break;
        }
      }

      // Ensure non-negative
      locked = Math.max(0, locked);
      unlocked = Math.max(0, unlocked);

      const oldLocked = wallet.lockedKwd;
      const oldUnlocked = wallet.unlockedKwd;
      const oldCeiling = wallet.ceilingKwd;

      wallet.lockedKwd = fmtKwd(locked);
      wallet.unlockedKwd = fmtKwd(unlocked);
      wallet.ceilingKwd = fmtKwd(ceiling);
      await wallet.save();

      console.log(`  User ${userId}:`);
      console.log(`    locked:   ${oldLocked} → ${wallet.lockedKwd}`);
      console.log(`    unlocked: ${oldUnlocked} → ${wallet.unlockedKwd}`);
      console.log(`    ceiling:  ${oldCeiling} → ${wallet.ceilingKwd}`);
    }
  }
}

async function main() {
  await connectMongo();
  console.log(`\n🔧 Duplicate Cleanup Script ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}\n`);

  await removeDuplicateMemberships();
  await removeDuplicateCashback();

  console.log("\n✅ Done.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
