/**
 * Standalone background-jobs process: `npm run start:worker`.
 * Optional — by default the web server runs the jobs itself (RUN_JOBS=true). To split them
 * out, run this process and set RUN_JOBS=false on the web service.
 */
import { connectMongo } from "./db/mongo.js";
import { startJobs } from "./jobs/index.js";

connectMongo()
  .then(() => {
    startJobs();
    // eslint-disable-next-line no-console
    console.log("Background jobs worker started");
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
