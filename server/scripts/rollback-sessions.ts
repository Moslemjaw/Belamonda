import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserOfferModel } from "../src/models/userOffer.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { WalletModel, WalletTxnModel } from "../src/models/kyc.model.js";

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

  const historicSessions = await BookingSessionModel.find({ notes: "Historically imported session" });
  console.log(`Found ${historicSessions.length} historic sessions to roll back.`);

  const affectedUserOffers = new Set<string>();

  let processed = 0;
  for (const session of historicSessions) {
    if (processed % 10 === 0) console.log(`Processed ${processed} / ${historicSessions.length} sessions...`);
    processed++;
    
    const cbKwd = (session as any).cashbackUnlockedKwd;
    const cbMils = cbKwd ? kwdMils(cbKwd) : 0;

    // Rollback Wallet
    if (cbMils > 0) {
      const wallet = await WalletModel.findOne({ userId: session.userId });
      if (wallet) {
        const unlocked = kwdMils(wallet.unlockedKwd || "0.000");
        const ceiling = kwdMils(wallet.ceilingKwd || "0.000");
        
        wallet.unlockedKwd = fmt(Math.max(0, unlocked - cbMils));
        wallet.ceilingKwd = fmt(Math.max(0, ceiling - cbMils));
        await wallet.save();
      }

      // Delete the transaction
      await WalletTxnModel.deleteMany({
        type: "session_reward",
        "reference.id": session._id.toString()
      });

      // Rollback UserOffer Balance
      const uo = await UserOfferModel.findById(session.userOfferId);
      if (uo) {
        const uoCbMils = kwdMils((uo as any).cashbackBalanceKwd || "0.000");
        (uo as any).cashbackBalanceKwd = fmt(Math.max(0, uoCbMils - cbMils));
        await uo.save();
      }
    }

    affectedUserOffers.add(session.userOfferId.toString());

    // Delete related BookingRequest
    await BookingRequestModel.deleteMany({ scheduledSessionId: session._id });
    
    // Delete the Session itself
    await BookingSessionModel.findByIdAndDelete(session._id);
  }

  // Recalculate sessionsUsed for affected UserOffers
  console.log(`Recalculating sessionsUsed for ${affectedUserOffers.size} user offers...`);
  for (const uoId of affectedUserOffers) {
    const remainingCount = await BookingSessionModel.countDocuments({
      userOfferId: uoId,
      status: "completed"
    });
    
    await UserOfferModel.findByIdAndUpdate(uoId, {
      $set: { sessionsUsed: remainingCount }
    });
  }

  console.log("\\nRollback complete!");
  process.exit(0);
}

run().catch(console.error);
