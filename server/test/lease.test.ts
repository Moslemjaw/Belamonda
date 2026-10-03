import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { runExclusive } from "../src/jobs/lease.js";

describe("runExclusive", () => {
  it("lets exactly one of several concurrent callers run a tick", async () => {
    let runs = 0;
    const job = async () => { runs++; };
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => runExclusive("job", 60_000, job)));
    expect(runs).toBe(1);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("skips while the lease is held and runs again once it expires", async () => {
    let runs = 0;
    const job = async () => { runs++; };
    expect(await runExclusive("job", 60_000, job)).toBe(true);
    expect(await runExclusive("job", 60_000, job)).toBe(false);

    // Simulate the lease running out.
    await mongoose.connection.collection("job_locks").updateOne({ _id: "job" as any }, { $set: { lockedUntil: new Date(0) } });
    expect(await runExclusive("job", 60_000, job)).toBe(true);
    expect(runs).toBe(2);
  });
});
