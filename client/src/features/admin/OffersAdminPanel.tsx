import { useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ApiOfferRow = {
  id: string;
  name: string;
  subtitle?: string;
  type: "A" | "B";
  offerKind?: string;
  category: string;
  categoryIds: string[];
  status: "active" | "draft" | "hidden" | "expired";
  active: boolean;
  visibility: string;
  featured: boolean;
  clinicLocked?: boolean;
  clinicId: string;
  clinicIds: string[];
  doctorIds: string[];
  subscriptionPriceKwd: string;
  perVisitPriceKwd?: string;
  originalClinicPriceKwd?: string;
  validityDays: number;
  maxSessions?: number;
  sessionIntervalDays: number;
  sessionExpiryMonths?: number;
  maxBookingsPerWeek?: number;
  maxActiveSessions?: number;
  bookingMode?: string;
  enrollmentCap?: number;
  description?: string;
  imageUrl?: string;
  bannerUrl?: string;
  allowFullPayment?: boolean;
  allowInstallments?: boolean;
  maxInstallments?: number;
  allowDeposit?: boolean;
  depositAmountKwd?: string;
  payPerSession?: boolean;
  sessionPriceKwd?: string;
  branchSessionPrices?: { clinicId: string; sessionPriceKwd: string }[];
  allowExtraPaidSessions?: boolean;
  extraSessionPriceKwd?: string;
  branchExtraSessionPrices?: { clinicId: string; priceKwd: string }[];
  signupCashbackKwd?: string;
  cashbackPerSessionKwd?: string;
  cashbackEligible?: boolean;
  maxCashbackPerPurchaseKwd?: string;
};

type FormState = {
  name: string;
  subtitle: string;
  offerKind: string;
  category: string;
  status: "active" | "draft" | "hidden" | "expired";
  visibility: string;
  featured: boolean;
  clinicLocked: boolean;
  clinicId: string;
  clinicIds: string[];
  doctorIds: string;
  subscriptionPriceKwd: string;
  perVisitPriceKwd: string;
  originalClinicPriceKwd: string;
  validityDays: number;
  maxSessions: string;
  sessionIntervalDays: number;
  sessionExpiryMonths: number;
  maxBookingsPerWeek: string;
  maxActiveSessions: string;
  bookingMode: string;
  enrollmentCap: string;
  description: string;
  imageUrl: string;
  bannerUrl: string;
  allowFullPayment: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  allowDeposit: boolean;
  depositAmountKwd: string;
  payPerSession: boolean;
  sessionPriceKwd: string;
  branchSessionPrices: { clinicId: string; sessionPriceKwd: string }[];
  allowExtraPaidSessions: boolean;
  extraSessionPriceKwd: string;
  branchExtraSessionPrices: { clinicId: string; priceKwd: string }[];
  signupCashbackKwd: string;
  cashbackPerSessionKwd: string;
  cashbackEligible: boolean;
  maxCashbackPerPurchaseKwd: string;
  enableCashbackRewards: boolean;
};

const DEFAULT_FORM: FormState = {
  name: "",
  subtitle: "",
  offerKind: "laser",
  category: "laser",
  status: "draft",
  visibility: "public",
  featured: false,
  clinicLocked: false,
  clinicId: "",
  clinicIds: [],
  doctorIds: "",
  subscriptionPriceKwd: "99.000",
  perVisitPriceKwd: "10.000",
  originalClinicPriceKwd: "15.000",
  validityDays: 365,
  maxSessions: "",
  sessionIntervalDays: 0,
  sessionExpiryMonths: 0,
  maxBookingsPerWeek: "",
  maxActiveSessions: "",
  bookingMode: "instant",
  enrollmentCap: "",
  description: "",
  imageUrl: "",
  bannerUrl: "",
  allowFullPayment: true,
  allowInstallments: false,
  maxInstallments: 2,
  allowDeposit: false,
  depositAmountKwd: "0.000",
  payPerSession: false,
  sessionPriceKwd: "",
  branchSessionPrices: [],
  allowExtraPaidSessions: false,
  extraSessionPriceKwd: "",
  branchExtraSessionPrices: [],
  signupCashbackKwd: "0.000",
  cashbackPerSessionKwd: "0.000",
  cashbackEligible: true,
  maxCashbackPerPurchaseKwd: "",
  enableCashbackRewards: false
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  draft: "Draft",
  hidden: "Hidden",
  expired: "Expired"
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  draft: "bg-amber-100 text-amber-700",
  hidden: "bg-surface-100 text-surface-500",
  expired: "bg-red-100 text-red-600"
};

const KIND_LABELS: Record<string, string> = {
  laser: "Laser",
  treatment: "Treatment",
  membership: "Membership",
  cashback: "Cashback",
  bundle: "Bundle",
  subscription: "Subscription"
};

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  members_only: "Members only",
  referral_only: "Referral only",
  vip_only: "VIP only",
  hidden_link: "Hidden link"
};

const BOOKING_MODE_LABELS: Record<string, string> = {
  instant: "Instant booking",
  review: "Under review",
  doctor_approval: "Doctor approval required",
  manual_confirmation: "Manual clinic confirmation"
};

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-surface-500 mb-1 block">{children}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-surface-200 pt-4 space-y-3">
      <h4 className="text-sm font-bold text-surface-800">{title}</h4>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OffersAdminPanel() {
  const { getAuthHeader } = useAuth();
  const { data, loading, error, refetch } = useApi<{ items: ApiOfferRow[] }>("/offers/admin");
  const { data: clinicsPayload } = useApi<{ items?: { id: string; nameEn: string }[]; clinics?: { id: string; nameEn: string }[] }>(
    "/clinics/admin"
  );
  const clinics = useMemo(() => clinicsPayload?.items ?? clinicsPayload?.clinics ?? [], [clinicsPayload]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const f = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const beginCreate = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM, clinicId: clinics[0]?.id ?? "" });
    setShowForm(true);
    setTimeout(() => document.getElementById("offer-form")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const beginEdit = (o: ApiOfferRow) => {
    setEditingId(o.id);
    setForm({
      name: o.name,
      subtitle: o.subtitle ?? "",
      offerKind: o.offerKind ?? "laser",
      category: o.category,
      status: o.status ?? (o.active ? "active" : "draft"),
      visibility: o.visibility ?? "public",
      featured: o.featured,
      clinicLocked: o.clinicLocked ?? false,
      clinicId: o.clinicId,
      clinicIds: o.clinicIds ?? [],
      doctorIds: (o.doctorIds ?? []).join(", "),
      subscriptionPriceKwd: o.subscriptionPriceKwd,
      perVisitPriceKwd: o.perVisitPriceKwd ?? "10.000",
      originalClinicPriceKwd: o.originalClinicPriceKwd ?? "15.000",
      validityDays: o.validityDays,
      maxSessions: o.maxSessions != null ? String(o.maxSessions) : "",
      sessionIntervalDays: o.sessionIntervalDays ?? 0,
      sessionExpiryMonths: o.sessionExpiryMonths ?? 0,
      maxBookingsPerWeek: o.maxBookingsPerWeek != null ? String(o.maxBookingsPerWeek) : "",
      maxActiveSessions: o.maxActiveSessions != null ? String(o.maxActiveSessions) : "",
      bookingMode: o.bookingMode ?? "instant",
      enrollmentCap: o.enrollmentCap != null ? String(o.enrollmentCap) : "",
      description: o.description ?? "",
      imageUrl: o.imageUrl ?? "",
      bannerUrl: o.bannerUrl ?? "",
      allowFullPayment: o.allowFullPayment ?? true,
      allowInstallments: o.allowInstallments ?? false,
      maxInstallments: o.maxInstallments ?? 2,
      allowDeposit: o.allowDeposit ?? false,
      depositAmountKwd: o.depositAmountKwd ?? "0.000",
      payPerSession: o.payPerSession ?? false,
      sessionPriceKwd: o.sessionPriceKwd ?? "",
      branchSessionPrices: o.branchSessionPrices ?? [],
      allowExtraPaidSessions: o.allowExtraPaidSessions ?? false,
      extraSessionPriceKwd: o.extraSessionPriceKwd ?? "",
      branchExtraSessionPrices: o.branchExtraSessionPrices ?? [],
      signupCashbackKwd: o.signupCashbackKwd ?? "0.000",
      cashbackPerSessionKwd: o.cashbackPerSessionKwd ?? "0.000",
      cashbackEligible: o.cashbackEligible !== false,
      maxCashbackPerPurchaseKwd: o.maxCashbackPerPurchaseKwd ?? "",
      enableCashbackRewards: parseFloat(o.signupCashbackKwd ?? "0") > 0 || parseFloat(o.cashbackPerSessionKwd ?? "0") > 0
    });
    setShowForm(true);
    setTimeout(() => document.getElementById("offer-form")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const submit = async () => {
    const clinicId = form.clinicLocked ? (form.clinicId || clinics[0]?.id) : (form.clinicId || clinics[0]?.id);
    if (!clinicId || !form.name.trim()) return;
    setSaving(true);
    try {
      const doctorIds = form.doctorIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        subtitle: form.subtitle.trim() || undefined,
        type: "A",
        offerKind: form.offerKind,
        category: form.category,
        status: form.status,
        visibility: form.visibility,
        featured: form.featured,
        clinicId,
        clinicIds: form.clinicLocked ? form.clinicIds : [],
        clinicLocked: form.clinicLocked,
        doctorIds,
        subscriptionPriceKwd: form.subscriptionPriceKwd,
        perVisitPriceKwd: form.perVisitPriceKwd,
        originalClinicPriceKwd: form.originalClinicPriceKwd,
        validityDays: form.validityDays,
        sessionIntervalDays: form.sessionIntervalDays,
        sessionExpiryMonths: form.sessionExpiryMonths,
        bookingMode: form.bookingMode,
        allowFullPayment: form.allowFullPayment,
        allowInstallments: form.allowInstallments,
        maxInstallments: form.allowInstallments ? Math.max(2, Math.min(4, form.maxInstallments)) : 1,
        allowDeposit: form.allowDeposit,
        depositAmountKwd: form.allowDeposit ? form.depositAmountKwd : "0.000",
        payPerSession: form.payPerSession,
        sessionPriceKwd: form.payPerSession && form.sessionPriceKwd.trim() ? form.sessionPriceKwd.trim() : undefined,
        branchSessionPrices: form.payPerSession
          ? form.branchSessionPrices.filter((b) => b.clinicId && b.sessionPriceKwd.trim())
          : [],
        allowExtraPaidSessions: form.allowExtraPaidSessions,
        extraSessionPriceKwd: form.allowExtraPaidSessions && form.extraSessionPriceKwd.trim() ? form.extraSessionPriceKwd.trim() : undefined,
        branchExtraSessionPrices: form.allowExtraPaidSessions
          ? form.branchExtraSessionPrices.filter((b) => b.clinicId && b.priceKwd.trim())
          : [],
        signupCashbackKwd: form.enableCashbackRewards ? form.signupCashbackKwd : "0.000",
        cashbackPerSessionKwd: form.enableCashbackRewards ? form.cashbackPerSessionKwd : "0.000",
        cashbackEligible: form.cashbackEligible,
        description: form.description.trim() || undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        bannerUrl: form.bannerUrl.trim() || undefined
      };

      if (form.maxSessions.trim()) body.maxSessions = Number(form.maxSessions);
      if (form.maxBookingsPerWeek.trim()) body.maxBookingsPerWeek = Number(form.maxBookingsPerWeek);
      if (form.maxActiveSessions.trim()) body.maxActiveSessions = Number(form.maxActiveSessions);
      if (form.enrollmentCap.trim()) body.enrollmentCap = Number(form.enrollmentCap);
      if (form.maxCashbackPerPurchaseKwd.trim()) body.maxCashbackPerPurchaseKwd = form.maxCashbackPerPurchaseKwd.trim();

      if (editingId) {
        await apiFetch(`/offers/admin/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: getAuthHeader(),
          body: JSON.stringify(body)
        });
      } else {
        await apiFetch("/offers/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify(body) });
      }
      await refetch();
      setShowForm(false);
      setEditingId(null);
      setForm(DEFAULT_FORM);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const patchOffer = async (id: string, patch: Record<string, unknown>) => {
    try {
      await apiFetch(`/offers/admin/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify(patch)
      });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  const duplicateOffer = async (id: string) => {
    try {
      await apiFetch(`/offers/admin/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        headers: getAuthHeader()
      });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  const toggleClinicId = (id: string) => {
    setForm((prev) => ({
      ...prev,
      clinicIds: prev.clinicIds.includes(id)
        ? prev.clinicIds.filter((c) => c !== id)
        : [...prev.clinicIds, id]
    }));
  };

  const items = data?.items ?? [];
  const filtered = filterStatus === "all" ? items : items.filter((o) => (o.status ?? (o.active ? "active" : "draft")) === filterStatus);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-bold text-surface-900">
          {ar() ? "إدارة العروض" : "Offer management"}
        </h3>
        <div className="flex gap-2 flex-wrap">
          <select
            className="select-field text-xs py-1"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
            <option value="expired">Expired</option>
          </select>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => {
              if (showForm) { setShowForm(false); setEditingId(null); setForm(DEFAULT_FORM); }
              else beginCreate();
            }}
          >
            {showForm ? (ar() ? "إغلاق" : "Close") : "+ " + (ar() ? "عرض جديد" : "New offer")}
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-surface-500">{ar() ? "جاري التحميل…" : "Loading…"}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* ─── Create / Edit form ─────────────────────────────────────────────── */}
      {showForm && (
        <div id="offer-form" className="card-elevated p-5 space-y-4">
          <h4 className="font-bold text-surface-900">
            {editingId ? (ar() ? "تعديل العرض" : "Edit offer") : (ar() ? "عرض جديد" : "New offer")}
          </h4>

          {/* ── Basic info ── */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <Label>{ar() ? "الاسم *" : "Name *"}</Label>
              <input className="input-field" value={form.name} onChange={(e) => f({ name: e.target.value })} />
            </label>
            <label className="block">
              <Label>{ar() ? "العنوان الفرعي" : "Subtitle"}</Label>
              <input className="input-field" value={form.subtitle} placeholder="Short tagline…" onChange={(e) => f({ subtitle: e.target.value })} />
            </label>
            <label className="block">
              <Label>{ar() ? "نوع العرض" : "Offer type"}</Label>
              <select className="select-field" value={form.offerKind} onChange={(e) => f({ offerKind: e.target.value })}>
                {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <Label>{ar() ? "الفئة" : "Category"}</Label>
              <select className="select-field" value={form.category} onChange={(e) => f({ category: e.target.value })}>
                {["laser", "injectables", "skincare", "beauty", "body", "dental", "medical", "other"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <Label>{ar() ? "الحالة" : "Status"}</Label>
              <select className="select-field" value={form.status} onChange={(e) => f({ status: e.target.value as any })}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <Label>{ar() ? "الظهور" : "Visibility"}</Label>
              <select className="select-field" value={form.visibility} onChange={(e) => f({ visibility: e.target.value })}>
                {Object.entries(VISIBILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          {/* ── Clinic assignment ── */}
          <Section title={ar() ? "تعيين العيادة" : "Clinic assignment"}>
            {/* Lock toggle */}
            <div className={`rounded-xl border p-4 transition-colors ${form.clinicLocked ? "border-amber-300 bg-amber-50" : "border-surface-200 bg-surface-50"}`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => f({ clinicLocked: !form.clinicLocked, clinicId: !form.clinicLocked ? (form.clinicId || clinics[0]?.id || "") : "" })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.clinicLocked ? "bg-amber-500" : "bg-surface-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.clinicLocked ? "translate-x-5" : ""}`} />
                </div>
                <div>
                  <div className="text-sm font-bold text-surface-900">
                    {form.clinicLocked
                      ? (ar() ? "مقيّد بعيادة واحدة" : "Locked to one clinic")
                      : (ar() ? "بدون تقييد — أي عيادة" : "Open — customer picks any clinic")}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">
                    {form.clinicLocked
                      ? (ar() ? "يتم تعيين المشترك للعيادة أدناه. تغيير العيادة لاحقاً يستلزم رسوم متصاعدة: 10 → 20 → 30 د.ك." : "Subscriber is locked to the clinic below. Changing clinic later costs 10 → 20 → 30 KWD (escalating).")
                      : (ar() ? "المشترك يختار أي عيادة نشطة عند الاشتراك. لا رسوم تغيير." : "Customer selects any active clinic at checkout. No transfer fee.")}
                  </div>
                </div>
              </label>

              {form.clinicLocked && (
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <Label>{ar() ? "العيادة المقيّدة *" : "Locked clinic *"}</Label>
                    <select
                      className="select-field border-amber-300 focus:border-amber-500"
                      value={form.clinicId}
                      onChange={(e) => f({ clinicId: e.target.value })}
                    >
                      <option value="">{ar() ? "— اختر عيادة —" : "— Select a clinic —"}</option>
                      {clinics.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
                    </select>
                  </label>
                  <div className="flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{ar() ? "رسوم تغيير العيادة متصاعدة: الطلب الأول 10 د.ك، الثاني 20 د.ك، الثالث 30 د.ك، وهكذا. تتم المراجعة والموافقة من خدمة العملاء." : "Clinic change fee escalates per request: 1st = 10 KWD, 2nd = 20 KWD, 3rd = 30 KWD, etc. CS reviews and approves each request."}</span>
                  </div>
                </div>
              )}
            </div>

            <label className="block">
              <Label>{ar() ? "الأطباء (معرفات مفصولة بفواصل)" : "Doctor IDs (comma-separated)"}</Label>
              <input className="input-field" value={form.doctorIds} placeholder="dr_001, dr_002" onChange={(e) => f({ doctorIds: e.target.value })} />
            </label>
          </Section>

          {/* ── Pricing ── */}
          <Section title={ar() ? "التسعير" : "Pricing"}>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <Label>{ar() ? "السعر (x.xxx)" : "Price KWD"}</Label>
                <input className="input-field" value={form.subscriptionPriceKwd} onChange={(e) => f({ subscriptionPriceKwd: e.target.value })} />
              </label>
              <label className="block">
                <Label>{ar() ? "سعر/زيارة KWD" : "Per-visit price KWD"}</Label>
                <input className="input-field" value={form.perVisitPriceKwd} onChange={(e) => f({ perVisitPriceKwd: e.target.value })} />
              </label>
              <label className="block">
                <Label>{ar() ? "سعر العيادة الأصلي KWD" : "Original clinic price KWD"}</Label>
                <input className="input-field" value={form.originalClinicPriceKwd} onChange={(e) => f({ originalClinicPriceKwd: e.target.value })} />
              </label>
            </div>
          </Section>

          {/* ── Sessions & Booking ── */}
          <Section title={ar() ? "الجلسات وقواعد الحجز" : "Sessions & booking rules"}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="block">
                <Label>{ar() ? "الصلاحية (أيام)" : "Validity (days)"}</Label>
                <input type="number" className="input-field" value={form.validityDays} onChange={(e) => f({ validityDays: Number(e.target.value) || 1 })} />
              </label>
              <label className="block">
                <Label>{ar() ? "عدد الجلسات (اتركه فارغاً = غير محدود)" : "Max sessions (blank = unlimited)"}</Label>
                <input type="number" className="input-field" value={form.maxSessions} placeholder="e.g. 6" onChange={(e) => f({ maxSessions: e.target.value })} />
              </label>
              <label className="block">
                <Label>{ar() ? "فترة الانتظار بين الجلسات (أيام)" : "Cooldown between sessions (days)"}</Label>
                <input type="number" className="input-field" min={0} value={form.sessionIntervalDays} onChange={(e) => f({ sessionIntervalDays: Number(e.target.value) })} />
              </label>
              <label className="block">
                <Label>{ar() ? "انتهاء الجلسات (أشهر، 0 = حسب الصلاحية)" : "Session expiry (months, 0 = use validity)"}</Label>
                <input type="number" className="input-field" min={0} value={form.sessionExpiryMonths} onChange={(e) => f({ sessionExpiryMonths: Number(e.target.value) })} />
              </label>
              <label className="block">
                <Label>{ar() ? "أقصى حجوزات/أسبوع" : "Max bookings / week (blank = unlimited)"}</Label>
                <input type="number" className="input-field" value={form.maxBookingsPerWeek} placeholder="e.g. 2" onChange={(e) => f({ maxBookingsPerWeek: e.target.value })} />
              </label>
              <label className="block">
                <Label>{ar() ? "أقصى جلسات نشطة في وقت واحد" : "Max active sessions simultaneously"}</Label>
                <input type="number" className="input-field" value={form.maxActiveSessions} placeholder="e.g. 1" onChange={(e) => f({ maxActiveSessions: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <Label>{ar() ? "طريقة معالجة الحجوزات" : "Booking processing mode"}</Label>
              <select className="select-field" value={form.bookingMode} onChange={(e) => f({ bookingMode: e.target.value })}>
                {Object.entries(BOOKING_MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <Label>{ar() ? "حد التسجيل الكلي" : "Total enrollment cap (blank = unlimited)"}</Label>
              <input type="number" className="input-field" style={{ maxWidth: 180 }} value={form.enrollmentCap} placeholder="e.g. 100" onChange={(e) => f({ enrollmentCap: e.target.value })} />
            </label>
          </Section>

          {/* ── Payment options ── */}
          <Section title={ar() ? "خيارات الدفع" : "Payment options"}>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.allowFullPayment} onChange={(e) => f({ allowFullPayment: e.target.checked })} />
                {ar() ? "دفع كامل" : "Full payment"}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.allowInstallments} onChange={(e) => f({ allowInstallments: e.target.checked })} />
                {ar() ? "أقساط" : "Installments"}
              </label>
              {form.allowInstallments && (
                <label className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">{ar() ? "الحد الأقصى" : "Max"}</span>
                  <select className="select-field" value={form.maxInstallments} onChange={(e) => f({ maxInstallments: Number(e.target.value) })}>
                    <option value={2}>2 {ar() ? "قسطين" : "installments"}</option>
                    <option value={3}>3 {ar() ? "أقساط" : "installments"}</option>
                    <option value={4}>4 (ENET)</option>
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.allowDeposit} onChange={(e) => f({ allowDeposit: e.target.checked })} />
                {ar() ? "حجز بعربون" : "Deposit reservation"}
              </label>
              {form.allowDeposit && (
                <label className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">{ar() ? "العربون KWD" : "Deposit KWD"}</span>
                  <input className="input-field w-28" value={form.depositAmountKwd} placeholder="10.000" onChange={(e) => f({ depositAmountKwd: e.target.value })} />
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.payPerSession} onChange={(e) => f({ payPerSession: e.target.checked })} />
                {ar() ? "رسوم لكل جلسة" : "Pay per session"}
              </label>
              {form.payPerSession && (
                <label className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">{ar() ? "رسوم الجلسة KWD (افتراضي)" : "Default session fee KWD"}</span>
                  <input className="input-field w-28" value={form.sessionPriceKwd} placeholder="5.000" onChange={(e) => f({ sessionPriceKwd: e.target.value })} />
                </label>
              )}
            </div>
            {form.payPerSession && (
              <div className="mt-3 space-y-2">
                <div className="text-xs font-semibold text-surface-600">{ar() ? "تجاوزات السعر لكل فرع" : "Branch price overrides"}</div>
                {form.branchSessionPrices.map((bp, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <select
                      className="select-field text-sm"
                      value={bp.clinicId}
                      onChange={(e) => {
                        const updated = form.branchSessionPrices.map((x, j) => j === i ? { ...x, clinicId: e.target.value } : x);
                        f({ branchSessionPrices: updated });
                      }}
                    >
                      <option value="">{ar() ? "اختر الفرع" : "Select branch"}</option>
                      {clinics.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
                    </select>
                    <input
                      className="input-field w-28 text-sm"
                      value={bp.sessionPriceKwd}
                      placeholder="5.000"
                      onChange={(e) => {
                        const updated = form.branchSessionPrices.map((x, j) => j === i ? { ...x, sessionPriceKwd: e.target.value } : x);
                        f({ branchSessionPrices: updated });
                      }}
                    />
                    <button
                      type="button"
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={() => f({ branchSessionPrices: form.branchSessionPrices.filter((_, j) => j !== i) })}
                    >
                      {ar() ? "حذف" : "Remove"}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-xs text-brand-pink-600 hover:text-brand-pink-700 font-medium"
                  onClick={() => f({ branchSessionPrices: [...form.branchSessionPrices, { clinicId: "", sessionPriceKwd: "" }] })}
                >
                  + {ar() ? "إضافة تجاوز فرع" : "Add branch override"}
                </button>
              </div>
            )}
          </Section>

          {/* ── Extra Paid Sessions ── */}
          <Section title={ar() ? "جلسات إضافية مدفوعة" : "Extra paid sessions"}>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.allowExtraPaidSessions} onChange={(e) => f({ allowExtraPaidSessions: e.target.checked })} />
                {ar() ? "السماح بجلسات إضافية مدفوعة بعد انتهاء الجلسات المجانية" : "Allow extra paid sessions after free sessions are used up"}
              </label>
            </div>
            {form.allowExtraPaidSessions && (
              <div className="space-y-3 mt-2 pl-1 border-l-2 border-amber-200">
                <label className="flex items-center gap-2">
                  <span className="text-xs text-surface-500">{ar() ? "سعر الجلسة الإضافية KWD" : "Extra session price KWD"}</span>
                  <input className="input-field w-28" value={form.extraSessionPriceKwd} placeholder="10.000" onChange={(e) => f({ extraSessionPriceKwd: e.target.value })} />
                </label>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-surface-600">{ar() ? "تجاوزات سعر الجلسة الإضافية لكل فرع" : "Branch extra session price overrides"}</div>
                  {form.branchExtraSessionPrices.map((bp, i) => (
                    <div key={i} className="flex items-center gap-2 flex-wrap">
                      <select
                        className="select-field text-sm"
                        value={bp.clinicId}
                        onChange={(e) => {
                          const updated = form.branchExtraSessionPrices.map((x, j) => j === i ? { ...x, clinicId: e.target.value } : x);
                          f({ branchExtraSessionPrices: updated });
                        }}
                      >
                        <option value="">{ar() ? "اختر الفرع" : "Select branch"}</option>
                        {clinics.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
                      </select>
                      <input
                        className="input-field w-28 text-sm"
                        value={bp.priceKwd}
                        placeholder="10.000"
                        onChange={(e) => {
                          const updated = form.branchExtraSessionPrices.map((x, j) => j === i ? { ...x, priceKwd: e.target.value } : x);
                          f({ branchExtraSessionPrices: updated });
                        }}
                      />
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-700"
                        onClick={() => f({ branchExtraSessionPrices: form.branchExtraSessionPrices.filter((_, j) => j !== i) })}
                      >
                        {ar() ? "حذف" : "Remove"}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-brand-pink-600 hover:text-brand-pink-700 font-medium"
                    onClick={() => f({ branchExtraSessionPrices: [...form.branchExtraSessionPrices, { clinicId: "", priceKwd: "" }] })}
                  >
                    + {ar() ? "إضافة تجاوز فرع" : "Add branch override"}
                  </button>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>{ar() ? "بعد انتهاء الجلسات المجانية، يمكن للعضو حجز جلسات إضافية بالسعر المحدد أعلاه حتى انتهاء صلاحية العضوية." : "After free sessions are exhausted, members can book extra sessions at the price above until the membership expires."}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ── Cashback ── */}
          <Section title={ar() ? "سياسة الكاش باك" : "Cashback policy"}>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm items-center">
                <label className="flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={form.enableCashbackRewards} onChange={(e) => f({ enableCashbackRewards: e.target.checked })} />
                  {ar() ? "تفعيل مكافآت الكاش باك" : "Enable cashback rewards"}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.cashbackEligible} onChange={(e) => f({ cashbackEligible: e.target.checked })} />
                  {ar() ? "يقبل خصم الكاش باك" : "Accepts cashback redemption"}
                </label>
              </div>
              {form.enableCashbackRewards && (
                <div className="flex flex-wrap gap-4 text-sm items-center pl-1 pt-1 border-l-2 border-brand-pink-200">
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">{ar() ? "كاش التسجيل KWD" : "Signup cashback KWD"}</span>
                    <input className="input-field w-24" value={form.signupCashbackKwd} onChange={(e) => f({ signupCashbackKwd: e.target.value })} />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">{ar() ? "كاش/جلسة KWD" : "Per-session cashback KWD"}</span>
                    <input className="input-field w-24" value={form.cashbackPerSessionKwd} onChange={(e) => f({ cashbackPerSessionKwd: e.target.value })} />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-surface-500">{ar() ? "حد الخصم/شراء" : "Cap per purchase"}</span>
                    <input className="input-field w-28" value={form.maxCashbackPerPurchaseKwd} placeholder={ar() ? "اختياري" : "optional"} onChange={(e) => f({ maxCashbackPerPurchaseKwd: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          </Section>

          {/* ── Media ── */}
          <Section title={ar() ? "الصور والمحتوى" : "Media & content"}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <Label>{ar() ? "رابط الصورة المصغرة" : "Thumbnail image URL"}</Label>
                <input className="input-field" value={form.imageUrl} placeholder="https://…" onChange={(e) => f({ imageUrl: e.target.value })} />
              </label>
              <label className="block">
                <Label>{ar() ? "رابط صورة البانر" : "Banner image URL"}</Label>
                <input className="input-field" value={form.bannerUrl} placeholder="https://…" onChange={(e) => f({ bannerUrl: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <Label>{ar() ? "الوصف" : "Description"}</Label>
              <textarea className="input-field" rows={3} value={form.description} onChange={(e) => f({ description: e.target.value })} />
            </label>
          </Section>

          {/* ── Flags ── */}
          <div className="flex flex-wrap gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.featured} onChange={(e) => f({ featured: e.target.checked })} />
              {ar() ? "مميز" : "Featured"}
            </label>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-2 items-center pt-2">
            <button type="button" className="btn-primary btn-sm" disabled={saving} onClick={() => void submit()}>
              {saving ? "…" : editingId ? (ar() ? "حفظ التعديلات" : "Save changes") : ar() ? "إنشاء العرض" : "Create offer"}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditingId(null); setForm(DEFAULT_FORM); }}>
              {ar() ? "إلغاء" : "Cancel"}
            </button>
            {editingId && (
              <span className="text-xs text-surface-500 ml-1">{ar() ? "وضع التعديل" : "Editing existing offer"}</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Offer cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((o) => {
          const st = o.status ?? (o.active ? "active" : "draft");
          return (
            <div key={o.id} className={`card-elevated p-4 ${st === "draft" || st === "expired" ? "opacity-80" : ""}`}>
              {/* Card header */}
              <div className="flex justify-between gap-2 mb-1">
                <div className="font-bold text-surface-900 line-clamp-2">{o.name}</div>
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${STATUS_COLORS[st] ?? "bg-surface-100 text-surface-500"}`}>
                  {STATUS_LABELS[st] ?? st}
                </span>
              </div>
              {o.subtitle && <div className="text-xs text-surface-500 mb-1">{o.subtitle}</div>}

              {/* Kind + visibility badges */}
              <div className="flex gap-1 flex-wrap mb-2">
                {o.offerKind && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-pink-50 text-brand-pink-600 font-bold uppercase">
                    {KIND_LABELS[o.offerKind] ?? o.offerKind}
                  </span>
                )}
                {o.visibility && o.visibility !== "public" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-bold uppercase">
                    {VISIBILITY_LABELS[o.visibility] ?? o.visibility}
                  </span>
                )}
                {o.featured && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold">★ Featured</span>
                )}
              </div>

              <div className="text-xl font-black text-brand-pink-600 mb-1">{o.subscriptionPriceKwd} KWD</div>
              <div className="text-[11px] text-surface-400 mb-2">{o.validityDays}d validity · {o.maxSessions != null ? `${o.maxSessions} sessions` : "Unlimited sessions"}</div>

              {/* Payment badges */}
              <div className="flex flex-wrap gap-1 mb-3 text-[10px]">
                {o.allowFullPayment && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">FULL</span>}
                {o.allowInstallments && (
                  <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold">×{o.maxInstallments ?? 1} INST</span>
                )}
                {o.allowDeposit && (
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">DEPOSIT {o.depositAmountKwd}</span>
                )}
                {o.cashbackEligible === false && (
                  <span className="px-2 py-0.5 rounded bg-surface-100 text-surface-500 font-bold">NO CB</span>
                )}
                {o.bookingMode && o.bookingMode !== "instant" && (
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold uppercase">
                    {o.bookingMode.replace(/_/g, " ")}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn-primary btn-sm text-xs" onClick={() => beginEdit(o)}>
                  {ar() ? "تعديل" : "Edit"}
                </button>
                <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => duplicateOffer(o.id)}>
                  {ar() ? "نسخ" : "Duplicate"}
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm text-xs"
                  onClick={() => patchOffer(o.id, { status: st === "active" ? "draft" : "active" })}
                >
                  {st === "active" ? (ar() ? "تعطيل" : "Deactivate") : ar() ? "تفعيل" : "Activate"}
                </button>
                <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => patchOffer(o.id, { featured: !o.featured })}>
                  {o.featured ? "Unfeature" : "Feature"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="text-sm text-surface-500 text-center py-8">
          {filterStatus !== "all" ? `No ${filterStatus} offers` : "No offers yet — create one above"}
        </div>
      )}
    </div>
  );
}
