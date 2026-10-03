// Timing harness (run with PERF=1): the test server talks to MongoDB through a TCP proxy that
// adds ~150 ms per round trip — what production sees between Render (US West) and Atlas
// (Hong Kong) — and reports how long each common action takes end to end.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import net from "node:net";
import mongoose from "mongoose";
import { UserModel } from "../src/models/user.model.js";
import { api, laterToday, makeClinicStaff, makeMembership, makeUser } from "./helpers.js";

const ONE_WAY_MS = 75; // ×2 = 150 ms round trip
const perf = process.env.PERF === "1";
let proxy: net.Server | undefined;
let traceT0 = 0;
const trace: string[] = [];

function delayedPipe(from: net.Socket, to: net.Socket) {
  from.on("data", (chunk) => setTimeout(() => to.write(chunk), ONE_WAY_MS));
  from.on("close", () => setTimeout(() => to.destroy(), ONE_WAY_MS));
  from.on("error", () => to.destroy());
}

beforeAll(async () => {
  if (!perf) return;
  const target = new URL(process.env.MONGODB_URI!.replace("mongodb://", "http://"));
  proxy = net.createServer((client) => {
    const upstream = net.connect(Number(target.port), target.hostname);
    delayedPipe(client, upstream);
    delayedPipe(upstream, client);
  });
  await new Promise<void>((r) => proxy!.listen(0, "127.0.0.1", () => r()));
  const port = (proxy.address() as net.AddressInfo).port;
  await mongoose.disconnect();
  await mongoose.connect(`mongodb://127.0.0.1:${port}/?directConnection=true`, { dbName: "belamonda_test", monitorCommands: true });
  if (process.env.PERF_TRACE) {
    mongoose.connection.getClient().on("commandStarted", (e: any) => {
      if (traceT0) trace.push(`+${String(Math.round(performance.now() - traceT0)).padStart(5)}ms ${e.commandName} ${e.command[e.commandName] ?? ""}`);
    });
  }
}, 60_000);

afterAll(async () => {
  proxy?.close();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
async function timed(label: string, fn: () => Promise<{ status: number }>) {
  const t0 = performance.now();
  trace.length = 0;
  if (process.env.PERF_TRACE && label.includes(process.env.PERF_TRACE)) traceT0 = t0;
  const r = await fn();
  const ms = Math.round(performance.now() - t0);
  traceT0 = 0;
  console.log(`PERF ${label.padEnd(28)} ${String(ms).padStart(6)} ms  (status ${r.status})`);
  if (trace.length) console.log(["TRACE " + label, ...trace].join("\n"));
  return r as any;
}

describe.skipIf(!perf)("action timings with 150 ms database round trips", () => {
  it("measures the common actions", async () => {
    const customer = await makeUser("customer");
    const admin = await makeUser("admin");
    await UserModel.updateOne({ _id: customer.id }, { $set: { publicToken: `card${customer.id}` } });
    const m = await makeMembership(customer.id);
    const staff = await makeClinicStaff(m.clinicId);

    // warm up: model indexes, caches of role lists, etc. (as on a running server)
    await api().get("/offers");
    await api().get("/scheduling/me/sessions").set(auth(customer.token));

    await timed("GET offers (catalog)", () => api().get("/offers"));
    await timed("GET offers again", () => api().get("/offers"));
    await timed("GET clinics", () => api().get("/clinics"));
    await timed("GET categories", () => api().get("/categories"));
    const b = await timed("POST book session", () => api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: m.userOfferId }));
    expect(b.status).toBe(201);
    await timed("POST admin forward", () => api().post(`/scheduling/cs/requests/${b.body.request.id}/propose`).set(auth(admin.token)).send({ scheduledAt: laterToday() }));
    const c = await timed("POST clinic confirm", () => api().post(`/scheduling/clinic/requests/${b.body.request.id}/confirm`).set(auth(staff.token)).send({ scheduledAt: laterToday() }));
    await timed("GET clinic scan card", () => api().get(`/public/clinic/scan/card${customer.id}`).set(auth(staff.token)));
    await timed("POST mark completed", () => api().post(`/scheduling/clinic/sessions/${c.body.session.id}/mark`).set(auth(staff.token)).send({ status: "completed" }));
    await timed("POST POS checkout", () => api().post(`/scheduling/requests/${b.body.request.id}/mark-paid`).set(auth(staff.token)).send({}));
    await timed("GET my sessions", () => api().get("/scheduling/me/sessions").set(auth(customer.token)));
    await timed("GET chat conversations", () => api().get("/chat/conversations").set(auth(customer.token)));
  }, 180_000);
});
