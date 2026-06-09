import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { 
  computeClinicSummaries, 
  computeFinanceSnapshot,
  computePaymentsBreakdown,
  computeFinanceTimeseries,
  computeRevenueByOffer,
  computeRevenueByUser,
  computeRevenueByReferral,
  computeInstallmentsAnalytics
} from "./modules/reporting/analytics.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";

async function main() {
  await mongoose.connect(MONGO_URI);
  try {
    console.log("Testing computeClinicSummaries...");
    await computeClinicSummaries();
    
    console.log("Testing computeFinanceSnapshot...");
    await computeFinanceSnapshot();

    console.log("Testing computePaymentsBreakdown...");
    await computePaymentsBreakdown();

    console.log("Testing computeFinanceTimeseries...");
    await computeFinanceTimeseries({ period: "daily" });

    console.log("Testing computeRevenueByOffer...");
    await computeRevenueByOffer();

    console.log("Testing computeRevenueByUser...");
    await computeRevenueByUser();

    console.log("Testing computeRevenueByReferral...");
    await computeRevenueByReferral();

    console.log("Testing computeInstallmentsAnalytics...");
    await computeInstallmentsAnalytics();

    console.log("ALL TESTS PASSED.");
  } catch (err) {
    console.error("ERROR:");
    console.error(err);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
