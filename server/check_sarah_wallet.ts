import "dotenv/config";
import { connectMongo } from "./src/db/mongo";
import { UserModel } from "./src/models/user.model";
import { WalletModel, WalletTxnModel } from "./src/models/kyc.model";
import { UserOfferModel } from "./src/models/userOffer.model";

async function main() {
  await connectMongo();
  const user = await UserModel.findOne({ _id: "6a2c1984181fc3f0d15b5b5e" });
  if (!user) return;
  
  const wallet = await WalletModel.findOne({ userId: user._id });
  console.log("Wallet locked:", wallet?.lockedKwd, "unlocked:", wallet?.unlockedKwd);
  console.log("Transactions:");
  const txns = await WalletTxnModel.find({ userId: user._id });
  for (const txn of txns) {
    console.log(`- ${txn.amountKwd} (type: ${txn.type}, ref: ${txn.reference?.kind} / ${txn.reference?.id}, desc: ${txn.reason})`);
  }
  
  const offers = await UserOfferModel.find({ userId: user._id });
  for (const o of offers) {
    console.log(`\nOffer ${o._id}: status=${o.status}, method=${o.method}`);
    if (o.installmentSchedule) {
      console.log(`Installments:`);
      for (const i of o.installmentSchedule) {
        console.log(`  dueDate: ${i.dueDate}, amount: ${i.amountKwd}, isPaid: ${i.isPaid}`);
      }
    }
  }

  process.exit(0);
}
main().catch(console.error);
