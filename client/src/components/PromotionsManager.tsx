import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import { apiFetch } from "../lib/api";
import { useAuth } from "../app/AuthContext";
import { QRCodeCanvas } from "qrcode.react";
import { SurveyBuilder } from "./SurveyBuilder";
import { SurveySubmissionsModal } from "./SurveySubmissionsModal";
import { SurveyQuestion } from "./SurveyRenderer";

export function PromotionsManager() {
  const { t, i18n } = useTranslation();
  const ar = () => i18n.language === "ar";
  const { getAuthHeader } = useAuth();
  
  const { data: promosData, refetch: refetchPromos } = useApi<{ items: any[] }>("/promotions/admin");
  const { data: offersData } = useApi<{ items: any[] }>("/offers/admin");
  const offers = offersData?.items || [];
  const promos = promosData?.items || [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    slug: "", 
    type: "packages" as "packages" | "survey",
    offerIds: [] as string[],
    surveyQuestions: [] as SurveyQuestion[]
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewingSubmissions, setViewingSubmissions] = useState<{id: string, title: string} | null>(null);

  const SITE_BASE_URL = window.location.origin;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/promotions/admin", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(form)
      });
      setShowForm(false);
      refetchPromos();
      setForm({ title: "", description: "", slug: "", type: "packages", offerIds: [], surveyQuestions: [] });
    } catch (err: any) {
      setError(err.message || "Failed to create promotion");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      await apiFetch(`/promotions/admin/${id}/toggle`, { method: "PATCH", headers: getAuthHeader() });
      refetchPromos();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(ar() ? "هل أنت متأكد من حذف هذا العرض الترويجي؟" : "Are you sure you want to delete this promotion?")) return;
    try {
      await apiFetch(`/promotions/admin/${id}`, { method: "DELETE", headers: getAuthHeader() });
      refetchPromos();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{ar() ? "العروض الترويجية (Promotions)" : "Promotions Manager"}</h2>
          <p className="text-sm text-surface-500 mt-1">{ar() ? "إدارة روابط العروض الخاصة للشركات والجهات الخارجية" : "Manage special promo links and QR codes for external companies"}</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {ar() ? "إنشاء رابط جديد" : "Create Promo Link"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-pink-100">
          <h3 className="text-lg font-bold text-surface-900 mb-4">{ar() ? "رابط ترويجي جديد" : "New Promo Link"}</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "نوع الرابط" : "Promo Type"}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="promoType" 
                      className="w-4 h-4 text-brand-pink-600 focus:ring-brand-pink-500"
                      checked={form.type === "packages"}
                      onChange={() => setForm(p => ({ ...p, type: "packages" }))}
                    />
                    <span className="text-sm font-bold">{ar() ? "بيع باقات" : "Sell Packages"}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="promoType" 
                      className="w-4 h-4 text-brand-pink-600 focus:ring-brand-pink-500"
                      checked={form.type === "survey"}
                      onChange={() => setForm(p => ({ ...p, type: "survey" }))}
                    />
                    <span className="text-sm font-bold">{ar() ? "استبيان وتسجيل بيانات" : "Lead Form / Survey"}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العنوان" : "Title"}</label>
                <input 
                  type="text" 
                  className="input-field w-full" 
                  required 
                  value={form.title} 
                  onChange={e => {
                    const t = e.target.value;
                    const s = t.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                    setForm(p => ({ ...p, title: t, slug: p.slug ? p.slug : s }));
                  }} 
                  placeholder={ar() ? "مثال: عرض البنك الوطني" : "e.g. NBK Summer Offer"} 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "الرابط الفريد (Slug)" : "URL Slug"}</label>
                <div className="flex items-center">
                  <span className="bg-surface-100 text-surface-500 px-3 py-2 text-sm border border-surface-200 border-r-0 rounded-l-lg" dir="ltr">/promo/</span>
                  <input 
                    type="text" 
                    className="input-field w-full rounded-l-none" 
                    required 
                    value={form.slug} 
                    onChange={e => setForm(p => ({ ...p, slug: e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase() }))} 
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "الوصف" : "Description"}</label>
                <textarea 
                  className="input-field w-full" 
                  rows={2} 
                  required 
                  value={form.description} 
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} 
                />
              </div>

              {form.type === "packages" && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "الباقات المشمولة" : "Included Packages"}</label>
                  <div className="max-h-48 overflow-y-auto border border-surface-200 rounded-xl p-2 bg-surface-50 space-y-1">
                    {offers.filter((o: any) => o.status === "active").map((o: any) => (
                      <label key={o._id || o.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-brand-pink-600 rounded" 
                          checked={form.offerIds.includes(o._id || o.id)}
                          onChange={e => {
                            const id = o._id || o.id;
                            if (e.target.checked) setForm(p => ({ ...p, offerIds: [...p.offerIds, id] }));
                            else setForm(p => ({ ...p, offerIds: p.offerIds.filter(x => x !== id) }));
                          }}
                        />
                        <div className="flex-1">
                          <div className="text-sm font-bold text-surface-900">{ar() ? o.nameAr || o.name : o.name}</div>
                          <div className="text-xs text-surface-500">{o.subscriptionPriceKwd} KWD</div>
                        </div>
                      </label>
                    ))}
                    {offers.length === 0 && <div className="p-2 text-sm text-surface-400">No active offers available</div>}
                  </div>
                </div>
              )}

              {form.type === "survey" && (
                <div className="md:col-span-2 border-t border-surface-100 pt-4 mt-2">
                  <label className="block text-sm font-bold text-surface-900 mb-3">{ar() ? "بناء الاستبيان" : "Survey Builder"}</label>
                  <SurveyBuilder 
                    questions={form.surveyQuestions} 
                    onChange={q => setForm(p => ({ ...p, surveyQuestions: q }))} 
                  />
                </div>
              )}
            </div>
            
            {error && <div className="text-xs text-red-600 font-bold">{error}</div>}
            
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">{ar() ? "إلغاء" : "Cancel"}</button>
              <button 
                type="submit" 
                disabled={saving || (form.type === "packages" && form.offerIds.length === 0) || (form.type === "survey" && form.surveyQuestions.length === 0)} 
                className="btn-primary"
              >
                {saving ? "..." : (ar() ? "إنشاء الرابط" : "Create Link")}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {promos.map((p: any) => {
          const link = `${SITE_BASE_URL}/promo/${p.slug}`;
          return (
            <div key={p._id || p.id} className={`card-elevated bg-white rounded-2xl p-5 border-2 ${p.isActive ? "border-brand-pink-200" : "border-surface-200 opacity-75"}`}>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-block px-2 py-0.5 bg-brand-pink-100 text-brand-pink-700 text-[10px] font-bold rounded-md uppercase tracking-wider">
                      {p.type === "survey" ? (ar() ? "استبيان" : "Survey") : (ar() ? "باقات" : "Packages")}
                    </span>
                    <h3 className="text-lg font-black text-surface-900">{p.title}</h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-surface-600 mb-4">{p.description}</p>
                  
                  {p.type === "packages" ? (
                    <div className="space-y-1 mb-4">
                      <div className="text-[10px] font-bold uppercase text-surface-400">{ar() ? "الباقات:" : "Packages:"}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.offerIds?.map((o: any) => (
                          <span key={o._id} className="inline-flex text-[10px] bg-brand-pink-50 text-brand-pink-700 border border-brand-pink-100 px-2 py-0.5 rounded-md font-medium">
                            {ar() ? o.nameAr || o.name : o.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4">
                      <button 
                        onClick={() => setViewingSubmissions({ id: p._id || p.id, title: p.title })} 
                        className="btn-secondary py-1 px-3 text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        {ar() ? "عرض الردود" : "View Submissions"}
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-center gap-2 shrink-0 bg-surface-50 p-2 rounded-xl">
                  <QRCodeCanvas value={link} size={100} className="rounded-lg" />
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand-pink-600 font-bold hover:underline">
                    {ar() ? "فتح الرابط" : "Open Link"}
                  </a>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-surface-100 mt-4 pt-4">
                <div className="flex items-center gap-2 max-w-[60%]">
                  <input type="text" readOnly value={link} className="input-field text-xs py-1.5 px-2 w-full bg-surface-50 text-surface-500" dir="ltr" />
                  <button 
                    onClick={() => navigator.clipboard.writeText(link)} 
                    className="p-1.5 bg-brand-pink-50 text-brand-pink-600 rounded-lg hover:bg-brand-pink-100 shrink-0"
                    title="Copy Link"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleActive(p._id || p.id)} className={`btn-sm ${p.isActive ? "btn-secondary text-amber-600 hover:bg-amber-50" : "btn-secondary text-emerald-600 hover:bg-emerald-50"}`}>
                    {p.isActive ? (ar() ? "تعطيل" : "Disable") : (ar() ? "تفعيل" : "Enable")}
                  </button>
                  <button onClick={() => handleDelete(p._id || p.id)} className="btn-sm btn-secondary text-red-600 hover:bg-red-50">
                    {ar() ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {promos.length === 0 && !showForm && (
          <div className="col-span-full py-12 text-center text-surface-500">
            {ar() ? "لا توجد عروض ترويجية حتى الآن." : "No promotions created yet."}
          </div>
        )}
      </div>

      {viewingSubmissions && (
        <SurveySubmissionsModal 
          promotionId={viewingSubmissions.id} 
          promotionTitle={viewingSubmissions.title} 
          onClose={() => setViewingSubmissions(null)} 
        />
      )}
    </div>
  );
}
