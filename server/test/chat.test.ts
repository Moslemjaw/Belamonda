// Chat behaviour through the real routes, plus persistence (messages must survive a restart).
import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { api, makeMembership, makeUser } from "./helpers.js";
import { UserModel } from "../src/models/user.model.js";
import { signAccessToken } from "../src/modules/auth/token.js";

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function bookingChat() {
  await makeUser("cs");
  const customer = await makeUser("customer");
  const m = await makeMembership(customer.id);
  const res = await api().post("/scheduling/me/request").set(auth(customer.token)).send({ userOfferId: m.userOfferId, notes: "hi" });
  const convId = res.body.conversationId as string;
  // The CS participant the conversation actually picked (CS ids are cached server-side)
  const conv = await api().get(`/chat/conversations/${convId}`).set(auth(customer.token));
  const csP = conv.body.conversation.participants.find((p: { role: string }) => p.role === "cs");
  if (!(await UserModel.exists({ _id: csP.userId }))) await UserModel.create({ _id: csP.userId, role: "cs", passwordHash: "x" });
  const cs = { id: csP.userId as string, token: signAccessToken({ sub: csP.userId, role: "cs" }) };
  return { customer, cs, m, convId };
}

describe("booking conversation", () => {
  it("booking creates a conversation with the system message", async () => {
    const s = await bookingChat();
    expect(s.convId).toBeTruthy();
    const msgs = await api().get(`/chat/conversations/${s.convId}/messages`).set(auth(s.customer.token));
    expect(msgs.status).toBe(200);
    expect(msgs.body.items).toHaveLength(1);
    expect(msgs.body.items[0].systemKind).toBe("booking_requested");
    expect(msgs.body.hasMore).toBe(false);
  });

  it("customer and CS exchange messages; CS sees the customer's message", async () => {
    const s = await bookingChat();
    const sent = await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.customer.token)).send({ body: "Can I come at 5?" });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ body: "Can I come at 5?", senderId: s.customer.id, senderRole: "customer" });
    const reply = await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.cs.token)).send({ body: "Yes" });
    expect(reply.status).toBe(201);
    const msgs = await api().get(`/chat/conversations/${s.convId}/messages`).set(auth(s.cs.token));
    expect(msgs.body.items.map((m: { body: string }) => m.body).slice(1)).toEqual(["Can I come at 5?", "Yes"]);
  });

  it("another customer cannot read or post", async () => {
    const s = await bookingChat();
    const stranger = await makeUser("customer");
    expect((await api().get(`/chat/conversations/${s.convId}/messages`).set(auth(stranger.token))).status).toBe(403);
    expect((await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(stranger.token)).send({ body: "x" })).status).toBe(403);
    expect((await api().get(`/chat/conversations/${s.convId}`).set(auth(stranger.token))).status).toBe(403);
  });

  it("admin can read but not post", async () => {
    const s = await bookingChat();
    const admin = await makeUser("admin");
    expect((await api().get(`/chat/conversations/${s.convId}/messages`).set(auth(admin.token))).status).toBe(200);
    const post = await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(admin.token)).send({ body: "x" });
    expect(post.status).toBe(403);
    expect(post.body.error).toBe("ADMIN_READ_ONLY");
  });

  it("unread count, then mark read", async () => {
    const s = await bookingChat();
    await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.cs.token)).send({ body: "one" });
    const last = await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.cs.token)).send({ body: "two" });
    const before = await api().get("/chat/conversations").set(auth(s.customer.token));
    const conv = before.body.items.find((c: { id: string }) => c.id === s.convId);
    expect(conv.unreadCount).toBe(3); // system message + two from CS
    expect(conv.lastMessagePreview).toBe("two");

    const read = await api().post(`/chat/conversations/${s.convId}/read`).set(auth(s.customer.token)).send({ lastMessageId: last.body.message.id });
    expect(read.status).toBe(200);
    expect(read.body.cursor.lastReadMessageId).toBe(last.body.message.id);
    const after = await api().get("/chat/conversations").set(auth(s.customer.token));
    expect(after.body.items.find((c: { id: string }) => c.id === s.convId).unreadCount).toBe(0);
  });

  it("pages older messages with ?before= and ?limit=", async () => {
    const s = await bookingChat();
    const ids: string[] = [];
    for (const b of ["m1", "m2", "m3", "m4"]) {
      ids.push((await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.customer.token)).send({ body: b })).body.message.id);
    }
    const page1 = await api().get(`/chat/conversations/${s.convId}/messages?limit=2`).set(auth(s.customer.token));
    expect(page1.body.items.map((m: { body: string }) => m.body)).toEqual(["m3", "m4"]);
    expect(page1.body.hasMore).toBe(true);
    const page2 = await api().get(`/chat/conversations/${s.convId}/messages?limit=2&before=${ids[2]}`).set(auth(s.customer.token));
    expect(page2.body.items.map((m: { body: string }) => m.body)).toEqual(["m1", "m2"]);
    expect(page2.body.hasMore).toBe(true); // the system message is older still
  });

  it("an empty message is refused", async () => {
    const s = await bookingChat();
    const res = await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.customer.token)).send({ body: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("EMPTY_MESSAGE");
  });
});

describe("customer support chat", () => {
  it("opening it twice returns the same conversation", async () => {
    const customer = await makeUser("customer");
    const first = await api().post("/chat/conversations/cs").set(auth(customer.token)).send({});
    expect(first.status).toBe(201);
    const again = await api().post("/chat/conversations/cs").set(auth(customer.token)).send({});
    expect(again.status).toBe(200);
    expect(again.body.conversation.id).toBe(first.body.conversation.id);
  });
});

describe("persistence", () => {
  it("messages and conversations are stored in the database (survive a restart)", async () => {
    const s = await bookingChat();
    await api().post(`/chat/conversations/${s.convId}/messages`).set(auth(s.customer.token)).send({ body: "keep me" });
    const db = mongoose.connection.db!;
    expect(await db.collection("chat_conversations").countDocuments({ _id: s.convId as any })).toBe(1);
    expect(await db.collection("chat_messages").countDocuments({ conversationId: s.convId, body: "keep me" })).toBe(1);
  });
});
