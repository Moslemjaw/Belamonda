import mongoose from "mongoose";
import { OfferModel } from "./models/offer.model.js";
import { updateOffer } from "./services/offer.service.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  // Find "Jamali" offer
  const jamali = await OfferModel.findOne({ name: "Jamali" });
  if (!jamali) {
    console.log("Jamali offer not found!");
    process.exit(0);
  }
  
  console.log("Current requireBranchSelection:", jamali.requireBranchSelection);
  console.log("Current clinicLocked:", jamali.clinicLocked);
  
  // Try to update it using updateOffer
  try {
    const updated = await updateOffer(jamali._id.toString(), {
      requireBranchSelection: false,
      clinicLocked: false,
      subscriptionPriceKwd: "89.000"
    });
    console.log("Update success!", updated ? "Yes" : "No");
  } catch (e: any) {
    console.error("Update failed!", e);
  }

  process.exit(0);
}
main();
