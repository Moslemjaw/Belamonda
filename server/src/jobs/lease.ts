import os from "node:os";
import mongoose from "mongoose";

const owner = `${os.hostname()}:${process.pid}`;
const running = new Set<string>();

/**
 * Take the `name` lease for `leaseMs` if nobody holds a live one. Stored in Mongo, so it is
 * shared by every app instance. Returns false while another holder's lease is still live.
 */
export async function acquireLease(name: string, leaseMs: number): Promise<boolean> {
  const now = new Date();
  const locks = mongoose.connection.collection<{ _id: string; owner: string; lockedUntil: Date }>("job_locks");
  try {
    await locks.updateOne(
      { _id: name, lockedUntil: { $lte: now } },
      { $set: { owner, lockedUntil: new Date(now.getTime() + leaseMs) } },
      { upsert: true }
    );
    return true;
  } catch (e: any) {
    if (e?.code === 11000) return false; // someone else holds a live lease
    throw e;
  }
}

/**
 * Run `fn` only if this process wins the `name` lease, which is then held for `leaseMs`.
 *
 * With several app instances (or a web + worker split) each interval job would otherwise
 * run once per instance, sending duplicate reminders. The lease lives in Mongo, so exactly
 * one instance runs each tick; the lease is not released early, so the others skip that
 * interval too. Use a leaseMs a little shorter than the job's interval.
 */
export async function runExclusive(name: string, leaseMs: number, fn: () => Promise<unknown>): Promise<boolean> {
  if (running.has(name)) return false; // previous tick in this process still going
  if (!(await acquireLease(name, leaseMs))) return false;
  running.add(name);
  try {
    await fn();
  } finally {
    running.delete(name);
  }
  return true;
}
