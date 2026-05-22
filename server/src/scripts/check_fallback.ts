import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { BookingRequestModel } from "../models/bookingRequest.model.js";
import { ClinicSessionOfferingModel } from "../models/clinicSessionOffering.model.js";
import { SessionTypeModel } from "../models/sessionType.model.js";

dotenv.config({ path: ".env" });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected");

  const bookings = await BookingRequestModel.find().sort({ createdAt: -1 }).limit(10);
  
  for (const b of bookings) {
    if (b.standaloneName) {
      console.log(`Booking ${b._id}: standaloneName="${b.standaloneName}", clinicId=${b.clinicId}, cashbackDeductedKwd="${b.cashbackDeductedKwd}"`);
      
      const offerings = await ClinicSessionOfferingModel.find({ clinicId: b.clinicId, isActive: true }).lean();
      const sessionTypeIds = offerings.map((o: any) => o.sessionTypeId);
      const sessionTypes = await SessionTypeModel.find({ _id: { $in: sessionTypeIds } }).lean();
      const stMap = new Map((sessionTypes as any[]).map((st) => [String(st._id), st]));

      const clinicProducts = offerings.map((o: any) => {
        const st = stMap.get(String(o.sessionTypeId));
        return {
          id: String(o._id),
          name: st ? (st.nameAr || st.nameEn) : "Unknown",
          nameAr: st?.nameAr || "",
          nameEn: st?.nameEn || "",
          priceKwd: o.priceKwd || "0.000",
          cashbackDeductionKwd: o.cashbackDeductionKwd || "0.000"
        };
      });

      const matchedProduct = clinicProducts.find(p => p.name === b.standaloneName || p.nameAr === b.standaloneName || p.nameEn === b.standaloneName);
      console.log(`  -> Matched Product:`, matchedProduct);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
