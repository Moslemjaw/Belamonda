const mongoose = require("mongoose");
const { UserOfferModel } = require("./server/dist/models/userOffer.model.js");

async function check() {
  await mongoose.connect("mongodb://localhost:27017/belamonda", { useNewUrlParser: true, useUnifiedTopology: true });
  const offers = await UserOfferModel.find({ status: "pending_payment" }).lean();
  console.log("Found", offers.length, "pending_payment offers");
  
  const groups = {};
  for (const o of offers) {
    const key = o.userId + "_" + o.offerId;
    if (!groups[key]) groups[key] = [];
    groups[key].push(o._id);
  }
  
  for (const [key, ids] of Object.entries(groups)) {
    if (ids.length > 1) {
      console.log("User/Offer pair with multiple pending:", key);
      console.log("IDs:", ids);
    }
  }
  process.exit(0);
}

check().catch(console.error);
