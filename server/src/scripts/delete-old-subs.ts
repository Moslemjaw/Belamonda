import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  
  const subs = await mongoose.connection.collection("eform_submissions").find({}).toArray();
  console.log("Found Submissions count:", subs.length);
  
  const deleted = await mongoose.connection.collection("eform_submissions").deleteMany({ formTitle: /Jamaely/i });
  console.log("Deleted 'Jamaely' submissions:", deleted.deletedCount);
  
  const formsDeleted = await mongoose.connection.collection("eforms").deleteMany({ title: /Jamaely/i });
  console.log("Deleted 'Jamaely' forms:", formsDeleted.deletedCount);
  
  process.exit(0);
}

run().catch(console.error);
