// READ-ONLY audit of memberships and sessions against their offer rules.
// Only find/aggregate queries — it never writes. Usage:
//   npx tsx src/scripts/audit_memberships.ts [output.json]
import "dotenv/config";
import fs from "node:fs";
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI!, { dbName: "test", readPreference: "secondaryPreferred" });
const db = mongoose.connection.db!;
const id = (x: unknown) => (x == null ? "" : String(x));
const DAY = 864e5;
const now = Date.now();

const [offers, uos, sessions, requests, scans, users] = await Promise.all([
  db.collection("offers").find({}).toArray(),
  db.collection("useroffers").find({}).toArray(),
  db.collection("bookingsessions").find({}).toArray(),
  db.collection("bookingrequests").find({}).toArray(),
  db.collection("scanlogs").find({}).toArray(),
  db.collection("users").find({ role: "customer" }).project({ shortId: 1, fullName: 1 }).toArray()
]);
const offerById = new Map(offers.map((o) => [id(o._id), o]));
const userById = new Map(users.map((u) => [id(u._id), u]));
const uoById = new Map(uos.map((u) => [id(u._id), u]));
const sessByUo = new Map<string, any[]>();
for (const s of sessions) {
  const k = id(s.userOfferId);
  if (!sessByUo.has(k)) sessByUo.set(k, []);
  sessByUo.get(k)!.push(s);
}
const scansByUser = new Map<string, any[]>();
for (const s of scans) {
  const k = id(s.userId);
  if (!scansByUser.has(k)) scansByUser.set(k, []);
  scansByUser.get(k)!.push(s);
}

type Issue = { rule: string; offer: string; member: string; customer: string; detail: string };
const issues: Issue[] = [];
const who = (uo: any) => ({ member: uo?.shortId ?? id(uo?._id), customer: userById.get(id(uo?.userId))?.shortId ?? id(uo?.userId) });
const add = (rule: string, uo: any, detail: string) =>
  issues.push({ rule, offer: offerById.get(id(uo?.offerId))?.name ?? "(missing offer)", ...who(uo), detail });

const LIVE = new Set(["scheduled", "completed", "no_show", "checked_in", "in_progress"]);
const d = (x: any) => (x ? new Date(x).toISOString().slice(0, 10) : "—");

for (const uo of uos) {
  const offer = offerById.get(id(uo.offerId));
  if (!offer) { add("Membership points to a missing offer", uo, `offerId ${id(uo.offerId)}`); continue; }
  const list = (sessByUo.get(id(uo._id)) ?? []).sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  const live = list.filter((s) => LIVE.has(s.status));
  const completed = list.filter((s) => s.status === "completed");

  // 1. Interval between sessions (only when the offer defines one)
  const interval = offer.sessionIntervalDays ?? 0;
  if (interval > 0) {
    const seq = list.filter((s) => s.status === "completed" || s.status === "scheduled");
    for (let i = 1; i < seq.length; i++) {
      const gap = (+new Date(seq[i].scheduledAt) - +new Date(seq[i - 1].completedAt ?? seq[i - 1].scheduledAt)) / DAY;
      if (gap < interval - 0.5) add(`Sessions closer than ${interval}-day interval`, uo, `${seq[i - 1].shortId} (${d(seq[i - 1].scheduledAt)}) → ${seq[i].shortId} (${d(seq[i].scheduledAt)}, ${seq[i].status}) = ${gap.toFixed(1)} days`);
    }
  }

  // 2. Session cap
  if (offer.maxSessions && live.length > offer.maxSessions && !offer.allowExtraPaidSessions)
    add("More sessions than the offer allows", uo, `${live.length} sessions, max ${offer.maxSessions}`);

  // 3. sessionsUsed counter vs actual
  const used = uo.sessionsUsed ?? 0;
  if (used !== live.length) add("Session counter out of sync", uo, `sessionsUsed=${used}, actual non-cancelled sessions=${live.length}`);

  // 4. Sessions outside the membership validity window
  if (uo.expiresAt) for (const s of live) if (+new Date(s.scheduledAt) > +new Date(uo.expiresAt) + DAY)
    add("Session after membership expiry", uo, `${s.shortId} on ${d(s.scheduledAt)}, expires ${d(uo.expiresAt)}`);
  if (uo.activatedAt) for (const s of completed) if (+new Date(s.scheduledAt) < +new Date(uo.activatedAt) - DAY)
    add("Session before membership activation", uo, `${s.shortId} on ${d(s.scheduledAt)}, activated ${d(uo.activatedAt)}`);

  // 5. Status vs expiry
  if (uo.status === "active" && uo.expiresAt && +new Date(uo.expiresAt) < now)
    add("Active membership past its expiry date", uo, `expired ${d(uo.expiresAt)}`);
  if (uo.status === "active" && !uo.expiresAt) add("Active membership without an expiry date", uo, `activated ${d(uo.activatedAt)}`);

  // 6. Installments: sessions beyond what has been paid for
  if (uo.purchaseMode === "installments" && (uo.installmentsPaid ?? 0) < (uo.installmentCount ?? 1)) {
    const cap = uo.installmentsPaid ?? 0;
    if (live.length > cap && offer.maxSessions !== null) add("Sessions beyond paid installments", uo, `${live.length} sessions, ${cap}/${uo.installmentCount} installments paid`);
  }

  // 7. Sessions on memberships that are not active
  if (!["active", "expired"].includes(uo.status) && completed.length)
    add("Completed sessions on a non-active membership", uo, `status=${uo.status}, ${completed.length} completed`);

  // 8. Clinic mismatch
  for (const s of live) if (uo.clinicId && id(s.clinicId) !== id(uo.clinicId))
    add("Session at a different clinic than the membership", uo, `${s.shortId} (${s.status}) clinic differs from membership clinic`);

  // 9. Cashback-only offers that still have sessions booked against them
  if (offer.isCashbackOnly && live.length) add("Sessions on a cashback-only membership", uo, `${live.length} sessions`);

  // 10. Overdue sessions still "scheduled"
  for (const s of list) if (s.status === "scheduled" && +new Date(s.scheduledAt) < now - 2 * DAY)
    add("Past session never marked (still scheduled)", uo, `${s.shortId} on ${d(s.scheduledAt)}`);

  // 11. Completed without a scan around that date
  for (const s of completed) {
    const day = +new Date(s.completedAt ?? s.scheduledAt);
    const scanned = (scansByUser.get(id(uo.userId)) ?? []).some((x) => Math.abs(+new Date(x.scannedAt) - day) < 2 * DAY);
    if (!scanned) add("Completed session with no QR scan recorded", uo, `${s.shortId} on ${d(s.scheduledAt)}`);
  }

  // 12. Two live sessions on the same day
  const days = new Map<string, number>();
  for (const s of live) days.set(d(s.scheduledAt), (days.get(d(s.scheduledAt)) ?? 0) + 1);
  for (const [day, n] of days) if (n > 1) add("Duplicate sessions on the same day", uo, `${n} sessions on ${day}`);
}

// Session-level checks
for (const s of sessions) {
  const uo = uoById.get(id(s.userOfferId));
  if (!uo) { issues.push({ rule: "Session linked to a missing membership", offer: offerById.get(id(s.offerId))?.name ?? "?", member: id(s.userOfferId), customer: userById.get(id(s.userId))?.shortId ?? id(s.userId), detail: `${s.shortId} ${s.status} ${d(s.scheduledAt)}` }); continue; }
  if (id(s.userId) !== id(uo.userId) && !(uo.sharedWith ?? []).map(id).includes(id(s.userId)))
    add("Session belongs to a different customer than the membership", uo, `${s.shortId}`);
}

// Booking request ↔ session sync
const sessById = new Map(sessions.map((s) => [id(s._id), s]));
for (const r of requests) {
  if (!r.scheduledSessionId) continue;
  const s = sessById.get(id(r.scheduledSessionId));
  const uo = uoById.get(id(r.userOfferId));
  if (!s) { add("Booking request points to a missing session", uo ?? { userId: r.userId }, `request ${id(r._id)} status=${r.status}`); continue; }
  const norm = (x: string) => (x === "confirmed" ? "scheduled" : x);
  if (norm(r.status) !== s.status) add("Booking request and session status disagree", uo ?? { userId: r.userId, offerId: s.offerId }, `request=${r.status}, session ${s.shortId}=${s.status}`);
}

// Data hygiene
const strOfferIds = uos.filter((u) => typeof u.offerId === "string").length;

// Summaries
const byRule = new Map<string, number>();
for (const i of issues) byRule.set(i.rule, (byRule.get(i.rule) ?? 0) + 1);
const byRuleOffer = new Map<string, Map<string, number>>();
for (const i of issues) {
  if (!byRuleOffer.has(i.rule)) byRuleOffer.set(i.rule, new Map());
  const m = byRuleOffer.get(i.rule)!;
  m.set(i.offer, (m.get(i.offer) ?? 0) + 1);
}
console.log("ISSUES BY RULE");
for (const [r, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
  const offersTxt = [...byRuleOffer.get(r)!].sort((a, b) => b[1] - a[1]).map(([o, c]) => `${o}:${c}`).join(", ");
  console.log(`${String(n).padStart(4)}  ${r}  [${offersTxt}]`);
}
console.log(`\nmemberships with offerId stored as string (not ObjectId): ${strOfferIds}`);
const membersWithIssues = new Set(issues.map((i) => i.member)).size;
console.log(`memberships checked: ${uos.length}, with at least one issue: ${membersWithIssues}`);
fs.writeFileSync(process.argv[2] ?? "audit.json", JSON.stringify(issues, null, 1));
await mongoose.disconnect();
