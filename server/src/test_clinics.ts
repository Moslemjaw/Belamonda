import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { computeClinicSummaries } from "./modules/reporting/analytics.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    const data = await computeClinicSummaries();
    console.log("Success! Returned", data.items.length, "clinics.");
  } catch (err) {
    console.error("Error computing clinic summaries:");
    console.error(err);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
