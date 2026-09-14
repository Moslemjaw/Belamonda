require("dotenv").config();
const mongoose = require("mongoose");
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const user = await mongoose.connection.db.collection("users").findOne({ phone: { $regex: "97858533" } });
  const reqs = await mongoose.connection.db.collection("bookingrequests").find({ userId: user._id.toString() }).sort({ createdAt: -1 }).toArray();
  for (const r of reqs) {
    console.log(`Status: ${r.status.padEnd(16)} | Request Date: ${r.createdAt.toISOString()} | shownAt: ${r.shownAt ? r.shownAt.toISOString() : "NONE"}`);
  }
  process.exit(0);
});
