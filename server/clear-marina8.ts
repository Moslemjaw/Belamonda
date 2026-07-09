import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { BookingRequestModel } from "./src/models/bookingRequest.model.js";
import { BookingSessionModel } from "./src/models/bookingSession.model.js";

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to DB");

  // Since clinic ID might be hard to guess, let's list all clinics or find by name.
  // Wait, clinics might not be a collection, or might be ClinicModel.
  // Let's just find BookingRequests and get distinct clinicIds to see.
  const clinicIds = await BookingRequestModel.distinct("clinicId");
  console.log("Clinic IDs in use:", clinicIds);
  
  // Find which clinicId corresponds to Marina 8.
  // It's probably "667683faebbbbdc47d77b8b4" or similar.
  // Let's check a request from Marina 8. The user's screenshot says "Marina 8 - today's schedule".
  const marina8Id = "66d6d4560d2b78b0f8087799"; // Need to find the exact one.
  
  // Let's print the clinicIds and some sample data to identify Marina 8.
  for (const cid of clinicIds) {
    const sample = await BookingRequestModel.findOne({ clinicId: cid }).lean();
    console.log(`Clinic ${cid} -> request for user ${sample?.userId}`);
  }
  
  // Or we can just import ClinicModel if it exists.
  let ClinicModel;
  try {
    ClinicModel = (await import("./src/models/clinic.model.js")).ClinicModel;
    const clinics = await ClinicModel.find().lean();
    console.log("Clinics in DB:");
    for (const c of clinics) {
      console.log(`- ${c._id}: ${c.nameEn}`);
      if (c.nameEn.toLowerCase().includes("marina 8")) {
        console.log(`  -> FOUND Marina 8 clinicId: ${c._id}`);
        const result1 = await BookingRequestModel.deleteMany({ clinicId: c._id });
        console.log(`  -> Deleted ${result1.deletedCount} BookingRequests`);
        const result2 = await BookingSessionModel.deleteMany({ clinicId: c._id });
        console.log(`  -> Deleted ${result2.deletedCount} BookingSessions`);
      }
    }
  } catch(e) {
    console.log("No ClinicModel found, falling back.");
  }

  process.exit(0);
}
run();
