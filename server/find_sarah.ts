import "dotenv/config";
import { connectMongo } from "./src/db/mongo";
import { UserModel } from "./src/models/user.model";
import { UserOfferModel } from "./src/models/userOffer.model";

async function main() {
  await connectMongo();
  
  const user = await UserModel.findOne({ fullName: { $regex: "سارة الشريف" } });
  if (!user) {
    console.log("User not found by fullName. Let's try finding any user matching Sarah.");
    const users = await UserModel.find({ fullName: { $regex: "سارة" } });
    console.log("Found:", users.map(u => ({ id: u._id, name: u.fullName })));
  } else {
    console.log(`Found user: ${user.fullName} (${user._id})`);
    const offers = await UserOfferModel.find({ userId: user._id });
    console.log("Offers:", offers.map(o => ({ id: o._id, offerId: o.offerId, status: o.status })));
  }
  
  process.exit(0);
}

main().catch(console.error);
