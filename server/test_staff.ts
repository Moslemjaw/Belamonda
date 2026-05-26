import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import { UserModel } from "./src/modules/auth/user.model.js";
import { chatStore } from "./src/modules/chat/chat.store.js";
import { bookingRequestsStore } from "./src/modules/scheduling/bookingRequests.store.js";
import { rehydrateChatStore } from "./src/modules/chat/chat.rehydrate.js";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  const staff = await UserModel.find({ role: "clinicStaff" }).lean();
  for (const s of staff) {
    console.log(`Staff ${s._id} (${s.displayName}): clinicId=${s.clinicId}`);
  }
  process.exit(0);
}
run();
