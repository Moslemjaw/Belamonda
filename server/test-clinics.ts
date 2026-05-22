import mongoose from "mongoose";
import { computeClinicSummaries } from "./src/modules/reporting/analytics.service.js";

async function run() {
  await mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll");
  
  const data = await computeClinicSummaries({ from: "2026-01-01", to: "2026-06-01" });
  console.log("With Jan-Jun dates:", data.items.map(i => `${i.clinicNameEn}: ${i.totalSessions} sessions`));

  const dataEmpty = await computeClinicSummaries({ from: "2026-05-22", to: "2026-05-23" });
  console.log("With Today dates:", dataEmpty.items.map(i => `${i.clinicNameEn}: ${i.totalSessions} sessions`));

  await mongoose.disconnect();
}

run().catch(console.error);
