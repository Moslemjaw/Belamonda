import mongoose from "mongoose";
import fs from "fs";
import { exportClinicReportXlsx } from "./src/modules/reporting/analytics.service.js";

async function run() {
  await mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll");

  // Let's test "Seven Unit" clinic
  const clinicId = "6a026bbea50390b2cfb8a52f"; 
  const xlsxBuffer = await exportClinicReportXlsx(clinicId, {});
  
  fs.writeFileSync("../clinic_reports/test_export.xlsx", xlsxBuffer);
  console.log("Successfully generated test export via analytics.service.ts");

  await mongoose.disconnect();
}

run().catch(console.error);
