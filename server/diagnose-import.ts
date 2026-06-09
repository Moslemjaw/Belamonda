import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

type ClientRow = [string,string,string,string,string,string,string,number,string,number,number,string,string,number,string];

async function loadData(): Promise<ClientRow[]> {
  const batches: ClientRow[][] = [];
  for (let i = 1; i <= 10; i++) {
    try {
      const mod = await import(`./scripts/clients-batch-${i}.js`);
      if (mod.default) batches.push(mod.default);
      else if (mod.data) batches.push(mod.data);
    } catch { break; }
  }
  return batches.flat();
}

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;

  const clients = await loadData();
  console.log(`Loaded ${clients.length} clients from CSV files.`);

  const offers = await db.collection("offers").find({}).toArray();
  const offerMap = new Map(offers.map(o => [String(o._id), o]));
  
  // Also create a map of offer name/code to find the correct offer
  const offerByDbName = new Map(offers.map(o => [o.name, o]));

  console.log("\n--- AUDITING IMPORTED CLIENTS ---");

  let mismappedOffersCount = 0;
  let missingUserOffersCount = 0;
  let totalCount = 0;

  for (const client of clients) {
    const [name, phone, username, password, nationalId, svcCode, clinicCode, sessions, payCode, total, paid, pkgDate, expiry, remain, due] = client;
    
    // Skip if cancelled/no membership in CSV
    if (svcCode === "X" || (total === 0 && paid === 0 && sessions === 0)) {
      continue;
    }

    totalCount++;

    // Find User in DB
    let user = await db.collection("users").findOne({ username: username.toLowerCase() });
    if (!user && phone) {
      const cleanPhone = phone.replace(/[^\d+]/g, "");
      if (cleanPhone) user = await db.collection("users").findOne({ phone: cleanPhone });
    }

    if (!user) {
      console.log(`User not found in DB: ${name} (${username})`);
      continue;
    }

    // Find their UserOffers
    const uos = await db.collection("useroffers").find({ userId: String(user._id) }).toArray();
    if (uos.length === 0) {
      missingUserOffersCount++;
      console.log(`User ${name} (${username}) has NO UserOffers in DB!`);
      continue;
    }

    // Determine what offer they SHOULD have got
    // svcCode: "1"=single, "99"=pkg99, "89"=pkg89, "49"=pkg49, "59"=pkg59, "M"=mini, "S"=sbaya, "O"=other, "X"=cancelled, "C"=cashback
    let expectedOfferName = "";
    if (svcCode === "99") expectedOfferName = "Nuomi Plus";
    else if (svcCode === "89") expectedOfferName = "Nuomi Classic";
    else if (svcCode === "M") expectedOfferName = "Mini Jamali";
    else if (svcCode === "S") expectedOfferName = "Sabaya";
    else if (svcCode === "C") expectedOfferName = "Jamali";
    else if (svcCode === "1") expectedOfferName = "Single Session";
    else if (svcCode === "49" || svcCode === "59") expectedOfferName = "3 Sessions";
    else expectedOfferName = "Other/Unknown";

    const expectedOffer = offerByDbName.get(expectedOfferName);

    // Let's inspect the UserOffers they actually got
    for (const uo of uos) {
      const actualOffer = offerMap.get(String(uo.offerId));
      const actualOfferName = actualOffer ? actualOffer.name : "Unknown";

      if (actualOfferName !== expectedOfferName) {
        mismappedOffersCount++;
        console.log(`MISMATCH for ${name} (${username}):`);
        console.log(`  CSV svcCode: ${svcCode} (Expected: ${expectedOfferName}, Price: ${total})`);
        console.log(`  DB UserOffer ID: ${uo._id} (Actual: ${actualOfferName}, Price: ${uo.paymentAmountKwd})`);
      }
    }
  }

  console.log(`\nAudit Summary:`);
  console.log(`  Total active clients in CSV: ${totalCount}`);
  console.log(`  Mismatched offers found: ${mismappedOffersCount}`);
  console.log(`  Users with missing UserOffers: ${missingUserOffersCount}`);

  await mongoose.disconnect();
}
main();
