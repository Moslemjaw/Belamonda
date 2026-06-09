import { useState } from "react";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../app/AuthContext";
import i18n from "../../app/i18n";
import { getCategoryIcon } from "../../components/CategoryIcons";

const ar = () => i18n.language === "ar";

type SessionTypeRow = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  categorySlug: string;
  isActive: boolean;
  tags?: string[];
};

export function SessionTypesAdminPanel() {
  const { getAuthHeader } = useAuth();
  const { data, loading, error, refetch } = useApi<{ items: SessionTypeRow[] }>("/session-types/admin");
  const { data: categoriesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories/admin");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ slug: "", nameEn: "", nameAr: "", categorySlug: "other", tags: "" });

  const save = async () => {
    if (!form.slug.trim() || !form.nameEn.trim() || !form.nameAr.trim()) return;
    setSaving(true);
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim(),
        categorySlug: form.categorySlug,
        tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
        isActive: true
      };

      if (editingId) {
        await apiFetch(`/session-types/admin/${editingId}`, {
          method: "PATCH",
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch("/session-types/admin", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify(payload)
        });
      }
      
      setForm({ slug: "", nameEn: "", nameAr: "", categorySlug: form.categorySlug, tags: "" });
      setEditingId(null);
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (id: string) => {
    if (!confirm(ar() ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete this treatment?")) return;
    try {
      await apiFetch(`/session-types/admin/${id}`, {
        method: "DELETE",
        headers: getAuthHeader()
      });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  const openEdit = (row: SessionTypeRow) => {
    setForm({
      slug: row.slug,
      nameEn: row.nameEn,
      nameAr: row.nameAr,
      categorySlug: row.categorySlug || "other",
      tags: (row.tags || []).join(", ")
    });
    setEditingId(row.id);
    setShowForm(true);
  };

  const toggleActive = async (row: SessionTypeRow) => {
    try {
      await apiFetch(`/session-types/admin/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ isActive: !row.isActive })
      });
      await refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error");
    }
  };

  const categoryItems = categoriesData?.items ?? [];
  const items = data?.items ?? [];
  
  const categoryFilters = [
    ...categoryItems,
    { slug: "other", nameEn: "Uncategorized", nameAr: "غير مصنف" }
  ];

  const filteredItems = filterCategory === "all" 
    ? items 
    : items.filter(row => (row.categorySlug || "other") === filterCategory);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العلاجات / الجلسات" : "Treatments / Session Types"}</h3>
          <p className="text-xs text-surface-500">{ar() ? "إضافة وتفعيل أنواع الجلسات من قاعدة البيانات" : "Create and activate DB-backed session types"}</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setForm({ slug: "", nameEn: "", nameAr: "", categorySlug: "other", tags: "" });
            setShowForm(!showForm);
          }}
          className="btn-primary btn-sm whitespace-nowrap"
        >
          {showForm ? (ar() ? "إغلاق النموذج" : "Close Form") : (ar() ? "+ إضافة علاج جديد" : "+ Add New Treatment")}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {categoryFilters.map((c) => (
          <button
            key={c.slug}
            onClick={() => setFilterCategory(c.slug)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all text-sm ${filterCategory === c.slug ? "bg-brand-pink-500 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
          >
            <span className="w-4 h-4 shrink-0">{getCategoryIcon(c.slug)}</span>
            {ar() ? c.nameAr : c.nameEn}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card-elevated p-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4 animate-in fade-in slide-in-from-top-4">
          <input className="input-field" placeholder={ar() ? "المعرف (Slug)" : "Slug"} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className="input-field" placeholder={ar() ? "الاسم (انجليزي)" : "Name (EN)"} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          <input className="input-field" placeholder={ar() ? "الاسم (عربي)" : "Name (AR)"} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          <select className="select-field" value={form.categorySlug} onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}>
            {categoryItems.map((c) => (
              <option key={c.id} value={c.slug}>{ar() ? c.nameAr : c.nameEn}</option>
            ))}
            <option value="other">{ar() ? "أخرى" : "Other"}</option>
          </select>
          <input className="input-field" placeholder={ar() ? "الكلمات الدالة (مفصولة بفاصلة)" : "Tags (comma separated)"} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          <div className="md:col-span-2 lg:col-span-4 flex gap-2">
            <button type="button" className="btn-primary btn-sm flex-1" onClick={() => { void save(); setShowForm(false); }} disabled={saving}>
              {saving ? "..." : editingId ? (ar() ? "حفظ التعديلات" : "Save Changes") : (ar() ? "إضافة نوع جلسة" : "Add Session Type")}
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => { setEditingId(null); setForm({ slug: "", nameEn: "", nameAr: "", categorySlug: "other", tags: "" }); setShowForm(false); }}>
              {ar() ? "إلغاء" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-surface-500">{ar() ? "جاري التحميل..." : "Loading..."}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((row) => (
          <div key={row.id} className="card-elevated p-4">
            <div className="text-xs font-bold text-surface-400 uppercase">{row.slug}</div>
            <div className="font-bold text-surface-900 mt-1">{ar() ? row.nameAr : row.nameEn}</div>
            <div className="text-xs text-surface-500 mt-1">{ar() ? "الفئة" : "Category"}: {row.categorySlug}</div>
            <div className="text-xs text-surface-500 mt-2">{(row.tags ?? []).join(" • ") || "—"}</div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
              <button type="button" className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 px-3 py-1.5 rounded-lg hover:bg-brand-pink-100 flex-1" onClick={() => openEdit(row)}>
                {ar() ? "تعديل" : "Edit"}
              </button>
              <button type="button" className="text-xs font-bold px-3 py-1.5 rounded-lg flex-1" onClick={() => void toggleActive(row)}>
                {row.isActive ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-lg block">{ar() ? "تعطيل" : "Deactivate"}</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg block">{ar() ? "تفعيل" : "Activate"}</span>}
              </button>
              <button type="button" className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 flex-1" onClick={() => void deleteRow(row.id)}>
                {ar() ? "حذف" : "Delete"}
              </button>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center bg-surface-50 rounded-2xl border border-surface-200">
            <p className="text-surface-500 font-medium mb-4">
              {ar() ? "لا توجد علاجات في هذه الفئة." : "No treatments found in this category."}
            </p>
            <button
              onClick={() => {
                setForm(prev => ({ ...prev, categorySlug: filterCategory === "all" ? "other" : filterCategory }));
                setShowForm(true);
              }}
              className="btn-primary btn-sm inline-flex"
            >
              {ar() ? "+ إضافة علاج جديد" : "+ Add New Treatment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
