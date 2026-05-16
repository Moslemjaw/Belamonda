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

  // ─── Fix 1: Update Jamali offer's signupCashbackKwd to 1000 ──────────────
  const JAMALI_OFFER_ID = "6a04da4b49f76e3307f97f2f";
  const CASHBACK_TOTAL = "1000.000"; // 1000 KWD total (500 per installment × 2)

  const offerResult = await db.collection("offers").findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(JAMALI_OFFER_ID) },
    { $set: { signupCashbackKwd: CASHBACK_TOTAL } },
    { returnDocument: "after" }
  );
  console.log(`\n✅ Fix 1: Updated Jamali offer signupCashbackKwd → ${CASHBACK_TOTAL}`);
  console.log(`   Offer name: ${offerResult?.name}`);

  // ─── Fix 2: Repair Test user's state ──────────────────────────────────────
  const USER_ID = "6a08674b74d19e8118c57f2c";
  const UO_ID = "6a0867b774d19e8118c57f89";

  // User has purchaseMode=installments, installmentCount=2, installmentsPaid=1
  // Total cashback = 1000. Per installment = 500. First installment paid → unlock 500.
  const totalMils = parseKwd(CASHBACK_TOTAL); // 1000000
  const totalInstallments = 2;
  const perInstallment = Math.floor(totalMils / totalInstallments); // 500000
  const remainder = totalMils - perInstallment * totalInstallments; // 0
  const firstInstallmentAmount = perInstallment + remainder; // 500000
  const firstAmountKwd = fmtKwd(firstInstallmentAmount); // "500.000"

  // 2a: Set wallet to correct state
  // Total locked pool = 1000 KWD. First installment unlocked 500. So: locked=500, unlocked=500
  await db.collection("wallets").updateOne(
    { userId: USER_ID },
    {
      $set: {
        ceilingKwd: CASHBACK_TOTAL,
        lockedKwd: fmtKwd(totalMils - firstInstallmentAmount), // "500.000" remaining locked
        unlockedKwd: firstAmountKwd // "500.000" unlocked
      }
    }
  );
  console.log(`\n✅ Fix 2a: Wallet updated`);
  console.log(`   ceiling: ${CASHBACK_TOTAL}`);
  console.log(`   locked: ${fmtKwd(totalMils - firstInstallmentAmount)}`);
  console.log(`   unlocked: ${firstAmountKwd}`);

  // 2b: Create wallet transaction for audit trail
  await db.collection("wallettxns").insertOne({
    userId: USER_ID,
    type: "signup_bonus",
    amountKwd: firstAmountKwd,
    reference: { kind: "userOffer", id: UO_ID },
    createdBy: { kind: "system", id: "manual_fix" },
    reason: "Manual fix: unlock cashback for installment 1 of 2",
    createdAt: new Date(),
    updatedAt: new Date()
  });
  console.log(`   Created wallet txn: signup_bonus ${firstAmountKwd}`);

  // 2c: Update userOffer tracking fields
  await db.collection("useroffers").updateOne(
    { _id: new mongoose.Types.ObjectId(UO_ID) },
    {
      $set: {
        totalSignupCashbackKwd: CASHBACK_TOTAL,
        cashbackGrantedKwd: firstAmountKwd,
        cashbackBalanceKwd: firstAmountKwd
      }
    }
  );
  console.log(`\n✅ Fix 2c: UserOffer updated`);
  console.log(`   totalSignupCashbackKwd: ${CASHBACK_TOTAL}`);
  console.log(`   cashbackGrantedKwd: ${firstAmountKwd}`);
  console.log(`   cashbackBalanceKwd: ${firstAmountKwd}`);

  // ─── Verify ───────────────────────────────────────────────────────────────
  console.log("\n=== VERIFICATION ===");
  const vw = await db.collection("wallets").findOne({ userId: USER_ID });
  const vu = await db.collection("useroffers").findOne({ _id: new mongoose.Types.ObjectId(UO_ID) });
  const vo = await db.collection("offers").findOne({ _id: new mongoose.Types.ObjectId(JAMALI_OFFER_ID) });

  console.log(`Wallet: ceiling=${vw?.ceilingKwd}, locked=${vw?.lockedKwd}, unlocked=${vw?.unlockedKwd}`);
  console.log(`UserOffer: cashbackBalance=${vu?.cashbackBalanceKwd}, granted=${vu?.cashbackGrantedKwd}, total=${vu?.totalSignupCashbackKwd}`);
  console.log(`Offer: signupCashbackKwd=${vo?.signupCashbackKwd}`);

  await mongoose.disconnect();
  console.log("\n✅ All fixes applied!");
}

main().catch(e => { console.error(e); process.exit(1); });
