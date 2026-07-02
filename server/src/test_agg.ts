import mongoose from "mongoose";
import { connectMongo } from "./db/mongo.js";
import { WalletModel, WalletTxnModel } from "./models/kyc.model.js";

async function main() {
  await connectMongo();
  
  const walletAgg = await WalletModel.aggregate([
    {
      $group: {
        _id: null,
        locked: { $sum: { $toDouble: "$lockedKwd" } },
        unlocked: { $sum: { $toDouble: "$unlockedKwd" } }
      }
    }
  ]);
  
  console.log("Wallet Agg:", walletAgg);
  
  const txnAgg = await WalletTxnModel.aggregate([
    {
      $group: {
        _id: "$type",
        total: { $sum: { $toDouble: "$amountKwd" } }
      }
    }
  ]);
  
  console.log("Txn Agg:", txnAgg);
  
  process.exit(0);
}

main().catch(console.error);
