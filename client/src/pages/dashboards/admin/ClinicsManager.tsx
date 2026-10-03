import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { sharedClinics } from "../../../lib/clinics";
import { ar } from "./shared";

export function ClinicsManager() {
  const { getAuthHeader, impersonateClinic, impersonateUser, login } = useAuth();
  const { data, refetch } = useApi<{ clinics: any[] }>("/clinics/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newClinicId, setNewClinicId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    nameEn: "", 
    nameAr: "",
    address: "", 
    account: "",
    password: "",
    phone: "",
    email: ""
  });

  const apiClinics = data?.clinics || [];
  const allClinics = [...apiClinics];
  sharedClinics.forEach(sc => {
      if (!allClinics.find(c => c.id === sc.id)) {
          allClinics.push({ ...sc, contactPhone: "+965 —", contactEmail: "No Email", account: sc.id });
      }
  });

  const saveClinic = async () => {
    const payload = {
      ...form,
      contactPhone: form.phone,
      contactEmail: form.email
    };
    try {
      if (editingId) {
        await apiFetch(`/clinics/admin/${editingId}`, { method: "PATCH", headers: getAuthHeader(), body: JSON.stringify(payload) });
        setShowCreate(false);
        setEditingId(null);
        refetch();
      } else {
        const res = await apiFetch("/clinics/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ ...payload, active: true }) }) as any;
        setNewClinicId(form.account || "clinic1");
        setShowCreate(false);
        refetch();
      }
    } catch (e: any) {
      alert(e?.message || e?.error || "Error saving clinic. Please check your inputs.");
      refetch();
    }
  };

  const deleteClinic = async (id: string) => {
    if (id.startsWith("clinic_")) {
      alert(ar() ? "هذه عيادة افتراضية (Hardcoded) ولا يمكن حذفها من خلال لوحة التحكم." : "This is a hardcoded demo clinic and cannot be deleted via the dashboard.");
      return;
    }
    if (!confirm(ar() ? "هل أنت متأكد من حذف هذه العيادة؟" : "Are you sure you want to delete this clinic?")) return;
    try {
      await apiFetch(`/clinics/admin/${id}`, { method: "DELETE", headers: getAuthHeader() });
      refetch();
    } catch (e) {
      alert(ar() ? "خطأ في حذف العيادة. ربما تكون مرتبطة ببيانات أخرى." : "Error deleting clinic. It might be linked to other data.");
    }
  };

  const openEdit = (c: any) => {
    setForm({
      nameEn: c.nameEn || "",
      nameAr: c.nameAr || "",
      address: c.address || "",
      account: c.account || "",
      password: "",
      phone: c.contactPhone || c.phone || "",
      email: c.contactEmail || ""
    });
    setEditingId(c.id);
    setShowCreate(true);
    setNewClinicId(null);
  };

  const closeSuccess = () => {
    setNewClinicId(null);
    setForm({ nameEn: "", nameAr: "", address: "", account: "", password: "", phone: "", email: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العيادات" : "Clinic Management"}</h3>
        <button className="btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); setNewClinicId(null); setForm({ nameEn: "", nameAr: "", address: "", account: "", password: "", phone: "", email: "" }); }}>+ {ar() ? "إضافة عيادة جديدة" : "Create New Clinic"}</button>
      </div>

      {newClinicId && (
        <div className="card-elevated p-6 bg-emerald-50 border-emerald-200 animate-slide-up">
          <h4 className="font-bold text-emerald-800 flex items-center gap-2 text-lg">
             <span>✅</span> {ar() ? "تم إنشاء العيادة بنجاح!" : "Clinic Created Successfully!"}
          </h4>
          <p className="text-sm text-emerald-700 mt-2">{ar() ? "الرجاء تزويد العيادة ببيانات الدخول التالية لتمكينهم من إدارة حسابهم:" : "Please provide the clinic with the following login credentials so they can set up their profile:"}</p>
          <div className="mt-4 bg-white p-5 rounded-xl border border-emerald-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <div className="text-xs font-medium text-emerald-600 mb-1">{ar() ? "اسم الحساب (Account)" : "Account / Username"}</div>
                <div className="font-mono font-bold text-lg text-surface-900">{form.account}</div>
             </div>
             <div>
                <div className="text-xs font-medium text-emerald-600 mb-1">{ar() ? "كلمة المرور (Password)" : "Password"}</div>
                <div className="font-mono font-bold text-lg text-surface-900">{form.password}</div>
             </div>
          </div>
          <button className="btn-ghost btn-sm text-emerald-600 mt-4 hover:bg-emerald-100/50" onClick={closeSuccess}>{ar() ? "إغلاق" : "Dismiss"}</button>
        </div>
      )}

      {showCreate && (
        <div className="card-elevated p-6 animate-slide-up">
          <h4 className="font-bold text-surface-900 mb-4">{ar() ? "البيانات الأولية ومعرف الدخول" : "Initial Details & Credentials"}</h4>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم العيادة (EN)" : "Clinic Name (EN)"}</label><input className="input-field" placeholder="e.g. Derma Clinic" value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم العيادة (AR)" : "Clinic Name (AR)"}</label><input className="input-field" placeholder="مثال: عيادة ديرما" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" /></div>
            <div className="md:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "الموقع / المنطقة" : "Location / Area"}</label><input className="input-field" placeholder="Kuwait City, Sharq..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "رقم الهاتف" : "Phone"}</label><input className="input-field" placeholder="+965 ..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "البريد الإلكتروني" : "Email"}</label><input className="input-field" placeholder="clinic@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            
            {!editingId && (
              <>
                <div className="col-span-full mt-2 mb-1 border-t border-surface-100 pt-5"><h5 className="font-bold text-sm text-surface-800">{ar() ? "بيانات الدخول للعيادة" : "Clinic Login Credentials"}</h5></div>
                <div><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم الحساب (للدخول)" : "Account Username"}</label><input className="input-field" placeholder="clinic_username" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} /></div>
                <div><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "كلمة المرور" : "Password"}</label><input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              </>
            )}
          </div>
          
          <div className="flex gap-3 mt-8">
            <button className="btn-primary" onClick={saveClinic} disabled={!form.nameEn || (!editingId && (!form.account || !form.password))}>{editingId ? (ar() ? "تعديل العيادة" : "Update Clinic") : (ar() ? "إنشاء العيادة" : "Create Clinic")}</button>
            <button className="btn-secondary" onClick={() => { setShowCreate(false); setEditingId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
          </div>
        </div>
      )}
      
      {!showCreate && !newClinicId && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allClinics.map((c: any) => (
            <div key={c.id} className="card-elevated p-5 relative overflow-hidden group flex flex-col">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-pink-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform" />
              <div className="text-base font-bold text-surface-900">{c.nameEn || "New Clinic"}</div>
              <div className="text-xs text-surface-500 mt-1">{c.nameAr || "عيادة جديدة"} • {c.address || "No Address"}</div>
              <div className="text-xs text-surface-600 mt-3 flex flex-col gap-1.5 bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> <span dir="ltr">{c.contactPhone || c.phone || "+965 —"}</span></div>
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {c.contactEmail || "No Email"}</div>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-100 flex justify-between items-center mb-4">
                 <div className="text-xs text-surface-500 font-mono bg-surface-100 px-2 py-1 rounded">ID: {c.id}</div>
                 <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100">{ar() ? "نشط" : "Active"}</span>
              </div>
              
              <div className="mt-auto grid grid-cols-3 gap-2">
                 <button className="btn-primary py-2 text-xs w-full flex items-center justify-center gap-1.5 col-span-3" onClick={() => impersonateClinic(c.id).catch(() => login(c.account || c.id, "clinic"))}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    {ar() ? "دخول بصلاحية العيادة" : "Login as Clinic"}
                 </button>
                 <button className="btn-secondary py-2 text-xs w-full bg-white hover:bg-surface-50 border-surface-200 col-span-2" onClick={() => openEdit(c)}>
                    {ar() ? "تعديل" : "Edit Details"}
                 </button>
                 <button className="btn-secondary py-2 text-xs w-full bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => deleteClinic(c.id)}>
                    {ar() ? "حذف" : "Delete"}
                 </button>
              </div>
            </div>
          ))}
          {allClinics.length === 0 && <div className="col-span-full card-elevated p-12 text-center border-dashed border-2 border-surface-200">
            <div className="text-4xl mb-3 opacity-50">🏥</div>
            <div className="text-base font-bold text-surface-900 mb-1">{ar() ? "لا توجد عيادات مسجلة" : "No clinics registered"}</div>
            <div className="text-sm text-surface-400">{ar() ? "قم بإنشاء أول عيادة في المنصة" : "Create the first clinic in the platform"}</div>
          </div>}
        </div>
      )}
    </div>
  );
}
