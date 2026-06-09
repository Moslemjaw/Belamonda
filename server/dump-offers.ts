import mongoose from "mongoose";
import { config } from "dotenv";
config({ path: ".env" });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  const offers = await db.collection("offers").find({}).toArray();
  for (const o of offers) {
    console.log(JSON.stringify(o, null, 2));
    console.log("---");
  }
  await mongoose.disconnect();
}
main();
