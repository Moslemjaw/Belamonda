import { afterAll, beforeAll, beforeEach, inject } from "vitest";
import mongoose from "mongoose";

// Must be set before any app module imports config/env.ts (dotenv never overrides existing vars),
// so tests can never reach the real database from .env.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = inject("mongoUri");
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123";

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: "belamonda_test" });
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
