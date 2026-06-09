import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ClinicModel } from "../models/clinic.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  const clinics = await ClinicModel.find({}).lean();
  for (const c of clinics) {
    console.log(`Clinic: "${c.nameEn}" / "${c.nameAr}" (ID: ${c._id})`);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
