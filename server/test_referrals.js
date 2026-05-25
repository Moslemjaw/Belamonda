import mongoose from "mongoose";
import { PaymentModel } from "./dist/models/payment.model.js";
import { UserModel } from "./dist/models/user.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const q = { status: "completed" };
  const paymentsInPeriod = await PaymentModel.find(q).select("_id userId amountKwd createdAt offerId").lean();
  console.log("paymentsInPeriod count:", paymentsInPeriod.length);
  
  const buyerIdsStr = [...new Set(paymentsInPeriod.map((p) => String(p.userId)))].filter(Boolean);
  console.log("buyerIdsStr count:", buyerIdsStr.length);
  
  const firstPaymentsEver = await PaymentModel.aggregate([
    { $match: { status: "completed", userId: { $in: buyerIdsStr } } },
    { $sort: { createdAt: 1 } },
    { $group: {
        _id: "$userId",
        paymentId: { $first: "$_id" }
    }}
  ]);
  console.log("firstPaymentsEver count:", firstPaymentsEver.length);
  
  const firstPaymentIds = new Set(firstPaymentsEver.map((p) => p.paymentId.toString()));
  const validPayments = paymentsInPeriod.filter((p) => firstPaymentIds.has(p._id.toString()));
  console.log("validPayments count:", validPayments.length);
  
  const buyers = await UserModel.find({
    $or: [
      { _id: { $in: buyerIdsStr.filter((i) => /^[a-f0-9]{24}$/i.test(i)) } },
      { username: { $in: buyerIdsStr } },
    ],
  }).select("username referredBy").lean();
  console.log("buyers count:", buyers.length);
  if (buyers.length > 0) {
      console.log("first 5 buyers:", buyers.slice(0, 5));
  }
  
  const buyerToReferrer = new Map();
  for (const b of buyers) {
    if (!b.referredBy) continue;
    buyerToReferrer.set(b._id.toString(), b.referredBy.toString());
    if (b.username) buyerToReferrer.set(b.username, b.referredBy.toString());
  }
  console.log("buyerToReferrer size:", buyerToReferrer.size);
  
  let matchCount = 0;
  for (const p of validPayments) {
    const ref = buyerToReferrer.get(String(p.userId));
    if (ref) matchCount++;
  }
  console.log("matches between validPayments and buyerToReferrer:", matchCount);
  
  mongoose.disconnect();
}

run().catch(console.error);
