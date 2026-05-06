import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

type SessionTypeRow = {
  id: string;
  categoryId: string;
  categorySlug?: string;
  categoryNameEn?: string;
  categoryNameAr?: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  isActive: boolean;
  tags?: string[];
};

export function TreatmentTypesAdminPanel() {
  const { getAuthHeader } = useAuth();
  const { data, loading, error, refetch } = useApi<{ items: SessionTypeRow[] }>("/session-types/admin");
  const { data: categoriesData } = useApi<{ items: Array<{ id: string; nameEn: string; nameAr: string }> }>("/categories/admin");
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ categoryId: "", slug: "", nameEn: "", nameAr: "", tags: "" });

  const items = data?.items || [];
  const categories = categoriesData?.items || [];

  const create = async () => {
    if (!form.slug.trim() || !form.nameEn.trim() || !form.categoryId) return;
    setSaving(true);
    try {
      await apiFetch("/session-types/admin", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          categoryId: form.categoryId,
          slug: form.slug.trim().toLowerCase(),
          nameEn: form.nameEn.trim(),
          nameAr: form.nameAr.trim() || form.nameEn.trim(),
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          isActive: true
        })
      });
      setForm({ categoryId: "", slug: "", nameEn: "", nameAr: "", tags: "" });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await apiFetch(`/session-types/admin/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: getAuthHeader(),
      body: JSON.stringify({ isActive: !isActive })
    });
    await refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-surface-900">{ar() ? "أنواع العلاجات" : "Treatment Types"}</h3>
          <div className="text-xs text-surface-500 mt-1">
            {ar() ? "إضافة/تفعيل/تعطيل أنواع العلاج وربطها بفئة." : "Create/activate/deactivate treatment types and link them to a category."}
          </div>
        </div>
        <button type="button" className="btn-primary btn-sm" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? (ar() ? "إغلاق" : "Close") : ar() ? "+ نوع علاج جديد" : "+ New treatment"}
        </button>
      </div>
      {loading && <div className="text-sm text-surface-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {showCreate && (
        <div className="card-elevated p-5 space-y-4">
          <div className="font-bold text-surface-900">{ar() ? "نوع علاج جديد" : "New treatment type"}</div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-surface-500">{ar() ? "الفئة" : "Category"}</span>
              <select className="select-field mt-1" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="" disabled>
                  {ar() ? "اختر الفئة" : "Select category"}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {ar() ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-surface-500">Slug</span>
              <input className="input-field mt-1" placeholder="filler-italian" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Name EN</span>
              <input className="input-field mt-1" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-surface-500">Name AR</span>
              <input className="input-field mt-1" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-surface-500">{ar() ? "الوسوم" : "Tags"}</span>
              <input
                className="input-field mt-1"
                placeholder={ar() ? "مثال: laser, beauty" : "e.g. laser, beauty"}
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
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
              <th>{ar() ? "الفئة" : "Category"}</th>
              <th>EN</th>
              <th>AR</th>
              <th>Tags</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td className="font-mono text-xs">{t.slug}</td>
                <td className="text-xs">{ar() ? (t.categoryNameAr || t.categorySlug || t.categoryId) : (t.categoryNameEn || t.categorySlug || t.categoryId)}</td>
                <td>{t.nameEn}</td>
                <td dir="rtl">{t.nameAr}</td>
                <td className="text-xs text-surface-500">{(t.tags || []).join(", ") || "—"}</td>
                <td>
                  <button type="button" className="text-xs font-bold underline" onClick={() => void toggleActive(t.id, t.isActive)}>
                    {t.isActive ? "on" : "off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

