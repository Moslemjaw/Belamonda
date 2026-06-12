import mongoose from 'mongoose';

const URI = "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

function parseKwd(s: string | undefined): number {
  if (!s) return 0;
  const [a, b = "000"] = String(s).split(".");
  return Number(a) * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
}

function fmtKwd(mils: number): string {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  const a = Math.floor(abs / 1000);
  const b = String(abs % 1000).padStart(3, "0");
  return `${sign}${a}.${b}`;
}

mongoose.connect(URI).then(async () => {
  const db = mongoose.connection.db!;
  const userOffers = db.collection('useroffers');
  const offers = db.collection('offers');
  const users = db.collection('users');
  const wallets = db.collection('wallets');
  const walletTxns = db.collection('wallettxns');
  const payments = db.collection('payments');

  // Find all active user offers
  const allUserOffers = await userOffers.find({ status: "active" }).toArray();
  
  console.log(`Found ${allUserOffers.length} active user offers total.\n`);

  let fixedCount = 0;

  for (const uo of allUserOffers) {
    const userId = String(uo.userId);
    const userOfferId = String(uo._id);
    const offer = await offers.findOne({ _id: uo.offerId });
    if (!offer) {
      console.log(`[SKIP] UserOffer ${userOfferId}: offer ${uo.offerId} not found`);
      continue;
    }

    const signupCashback = parseKwd(offer.signupCashbackKwd);
    if (signupCashback <= 0) {
      // This offer has no signup cashback, nothing to do
      continue;
    }

    const currentGranted = parseKwd(uo.cashbackGrantedKwd);
    const currentBalance = parseKwd(uo.cashbackBalanceKwd);
    
    // Check if cashback was already granted
    if (currentGranted > 0) {
      continue; // Already has cashback, skip
    }

    // Check if wallet transaction already exists for this userOffer
    const existingTxn = await walletTxns.findOne({
      userId: userId,
      type: "offer_cashback_credit",
      "reference.id": userOfferId
    });
    if (existingTxn) {
      console.log(`[SKIP] UserOffer ${userOfferId}: wallet txn already exists, just missing cashbackGrantedKwd. Updating...`);
      await userOffers.updateOne({ _id: uo._id }, {
        $set: {
          cashbackGrantedKwd: offer.signupCashbackKwd,
          cashbackBalanceKwd: offer.signupCashbackKwd
        }
      });
      fixedCount++;
      continue;
    }

    // This user offer needs cashback. Let's see how much was paid.
    const user = await users.findOne({ _id: new mongoose.Types.ObjectId(userId) });
    const userName = user?.fullName || user?.phone || userId;

    console.log(`\n[FIX] User: ${userName} (${userId})`);
    console.log(`  Offer: ${offer.name || offer.titleEn || offer._id}`);
    console.log(`  Signup Cashback: ${offer.signupCashbackKwd}`);
    console.log(`  Purchase Mode: ${uo.purchaseMode || "full"}`);
    console.log(`  Amount Paid: ${uo.paymentAmountKwd || "0.000"}`);

    // Ensure wallet exists
    let wallet = await wallets.findOne({ userId: userId });
    if (!wallet) {
      console.log(`  Creating wallet for user...`);
      await wallets.insertOne({
        userId: userId,
        ceilingKwd: "0.000",
        lockedKwd: "0.000",
        unlockedKwd: "0.000",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      wallet = await wallets.findOne({ userId: userId });
    }

    const walletLocked = parseKwd(wallet!.lockedKwd);
    const walletCeiling = parseKwd(wallet!.ceilingKwd);
    const walletUnlocked = parseKwd(wallet!.unlockedKwd);

    // Step 1: Credit full cashback to locked pool
    const newLocked = walletLocked + signupCashback;
    const newCeiling = walletCeiling + signupCashback;
    
    await wallets.updateOne({ _id: wallet!._id }, {
      $set: {
        lockedKwd: fmtKwd(newLocked),
        ceilingKwd: fmtKwd(newCeiling)
      }
    });

    await walletTxns.insertOne({
      userId: userId,
      type: "offer_cashback_credit",
      amountKwd: fmtKwd(signupCashback),
      reference: { kind: "userOffer", id: userOfferId },
      createdBy: { kind: "system", id: "manual_fix_script" },
      reason: "Offer cashback credited to wallet (retroactive fix)",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`  ✅ Credited ${fmtKwd(signupCashback)} to locked wallet pool`);

    // Step 2: For full payment, unlock the entire cashback immediately.
    // For installments, unlock proportionally based on installments paid.
    const purchaseMode = uo.purchaseMode || "full";
    let amountToUnlock = 0;

    if (purchaseMode === "installments") {
      const totalInstallments = uo.installmentCount || (uo.installmentSchedule?.length || 1);
      const paidInstallments = uo.installmentsPaid || 0;
      
      if (paidInstallments > 0) {
        const perInstallment = Math.floor(signupCashback / totalInstallments);
        const remainder = signupCashback - perInstallment * totalInstallments;
        
        for (let i = 1; i <= paidInstallments; i++) {
          const thisAmount = perInstallment + (i === 1 ? remainder : 0);
          if (thisAmount > 0) {
            const dedupRefId = `${userOfferId}_inst_${i}`;
            const existingUnlock = await walletTxns.findOne({
              userId: userId,
              type: "installment_unlock",
              "reference.id": dedupRefId
            });
            if (!existingUnlock) {
              amountToUnlock += thisAmount;
              await walletTxns.insertOne({
                userId: userId,
                type: "installment_unlock",
                amountKwd: fmtKwd(thisAmount),
                reference: { kind: "userOffer", id: dedupRefId },
                createdBy: { kind: "system", id: "manual_fix_script" },
                reason: `Cashback unlocked for installment ${i} (retroactive fix)`,
                createdAt: new Date(),
                updatedAt: new Date()
              });
            }
          }
        }
      }
      console.log(`  Installments: ${paidInstallments}/${totalInstallments} paid`);
    } else {
      // Full payment — unlock everything
      amountToUnlock = signupCashback;
      
      const existingUnlock = await walletTxns.findOne({
        userId: userId,
        type: "signup_bonus",
        "reference.id": userOfferId
      });
      if (!existingUnlock) {
        await walletTxns.insertOne({
          userId: userId,
          type: "signup_bonus",
          amountKwd: fmtKwd(signupCashback),
          reference: { kind: "userOffer", id: userOfferId },
          createdBy: { kind: "system", id: "manual_fix_script" },
          reason: "Signup cashback bonus (retroactive fix)",
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (amountToUnlock > 0) {
      // Move from locked to unlocked
      const currentWallet = await wallets.findOne({ _id: wallet!._id });
      const curLocked = parseKwd(currentWallet!.lockedKwd);
      const curUnlocked = parseKwd(currentWallet!.unlockedKwd);
      
      const actualUnlock = Math.min(amountToUnlock, curLocked);
      await wallets.updateOne({ _id: wallet!._id }, {
        $set: {
          lockedKwd: fmtKwd(curLocked - actualUnlock),
          unlockedKwd: fmtKwd(curUnlocked + actualUnlock)
        }
      });
      console.log(`  ✅ Unlocked ${fmtKwd(actualUnlock)} from locked to unlocked wallet`);
    }

    // Step 3: Update the userOffer's cashback tracking
    await userOffers.updateOne({ _id: uo._id }, {
      $set: {
        cashbackGrantedKwd: fmtKwd(amountToUnlock),
        cashbackBalanceKwd: fmtKwd(amountToUnlock),
        totalSignupCashbackKwd: offer.signupCashbackKwd,
        membershipType: uo.membershipType || "cashback"
      }
    });

    console.log(`  ✅ Updated userOffer cashbackGrantedKwd=${fmtKwd(amountToUnlock)}, cashbackBalanceKwd=${fmtKwd(amountToUnlock)}`);
    fixedCount++;
  }

  console.log(`\n========================================`);
  console.log(`Done! Fixed ${fixedCount} user offers.`);
  console.log(`========================================`);
  
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
