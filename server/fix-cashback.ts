import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

function parseKwd(s: string) {
  const [a, b = "000"] = s.split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}
function fmtKwd(mils: number) {
  return `${Math.floor(mils / 1000)}.${String(mils % 1000).padStart(3, "0")}`;
}

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");
  const db = mongoose.connection.db!;

  // ─── Fix 1: Update Jamali offer's signupCashbackKwd ───────────────────────
  const JAMALI_OFFER_ID = "6a04da4b49f76e3307f97f2f";
  const CASHBACK_AMOUNT = "500.000";

  const offerResult = await db.collection("offers").findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(JAMALI_OFFER_ID) },
    { $set: { signupCashbackKwd: CASHBACK_AMOUNT } },
    { returnDocument: "after" }
  );
  console.log(`\n✅ Fix 1: Updated Jamali offer signupCashbackKwd → ${CASHBACK_AMOUNT}`);
  console.log(`   Offer name: ${offerResult?.name}`);

  // ─── Fix 2: Repair Test user's state ──────────────────────────────────────
  const USER_ID = "6a08674b74d19e8118c57f2c";
  const UO_ID = "6a0867b774d19e8118c57f89";

  // The user has purchaseMode=installments, installmentCount=2, installmentsPaid=1
  // So first installment is paid. Unlock proportional share: 500/2 = 250 KWD
  const totalMils = parseKwd(CASHBACK_AMOUNT); // 500000
  const totalInstallments = 2;
  const perInstallment = Math.floor(totalMils / totalInstallments); // 250000
  const remainder = totalMils - perInstallment * totalInstallments; // 0
  const firstInstallmentAmount = perInstallment + remainder; // 250000
  const firstAmountKwd = fmtKwd(firstInstallmentAmount); // "250.000"

  // 2a: Unlock proportional share from wallet (locked → unlocked)
  const wallet = await db.collection("wallets").findOne({ userId: USER_ID });
  if (!wallet) {
    console.log("❌ No wallet found for user!");
    process.exit(1);
  }

  const locked = parseKwd(wallet.lockedKwd);
  const unlocked = parseKwd(wallet.unlockedKwd);
  const toUnlock = Math.min(firstInstallmentAmount, locked);

  await db.collection("wallets").updateOne(
    { userId: USER_ID },
    {
      $set: {
        lockedKwd: fmtKwd(locked - toUnlock),
        unlockedKwd: fmtKwd(unlocked + toUnlock)
      }
    }
  );
  console.log(`\n✅ Fix 2a: Wallet updated`);
  console.log(`   locked: ${wallet.lockedKwd} → ${fmtKwd(locked - toUnlock)}`);
  console.log(`   unlocked: ${wallet.unlockedKwd} → ${fmtKwd(unlocked + toUnlock)}`);

  // 2b: Create wallet transaction for audit trail
  await db.collection("wallettxns").insertOne({
    userId: USER_ID,
    type: "signup_bonus",
    amountKwd: fmtKwd(toUnlock),
    reference: { kind: "userOffer", id: UO_ID },
    createdBy: { kind: "system", id: "manual_fix" },
    reason: "Manual fix: unlock cashback for installment 1",
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log(`   Created wallet txn: signup_bonus ${fmtKwd(toUnlock)}`);

  // 2c: Update userOffer tracking fields
  await db.collection("useroffers").updateOne(
    { _id: new mongoose.Types.ObjectId(UO_ID) },
    {
      $set: {
        totalSignupCashbackKwd: CASHBACK_AMOUNT,
        cashbackGrantedKwd: firstAmountKwd,
        cashbackBalanceKwd: firstAmountKwd
      }
    }
  );
  console.log(`\n✅ Fix 2c: UserOffer updated`);
  console.log(`   totalSignupCashbackKwd: ${CASHBACK_AMOUNT}`);
  console.log(`   cashbackGrantedKwd: ${firstAmountKwd}`);
  console.log(`   cashbackBalanceKwd: ${firstAmountKwd}`);

  // ─── Verify ───────────────────────────────────────────────────────────────
  console.log("\n=== VERIFICATION ===");
  const verifyWallet = await db.collection("wallets").findOne({ userId: USER_ID });
  const verifyUo = await db.collection("useroffers").findOne({ _id: new mongoose.Types.ObjectId(UO_ID) });
  const verifyOffer = await db.collection("offers").findOne({ _id: new mongoose.Types.ObjectId(JAMALI_OFFER_ID) });

  console.log(`Wallet: locked=${verifyWallet?.lockedKwd}, unlocked=${verifyWallet?.unlockedKwd}`);
  console.log(`UserOffer: cashbackBalance=${verifyUo?.cashbackBalanceKwd}, granted=${verifyUo?.cashbackGrantedKwd}, total=${verifyUo?.totalSignupCashbackKwd}`);
  console.log(`Offer: signupCashbackKwd=${verifyOffer?.signupCashbackKwd}`);

  await mongoose.disconnect();
  console.log("\n✅ All fixes applied successfully!");
}

main().catch(e => { console.error(e); process.exit(1); });
