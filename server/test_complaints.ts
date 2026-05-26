import mongoose from "mongoose";
import { ComplaintModel } from "./src/models/complaint.model.js";
import { UserModel } from "./src/models/user.model.js";
import { ClinicModel } from "./src/models/clinic.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  const complaints = await ComplaintModel.find({}).lean();
  console.log(`Found ${complaints.length} complaints.`);
  
  for (const c of complaints) {
    console.log(`Complaint ${c._id}: userId = ${c.userId}`);
    if (mongoose.isValidObjectId(c.userId)) {
      const u = await UserModel.findById(c.userId).lean();
      if (u) {
        console.log(`  -> User found: ${(u as any).displayName}`);
      } else {
        console.log(`  -> No User found for ObjectId ${c.userId}`);
      }
    } else {
      const clinic = await ClinicModel.findOne({ clinicId: c.userId }).lean();
      if (clinic) {
        console.log(`  -> Clinic found: ${(clinic as any).nameEn}`);
      } else {
        console.log(`  -> No Clinic found for ${c.userId}`);
      }
    }
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
