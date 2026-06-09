import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const DUPLICATE_CLINIC_ID = new mongoose.Types.ObjectId("6a12b5000053279023e1ffea");
  const CORRECT_CLINIC_ID = new mongoose.Types.ObjectId("6a026bbba50390b2cfb8a50d");

  const sessResult = await mongoose.connection.collection("bookingsessions")
    .updateMany(
      { clinicId: DUPLICATE_CLINIC_ID },
      { $set: { clinicId: CORRECT_CLINIC_ID } }
    );
  console.log(`Sessions moved (using ObjectId): ${sessResult.modifiedCount}`);

  process.exit(0);
}
main().catch(console.error);
