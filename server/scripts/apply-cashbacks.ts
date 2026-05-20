import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { OfferModel } from "../src/models/offer.model.js";
import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";

type ClientRow = [string,string,string,string,string,string,string,number,string,number,number,string,string,number,string];

async function loadData(): Promise<ClientRow[]> {
  const batches: ClientRow[][] = [];
  for (let i = 1; i <= 10; i++) {
    try {
      const mod = await import(`./clients-batch-${i}.js`);
      if (mod.default) batches.push(mod.default);
      else if (mod.data) batches.push(mod.data);
    } catch { break; }
  }
  return batches.flat();
}

function kwdMils(kwdStr: string): number {
  if (!kwdStr) return 0;
  return Math.round(parseFloat(kwdStr) * 1000);
}

function fmt(mils: number): string {
  const sign = mils < 0 ? "-" : "";
  const abs = Math.abs(mils);
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB\n");

  const clients = await loadData();
  console.log(`Loaded ${clients.length} clients`);

  let processed = 0;
  let errors = 0;

  for (const row of clients) {
    const [name, phone, username, password, nationalId, svcCode, clinicCode, sessions, payCode, total, paid, pkgDate, expiry, remain, due] = row;
    
    try {
      // Find User
      let user = await UserModel.findOne({ username: username.toLowerCase() });
      if (!user) {
        const cleanPhone = phone.replace(/[^\d+]/g, "");
        if (cleanPhone) user = await UserModel.findOne({ phone: cleanPhone });
      }
      if (!user) continue;

      // Find their latest UserOffer
      const uo = await UserOfferModel.findOne({ userId: user._id }).sort({ createdAt: -1 });
      if (!uo) {
        // console.log(`[${processed}] ${username}: No user offer found, skipping.`);
        continue;
      }

      const offer = await OfferModel.findById(uo.offerId);
      if (!offer) {
        // console.log(`[${processed}] ${username}: No offer found for offerId ${uo.offerId}, skipping.`);
        continue;
      }

      console.log(`[${processed}] Processing ${username}: ${offer.name}`);

      // 1. Calculate Signup Cashback
      const totalSignupCbMils = kwdMils((offer as any).signupCashbackKwd || "0.000");
      let grantedSignupCbMils = 0;

      if (totalSignupCbMils > 0) {
        if (uo.purchaseMode === "full" || uo.purchaseMode === "deposit") {
          grantedSignupCbMils = totalSignupCbMils;
        } else if (uo.purchaseMode === "installments") {
          const count = uo.installmentCount || 3;
          const paidInst = uo.installmentsPaid || 0;
          if (paidInst > 0) {
            const perInst = Math.floor(totalSignupCbMils / count);
            grantedSignupCbMils = perInst * paidInst;
            // Add remainder to first installment
            const remainder = totalSignupCbMils - (perInst * count);
            grantedSignupCbMils += remainder;
          }
        }
      }

      // 2. Calculate Per-Session Cashback
      const cbPerSessionMils = kwdMils((offer as any).cashbackPerSessionKwd || "0.000");
      let earnedSessionCbMils = 0;

      if (cbPerSessionMils > 0 && sessions > 0) {
        earnedSessionCbMils = cbPerSessionMils * sessions;
      }

      // 3. Update UserOffer
      const totalGrantedCbMils = grantedSignupCbMils; // granted from signup
      const totalBalanceCbMils = grantedSignupCbMils + earnedSessionCbMils; // what they can spend

      uo.sessionsUsed = sessions;
      (uo as any).cashbackGrantedKwd = fmt(totalGrantedCbMils);
      (uo as any).cashbackBalanceKwd = fmt(totalBalanceCbMils);
      (uo as any).totalSignupCashbackKwd = fmt(totalSignupCbMils);
      await uo.save();

      // 4. Update Wallet
      const lockedCbMils = Math.max(0, totalSignupCbMils - grantedSignupCbMils);
      const ceilingMils = totalSignupCbMils + earnedSessionCbMils; // Expand ceiling to accommodate earned sessions
      const unlockedMils = totalBalanceCbMils;

      const wallet = await WalletModel.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            lockedKwd: fmt(lockedCbMils),
            unlockedKwd: fmt(unlockedMils),
            ceilingKwd: fmt(ceilingMils)
          }
        },
        { upsert: true, new: true }
      );

      // 5. Create Transactions
      if (totalSignupCbMils > 0) {
        await WalletTxnModel.findOneAndUpdate(
          { userId: user._id, type: "offer_cashback_credit", "reference.id": uo._id.toString() },
          {
            $set: {
              amountKwd: fmt(totalSignupCbMils),
              createdBy: { kind: "system", id: "seed-script" },
              reason: "Initial offer cashback credited to locked pool"
            }
          },
          { upsert: true }
        );

        if (grantedSignupCbMils > 0) {
          await WalletTxnModel.findOneAndUpdate(
            { userId: user._id, type: "signup_bonus", "reference.id": uo._id.toString() },
            {
              $set: {
                amountKwd: fmt(grantedSignupCbMils),
                createdBy: { kind: "system", id: "seed-script" },
                reason: "Signup cashback granted"
              }
            },
            { upsert: true }
          );
        }
      }

      if (earnedSessionCbMils > 0) {
        await WalletTxnModel.findOneAndUpdate(
          { userId: user._id, type: "adjustment", "reference.id": uo._id.toString() + "_sessions" },
          {
            $set: {
              amountKwd: fmt(earnedSessionCbMils),
              createdBy: { kind: "system", id: "seed-script" },
              reason: `Cashback earned for ${sessions} completed sessions`
            }
          },
          { upsert: true }
        );
      }

      processed++;
    } catch (err: any) {
      console.error(`Failed to process ${username}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Processed: ${processed}, Errors: ${errors}`);
  process.exit(0);
}

run().catch(console.error);
