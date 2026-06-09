import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Connected to MongoDB");

  const phones = ["9454515188", "123123123"];
  const users = await mongoose.connection.collection("users").find({ phone: { $in: phones } }).toArray();
  
  if (users.length === 0) {
    console.log("No users found");
    process.exit(0);
  }

  for (const u of users) {
    const userIdStr = String(u._id);
    console.log(`Deleting user: ${u.fullName} (${u.phone}) - ID: ${userIdStr}`);

    // Delete related records where userId is stored as a string or ObjectId
    // Try both string and objectId matching just in case
    
    const filter = { $or: [{ userId: userIdStr }, { userId: u._id }] };

    const collections = [
      "useroffers",
      "bookingrequests",
      "bookingsessions", 
      "payments",
      "kycwallets",
      "kyctransactions",
      "conversations",
      "messages",
      "notifications"
    ];

    for (const collName of collections) {
      try {
        const coll = mongoose.connection.collection(collName);
        let result;
        if (collName === "conversations") {
            result = await coll.deleteMany({ "participants.userId": userIdStr });
        } else if (collName === "messages") {
            result = await coll.deleteMany({ senderId: userIdStr });
        } else {
            result = await coll.deleteMany(filter);
        }
        console.log(` - ${collName}: deleted ${result.deletedCount}`);
      } catch (e) {
        console.log(` - ${collName}: error or collection missing`);
      }
    }
    
    await mongoose.connection.collection("users").deleteOne({ _id: u._id });
    console.log(` - user record deleted`);
  }

  process.exit(0);
}

main().catch(console.error);
