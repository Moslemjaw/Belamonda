import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("No db");
  
  const kyc = await db.collection("kycsubmissions").find({}).toArray();
  console.log("Found KYC submissions:", kyc.length);
  
  for (const k of kyc) {
    const user = await db.collection("users").findOne({ _id: k.userId });
    
    let userAsObj = null;
    if (mongoose.isValidObjectId(k.userId)) {
      userAsObj = await db.collection("users").findOne({ _id: new mongoose.Types.ObjectId(k.userId) });
    }
    
    console.log(`KYC UserID: ${k.userId} (type: ${typeof k.userId}). Found as string: ${!!user}, found as ObjectId: ${!!userAsObj}`);
    if (userAsObj) {
      console.log(`  User details: fullName=${userAsObj.fullName}, phone=${userAsObj.phone}, username=${userAsObj.username}`);
    } else if (user) {
      console.log(`  User details: fullName=${user.fullName}, phone=${user.phone}, username=${user.username}`);
    }
  }
  
  await mongoose.disconnect();
}

run().catch(console.error);
