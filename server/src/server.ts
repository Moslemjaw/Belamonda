import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";

async function main() {
  if (!env.SKIP_MONGO) {
    await connectMongo();
  } else {
    // eslint-disable-next-line no-console
    console.log("SKIP_MONGO=true: starting API without MongoDB connection");
  }
  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

