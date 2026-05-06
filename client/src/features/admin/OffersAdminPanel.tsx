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
  imageUrl?: string;
  isCashbackOnly?: boolean;
  signupCashbackKwd?: string;
  cashbackActivationFeeKwd?: string;
  tagsEn?: string[];
  tagsAr?: string[];
  allowFullPayment?: boolean;
  allowInstallments?: boolean;
  maxInstallments?: number;
  allowDeposit?: boolean;
  depositAmountKwd?: string;
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

  const emptyForm = {
    name: "",
    type: "A" as "A" | "B",
    clinicId: "",
    subscriptionPriceKwd: "99.000",
    validityDays: 365,
    imageUrl: "",
    isCashbackOnly: false,
    signupCashbackKwd: "0.000",
    cashbackActivationFeeKwd: "0.000",
    tagsEn: "",
    tagsAr: "",
    allowFullPayment: true,
    allowInstallments: false,
    maxInstallments: 1,
    allowDeposit: false,
    depositAmountKwd: "0.000",
    cashbackPerSessionKwd: "0.000",
    sessionIntervalDays: 0,
    maxSessions: "",
    featured: false,
    active: true,
    perVisitPriceKwd: "10.000",
    originalClinicPriceKwd: "15.000",
    categoryIds: [] as string[]
  };

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState(emptyForm);

  const toggleCategory = (id: string) => {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((x) => x !== id) : [...f.categoryIds, id]
    }));
  };

  const submit = async () => {
    const clinicId = form.clinicId || clinics[0]?.id;
    if (!clinicId || !form.name.trim()) return;
    if (!form.categoryIds.length) {
      alert(ar() ? "اختر فئة واحدة على الأقل" : "Select at least one category");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.imageUrl.trim() ? form.imageUrl.trim() : "";
      if (imageFile) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/uploads-api/image`, {
          method: "POST",
          headers: getAuthHeader(),
          body: fd
        });
        if (!resp.ok) throw new Error(`Upload failed (${resp.status})`);
        const json = (await resp.json()) as { url?: string };
        if (!json.url) throw new Error("Upload failed");
        imageUrl = json.url;
      }

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        clinicId,
        subscriptionPriceKwd: form.subscriptionPriceKwd,
        validityDays: form.validityDays,
        imageUrl: imageUrl || undefined,
        isCashbackOnly: form.isCashbackOnly,
        signupCashbackKwd: form.signupCashbackKwd,
        cashbackActivationFeeKwd: form.cashbackActivationFeeKwd,
        tagsEn: form.tagsEn
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        tagsAr: form.tagsAr
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        allowFullPayment: form.allowFullPayment,
        allowInstallments: form.allowInstallments,
        maxInstallments: form.maxInstallments,
        allowDeposit: form.allowDeposit,
        depositAmountKwd: form.depositAmountKwd,
        cashbackPerSessionKwd: form.cashbackPerSessionKwd,
        sessionIntervalDays: form.sessionIntervalDays,
        featured: form.featured,
        active: form.active,
        categoryIds: form.categoryIds
      };
      if (form.maxSessions.trim()) body.maxSessions = Number(form.maxSessions);
      if (form.type === "B") {
        body.perVisitPriceKwd = form.perVisitPriceKwd;
        body.originalClinicPriceKwd = form.originalClinicPriceKwd;
      }
      if (editingOfferId) {
        await apiFetch(`/offers/admin/${encodeURIComponent(editingOfferId)}`, {
          method: "PATCH",
          headers: getAuthHeader(),
          body: JSON.stringify(body)
        });
      } else {
        await apiFetch("/offers/admin", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify(body)
        });
      }
      await refetch();
      setShowForm(false);
      setEditingOfferId(null);
      setImageFile(null);
      setForm(emptyForm);
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
        <div>
          <h3 className="text-base font-bold text-surface-900">{ar() ? "العروض" : "Offers"}</h3>
          <div className="text-xs text-surface-500 mt-1">
            {ar() ? "أنشئ وعدّل العروض (الكاش باك + خيارات الدفع) من قاعدة البيانات." : "Create and edit offers (cashback + payment options) in DB."}
          </div>
        </div>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditingOfferId(null);
              setForm(emptyForm);
            } else {
              setEditingOfferId(null);
              setForm(emptyForm);
              setShowForm(true);
            }
          }}
        >
          {showForm ? (ar() ? "إغلاق" : "Close") : ar() ? "+ عرض جديد" : "+ New offer"}
        </button>
      </div>

      {loading && <div className="text-sm text-surface-500">{ar() ? "جاري التحميل…" : "Loading…"}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {showForm && (
        <div className="card-elevated p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-bold text-surface-900">
              {editingOfferId ? (ar() ? "تعديل العرض" : "Edit offer") : ar() ? "عرض جديد" : "New offer"}
            </div>
            {editingOfferId && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setEditingOfferId(null);
                  setForm(emptyForm);
                }}
              >
                {ar() ? "إنشاء جديد" : "Create new"}
              </button>
            )}
          </div>

          <div className="card-elevated p-4 bg-surface-50 border border-surface-100">
            <div className="text-sm font-bold text-surface-900 mb-3">{ar() ? "الفئات" : "Categories"}</div>
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
              <p className="text-xs text-surface-400 mt-2">{ar() ? "لا توجد فئات — أضفها من تبويب الفئات" : "No categories yet — add them in Categories tab."}</p>
            )}
            {categories.length > 0 && form.categoryIds.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">{ar() ? "اختر فئة واحدة على الأقل" : "Pick at least one category"}</p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "الاسم" : "Name"}</span>
              <input className="input-field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "نوع العرض" : "Offer type"}</span>
              <select className="select-field mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "A" | "B" })}>
                <option value="A">{ar() ? "A — باقة/اشتراك" : "A — Package (subscription)"}</option>
                <option value="B">{ar() ? "B — سعر لكل زيارة" : "B — Per-visit pricing"}</option>
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
            <div className="lg:col-span-3 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-surface-500">{ar() ? "صورة العرض" : "Offer image"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="input-field mt-1"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
                <div className="text-[11px] text-surface-500 mt-1">
                  {ar() ? "سيتم رفع الصورة وحفظ رابطها تلقائياً." : "Image uploads to server and is saved automatically."}
                </div>
              </label>
              <div className="rounded-xl border border-surface-200 bg-white p-3 flex items-center gap-3">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-surface-100 border border-surface-200 shrink-0">
                  {(imageFile || form.imageUrl) ? (
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : form.imageUrl}
                      alt="Offer"
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="text-xs text-surface-600">
                  <div className="font-bold text-surface-800">{ar() ? "معاينة" : "Preview"}</div>
                  <div>{imageFile ? imageFile.name : (form.imageUrl ? (ar() ? "محفوظ" : "Saved") : (ar() ? "لا يوجد" : "None"))}</div>
                </div>
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "مدة الصلاحية (أيام)" : "Validity days"}</span>
              <input
                type="number"
                className="input-field mt-1"
                value={form.validityDays}
                onChange={(e) => setForm({ ...form, validityDays: Number(e.target.value) || 1 })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm lg:col-span-3">
              <input type="checkbox" checked={form.isCashbackOnly} onChange={(e) => setForm({ ...form, isCashbackOnly: e.target.checked })} />
              {ar() ? "كاش باك فقط (بدون حجوزات)" : "Cashback-only (card / no sessions)"}
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "كاش باك عند التسجيل (KWD)" : "Signup cashback (KWD)"}</span>
              <input
                className="input-field mt-1"
                value={form.signupCashbackKwd}
                onChange={(e) => setForm({ ...form, signupCashbackKwd: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "رسوم تفعيل الكاش باك (KWD)" : "Cashback activation fee (KWD)"}</span>
              <input
                className="input-field mt-1"
                value={form.cashbackActivationFeeKwd}
                onChange={(e) => setForm({ ...form, cashbackActivationFeeKwd: e.target.value })}
              />
            </label>
            <label className="block lg:col-span-3">
              <span className="text-xs font-medium text-surface-500">{ar() ? "وسوم EN (Comma)" : "Tags EN (comma-separated)"}</span>
              <input className="input-field mt-1" value={form.tagsEn} onChange={(e) => setForm({ ...form, tagsEn: e.target.value })} />
            </label>
            <label className="block lg:col-span-3">
              <span className="text-xs font-medium text-surface-500">{ar() ? "وسوم AR (Comma)" : "Tags AR (comma-separated)"}</span>
              <input className="input-field mt-1" value={form.tagsAr} onChange={(e) => setForm({ ...form, tagsAr: e.target.value })} />
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

          <div className="card-elevated p-4 bg-surface-50 border border-surface-100">
            <div className="text-sm font-bold text-surface-900 mb-3">{ar() ? "خيارات الدفع" : "Payment options"}</div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowFullPayment}
                  onChange={(e) => setForm({ ...form, allowFullPayment: e.target.checked })}
                />
                {ar() ? "دفع كامل" : "Allow full payment"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.allowInstallments}
                  onChange={(e) => setForm({ ...form, allowInstallments: e.target.checked })}
                />
                {ar() ? "أقساط" : "Allow installments"}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-surface-500">{ar() ? "حد الأقساط" : "Max installments"}</span>
                <input
                  type="number"
                  className="input-field mt-1"
                  value={form.maxInstallments}
                  onChange={(e) => setForm({ ...form, maxInstallments: Number(e.target.value) || 1 })}
                  min={1}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.allowDeposit} onChange={(e) => setForm({ ...form, allowDeposit: e.target.checked })} />
                {ar() ? "دفعة مقدمة" : "Allow deposit"}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-surface-500">{ar() ? "قيمة الدفعة (KWD)" : "Deposit amount (KWD)"}</span>
                <input
                  className="input-field mt-1"
                  value={form.depositAmountKwd}
                  onChange={(e) => setForm({ ...form, depositAmountKwd: e.target.value })}
                />
              </label>
            </div>
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
            {(o.tagsEn && o.tagsEn.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {(ar() ? (o.tagsAr || []) : (o.tagsEn || [])).slice(0, 3).map((t) => (
                  <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-100 text-surface-700">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary btn-sm text-xs"
                onClick={() => {
                  setEditingOfferId(o.id);
                  setShowForm(true);
                  setImageFile(null);
                  setForm({
                    ...emptyForm,
                    name: o.name ?? "",
                    type: o.type,
                    clinicId: o.clinicId,
                    subscriptionPriceKwd: o.subscriptionPriceKwd,
                    validityDays: o.validityDays,
                    imageUrl: o.imageUrl ?? "",
                    isCashbackOnly: !!o.isCashbackOnly,
                    signupCashbackKwd: o.signupCashbackKwd ?? "0.000",
                    cashbackActivationFeeKwd: o.cashbackActivationFeeKwd ?? "0.000",
                    tagsEn: (o.tagsEn || []).join(", "),
                    tagsAr: (o.tagsAr || []).join(", "),
                    allowFullPayment: o.allowFullPayment ?? true,
                    allowInstallments: o.allowInstallments ?? false,
                    maxInstallments: o.maxInstallments ?? 1,
                    allowDeposit: o.allowDeposit ?? false,
                    depositAmountKwd: o.depositAmountKwd ?? "0.000",
                    cashbackPerSessionKwd: o.cashbackPerSessionKwd ?? "0.000",
                    sessionIntervalDays: o.sessionIntervalDays ?? 0,
                    maxSessions: o.maxSessions != null ? String(o.maxSessions) : "",
                    featured: !!o.featured,
                    active: !!o.active,
                    perVisitPriceKwd: o.perVisitPriceKwd ?? "10.000",
                    originalClinicPriceKwd: o.originalClinicPriceKwd ?? "15.000",
                    categoryIds: o.categoryIds || []
                  });
                }}
              >
                {ar() ? "تعديل" : "Edit"}
              </button>
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
