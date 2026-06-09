import { connectMongo } from "../src/db/mongo.js";
import { UserModel } from "../src/models/index.js";
import mongoose from "mongoose";

async function run() {
  await connectMongo();
  
  const users = await UserModel.find({
    $or: [
      { fullName: { $regex: /test/i } },
      { username: { $regex: /test/i } },
      { phone: { $regex: /6255555898/ } },
      { phone: { $regex: /8735673468363/ } }
    ]
  });

  console.log(`Found ${users.length} matching users:`);
  for (const u of users) {
    console.log(`- ID: ${u._id}, Name: ${u.fullName}, Username: ${u.username}, Phone: ${u.phone}`);
  }
  
  await mongoose.disconnect();
}
run().catch(console.error);
