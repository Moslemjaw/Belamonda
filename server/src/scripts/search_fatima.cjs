const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://moslemjawich:MMjj2005@forall.9ryif9r.mongodb.net/?appName=ForAll/";

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  // Search by name regex
  const usersByName = await User.find({
    $or: [
      { fullName: /فاطمة/i },
      { fullName: /فيصل/i },
      { fullName: /فرحات/i },
      { fullName: /fatima/i },
      { fullName: /farhat/i }
    ]
  }).lean();

  console.log(`Found ${usersByName.length} user(s) matching search:`);
  for (const u of usersByName) {
    console.log(`  ID: ${u._id} | fullName: "${u.fullName}" | phone: "${u.phone}" | role: "${u.role}" | isActive: ${u.isActive}`);
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
