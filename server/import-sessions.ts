import fs from "fs";
import mongoose from "mongoose";
import { ClinicModel } from "./src/models/clinic.model.js";
import { UserModel } from "./src/models/user.model.js";
import { UserOfferModel } from "./src/models/userOffer.model.js";
import { BookingSessionModel } from "./src/models/bookingSession.model.js";

const clinicMap: Record<string, string> = {
  "مارينا 8": "6a026bbfa50390b2cfb8a53b",
  "مارينا 2": "6a0f3405e5bd6a5663f7197d",
  "مارينا5": "6a026bbca50390b2cfb8a51f",
  "المهبولة - سفن كلينك": "6a026bbea50390b2cfb8a52f",
  "مستوصف اسيل - بنيد القار - يارو 11": "6a0eec6232ce053ddc3ed386",
  "نوفا ميد دور 11 - السالمية": "6a026bbba50390b2cfb8a514",
  "هوب كلينك دور 3 - اماني": "6a026bbea50390b2cfb8a535",
  "هوب كلينك - كارول": "6a026bbea50390b2cfb8a535",
  "آي ميد - صباح السالم": "6a026bbda50390b2cfb8a529"
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URI!);
  
  // 1. Delete all existing sessions
  const deleteRes = await BookingSessionModel.deleteMany({});
  console.log(`Deleted all existing sessions: ${deleteRes.deletedCount}`);

  // 2. Read file and parse
  const content = fs.readFileSync("../clients_data_mock.txt", "utf-8");
  const sections = content.split("────────────────────────────────────────────────────────────────────────────────");

  let createdSessions = 0;
  let missingUsers = 0;
  let missingOffers = 0;

  for (const sec of sections) {
    if (!sec.trim()) continue;
    
    // Extract username
    const usernameMatch = sec.match(/•\s*Username:\s*(.+)/);
    if (!usernameMatch) continue;
    const username = usernameMatch[1].trim();

    // Extract sessions
    const sessionRegex = /Session #[^\s]+ —\s*([\d-]+):\s*([^|]+)\s*\|\s*(?:Cost:\s*([\d.]+)\s*KD\s*\|)?\s*Status:\s*(.+)/g;
    let smatch;
    const sessions = [];
    while ((smatch = sessionRegex.exec(sec)) !== null) {
      sessions.push({
        date: smatch[1].trim(),
        clinicRaw: smatch[2].trim(),
        cost: smatch[3] ? smatch[3].trim() : "0",
        statusStr: smatch[4].trim(),
      });
    }

    if (sessions.length === 0) continue;

    const user = await UserModel.findOne({ username: { $regex: new RegExp(`^${username}$`, "i") } }).lean();
    if (!user) {
      missingUsers++;
      console.log(`User not found: ${username}`);
      continue;
    }

    const userOffers = await UserOfferModel.find({ userId: user._id.toString() }).sort({ createdAt: -1 }).lean();
    if (userOffers.length === 0) {
      missingOffers++;
      console.log(`No offer found for user: ${username}`);
      continue;
    }

    const userOffer = userOffers[0];

    for (const sess of sessions) {
      const clinicId = clinicMap[sess.clinicRaw];
      if (!clinicId) {
        console.log(`Clinic not found for: ${sess.clinicRaw}`);
        continue;
      }

      const sessDate = new Date(sess.date);

      // Create new session
      await BookingSessionModel.create({
        userOfferId: userOffer._id,
        userId: user._id,
        offerId: userOffer.offerId,
        clinicId: clinicId,
        scheduledAt: sessDate,
        status: "completed",
        scheduledBy: "import",
        completedAt: sessDate,
        markedBy: "import",
        totalBillKwd: Number.parseFloat(sess.cost || "0").toFixed(3),
        finalPaidKwd: Number.parseFloat(sess.cost || "0").toFixed(3),
        notes: `Imported from legacy system. Status: ${sess.statusStr}`
      });
      createdSessions++;
    }
  }

  console.log(`\nImport Summary:`);
  console.log(`- Created Sessions: ${createdSessions}`);
  console.log(`- Missing Users: ${missingUsers}`);
  console.log(`- Missing Offers: ${missingOffers}`);

  await mongoose.disconnect();
}

run().catch(console.error);
