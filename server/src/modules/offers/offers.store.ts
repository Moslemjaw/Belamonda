import type { OfferCategory, OfferType } from "@belamonda/shared";

export type OfferRecordBase = {
  id: string;
  name: string;
  type: OfferType; // "A" | "B"
  category: OfferCategory;
  clinicId: string; // SRS: exactly one clinic
  subscriptionPriceKwd: string; // "99.000"
  validityDays: number;
  cashbackPerSessionKwd: string; // "0.000" allowed
  sessionIntervalDays: number; // 0 allowed
  maxSessions?: number;
  active: boolean;
  featured: boolean;
  enrollmentCap?: number;
  enrolledCount: number;
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  description?: string;
  terms?: string;
  createdAt: string;
};

export type OfferTypeA = OfferRecordBase & {
  type: "A";
};

export type OfferTypeB = OfferRecordBase & {
  type: "B";
  perVisitPriceKwd: string;
  originalClinicPriceKwd: string;
};

export type OfferRecord = OfferTypeA | OfferTypeB;

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const offers = new Map<string, OfferRecord>();

function isWithinWindow(offer: OfferRecord, now: Date) {
  const s = offer.startDate ? new Date(offer.startDate) : null;
  const e = offer.endDate ? new Date(offer.endDate) : null;
  if (s && now < s) return false;
  if (e && now > e) return false;
  return true;
}

export const offersStore = {
  create(input: Omit<OfferRecord, "id" | "createdAt" | "enrolledCount">) {
    const id = randomId("offer");
    const offer: OfferRecord = { ...input, id, enrolledCount: 0, createdAt: nowIso() } as OfferRecord;
    offers.set(id, offer);
    return offer;
  },

  get(id: string) {
    return offers.get(id) ?? null;
  },

  listAdmin() {
    return Array.from(offers.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  listPublic(filters: {
    clinicId?: string;
    category?: OfferCategory;
    type?: OfferType;
    featured?: boolean;
  }) {
    const now = new Date();
    return Array.from(offers.values())
      .filter((o) => o.active)
      .filter((o) => isWithinWindow(o, now))
      .filter((o) => (filters.clinicId ? o.clinicId === filters.clinicId : true))
      .filter((o) => (filters.category ? o.category === filters.category : true))
      .filter((o) => (filters.type ? o.type === filters.type : true))
      .filter((o) => (filters.featured != null ? o.featured === filters.featured : true))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.createdAt.localeCompare(a.createdAt));
  },

  update(id: string, patch: Partial<Omit<OfferRecord, "id" | "createdAt" | "enrolledCount">>) {
    const existing = offers.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch } as OfferRecord;
    offers.set(id, updated);
    return updated;
  }
};

