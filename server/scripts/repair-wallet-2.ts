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

  // Deduct 55 KWD cashback from wallet
  const wallet = await WalletModel.findOne({ userId });
  if (!wallet) { console.log("No wallet!"); process.exit(1); }

  const currentUnlocked = parseFloat(wallet.unlockedKwd);
  console.log(`Before fix: unlocked=${wallet.unlockedKwd}`);

  const deductAmount = 55;
  wallet.unlockedKwd = (currentUnlocked - deductAmount).toFixed(3);
  await wallet.save();
  console.log(`After fix:  unlocked=${wallet.unlockedKwd}`);

  await WalletTxnModel.create({
    userId,
    type: "deduction",
    amountKwd: deductAmount.toFixed(3),
    reference: { kind: "userOffer", id: userOfferId },
    createdBy: { kind: "system", id: "repair-script-2" },
    reason: "Cashback deducted for completed session (retroactive fix 2)"
  });

  const uo = await UserOfferModel.findById(userOfferId);
  if (uo) {
    const currentBalance = parseFloat((uo as any).cashbackBalanceKwd || "0");
    const newBalance = (currentBalance - deductAmount).toFixed(3);
    (uo as any).cashbackBalanceKwd = newBalance;
    await uo.save();
    console.log(`UserOffer cashbackBalanceKwd: ${currentBalance} → ${newBalance}`);
  }

  process.exit(0);
}

run().catch(console.error);
