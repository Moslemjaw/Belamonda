import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected");

  const { UserOfferModel } = await import("../src/models/userOffer.model.js");
  const { OfferModel } = await import("../src/models/offer.model.js");

  // Check all user offers
  const allUO = await UserOfferModel.find({}).select("status purchaseMode offerId installmentSchedule installmentCount installmentsPaid").lean();
  console.log(`\nTotal UserOffers: ${allUO.length}`);
  
  // Group by status
  const statusMap: Record<string, number> = {};
  for (const uo of allUO as any[]) {
    statusMap[uo.status] = (statusMap[uo.status] || 0) + 1;
  }
  console.log("\nBy Status:", statusMap);

  // Group by purchaseMode
  const modeMap: Record<string, number> = {};
  for (const uo of allUO as any[]) {
    modeMap[uo.purchaseMode || "none"] = (modeMap[uo.purchaseMode || "none"] || 0) + 1;
  }
  console.log("By PurchaseMode:", modeMap);

  // Check installment offers specifically
  const installmentOffers = allUO.filter((uo: any) => uo.purchaseMode === "installments");
  console.log(`\nInstallment offers: ${installmentOffers.length}`);
  for (const uo of installmentOffers as any[]) {
    console.log(`  ID: ${uo._id}, status: ${uo.status}, schedule length: ${uo.installmentSchedule?.length || 0}, paid: ${uo.installmentsPaid}`);
    if (uo.installmentSchedule) {
      for (const inst of uo.installmentSchedule) {
        console.log(`    #${inst.number}: ${inst.amountKwd} KWD, paid: ${inst.paid}`);
      }
    }
  }

  // Check active/reserved/pending offers with their offer prices
  const activeOffers = allUO.filter((uo: any) => ["active", "pending_payment", "reserved"].includes(uo.status));
  console.log(`\nActive/pending/reserved offers: ${activeOffers.length}`);
  
  if (activeOffers.length > 0) {
    const offerIds = [...new Set(activeOffers.map((uo: any) => uo.offerId?.toString()).filter(Boolean))];
    const offers = await OfferModel.find({ _id: { $in: offerIds } }).select("name subscriptionPriceKwd").lean();
    console.log("\nOffer prices:");
    for (const o of offers as any[]) {
      console.log(`  ${o.name}: ${o.subscriptionPriceKwd} KWD`);
    }
  }

  // Show first 5 user offers with full details
  console.log("\n--- First 5 UserOffers ---");
  const sample = await UserOfferModel.find({}).limit(5).lean();
  for (const uo of sample as any[]) {
    console.log(`  ID: ${uo._id}, status: ${uo.status}, mode: ${uo.purchaseMode}, offerId: ${uo.offerId}`);
  }

  process.exit(0);
}

run().catch(console.error);
