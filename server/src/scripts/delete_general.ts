import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const generalOffer = await db.collection("offers").findOne({ name: "General Service" });
  const otherOffer = await db.collection("offers").findOne({ name: "Other" });

  if (generalOffer) {
    await db.collection("offers").deleteOne({ _id: generalOffer._id });
    console.log("Deleted General Service membership.");
  }

  if (otherOffer) {
    await db.collection("offers").deleteOne({ _id: otherOffer._id });
    console.log("Deleted Other membership.");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
