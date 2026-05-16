import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  const userId = "6a08a505307270f12df2e6df";
  const userOfferId = "6a08a56e307270f12df2e759";

  // 1. Fix: Deduct 20 KWD cashback from wallet (session booking deduction that failed)
  const wallet = await WalletModel.findOne({ userId });
  if (!wallet) { console.log("No wallet!"); process.exit(1); }

  const currentUnlocked = parseFloat(wallet.unlockedKwd);
  const currentLocked = parseFloat(wallet.lockedKwd);
  console.log(`Before fix: unlocked=${wallet.unlockedKwd}, locked=${wallet.lockedKwd}`);

  // Fix 1: Deduct the 20 KWD that should have been deducted at booking time
  const deductAmount = 20;
  wallet.unlockedKwd = (currentUnlocked - deductAmount).toFixed(3);
  
  // Fix 2: Unlock the 250 KWD from installment #2 (locked→unlocked)
  const unlockAmount = 250;
  const newLocked = Math.max(0, currentLocked - unlockAmount);
  const newUnlocked = parseFloat(wallet.unlockedKwd) + unlockAmount;
  wallet.lockedKwd = newLocked.toFixed(3);
  wallet.unlockedKwd = newUnlocked.toFixed(3);
  
  await wallet.save();
  console.log(`After fix:  unlocked=${wallet.unlockedKwd}, locked=${wallet.lockedKwd}`);

  // Create the missing deduction transaction
  await WalletTxnModel.create({
    userId,
    type: "deduction",
    amountKwd: deductAmount.toFixed(3),
    reference: { kind: "userOffer", id: userOfferId },
    createdBy: { kind: "system", id: "repair-script" },
    reason: "Cashback deducted for completed session (retroactive fix)"
  });
  console.log("Created deduction transaction for 20 KWD");

  // Create the missing installment #2 unlock transaction
  await WalletTxnModel.create({
    userId,
    type: "installment_unlock",
    amountKwd: unlockAmount.toFixed(3),
    reference: { kind: "userOffer", id: `${userOfferId}_inst_2` },
    createdBy: { kind: "system", id: "repair-script" },
    reason: "Cashback unlocked for installment 2 (retroactive fix)"
  });
  console.log("Created installment_unlock transaction for 250 KWD");

  // Fix 3: Update UserOffer cashbackBalanceKwd to reflect the 20 KWD deduction
  // Currently 750, should be 750 - 20 = 730 (from session) + 250 (from installment 2 unlock) = 980
  const uo = await UserOfferModel.findById(userOfferId);
  if (uo) {
    const currentBalance = parseFloat((uo as any).cashbackBalanceKwd || "0");
    // The balance was 750 (only inst 1 unlocked). 
    // Inst 2 should unlock another 250 → 1000.
    // Then 20 was spent on session → 980.
    const newBalance = (currentBalance + unlockAmount - deductAmount).toFixed(3);
    (uo as any).cashbackBalanceKwd = newBalance;
    await uo.save();
    console.log(`UserOffer cashbackBalanceKwd: ${currentBalance} → ${newBalance}`);
  }

  // Verify final state
  const finalWallet = await WalletModel.findOne({ userId });
  const finalTxns = await WalletTxnModel.find({ userId }).sort({ createdAt: -1 }).lean();
  console.log(`\n=== FINAL STATE ===`);
  console.log(`Wallet: unlocked=${finalWallet?.unlockedKwd}, locked=${finalWallet?.lockedKwd}, ceiling=${finalWallet?.ceilingKwd}`);
  console.log(`Transactions (${finalTxns.length}):`);
  for (const t of finalTxns) {
    console.log(`  [${(t as any).type}] ${(t as any).amountKwd} KWD - ${(t as any).reason || JSON.stringify((t as any).reference)}`);
  }

  process.exit(0);
}

run().catch(console.error);
