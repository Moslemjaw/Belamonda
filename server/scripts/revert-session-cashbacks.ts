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
  console.log("Connected to MongoDB\\n");

  const clients = await loadData();
  console.log(`Loaded ${clients.length} clients to fix`);

  let processed = 0;
  let errors = 0;

  for (const row of clients) {
    const [name, phone, username, password, nationalId, svcCode, clinicCode, sessions, payCode, total, paid, pkgDate, expiry, remain, due] = row;
    
    try {
      let user = await UserModel.findOne({ username: username.toLowerCase() });
      if (!user) {
        const cleanPhone = phone.replace(/[^\\d+]/g, "");
        if (cleanPhone) user = await UserModel.findOne({ phone: cleanPhone });
      }
      if (!user) continue;

      const uo = await UserOfferModel.findOne({ userId: user._id }).sort({ createdAt: -1 });
      if (!uo) continue;

      const offer = await OfferModel.findById(uo.offerId);
      if (!offer) continue;

      // Recalculate ONLY Signup Cashback
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
            const remainder = totalSignupCbMils - (perInst * count);
            grantedSignupCbMils += remainder;
          }
        }
      }

      // Reset UserOffer
      uo.sessionsUsed = 0;
      (uo as any).cashbackGrantedKwd = fmt(grantedSignupCbMils);
      (uo as any).cashbackBalanceKwd = fmt(grantedSignupCbMils);
      await uo.save();

      // Reset Wallet
      const lockedCbMils = Math.max(0, totalSignupCbMils - grantedSignupCbMils);
      
      await WalletModel.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            lockedKwd: fmt(lockedCbMils),
            unlockedKwd: fmt(grantedSignupCbMils),
            ceilingKwd: fmt(totalSignupCbMils)
          }
        }
      );

      // Delete the mistakenly added session adjustment transactions
      await WalletTxnModel.deleteMany({
        userId: user._id,
        type: "adjustment",
        "reference.id": uo._id.toString() + "_sessions"
      });

      processed++;
    } catch (err: any) {
      console.error(`Failed to process ${username}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\\nDone fixing! Processed: ${processed}, Errors: ${errors}`);
  process.exit(0);
}

run().catch(console.error);
