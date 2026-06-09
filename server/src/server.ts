import { createServer } from "http";
import { randomBytes } from "crypto";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { seedDefaultCategories, seedDefaultOffers, seedDefaultSessionTypesAndOfferings } from "./bootstrap/seedDefaults.js";
import { startPurchaseReminders } from "./services/purchaseReminders.service.js";
import { startFormSignatureReminders } from "./services/formSignatureReminders.service.js";
import { initChatSocket } from "./modules/chat/chat.socket.js";
import { UserModel } from "./models/user.model.js";

async function backfillPublicTokens() {
  const missing = await UserModel.find({ publicToken: { $exists: false } }).select("_id").lean();
  if (missing.length === 0) return;
  const ops = missing.map((u) => ({
    updateOne: {
      filter: { _id: u._id },
      update: { $set: { publicToken: randomBytes(20).toString("hex") } }
    }
  }));
  await UserModel.bulkWrite(ops);
}

async function dropStaleUserIndexes() {
  try {
    const col = UserModel.collection;
    const indexes = await col.indexes();
    // The field-level `index: true` definitions created non-unique, possibly non-sparse
    // duplicates of the schema-level unique+sparse indexes. Drop any plain (non-unique)
    // indexes on username/email/phone so Mongoose can recreate them correctly.
    for (const idx of indexes) {
      const key = Object.keys(idx.key ?? {});
      if (key.length === 1 && ["username", "email", "phone"].includes(key[0]) && !idx.unique) {
        await col.dropIndex(idx.name as string).catch(() => {});
      }
    }
    await UserModel.syncIndexes();
  } catch {
    // Non-fatal — indexes will be corrected on next startup
  }
}

async function main() {
  await connectMongo();
  await dropStaleUserIndexes();
  await backfillPublicTokens();
  // seed calls removed
  await seedDefaultCategories();
  if (env.NODE_ENV !== "production") {
    await seedDefaultSessionTypesAndOfferings();
    await seedDefaultOffers();
  }
  const app = createApp();
  startPurchaseReminders();
  startFormSignatureReminders();
  const httpServer = createServer(app);
  initChatSocket(httpServer);

  const host = "0.0.0.0";
  httpServer.listen(env.PORT, host, () => {
    // eslint-disable-next-line no-console
    console.log(`API + Socket.IO listening on http://${host}:${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
