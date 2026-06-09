import { Fragment, useMemo, useState } from "react";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import i18n from "../../app/i18n";
type ApiOfferRow = {
  id: string;
  name: string;
  category?: string;
  clinicId: string;
  subscriptionPriceKwd: string;
  active: boolean;
};

const ar = () => i18n.language === "ar";

type Cat = { id: string; nameEn: string; nameAr: string; slug: string; isActive: boolean; sortOrder: number };

export function CategoriesAdminPanel() {
  const { getAuthHeader } = useAuth();
  const { data, loading, error, refetch } = useApi<{ items: Cat[] }>("/categories/admin");
  const { data: offersPayload } = useApi<{ items: ApiOfferRow[] }>("/offers/admin");
  const { data: treatmentsPayload } = useApi<{ items: Array<{ id: string; nameEn: string; nameAr: string; categorySlug: string }> }>("/session-types/admin");
  const [form, setForm] = useState({ nameEn: "", nameAr: "", slug: "", sortOrder: 0 });
  const [saving, setSaving] = useState(false);
  const [detailsOpenFor, setDetailsOpenFor] = useState<string | null>(null);

  const items = data?.items ?? [];
  const offers = offersPayload?.items ?? [];

  const offersByCategorySlug = useMemo(() => {
    const map = new Map<string, ApiOfferRow[]>();
    for (const o of offers) {
      const slug = (o.category ?? "other").toLowerCase();
      const prev = map.get(slug) ?? [];
      prev.push(o);
      map.set(slug, prev);
    }
    for (const [k, v] of map.entries()) {
      v.sort((a, b) => a.name.localeCompare(b.name));
      map.set(k, v);
    }
    return map;
  }, [offers]);
  const treatmentsByCategorySlug = useMemo(() => {
    const map = new Map<string, Array<{ id: string; nameEn: string; nameAr: string; categorySlug: string }>>();
    for (const t of treatmentsPayload?.items ?? []) {
      const slug = (t.categorySlug ?? "other").toLowerCase();
      const prev = map.get(slug) ?? [];
      prev.push(t);
      map.set(slug, prev);
    }
    return map;
  }, [treatmentsPayload]);

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
  const editCategory = async (c: Cat) => {
    const nameEn = prompt("Name EN", c.nameEn) ?? c.nameEn;
    const nameAr = prompt("Name AR", c.nameAr) ?? c.nameAr;
    const slug = (prompt("Slug", c.slug) ?? c.slug).toLowerCase().trim();
    const sortOrder = Number(prompt("Sort Order", String(c.sortOrder)) ?? c.sortOrder);
    try {
      await apiFetch(`/categories/admin/${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ nameEn, nameAr, slug, sortOrder })
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
              <th>{ar() ? "العلاجات" : "Treatments"}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => {
              const linked = offersByCategorySlug.get(c.slug) ?? [];
              const linkedTreatments = treatmentsByCategorySlug.get(c.slug) ?? [];
              const isOpen = detailsOpenFor === c.id;
              return (
                <Fragment key={c.id}>
                  <tr>
                    <td className="font-mono text-xs">{c.slug}</td>
                    <td>{c.nameEn}</td>
                    <td dir="rtl">{c.nameAr}</td>
                    <td>
                      <button type="button" className="text-xs font-bold underline" onClick={() => void setActive(c.id, !c.isActive)}>
                        {c.isActive ? "on" : "off"}
                      </button>
                    </td>
                    <td className="text-xs text-surface-600">{linked.length}</td>
                    <td className="text-xs text-surface-600">{linkedTreatments.length}</td>
                    <td>
                      <button type="button" className="text-xs text-surface-700 font-bold mr-3" onClick={() => setDetailsOpenFor(isOpen ? null : c.id)}>
                        {isOpen ? (ar() ? "إخفاء" : "Hide") : (ar() ? "تفاصيل" : "Details")}
                      </button>
                      <button type="button" className="text-xs text-blue-600 font-bold mr-3" onClick={() => void editCategory(c)}>
                        Edit
                      </button>
                      <button type="button" className="text-xs text-red-600 font-bold" onClick={() => void remove(c.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="m-3 overflow-hidden rounded-xl border border-surface-200">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>{ar() ? "الاسم" : "Name"}</th>
                                <th>{ar() ? "النوع" : "Type"}</th>
                                <th>{ar() ? "تفاصيل" : "Details"}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {linked.slice(0, 10).map((o) => (
                                <tr key={`offer_${o.id}`}>
                                  <td className="font-medium">{o.name}</td>
                                  <td><span className="badge-sage">{ar() ? "عرض" : "Offer"}</span></td>
                                  <td className="text-xs text-surface-500">{o.subscriptionPriceKwd} KWD • {o.clinicId}</td>
                                </tr>
                              ))}
                              {linkedTreatments.slice(0, 10).map((t) => (
                                <tr key={`treatment_${t.id}`}>
                                  <td className="font-medium">{ar() ? t.nameAr : t.nameEn}</td>
                                  <td><span className="badge-blue">{ar() ? "علاج" : "Treatment"}</span></td>
                                  <td className="text-xs text-surface-500">{t.categorySlug}</td>
                                </tr>
                              ))}
                              {linked.length === 0 && linkedTreatments.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="text-sm text-surface-400 py-4 text-center">
                                    {ar() ? "لا توجد عروض أو علاجات تحت هذه الفئة." : "No offers or treatments under this category yet."}
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      
    </div>
  );
}
