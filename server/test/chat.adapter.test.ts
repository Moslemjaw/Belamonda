// Two server instances relaying Socket.IO events through MongoDB (CHAT_SOCKET_ADAPTER=mongo).
import { afterAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Server as IOServer } from "socket.io";
import { io as connect, type Socket } from "socket.io-client";
import { useMongoAdapter } from "../src/modules/chat/chat.adapter.js";

const cleanup: Array<() => Promise<void> | void> = [];
afterAll(async () => {
  for (const c of cleanup.reverse()) await c();
});

async function instance() {
  const http: Server = createServer();
  const io = new IOServer(http);
  useMongoAdapter(io);
  io.on("connection", (s) => s.join("conv:test"));
  await new Promise<void>((r) => http.listen(0, r));
  cleanup.push(() => new Promise<void>((r) => { io.close(); http.close(() => r()); }));
  return { io, url: `http://127.0.0.1:${(http.address() as AddressInfo).port}` };
}

describe("chat relay between server instances", () => {
  it("an event emitted on server B reaches a browser connected to server A", async () => {
    const a = await instance();
    const b = await instance();
    const client: Socket = connect(a.url, { transports: ["websocket"], forceNew: true });
    cleanup.push(() => { client.close(); });
    await new Promise<void>((r) => client.on("connect", () => r()));
    await new Promise((r) => setTimeout(r, 500)); // let both adapters start their change streams

    const got = new Promise<unknown>((r) => client.on("message:new", r));
    b.io.to("conv:test").emit("message:new", { body: "from instance B" });
    expect(await Promise.race([got, new Promise((r) => setTimeout(() => r("TIMEOUT"), 5000))])).toEqual({ body: "from instance B" });
  }, 20_000);
});
