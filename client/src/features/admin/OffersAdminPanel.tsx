import { useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

export type ApiOfferRow = {
  id: string;
  name: string;
  type: "A" | "B";
  category: string;
  categoryIds: string[];
  clinicId: string;
  subscriptionPriceKwd: string;
  validityDays: number;
  cashbackPerSessionKwd: string;
  sessionIntervalDays: number;
  maxSessions?: number;
  active: boolean;
  featured: boolean;
  enrollmentCap?: number;
  perVisitPriceKwd?: string;
  originalClinicPriceKwd?: string;
};

export function OffersAdminPanel() {
  const { getAuthHeader } = useAuth();
  const { data, loading, error, refetch } = useApi<{ items: ApiOfferRow[] }>("/offers/admin");
  const { data: clinicsPayload } = useApi<{ items?: { id: string; nameEn: string }[]; clinics?: { id: string; nameEn: string }[] }>(
    "/clinics/admin"
  );
  const { data: categoriesPayload } = useApi<{ items: { id: string; nameEn: string; slug: string }[] }>("/categories/admin");

  const clinics = useMemo(
    () => clinicsPayload?.items ?? clinicsPayload?.clinics ?? [],
    [clinicsPayload]
  );
  const categories = categoriesPayload?.items ?? [];

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "A" as "A" | "B",
    category: "laser",
    clinicId: "",
    subscriptionPriceKwd: "99.000",
    validityDays: 365,
    cashbackPerSessionKwd: "0.000",
    sessionIntervalDays: 0,
    maxSessions: "",
    featured: false,
    active: true,
    perVisitPriceKwd: "10.000",
    originalClinicPriceKwd: "15.000",
    categoryIds: [] as string[]
  });

  const toggleCategory = (id: string) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((x) => x !== id) : [...f.categoryIds, id]
    }));
  };

  const submit = async () => {
    const clinicId = form.clinicId || clinics[0]?.id;
    if (!clinicId || !form.name.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        clinicId,
        subscriptionPriceKwd: form.subscriptionPriceKwd,
        validityDays: form.validityDays,
        cashbackPerSessionKwd: form.cashbackPerSessionKwd,
        sessionIntervalDays: form.sessionIntervalDays,
        featured: form.featured,
        active: form.active
      };
      if (form.categoryIds.length) body.categoryIds = form.categoryIds;
      else body.category = form.category;
      if (form.maxSessions.trim()) body.maxSessions = Number(form.maxSessions);
      if (form.type === "B") {
        body.perVisitPriceKwd = form.perVisitPriceKwd;
        body.originalClinicPriceKwd = form.originalClinicPriceKwd;
      }
      await apiFetch("/offers/admin", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      await refetch();
      setShowForm(false);
      setForm((f) => ({ ...f, name: "" }));
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

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العروض (قاعدة البيانات)" : "Offer management (database)"}</h3>
        <button type="button" className="btn-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? (ar() ? "إغلاق النموذج" : "Close form") : "+ " + (ar() ? "عرض جديد" : "New offer")}
        </button>
      </div>

      {loading && <div className="text-sm text-surface-500">{ar() ? "جاري التحميل…" : "Loading…"}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {showForm && (
        <div className="card-elevated p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "الاسم" : "Name"}</span>
              <input className="input-field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Type</span>
              <select className="select-field mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "A" | "B" })}>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "العيادة" : "Clinic"}</span>
              <select
                className="select-field mt-1"
                value={form.clinicId || clinics[0]?.id || ""}
                onChange={(e) => setForm({ ...form, clinicId: e.target.value })}
              >
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "السعر (x.xxx)" : "Price KWD (x.xxx)"}</span>
              <input
                className="input-field mt-1"
                value={form.subscriptionPriceKwd}
                onChange={(e) => setForm({ ...form, subscriptionPriceKwd: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "مدة الصلاحية (أيام)" : "Validity days"}</span>
              <input
                type="number"
                className="input-field mt-1"
                value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) || 1 })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "كاش باك / جلسة" : "Cashback / session"}</span>
              <input
                className="input-field mt-1"
                value={form.cashbackPerSessionKwd}
                onChange={(e) => setForm({ ...form, cashbackPerSessionKwd: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "أيام بين الجلسات" : "Session interval days"}</span>
              <input
                type="number"
                className="input-field mt-1"
                value={form.sessionIntervalDays}
                onChange={(e) => setForm({ ...form, sessionIntervalDays: Number(e.target.value) || 0 })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "أقصى جلسات (اختياري)" : "Max sessions (optional)"}</span>
              <input
                className="input-field mt-1"
                value={form.maxSessions}
                onChange={(e) => setForm({ ...form, maxSessions: e.target.value })}
                placeholder="∞"
              />
            </label>
            {form.type === "B" && (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-surface-500">Per visit KWD</span>
                  <input
                    className="input-field mt-1"
                    value={form.perVisitPriceKwd}
                    onChange={(e) => setForm({ ...form, perVisitPriceKwd: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-surface-500">Original clinic KWD</span>
                  <input
                    className="input-field mt-1"
                    value={form.originalClinicPriceKwd}
                    onChange={(e) => setForm({ ...form, originalClinicPriceKwd: e.target.value })}
                  />
                </label>
              </>
            )}
          </div>

          <div>
            <div className="text-xs font-medium text-surface-500 mb-2">{ar() ? "الفئات (من قاعدة البيانات)" : "Categories (from database)"}</div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                    form.categoryIds.includes(c.id) ? "bg-brand-pink-500 text-white border-brand-pink-500" : "bg-white border-surface-200"
                  }`}
                >
                  {c.nameEn}
                </button>
              ))}
            </div>
            {categories.length === 0 && (
              <p className="text-xs text-surface-400 mt-1">{ar() ? "لا توجد فئات — أضفها من تبويب الفئات" : "No categories — add them in Categories tab"}</p>
            )}
            {form.categoryIds.length === 0 && (
              <label className="block mt-3 max-w-xs">
                <span className="text-xs font-medium text-surface-500">{ar() ? "فئة افتراضية (سلسلة)" : "Legacy category slug"}</span>
                <select
                  className="select-field mt-1"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {["laser", "beauty", "skincare", "other"].map((slug) => (
                    <option key={slug} value={slug}>
                      {slug}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>

          <button type="button" className="btn-primary btn-sm" disabled={saving} onClick={() => void submit()}>
            {saving ? "…" : ar() ? "حفظ في الخادم" : "Save to server"}
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o) => (
          <div key={o.id} className={`card-elevated p-4 ${!o.active ? "opacity-70" : ""}`}>
            <div className="flex justify-between gap-2 mb-2">
              <div className="font-bold text-surface-900 line-clamp-2">{o.name}</div>
              <span className="text-[10px] uppercase font-bold text-surface-400 shrink-0">{o.type}</span>
            </div>
            <div className="text-xs text-surface-500 mb-2">{o.category}</div>
            <div className="text-xl font-black text-brand-pink-600 mb-3">{o.subscriptionPriceKwd} KWD</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => patchOffer(o.id, { active: !o.active })}>
                {o.active ? (ar() ? "تعطيل" : "Deactivate") : ar() ? "تفعيل" : "Activate"}
              </button>
              <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => patchOffer(o.id, { featured: !o.featured })}>
                {o.featured ? "Unfeature" : "Feature"}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && !loading && (
          <div className="md:col-span-2 xl:col-span-3 text-center text-surface-400 py-12 card-elevated">
            {ar() ? "لا توجد عروض في قاعدة البيانات" : "No offers in database yet"}
          </div>
        )}
      </div>
    </div>
  );
}
