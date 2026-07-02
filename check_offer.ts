import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config({ path: "./server/.env" });

async function main() {
  await mongoose.connect(process.env.DATABASE_URL as string);
  
  // Assuming OfferModel is in the db, we can just do raw query
  const offer = await mongoose.connection.collection("offers").findOne({ name: "Naumi Plus (Female)" });
  console.log(JSON.stringify(offer, null, 2));
  process.exit(0);
}

main().catch(console.error);
