import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectMongo } from "./db/mongo.js";
import { seedDefaultCategories, seedDefaultOffers, seedDefaultSessionTypes, seedLocalDemoUsersAndClinics } from "./bootstrap/seedDefaults.js";

async function main() {
  await connectMongo();
  if (env.NODE_ENV !== "production") {
    await seedLocalDemoUsersAndClinics();
  }
  await seedDefaultCategories();
  await seedDefaultSessionTypes();
  await seedDefaultOffers();
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

