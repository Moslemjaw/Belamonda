import mongoose from "mongoose";
import { config } from "dotenv";
config();

import { UserModel } from "../src/models/user.model.js";
import { UserOfferModel } from "../src/models/userOffer.model.js";
import { OfferModel } from "../src/models/offer.model.js";
import { BookingSessionModel } from "../src/models/bookingSession.model.js";
import { BookingRequestModel } from "../src/models/bookingRequest.model.js";
import { kycStore } from "../src/modules/kyc/kyc.store.js";

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
  console.log(`Loaded ${clients.length} clients to record sessions`);

  let processed = 0;
  let errors = 0;

  for (const row of clients) {
    const [name, phone, username, password, nationalId, svcCode, clinicCode, sessions, payCode, total, paid, pkgDate, expiry, remain, due] = row;
    
    if (sessions <= 0) continue;

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

      // Make sure we only process this if they don't already have sessions
      const existingSessions = await BookingSessionModel.countDocuments({ userOfferId: uo._id, status: "completed" });
      if (existingSessions >= sessions) {
        continue;
      }

      console.log(`[${processed}] Processing ${username} (Needs ${sessions - existingSessions} sessions recorded)`);

      const cbPerSessionKwd = (offer as any).cashbackPerSessionKwd || "0.000";
      const cbPerSessionMils = kwdMils(cbPerSessionKwd);

      // Create missing sessions
      const toCreate = sessions - existingSessions;
      
      for (let i = 0; i < toCreate; i++) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - (toCreate - i)); // Space them out a bit in the past

        const sessionDoc = await BookingSessionModel.create({
          userOfferId: uo._id,
          userId: user._id,
          offerId: offer._id,
          clinicId: uo.clinicId,
          scheduledAt: pastDate.toISOString(),
          status: "completed",
          scheduledBy: "system",
          completedAt: pastDate.toISOString(),
          markedBy: "system",
          notes: "Historically imported session",
          cashbackUnlockedKwd: parseFloat(cbPerSessionKwd) > 0 ? cbPerSessionKwd : undefined
        });

        // Create corresponding booking request
        await BookingRequestModel.create({
          userId: user._id,
          offerId: offer._id,
          userOfferId: uo._id,
          clinicId: uo.clinicId,
          membershipType: (uo as any).membershipType,
          status: "completed",
          scheduledSessionId: sessionDoc._id,
          clinicPaymentStatus: "paid",
          createdAt: pastDate,
          updatedAt: pastDate,
          confirmedAt: pastDate.toISOString(),
          confirmedBy: "system"
        });

        if (cbPerSessionMils > 0) {
          await kycStore.rewardSessionCashback({
            userId: user._id.toString(),
            amountKwd: cbPerSessionKwd,
            sessionId: sessionDoc._id.toString(),
            createdById: "system"
          });
        }
      }

      // Update UserOffer
      uo.sessionsUsed = sessions;
      if (cbPerSessionMils > 0) {
        const currentBalance = kwdMils((uo as any).cashbackBalanceKwd || "0.000");
        const newBalance = currentBalance + (cbPerSessionMils * toCreate);
        (uo as any).cashbackBalanceKwd = fmt(newBalance);
      }
      await uo.save();

      processed++;
    } catch (err: any) {
      console.error(`Failed to record sessions for ${username}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\\nDone recording sessions! Processed: ${processed}, Errors: ${errors}`);
  process.exit(0);
}

run().catch(console.error);
