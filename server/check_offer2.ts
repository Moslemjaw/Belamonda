import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env" });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  const offer = await mongoose.connection.collection("offers").findOne({ name: "Naumi Plus (Female)" });
  console.log(JSON.stringify(offer, null, 2));
  process.exit(0);
}

main().catch(console.error);
