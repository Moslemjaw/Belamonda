import mongoose from "mongoose";
import { OfferModel } from "./src/models/offer.model.js";

async function run() {
  await mongoose.connect("mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll");
  
  const id = "6a0f0add1eac7d9d8053a348";
  let offer = await OfferModel.findById(id);
  if (!offer) {
    console.log("Creating offer Naumi classic with ID", id);
    offer = await OfferModel.create({
      _id: new mongoose.Types.ObjectId(id),
      name: "Naumi classic",
      type: "A",
      offerKind: "membership",
      membershipType: "free_sessions",
      status: "active",
      subscriptionPriceKwd: "100.000",
      validityDays: 365,
    });
    console.log("Created successfully");
  } else {
    console.log("Offer already exists");
  }
  
  await mongoose.disconnect();
}
run().catch(console.error);
