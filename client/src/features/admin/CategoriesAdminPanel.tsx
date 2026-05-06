import { useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import i18n from "../../app/i18n";
import type { ApiOfferRow } from "./OffersAdminPanel";

const ar = () => i18n.language === "ar";

type Cat = { id: string; nameEn: string; nameAr: string; slug: string; isActive: boolean; sortOrder: number };

export function CategoriesAdminPanel() {
  const { getAuthHeader } = useAuth();
  const { data, loading, error, refetch } = useApi<{ items: Cat[] }>("/categories/admin");
  const { data: offersPayload } = useApi<{ items: ApiOfferRow[] }>("/offers/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nameEn: "", nameAr: "", slug: "", sortOrder: 0 });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: relationsData } = useApi<{ offers: Array<{ id: string; name: string; clinicId: string; active: boolean; subscriptionPriceKwd: string }>; sessionTypes: Array<{ id: string; slug: string; nameEn: string; nameAr: string; isActive: boolean }> }>(
    activeCategoryId ? `/categories/admin/${encodeURIComponent(activeCategoryId)}/relations` : null,
    { deps: [activeCategoryId] }
  );

  const items = data?.items ?? [];
  const offers = offersPayload?.items ?? [];

  const offersByCategoryId = useMemo(() => {
    const map = new Map<string, ApiOfferRow[]>();
    for (const o of offers) {
      const ids = (o.categoryIds && o.categoryIds.length) ? o.categoryIds : [];
      for (const id of ids) {
        const prev = map.get(id) ?? [];
        prev.push(o);
        map.set(id, prev);
      }
    }
    // stable-ish sorting
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.name.localeCompare(b.name));
      map.set(k, v);
    }
    return map;
  }, [offers]);

  const create = async () => {
    if (!form.slug.trim() || !form.nameEn.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/categories/admin", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          nameEn: form.nameEn.trim(),
          nameAr: form.nameAr.trim() || form.nameEn.trim(),
          slug: form.slug.trim().toLowerCase(),
          sortOrder: form.sortOrder
        })
      });
      setForm({ nameEn: "", nameAr: "", slug: "", sortOrder: 0 });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (id: string, isActive: boolean) => {
    try {
      await apiFetch(`/categories/admin/${encodeURIComponent(id)}/activation`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ isActive })
      });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  const remove = async (id: string) => {
    if (!confirm(ar() ? "حذف الفئة؟" : "Delete category?")) return;
    try {
      await apiFetch(`/categories/admin/${encodeURIComponent(id)}`, { method: "DELETE", headers: getAuthHeader() });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة الفئات" : "Categories"}</h3>
          <div className="text-xs text-surface-500 mt-1">
            {ar()
              ? "نفس الفئات تظهر في الفلاتر وتُستخدم لتصنيف العروض."
              : "Same categories are used for filters and offer classification."}
          </div>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? (ar() ? "إغلاق" : "Close") : ar() ? "+ فئة جديدة" : "+ New category"}
        </button>
      </div>
      {loading && <div className="text-sm text-surface-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {showCreate && (
        <div className="card-elevated p-5 space-y-4">
          <div className="font-bold text-surface-900">{ar() ? "فئة جديدة" : "New category"}</div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Slug</span>
              <input className="input-field mt-1" placeholder="laser" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Name EN</span>
              <input className="input-field mt-1" placeholder="Laser Services" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Name AR</span>
              <input className="input-field mt-1" placeholder="خدمات الليزر" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">{ar() ? "الترتيب" : "Sort order"}</span>
              <input
                type="number"
                className="input-field mt-1"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </label>
          </div>
          <button type="button" className="btn-primary btn-sm" disabled={saving} onClick={() => void create()}>
            {saving ? "…" : ar() ? "حفظ" : "Save"}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-surface-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>EN</th>
              <th>AR</th>
              <th>Active</th>
              <th>{ar() ? "العروض" : "Offers"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-xs">{c.slug}</td>
                <td>{c.nameEn}</td>
                <td dir="rtl">{c.nameAr}</td>
                <td>
                  <button type="button" className="text-xs font-bold underline" onClick={() => void setActive(c.id, !c.isActive)}>
                    {c.isActive ? "on" : "off"}
                  </button>
                </td>
                <td className="text-xs text-surface-600">
                  {(offersByCategoryId.get(c.id)?.length ?? 0)}
                </td>
                <td>
                  <button type="button" className="text-xs font-bold text-brand-pink-600 mr-3" onClick={() => setActiveCategoryId((prev) => prev === c.id ? null : c.id)}>
                    {activeCategoryId === c.id ? (ar() ? "إخفاء" : "Hide") : (ar() ? "عرض" : "View")}
                  </button>
                  <button type="button" className="text-xs text-red-600 font-bold" onClick={() => void remove(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeCategoryId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveCategoryId(null)} />
          <div className="relative w-full max-w-3xl card-elevated p-6 bg-white max-h-[85vh] overflow-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="font-bold text-surface-900">{ar() ? "علاقات الفئة" : "Category Relations"}</h4>
                <div className="text-xs text-surface-500 mt-1">{ar() ? "العروض + أنواع العلاج المرتبطة بهذه الفئة." : "Offers + treatment types linked to this category."}</div>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setActiveCategoryId(null)}>
                {ar() ? "إغلاق" : "Close"}
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="text-sm font-semibold text-surface-700 mb-2">{ar() ? "العروض المرتبطة" : "Linked Offers"}</div>
                {(relationsData?.offers || []).length === 0 ? (
                  <div className="text-sm text-surface-400">{ar() ? "لا توجد عروض مرتبطة." : "No linked offers."}</div>
                ) : (
                  <div className="space-y-2">
                    {(relationsData?.offers || []).map((o) => (
                      <div key={o.id} className="flex items-center justify-between bg-surface-50 border border-surface-200 rounded-lg px-3 py-2">
                        <div className="font-medium text-surface-800">{o.name}</div>
                        <div className="text-xs text-surface-500">{o.subscriptionPriceKwd} KWD</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold text-surface-700 mb-2">{ar() ? "أنواع العلاج المرتبطة" : "Linked Treatment Types"}</div>
                {(relationsData?.sessionTypes || []).length === 0 ? (
                  <div className="text-sm text-surface-400">{ar() ? "لا توجد أنواع علاج مرتبطة." : "No linked treatment types."}</div>
                ) : (
                  <div className="space-y-2">
                    {(relationsData?.sessionTypes || []).map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-surface-50 border border-surface-200 rounded-lg px-3 py-2">
                        <div className="font-medium text-surface-800">{ar() ? s.nameAr : s.nameEn}</div>
                        <div className={s.isActive ? "badge-green" : "badge-red"}>{s.isActive ? "on" : "off"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
