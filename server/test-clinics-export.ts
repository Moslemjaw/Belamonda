import mongoose from "mongoose";
import fs from "fs";
import { exportFinanceXlsx } from "./src/modules/reporting/analytics.service.js";

async function run() {
  await mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll");
  
  // No dates to get all data
  const buf = await exportFinanceXlsx("clinics" as any, {});
  
  fs.writeFileSync("../clinic_performance_test.xlsx", buf);
  console.log("Exported clinic_performance_test.xlsx");

  await mongoose.disconnect();
}

run().catch(console.error);
