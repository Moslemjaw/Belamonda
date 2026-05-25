import mongoose from "mongoose";
import { PaymentModel } from "./src/models/payment.model.js";
import { UserModel } from "./src/models/user.model.js";
import { OfferModel } from "./src/models/offer.model.js";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/belamonda");
  
  const q: Record<string, unknown> = { status: "completed" };
  const paymentsInPeriod = await PaymentModel.find(q).select("_id userId amountKwd createdAt offerId").lean();
  console.log("paymentsInPeriod count:", paymentsInPeriod.length);
  
  const buyerIdsStr = [...new Set(paymentsInPeriod.map((p: any) => String(p.userId)))].filter(Boolean);
  console.log("buyerIdsStr count:", buyerIdsStr.length);
  
  const matchUserIds = buyerIdsStr.map(id => /^[a-f0-9]{24}$/i.test(id) ? new mongoose.Types.ObjectId(id) : id);
  console.log("matchUserIds count:", matchUserIds.length);
  
  const firstPaymentsEver = await PaymentModel.aggregate([
    { $match: { status: "completed", userId: { $in: matchUserIds } } },
    { $sort: { createdAt: 1 } },
    { $group: {
        _id: "$userId",
        paymentId: { $first: "$_id" }
    }}
  ]);
  console.log("firstPaymentsEver count:", firstPaymentsEver.length);
  
  const firstPaymentIds = new Set(firstPaymentsEver.map((p: any) => p.paymentId.toString()));
  const validPayments = paymentsInPeriod.filter((p: any) => firstPaymentIds.has(p._id.toString()));
  console.log("validPayments count:", validPayments.length);
  
  const buyers = await UserModel.find({
    $or: [
      { _id: { $in: buyerIdsStr.filter((i) => /^[a-f0-9]{24}$/i.test(i)) } },
      { username: { $in: buyerIdsStr } },
    ],
  }).select("username referredBy").lean();
  console.log("buyers count:", buyers.length);
  
  const buyerToReferrer = new Map<string, string>();
  for (const b of buyers) {
    if (!b.referredBy) continue;
    buyerToReferrer.set(b._id.toString(), b.referredBy.toString());
    if (b.username) buyerToReferrer.set(b.username, b.referredBy.toString());
  }
  console.log("buyerToReferrer size:", buyerToReferrer.size);
  
  let matchCount = 0;
  for (const p of validPayments as any[]) {
    const ref = buyerToReferrer.get(String(p.userId));
    if (ref) matchCount++;
  }
  console.log("matches between validPayments and buyerToReferrer:", matchCount);
  
  mongoose.disconnect();
}

run().catch(console.error);
