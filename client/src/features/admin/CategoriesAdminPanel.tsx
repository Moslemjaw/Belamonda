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
  const [form, setForm] = useState({ nameEn: "", nameAr: "", slug: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);

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
        <div className="text-xs text-surface-500">
          {ar() ? "العروض المرتبطة تظهر تحت كل فئة." : "Linked offers are listed under each category."}
        </div>
      </div>
      {loading && <div className="text-sm text-surface-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="card-elevated p-5 grid gap-3 md:grid-cols-4">
        <input className="input-field" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input className="input-field" placeholder="Name EN" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        <input className="input-field" placeholder="Name AR" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
        <input
          type="number"
          className="input-field"
          placeholder="Sort"
          value={form.sortOrder}
          onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
        />
        <button type="button" className="btn-primary btn-sm md:col-span-4" disabled={saving} onClick={() => void create()}>
          {ar() ? "إضافة" : "Add category"}
        </button>
      </div>

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
                  <button type="button" className="text-xs text-red-600 font-bold" onClick={() => void remove(c.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        {items
          .slice()
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((c) => {
            const linked = offersByCategoryId.get(c.id) ?? [];
            return (
              <div key={c.id} className="card-elevated p-5 bg-white border border-surface-100">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">{c.slug}</div>
                    <div className="font-bold text-surface-900">{ar() ? c.nameAr : c.nameEn}</div>
                  </div>
                  <span className="badge-sage">{linked.length} {ar() ? "عرض" : "offers"}</span>
                </div>
                {linked.length === 0 ? (
                  <div className="text-sm text-surface-400 mt-4">{ar() ? "لا توجد عروض تحت هذه الفئة." : "No offers under this category yet."}</div>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-xl border border-surface-200">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{ar() ? "الاسم" : "Name"}</th>
                          <th>{ar() ? "العيادة" : "Clinic"}</th>
                          <th>{ar() ? "السعر" : "Price"}</th>
                          <th>{ar() ? "مفعل" : "Active"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linked.slice(0, 10).map((o) => (
                          <tr key={o.id}>
                            <td className="font-medium">{o.name}</td>
                            <td className="text-xs text-surface-500">{o.clinicId}</td>
                            <td className="font-bold">{o.subscriptionPriceKwd} KWD</td>
                            <td>
                              <span className={o.active ? "badge-green" : "badge-red"}>{o.active ? "on" : "off"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {linked.length > 10 && (
                      <div className="px-4 py-3 text-xs text-surface-500 bg-surface-50 border-t border-surface-200">
                        {ar() ? "تم عرض 10 فقط." : "Showing first 10 only."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
