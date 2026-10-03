import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/globalSetup.ts"],
    setupFiles: ["test/setup.ts"],
    // One in-memory replica set shared by all files; run files serially so they don't clobber each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000
  }
});
