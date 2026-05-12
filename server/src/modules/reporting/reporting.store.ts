export type ReportType =
  | "daily_summary"
  | "weekly_pl"
  | "monthly_cashback_liability"
  | "yearly_revenue"
  | "custom";

export type ReportStatus = "queued" | "processing" | "ready" | "failed";

export type ReportRecord = {
  id: string;
  requestedBy: string;
  type: ReportType;
  from: string;
  to: string;
  status: ReportStatus;
  createdAt: string;
  readyAt?: string;
  result?: Record<string, unknown>;
  error?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const reports = new Map<string, ReportRecord>();

export const reportingStore = {
  create(input: Omit<ReportRecord, "id" | "status" | "createdAt">) {
    const id = randomId("rpt");
    const rec: ReportRecord = { ...input, id, status: "queued", createdAt: nowIso() };
    reports.set(id, rec);
    return rec;
  },

  get(id: string) {
    return reports.get(id) ?? null;
  },

  listByUser(userId: string) {
    return Array.from(reports.values())
      .filter((r) => r.requestedBy === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  setProcessing(id: string) {
    const r = reports.get(id);
    if (!r) return null;
    r.status = "processing";
    reports.set(id, r);
    return r;
  },

  setReady(id: string, result: Record<string, unknown>) {
    const r = reports.get(id);
    if (!r) return null;
    r.status = "ready";
    r.readyAt = nowIso();
    r.result = result;
    reports.set(id, r);
    return r;
  },

  setFailed(id: string, error: string) {
    const r = reports.get(id);
    if (!r) return null;
    r.status = "failed";
    r.error = error;
    reports.set(id, r);
    return r;
  }
};

