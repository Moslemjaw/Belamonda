// Live chat over Socket.IO: join, send, receive, access control — against the real server.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { io as connect, type Socket } from "socket.io-client";
import { app, api, makeMembership, makeUser } from "./helpers.js";
import { initChatSocket } from "../src/modules/chat/chat.socket.js";
import { UserModel } from "../src/models/user.model.js";
import { signAccessToken } from "../src/modules/auth/token.js";

let server: Server;
let url = "";
const sockets: Socket[] = [];

beforeAll(async () => {
  server = createServer(app);
  initChatSocket(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await new Promise<void>((r) => server.close(() => r()));
});

function open(token: string) {
  const s = connect(url, { auth: { token }, transports: ["websocket"], forceNew: true });
  sockets.push(s);
  return new Promise<Socket>((resolve, reject) => {
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
  });
}
const call = (s: Socket, ev: string, payload: unknown) => new Promise<any>((r) => s.emit(ev, payload, r));

async function bookingChat() {
  await makeUser("cs");
  const customer = await makeUser("customer");
  const m = await makeMembership(customer.id);
  const res = await api().post("/scheduling/me/request").set({ Authorization: `Bearer ${customer.token}` }).send({ userOfferId: m.userOfferId });
  const convId = res.body.conversationId as string;
  const conv = await api().get(`/chat/conversations/${convId}`).set({ Authorization: `Bearer ${customer.token}` });
  const csId = conv.body.conversation.participants.find((p: { role: string }) => p.role === "cs").userId as string;
  if (!(await UserModel.exists({ _id: csId }))) await UserModel.create({ _id: csId, role: "cs", passwordHash: "x" });
  return { customer, cs: { id: csId, token: signAccessToken({ sub: csId, role: "cs" }) }, convId };
}

describe("chat over Socket.IO", () => {
  it("a message sent by the customer reaches CS live and is stored", async () => {
    const c = await bookingChat();
    const custSock = await open(c.customer.token);
    const csSock = await open(c.cs.token);
    expect(await call(csSock, "conversation:join", { conversationId: c.convId })).toEqual({ ok: true });
    expect(await call(custSock, "conversation:join", { conversationId: c.convId })).toEqual({ ok: true });

    const received = new Promise<any>((r) => csSock.on("message:new", (e) => e.message.body === "live hello" && r(e)));
    const ack = await call(custSock, "message:send", { conversationId: c.convId, body: "live hello" });
    expect(ack.ok).toBe(true);
    expect((await received).message.senderId).toBe(c.customer.id);

    const msgs = await api().get(`/chat/conversations/${c.convId}/messages`).set({ Authorization: `Bearer ${c.cs.token}` });
    expect(msgs.body.items.some((m: { body: string }) => m.body === "live hello")).toBe(true);
  });

  it("a stranger cannot join or send", async () => {
    const c = await bookingChat();
    const stranger = await makeUser("customer");
    const s = await open(stranger.token);
    expect(await call(s, "conversation:join", { conversationId: c.convId })).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(await call(s, "message:send", { conversationId: c.convId, body: "x" })).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("read over the socket clears the unread count", async () => {
    const c = await bookingChat();
    const csSock = await open(c.cs.token);
    await call(csSock, "conversation:join", { conversationId: c.convId });
    const sent = await call(csSock, "message:send", { conversationId: c.convId, body: "ping" });
    const custSock = await open(c.customer.token);
    await call(custSock, "conversation:join", { conversationId: c.convId });
    custSock.emit("read", { conversationId: c.convId, lastMessageId: sent.message.id });
    await new Promise((r) => setTimeout(r, 300));
    const list = await api().get("/chat/conversations").set({ Authorization: `Bearer ${c.customer.token}` });
    expect(list.body.items.find((x: { id: string }) => x.id === c.convId).unreadCount).toBe(0);
  });
});
