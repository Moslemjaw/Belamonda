import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || "");
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
      const docs = await db.collection(c.name).find({ $or: [
          { groupInviteCode: /9C8AA30E/i },
          { inviteCode: /9C8AA30E/i },
          { referralCode: /9C8AA30E/i }
      ]}).toArray();
      if (docs.length > 0) {
          console.log(`Found in collection ${c.name}:`, docs);
      }
  }
  console.log("Search complete.");
  process.exit(0);
}
main();
