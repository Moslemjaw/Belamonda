export type ClinicRecord = {
  id: string;
  nameEn: string;
  nameAr: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  categoryTags: string[];
  operatingHours?: {
    // Simple v1 shape; later expand per weekday like SRS
    open: string; // "08:00"
    close: string; // "18:00"
  };
  active: boolean;
  createdAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
}

const clinics = new Map<string, ClinicRecord>();

export const clinicsStore = {
  create(input: Omit<ClinicRecord, "id" | "createdAt">) {
    const id = randomId("clinic");
    const clinic: ClinicRecord = { id, createdAt: nowIso(), ...input };
    clinics.set(id, clinic);
    return clinic;
  },

  get(id: string) {
    return clinics.get(id) ?? null;
  },

  list({ activeOnly }: { activeOnly?: boolean } = {}) {
    const all = Array.from(clinics.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return activeOnly ? all.filter((c) => c.active) : all;
  },

  update(id: string, patch: Partial<Omit<ClinicRecord, "id" | "createdAt">>) {
    const existing = clinics.get(id);
    if (!existing) return null;
    const updated: ClinicRecord = { ...existing, ...patch };
    clinics.set(id, updated);
    return updated;
  }
};

