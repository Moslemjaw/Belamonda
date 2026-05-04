import type { SessionStatus } from "@belamonda/shared";

export type SessionRecord = {
  id: string;
  userOfferId: string;
  userId: string;
  offerId: string;
  clinicId: string;
  scheduledAt: string; // ISO
  status: SessionStatus; // scheduled|completed|no_show|cancelled
  createdAt: string;
  scheduledBy: string; // CS user id
  completedAt?: string;
  markedBy?: string; // clinic staff id
  notes?: string;
  cashbackUnlockedKwd?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const sessions = new Map<string, SessionRecord>();

export const sessionsStore = {
  create(input: Omit<SessionRecord, "id" | "createdAt" | "status">) {
    const id = randomId("sess");
    const rec: SessionRecord = { ...input, id, createdAt: nowIso(), status: "scheduled" };
    sessions.set(id, rec);
    return rec;
  },

  get(id: string) {
    return sessions.get(id) ?? null;
  },

  listByClinic(clinicId: string, fromIso: string, toIso: string) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    return Array.from(sessions.values())
      .filter((s) => s.clinicId === clinicId)
      .filter((s) => {
        const d = new Date(s.scheduledAt);
        return d >= from && d <= to;
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  },

  listByUserOffer(userOfferId: string) {
    return Array.from(sessions.values())
      .filter((s) => s.userOfferId === userOfferId)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  },

  lastCompletedAt(userOfferId: string) {
    const completed = Array.from(sessions.values())
      .filter((s) => s.userOfferId === userOfferId)
      .filter((s) => s.status === "completed" && s.completedAt)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return completed[0]?.completedAt ?? null;
  },

  isSlotTaken(clinicId: string, scheduledAtIso: string) {
    return Array.from(sessions.values()).some(
      (s) => s.clinicId === clinicId && s.scheduledAt === scheduledAtIso && s.status !== "cancelled"
    );
  },

  mark(input: {
    sessionId: string;
    status: "completed" | "no_show" | "cancelled";
    markedBy: string;
    notes?: string;
    cashbackUnlockedKwd?: string;
  }) {
    const s = sessions.get(input.sessionId);
    if (!s) return null;
    s.status = input.status;
    s.markedBy = input.markedBy;
    s.notes = input.notes;
    if (input.status === "completed") {
      s.completedAt = nowIso();
      s.cashbackUnlockedKwd = input.cashbackUnlockedKwd;
    }
    sessions.set(s.id, s);
    return s;
  }
};

