import fs from "fs";
import mongoose from "mongoose";
import { ClinicModel } from "./src/models/clinic.model.js";

async function run() {
  await mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll");
  
  const clinics = await ClinicModel.find({}).lean();
  console.log("DB Clinics:");
  for (const c of clinics) {
    console.log(`- ${c.nameEn} / ${c.nameAr} : ${c._id.toString()}`);
  }

  const content = fs.readFileSync("../clients_data_mock.txt", "utf-8");
  const clinicNames = new Set<string>();
  
  const sessionRegex = /Session #.*—\s*([\d-]+):\s*([^|]+)\s*\|/g;
  let match;
  while ((match = sessionRegex.exec(content)) !== null) {
    clinicNames.add(match[2].trim());
  }

  console.log("\nFile Clinics:");
  for (const name of clinicNames) {
    console.log(`- ${name}`);
  }

  await mongoose.disconnect();
}
run().catch(console.error);
