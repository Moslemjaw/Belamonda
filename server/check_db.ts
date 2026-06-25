import "dotenv/config";
import mongoose from "mongoose";
import { env } from "./src/config/env.js";
mongoose.connect(env.MONGODB_URI).then(async () => {
  try {
    console.log("users:", await mongoose.connection.db?.collection("users").estimatedDocumentCount());
    console.log("audits:", await mongoose.connection.db?.collection("audits").estimatedDocumentCount());
    console.log("useroffers:", await mongoose.connection.db?.collection("useroffers").estimatedDocumentCount());
    console.log("bookingrequests:", await mongoose.connection.db?.collection("bookingrequests").estimatedDocumentCount());
    console.log("payments:", await mongoose.connection.db?.collection("payments").estimatedDocumentCount());
  } catch(e) { console.error(e); }
  process.exit(0);
});
