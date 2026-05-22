import mongoose from "mongoose";
import dotenv from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  const { SubscriptionPlanModel } = await import("../models/subscriptionPlan.model.js");

  const exists = await SubscriptionPlanModel.findOne({ price: 12.5 });
  if (!exists) {
    await SubscriptionPlanModel.create({
      nameEn: "Monthly Plan",
      nameAr: "الخطة الشهرية",
      descriptionEn: "1 Month of Belamonda Pro",
      descriptionAr: "شهر واحد من بيلاموندو برو",
      price: 12.5,
      durationMonths: 1,
      minimumCommitmentMonths: 3,
      isActive: true
    });
    console.log("Seeded 12.5 KWD Monthly Plan");
  } else {
    console.log("Plan already exists");
  }
  
  const existsAdvance = await SubscriptionPlanModel.findOne({ price: 37.5 });
  if (!existsAdvance) {
    await SubscriptionPlanModel.create({
      nameEn: "3-Months Advance",
      nameAr: "الخطة الثلاثية المقدمة",
      descriptionEn: "3 Months of Belamonda Pro (Advance)",
      descriptionAr: "ثلاثة أشهر من بيلاموندو برو",
      price: 37.5,
      durationMonths: 3,
      minimumCommitmentMonths: 3,
      isActive: true
    });
    console.log("Seeded 37.5 KWD Advance Plan");
  } else {
    console.log("Advance Plan already exists");
  }

  process.exit(0);
}

run().catch(console.error);
