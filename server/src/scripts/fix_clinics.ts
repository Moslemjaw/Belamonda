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

  // 1. Delete Main Clinic (not needed — Jamali/Mini Jamali clients don't need a clinic)
  const mainClinic = await ClinicModel.findOne({ nameEn: "Main Clinic" });
  if (mainClinic) {
    await ClinicModel.deleteOne({ _id: mainClinic._id });
    console.log("✅ Deleted 'Main Clinic'");
  } else {
    console.log("Main Clinic not found (already deleted?)");
  }

  // 2. Create Marina 2 as a proper clinic
  const existing = await ClinicModel.findOne({ nameEn: "Marina 2" });
  if (existing) {
    console.log("Marina 2 already exists:", existing._id);
  } else {
    const marina2 = await ClinicModel.create({
      nameEn: "Marina 2",
      nameAr: "مارينا 2",
      isActive: true,
      status: "active",
    });
    console.log("✅ Created 'Marina 2' clinic:", marina2._id);
  }

  // 3. List remaining clinics
  const allClinics = await ClinicModel.find({}).lean();
  console.log("\n--- Final Clinic List ---");
  for (const c of allClinics) {
    console.log(`  ${(c as any).nameEn} / ${(c as any).nameAr} (${c._id})`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
