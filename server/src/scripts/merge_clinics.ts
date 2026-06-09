import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ClinicModel } from "../models/clinic.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { PaymentModel } from "../models/payment.model.js";
import { BookingSessionModel } from "../models/bookingSession.model.js";
import { BookingRequestModel } from "../models/bookingRequest.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const clinics = await ClinicModel.find({}).lean() as any[];

  // Define target core clinics
  const coreMap = {
    "Marina 5": clinics.find(c => c.nameEn === "Marina 5")?._id,
    "Marina 8": clinics.find(c => c.nameEn === "Marina 8")?._id,
    "Nova Clinic": clinics.find(c => c.nameEn === "Nova Clinic")?._id,
    "Seven Unit": clinics.find(c => c.nameEn === "Seven Unit")?._id,
    "E-Med Clinic": clinics.find(c => c.nameEn === "E-Med Clinic")?._id,
    "Hope Clinic": clinics.find(c => c.nameEn === "Hope Clinic")?._id,
    "Al Qibla Clinic": clinics.find(c => c.nameEn === "Al Qibla Clinic")?._id,
    "Asnanco": clinics.find(c => c.nameEn === "Asnanco")?._id,
  };

  const mergeMap: Record<string, mongoose.Types.ObjectId> = {};

  for (const c of clinics) {
    const name = c.nameEn || c.nameAr;
    const id = c._id;
    let targetId: mongoose.Types.ObjectId | undefined;

    if (name === "مارينا 8") targetId = coreMap["Marina 8"];
    else if (name === "مارينا5" || name === "مارينا 2" || name === "م") targetId = coreMap["Marina 5"];
    else if (name === "المهبولة - سفن كلينك") targetId = coreMap["Seven Unit"];
    else if (name === "نوفا ميد دور 11 - السالمية" || name === "ن") targetId = coreMap["Nova Clinic"];
    else if (name.includes("هوب كلينك") || name === "ه") targetId = coreMap["Hope Clinic"];
    else if (name.includes("آي ميد") || name === "آ" || name.includes("عيادة ID")) targetId = coreMap["E-Med Clinic"];
    else if (name === "ا") targetId = coreMap["Asnanco"];
    else if (name === "Qibla Clinic") targetId = coreMap["Al Qibla Clinic"];

    if (targetId && targetId.toString() !== id.toString()) {
      mergeMap[id.toString()] = targetId;
      console.log(`Will merge "${name}" into target clinic ID ${targetId}`);
    }
  }

  // Execute Merge
  let totalMerged = 0;
  for (const [sourceIdStr, targetId] of Object.entries(mergeMap)) {
    const sourceId = new mongoose.Types.ObjectId(sourceIdStr);
    
    const uoRes = await UserOfferModel.updateMany({ clinicId: sourceId }, { $set: { clinicId: targetId } });
    const payRes = await PaymentModel.updateMany({ clinicId: sourceId }, { $set: { clinicId: targetId } });
    const sessRes = await BookingSessionModel.updateMany({ clinicId: sourceId }, { $set: { clinicId: targetId } });
    const brRes = await BookingRequestModel.updateMany({ clinicId: sourceId }, { $set: { clinicId: targetId } });

    console.log(`Merged clinic ${sourceIdStr} -> updated ${uoRes.modifiedCount} UOs, ${payRes.modifiedCount} Payments, ${sessRes.modifiedCount} Sessions`);

    await ClinicModel.deleteOne({ _id: sourceId });
    totalMerged++;
  }

  console.log(`Merged ${totalMerged} clinics successfully.`);

  // Additionally, ensure wallets are properly created for cashback users
  console.log("Checking for missing cashback wallets...");
  const cashbackOffers = await db.collection("offers").find({ membershipType: "cashback" }).toArray();
  const cbOfferIds = cashbackOffers.map(o => o._id.toString());
  
  const cashbackUsers = await UserOfferModel.find({ offerId: { $in: cbOfferIds } }).lean();
  let walletsCreated = 0;
  for (const uo of cashbackUsers as any[]) {
    const wallet = await db.collection("wallets").findOne({ userId: uo.userId });
    if (!wallet) {
      const startCb = parseFloat(uo.totalSignupCashbackKwd || "0") || parseFloat(uo.cashbackBalanceKwd || "0");
      await db.collection("wallets").insertOne({
        userId: uo.userId,
        ceilingKwd: startCb.toFixed(3),
        unlockedKwd: startCb.toFixed(3),
        lockedKwd: "0.000",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await db.collection("wallettxns").insertOne({
        userId: uo.userId,
        type: "signup_bonus",
        amountKwd: startCb.toFixed(3),
        notes: "Initial cashback from membership",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      walletsCreated++;
    }
  }
  console.log(`Created ${walletsCreated} missing wallets for cashback users.`);

  await mongoose.disconnect();
}

main().catch(console.error);
