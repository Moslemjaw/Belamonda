import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { getCategoryIcon } from "../../../components/CategoryIcons";
import { sharedClinics } from "../../../lib/clinics";
import { ar } from "./shared";

export function SessionsManager() {
  const { getAuthHeader } = useAuth();
  const { data: offeringsData, refetch: refetchOfferings } = useApi<{ items: any[] }>("/session-types/offerings/admin");
  const sessions = offeringsData?.items || [];
  const [showCreate, setShowCreate] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [form, setForm] = useState({ categoryId: "laser", treatmentId: "", clinicId: "", price: "19", cashbackDeduction: "0", schedulingMode: "belamonda_cs" as "belamonda_cs" | "clinic_handles" });
  
  const { data: clinicsData } = useApi<{ clinics: any[] }>("/clinics/admin");
  const { data: categoriesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories/admin");
  const { data: sessionTypesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string; categorySlug?: string }> }>("/session-types/admin");
  const categories = categoriesData?.items || [];
  const sessionTypes = (sessionTypesData?.items || []).filter(t => (t.categorySlug || "other") !== "all");
  const availableTreatments = sessionTypes.filter(t => (t.categorySlug || "other") === form.categoryId);

  /** Format number to KWD string "XX.000" */
  const toKwd = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!n || isNaN(n)) return "0.000";
    return n.toFixed(3);
  };

  const resolveClinicName = (clinicId: string | undefined) => {
    if (!clinicId) return "—";
    const id = String(clinicId);
    const apiHit = (clinicsData?.clinics || []).find((c: any) => String(c.id ?? c._id) === id);
    if (apiHit) {
      return ar() ? (apiHit.nameAr || apiHit.nameEn || id) : (apiHit.nameEn || apiHit.nameAr || id);
    }
    const sharedHit = sharedClinics.find((c) => c.id === id);
    if (sharedHit) {
      return ar() ? (sharedHit.nameAr || sharedHit.nameEn) : (sharedHit.nameEn || sharedHit.nameAr);
    }
    return id;
  };

  const saveSession = async () => {
     if (!form.clinicId || !form.treatmentId) return;
     try {
       // If editing and clinic/treatment changed, delete old offering first
       if (editingSessionId) {
         const oldSession = sessions.find((s: any) => s.id === editingSessionId);
         if (oldSession && (oldSession.clinicId !== form.clinicId || oldSession.sessionTypeId !== form.treatmentId)) {
           await apiFetch(`/session-types/clinic/${oldSession.clinicId}/admin/${editingSessionId}`, {
             method: "DELETE",
             headers: getAuthHeader()
           });
         }
       }
       await apiFetch(`/session-types/clinic/${form.clinicId}/admin`, {
         method: "POST",
         headers: getAuthHeader(),
         body: JSON.stringify({
           sessionTypeId: form.treatmentId,
           priceKwd: toKwd(form.price),
           cashbackDeductionKwd: toKwd(form.cashbackDeduction),
           bookingMode: form.schedulingMode,
           isActive: true
         })
       });
       await refetchOfferings();
       setShowCreate(false);
       setEditingSessionId(null);
     } catch (e: any) {
       alert(e?.message || "Error saving session");
     }
  };

  const deleteSession = async (id: string) => {
     const session = sessions.find((s: any) => s.id === id);
     if (!session) return;
     try {
       await apiFetch(`/session-types/clinic/${session.clinicId}/admin/${id}`, {
         method: "DELETE",
         headers: getAuthHeader()
       });
       await refetchOfferings();
     } catch (e: any) {
       alert(e?.message || "Error deleting session");
     }
  };
  
  const editSession = (session: any) => {
     setForm({
       categoryId: session.categorySlug || "injectables",
       treatmentId: session.sessionTypeId || "",
       clinicId: session.clinicId || "",
       price: String(parseFloat(session.priceKwd) || 0),
       cashbackDeduction: String(parseFloat(session.cashbackDeductionKwd) || 0),
       schedulingMode: session.bookingMode || "belamonda_cs"
     });
     setEditingSessionId(session.id);
     setShowCreate(true);
  };

  // Group sessions by sessionTypeId for display
  const grouped = sessions.reduce((acc: Record<string, any[]>, s: any) => {
    const tid = s.sessionTypeId || s.id;
    if (!acc[tid]) acc[tid] = [];
    acc[tid].push(s);
    return acc;
  }, {});

  const addClinicToTreatment = (treatmentId: string) => {
    const existing = sessions.find((s: any) => s.sessionTypeId === treatmentId);
    if (!existing) return;
    setForm({
      categoryId: existing.categorySlug || "injectables",
      treatmentId: existing.sessionTypeId,
      clinicId: "",
      price: String(parseFloat(existing.priceKwd) || 19),
      cashbackDeduction: String(parseFloat(existing.cashbackDeductionKwd) || 0),
      schedulingMode: existing.bookingMode || "belamonda_cs"
    });
    setEditingSessionId(null);
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة الجلسات المنفردة" : "Standalone Sessions"}</h3>
        <button className="btn-primary btn-sm" onClick={() => { 
            setShowCreate(!showCreate); 
            setEditingSessionId(null); 
            const defaultCategory = categories.find(c => c.slug !== "all")?.slug || "other";
            const firstTreatment = sessionTypes.find(t => (t.categorySlug || "other") === defaultCategory);
            setForm({ categoryId: defaultCategory, treatmentId: firstTreatment?.id || "", clinicId: "", price: "19", cashbackDeduction: "0", schedulingMode: "belamonda_cs" }); 
        }}>+ {ar() ? "إضافة جلسة جديدة" : "Add New Session"}</button>
      </div>

      {showCreate && (
         <div className="card-elevated p-5 animate-slide-up">
           <h4 className="text-sm font-bold text-surface-800 mb-3">{editingSessionId ? (ar() ? "تعديل بيانات العيادة" : "Edit Clinic Entry") : (ar() ? "إضافة جلسة / عيادة جديدة" : "Add New Session / Clinic")}</h4>
           <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "الفئة" : "Category"}</label>
                 <select className="select-field mt-1" value={form.categoryId} onChange={e => {
                    const catId = e.target.value;
                    const firstTreatment = sessionTypes.find(t => (t.categorySlug || "other") === catId);
                    setForm({ ...form, categoryId: catId, treatmentId: firstTreatment?.id || "" });
                 }}>
                    {categories.filter(c => c.slug !== "all").map(c => (
                      <option key={c.id} value={c.slug}>{ar() ? c.nameAr : c.nameEn}</option>
                    ))}
                    <option value="other">{ar() ? "أخرى" : "Other"}</option>
                 </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "نوع العلاج" : "Treatment Type"}</label>
                 <select className="select-field mt-1" value={form.treatmentId} onChange={e => setForm({ ...form, treatmentId: e.target.value })}>
                    <option value="" disabled>{ar() ? "اختر الجلسة" : "Select Treatment"}</option>
                    {availableTreatments.map(t => (
                      <option key={t.id} value={t.id}>{ar() ? t.nameAr : t.nameEn}</option>
                    ))}
                 </select>
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-surface-500">{ar() ? "العيادة" : "Clinic"}</label>
                <select className="select-field mt-1" value={form.clinicId} onChange={e => setForm({ ...form, clinicId: e.target.value })}>
                  <option value="" disabled>{ar() ? "اختر العيادة" : "Select Clinic"}</option>
                  {sharedClinics.map(c => (
                    <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
                  ))}
                  {(clinicsData?.clinics || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nameEn || c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "السعر الأصلي (KWD)" : "Original Price (KWD)"}</label>
                 <input className="input-field mt-1" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "خصم الكاش باك (KWD)" : "Cashback Deduction (KWD)"}</label>
                 <input className="input-field mt-1" type="number" value={form.cashbackDeduction} onChange={e => setForm({ ...form, cashbackDeduction: e.target.value })} />
              </div>
           </div>
                       {/* Scheduling Mode */}
            <div className="mt-4">
               <label className="text-xs font-bold text-surface-700 block mb-2">{ar() ? "طريقة إدارة الحجز" : "Booking Handling Mode"}</label>
               <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.schedulingMode === 'belamonda_cs' ? 'border-brand-pink-500 bg-brand-pink-50' : 'border-surface-200 hover:border-surface-300'}`}>
                     <input type="radio" name="schedMode" value="belamonda_cs" checked={form.schedulingMode === 'belamonda_cs'} onChange={() => setForm({ ...form, schedulingMode: 'belamonda_cs' })} className="mt-1" />
                     <div>
                        <div className="font-bold text-surface-900 text-sm">🎧 {ar() ? "بيلاموندو (خدمة العملاء)" : "Belamonda CS"}</div>
                        <div className="text-xs text-surface-500 mt-0.5">{ar() ? "فريقنا يتولى تنسيق الموعد مع العميل" : "Our team coordinates the appointment"}</div>
                     </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.schedulingMode === 'clinic_handles' ? 'border-emerald-500 bg-emerald-50' : 'border-surface-200 hover:border-surface-300'}`}>
                     <input type="radio" name="schedMode" value="clinic_handles" checked={form.schedulingMode === 'clinic_handles'} onChange={() => setForm({ ...form, schedulingMode: 'clinic_handles' })} className="mt-1" />
                     <div>
                        <div className="font-bold text-surface-900 text-sm">🏥 {ar() ? "العيادة تتولى الجدولة" : "Clinic Handles Scheduling"}</div>
                        <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة ستتواصل مع العميل لتحديد الموعد" : "The clinic contacts the client to schedule"}</div>
                     </div>
                  </label>
               </div>
            </div>
<div className="mt-4 flex gap-2">
             <button className="btn-primary btn-sm" onClick={() => void saveSession()}>{editingSessionId ? (ar() ? "حفظ التغييرات" : "Save Changes") : (ar() ? "حفظ" : "Save")}</button>
             <button className="btn-secondary btn-sm" onClick={() => { setShowCreate(false); setEditingSessionId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
           </div>
         </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {[
          { id: "all", label: ar() ? "الكل" : "All" },
          ...categories.filter(c => c.slug !== "all").map(c => ({ id: c.slug, label: ar() ? c.nameAr : c.nameEn })),
          { id: "other", label: ar() ? "غير مصنف" : "Uncategorized" }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setSessionFilter(f.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all text-sm ${sessionFilter === f.id ? "bg-brand-pink-500 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
          >
            <span className="w-4 h-4 shrink-0">{getCategoryIcon(f.id)}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).filter(([_, items]) => sessionFilter === "all" || items[0].categorySlug === sessionFilter).length === 0 && (
          <div className="card-elevated p-8 text-center text-surface-400">{ar() ? "لا توجد جلسات منفردة" : "No standalone sessions found"}</div>
        )}
        {Object.entries(grouped).filter(([_, items]) => sessionFilter === "all" || items[0].categorySlug === sessionFilter).map(([tid, items]: [string, any[]]) => {
          const first = items[0];
          const tDef = sessionTypes.find(t => t.id === tid);
          const cDef = categories.find(c => c.slug === first.categorySlug);
          const treatmentName = tDef ? (ar() ? tDef.nameAr : tDef.nameEn) : (first.nameEn || first.title);
          const categoryName = cDef ? (ar() ? cDef.nameAr : cDef.nameEn) : first.categorySlug;
          return (
            <div key={tid} className="card-elevated overflow-hidden">
              <div className="bg-surface-50 px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-surface-900 flex items-center gap-2">
                    <span className="w-5 h-5">{getCategoryIcon(first.categorySlug)}</span> {treatmentName}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">{categoryName} • {items.length} {ar() ? "عيادة" : items.length === 1 ? "clinic" : "clinics"}</div>
                </div>
                <button className="btn-sm bg-brand-pink-50 text-brand-pink-600 hover:bg-brand-pink-100 font-bold text-xs rounded-lg px-3 py-1.5" onClick={() => addClinicToTreatment(tid)}>
                  + {ar() ? "إضافة عيادة" : "Add Clinic"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>{ar() ? "العيادة" : "Clinic"}</th><th>{ar() ? "السعر الأصلي" : "Original Price"}</th><th>{ar() ? "خصم الكاش باك" : "Cashback Deduction"}</th><th>{ar() ? "نمط الحجز" : "Booking Mode"}</th><th></th></tr></thead>
                  <tbody>
                    {items.map((s: any) => (
                      <tr key={s.id}>
                        <td className="text-surface-700 font-medium">
                          <span title={s.clinicId}>{resolveClinicName(s.clinicId)}</span>
                        </td>
                        <td className="text-brand-pink-600 font-bold">{s.priceKwd || "0.000"} KWD</td>
                        <td className="text-blue-600 font-bold">{s.cashbackDeductionKwd || "0.000"} KWD</td>
                        <td>
                          {s.bookingMode === 'clinic_handles'
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">🏥 {ar() ? "العيادة تجدول" : "Clinic Schedules"}</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-pink-100 text-brand-pink-700">🎧 {ar() ? "بيلاموندو" : "Belamonda CS"}</span>
                          }
                        </td>
                        <td className="text-right flex gap-2 justify-end">
                          <button className="text-brand-pink-600 hover:text-brand-pink-800 text-sm font-bold bg-brand-pink-50 px-3 py-1 rounded-lg" onClick={() => editSession(s)}>{ar() ? "تعديل" : "Edit"}</button>
                          <button className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 px-3 py-1 rounded-lg" onClick={() => void deleteSession(s.id)}>{ar() ? "حذف" : "Delete"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
