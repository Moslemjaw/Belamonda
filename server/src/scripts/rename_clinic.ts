import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ClinicModel } from "../models/clinic.model.js";
import { UserOfferModel } from "../models/userOffer.model.js";
import { UserModel } from "../models/user.model.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);

  // 1. Rename the Arabic clinic
  const aseelClinic = await ClinicModel.findOne({ nameEn: "مستوصف اسيل - بنيد القار - يارو 11" }) ||
                      await ClinicModel.findOne({ nameAr: "مستوصف اسيل - بنيد القار - يارو 11" });

  if (aseelClinic) {
    aseelClinic.nameEn = "Aseel Clinic";
    aseelClinic.nameAr = "مستوصف اسيل";
    await aseelClinic.save();
    console.log("Renamed 'مستوصف اسيل - بنيد القار - يارو 11' to 'Aseel Clinic'");
  } else {
    console.log("Could not find the clinic 'مستوصف اسيل - بنيد القار - يارو 11'");
  }

  // 2. Identify who is in "Main Clinic"
  const mainClinic = await ClinicModel.findOne({ nameEn: "Main Clinic" });
  if (mainClinic) {
    const mainUOs = await UserOfferModel.find({ clinicId: mainClinic._id }).lean();
    console.log(`Found ${mainUOs.length} user offers connected to Main Clinic.`);
    const uids = mainUOs.map(uo => uo.userId);
    const users = await UserModel.find({ _id: { $in: uids } }).select("fullName").lean();
    console.log("Clients in Main Clinic:", users.map(u => u.fullName).join(", "));
  } else {
    console.log("Main Clinic not found.");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
