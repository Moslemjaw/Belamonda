import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useApi, useKycQueue, usePendingPayments, useComplaints, useProducts, useFinanceSnapshot } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { allTreatments, treatmentCategories } from "../../lib/treatments";
import { OfferTemplate, getOfferTemplates, saveOfferTemplates, upsertOfferTemplate, deleteOfferTemplate, seedDefaultOffers, getSubscriptions } from "../../lib/offerSystem";
import { sharedClinics } from "../../lib/clinics";

const ar = () => i18n.language === "ar";

function KpiCard({ label, value, sub, icon, isHighlighted, trend }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; isHighlighted?: boolean; trend?: string }) {
  return (
    <div className={`card-elevated p-6 flex flex-col justify-between relative overflow-hidden group ${isHighlighted ? 'bg-gradient-to-br from-brand-pink-500 to-brand-pink-700 text-white border-none shadow-brand-pink-500/30 shadow-lg' : 'bg-white'}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-10 transition-transform duration-500 group-hover:scale-110 ${isHighlighted ? 'bg-white/10' : 'bg-brand-pink-50/50'}`} />
      <div className="flex justify-between items-start mb-6">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm backdrop-blur-md ${isHighlighted ? 'bg-white/20 text-white' : 'bg-brand-pink-50 text-brand-pink-600 border border-brand-pink-100'}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg ${isHighlighted ? 'bg-white/20 text-white' : 'text-emerald-600 bg-emerald-50'}`}>
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
             {trend}
          </div>
        )}
      </div>
      <div>
        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isHighlighted ? 'text-brand-pink-100' : 'text-surface-500'}`}>{label}</div>
        <div className={`text-4xl font-black ${isHighlighted ? 'text-white' : 'text-surface-900'}`}>{value}</div>
        {sub && <div className={`text-sm font-medium mt-1 ${isHighlighted ? 'text-brand-pink-200' : 'text-surface-400'}`}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Sub-pages ──
function OffersManager() {
  const { data: clinicsData } = useApi<{ clinics: any[] }>("/clinics/admin");
  const [offers, setOffers] = useState<OfferTemplate[]>(() => { seedDefaultOffers(); return getOfferTemplates(); });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emptyForm = { nameEn: "", nameAr: "", category: "laser", price: "99", validityDays: "365", maxSessions: "6", unlimitedSessions: false, sessionIntervalDays: "25", imageUrl: "", signupCashback: "0", perSessionCashback: "0", cashbackActivationFee: "0", allowFullPayment: true, allowInstallments: false, maxInstallments: "4", allowDeposit: false, depositAmount: "0", tagsEn: "", tagsAr: "", isCashbackOnly: false };
  const [form, setForm] = useState(emptyForm);

  const refresh = () => setOffers(getOfferTemplates());

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (o: OfferTemplate) => {
    setForm({ nameEn: o.nameEn, nameAr: o.nameAr, category: o.category, price: String(o.price), validityDays: String(o.validityDays), maxSessions: o.maxSessions ? String(o.maxSessions) : "0", unlimitedSessions: o.maxSessions === null, sessionIntervalDays: String(o.sessionIntervalDays), imageUrl: o.imageUrl, signupCashback: String(o.signupCashback), perSessionCashback: String(o.perSessionCashback), cashbackActivationFee: String(o.cashbackActivationFee), allowFullPayment: o.allowFullPayment, allowInstallments: o.allowInstallments, maxInstallments: String(o.maxInstallments), allowDeposit: o.allowDeposit, depositAmount: String(o.depositAmount), tagsEn: o.tagsEn.join(", "), tagsAr: o.tagsAr.join(", "), isCashbackOnly: o.isCashbackOnly || false });
    setEditingId(o.id); setShowForm(true);
  };

  const saveOffer = () => {
    if (!form.nameEn) return;
    const offer: OfferTemplate = {
      id: editingId || `offer_${Date.now()}`, nameEn: form.nameEn, nameAr: form.nameAr || form.nameEn, category: form.category, price: parseFloat(form.price) || 0, validityDays: parseInt(form.validityDays) || 365, maxSessions: form.unlimitedSessions ? null : (parseInt(form.maxSessions) || 6), sessionIntervalDays: parseInt(form.sessionIntervalDays) || 25, imageUrl: form.imageUrl,
      signupCashback: parseFloat(form.signupCashback) || 0, perSessionCashback: parseFloat(form.perSessionCashback) || 0, cashbackActivationFee: parseFloat(form.cashbackActivationFee) || 0,
      allowFullPayment: form.allowFullPayment, allowInstallments: form.allowInstallments, maxInstallments: parseInt(form.maxInstallments) || 4, allowDeposit: form.allowDeposit, depositAmount: parseFloat(form.depositAmount) || 0,
      tagsEn: form.tagsEn.split(",").map(s => s.trim()).filter(Boolean), tagsAr: form.tagsAr.split(",").map(s => s.trim()).filter(Boolean),
      isCashbackOnly: form.isCashbackOnly,
      active: true, createdAt: editingId ? (offers.find(o => o.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };
    upsertOfferTemplate(offer); refresh(); setShowForm(false); setEditingId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onloadend = () => setForm({ ...form, imageUrl: r.result as string }); r.readAsDataURL(file); } };
  const toggleActive = (o: OfferTemplate) => { upsertOfferTemplate({ ...o, active: !o.active }); refresh(); };
  const handleDelete = (id: string) => { deleteOfferTemplate(id); refresh(); };
  const subs = getSubscriptions();

  const F = (label: string, children: React.ReactNode, span?: string) => <div className={span || ""}><label className="text-xs font-medium text-surface-500 mb-1 block">{label}</label>{children}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العروض" : "Offer Management"}</h3>
        <button className="btn-primary btn-sm" onClick={openCreate}>+ {ar() ? "إنشاء عرض" : "Create Offer"}</button>
      </div>

      {showForm && (
        <div className="card-elevated p-5 animate-slide-up">
          <h4 className="text-sm font-bold text-surface-800 mb-4">{editingId ? (ar() ? "تعديل العرض" : "Edit Offer") : (ar() ? "إنشاء عرض جديد" : "Create New Offer")}</h4>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {F(ar() ? "اسم العرض (EN)" : "Offer Name (EN)", <input className="input-field" value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} />)}
            {F(ar() ? "اسم العرض (AR)" : "Offer Name (AR)", <input className="input-field" dir="rtl" value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} />)}
            {F(ar() ? "الفئات المشمولة" : "Included Categories", (
              <div className="border border-surface-200 rounded-lg p-3 max-h-40 overflow-y-auto bg-surface-50 flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded-lg border border-surface-200 shadow-sm w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.5rem)]">
                  <input type="checkbox" className="accent-brand-pink-500 w-4 h-4 rounded" checked={form.category === "all"} onChange={e => setForm({...form, category: e.target.checked ? "all" : ""})} />
                  <span className="font-medium">🌟 {ar() ? "جميع الفئات" : "All Categories"}</span>
                </label>
                {treatmentCategories.map(c => (
                  <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded-lg border border-surface-200 shadow-sm w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.5rem)] ${form.category === "all" ? "opacity-50 pointer-events-none grayscale" : ""}`}>
                    <input type="checkbox" className="accent-brand-pink-500 w-4 h-4 rounded" 
                           checked={form.category !== "all" && form.category.split(',').includes(c.id)}
                           onChange={e => {
                              if (form.category === "all") return;
                              let arr = form.category ? form.category.split(',').filter(Boolean) : [];
                              if (e.target.checked) arr.push(c.id); else arr = arr.filter(x => x !== c.id);
                              setForm({...form, category: arr.join(',')});
                           }} />
                    <span className="font-medium">{c.icon} {ar() ? c.nameAr : c.nameEn}</span>
                  </label>
                ))}
              </div>
            ), "md:col-span-3 lg:col-span-4")}
            {F(ar() ? "السعر (KWD)" : "Price (KWD)", <input className="input-field" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />)}
            {F(ar() ? "المدة (أيام)" : "Validity (days)", <input className="input-field" type="number" value={form.validityDays} onChange={e => setForm({...form, validityDays: e.target.value})} />)}
            {F(ar() ? "الجلسات" : "Max Sessions", <div className="flex items-center gap-2"><input className="input-field flex-1" type="number" value={form.maxSessions} onChange={e => setForm({...form, maxSessions: e.target.value})} disabled={form.unlimitedSessions} /><label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={form.unlimitedSessions} onChange={e => setForm({...form, unlimitedSessions: e.target.checked})} />{ar() ? "غير محدود" : "Unlimited"}</label></div>)}
            {F(ar() ? "فترة الانتظار (أيام)" : "Interval (days)", <input className="input-field" type="number" value={form.sessionIntervalDays} onChange={e => setForm({...form, sessionIntervalDays: e.target.value})} />)}
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="text-sm font-bold text-surface-800 mb-3">{ar() ? "قواعد الكاش باك" : "Cashback Rules"}</h5>
            <div className="grid gap-4 md:grid-cols-3">
              {F(ar() ? "كاش باك عند الاشتراك (KWD)" : "Signup Cashback (KWD)", <input className="input-field" type="number" value={form.signupCashback} onChange={e => setForm({...form, signupCashback: e.target.value})} />)}
              {F(ar() ? "خصم كاش باك لكل جلسة (KWD)" : "Per-Session Cashback (KWD)", <input className="input-field" type="number" value={form.perSessionCashback} onChange={e => setForm({...form, perSessionCashback: e.target.value})} />)}
              {F(ar() ? "رسوم تفعيل الكاش باك (KWD)" : "Cashback Activation Fee (KWD)", <input className="input-field" type="number" value={form.cashbackActivationFee} onChange={e => setForm({...form, cashbackActivationFee: e.target.value})} />)}
            </div>
            <div className="mt-4">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.isCashbackOnly ? 'border-emerald-500 bg-emerald-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                <input type="checkbox" checked={form.isCashbackOnly} onChange={e => setForm({...form, isCashbackOnly: e.target.checked})} className="accent-emerald-500 w-4 h-4" />
                <div>
                  <span className="font-bold text-sm text-surface-900">{ar() ? "كاش باك فقط (بدون حجز مواعيد)" : "Cashback Only (No Appointment Booking)"}</span>
                  <p className="text-xs text-surface-500 mt-0.5">{ar() ? "هذا العرض للكاش باك فقط ولا يتطلب حجز جلسات أو مواعيد" : "This offer is for cashback only — no sessions or appointments needed"}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="text-sm font-bold text-surface-800 mb-3">{ar() ? "خيارات الدفع" : "Payment Options"}</h5>
            <div className="grid gap-4 md:grid-cols-3">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${form.allowFullPayment ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}><input type="checkbox" checked={form.allowFullPayment} onChange={e => setForm({...form, allowFullPayment: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "دفع كامل" : "Full Payment"}</span></label>
              <div className={`p-3 rounded-xl border-2 ${form.allowInstallments ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.allowInstallments} onChange={e => setForm({...form, allowInstallments: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "أقساط" : "Installments"}</span></label>
                {form.allowInstallments && <input className="input-field mt-2" type="number" placeholder="Max installments" value={form.maxInstallments} onChange={e => setForm({...form, maxInstallments: e.target.value})} />}
              </div>
              <div className={`p-3 rounded-xl border-2 ${form.allowDeposit ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={form.allowDeposit} onChange={e => setForm({...form, allowDeposit: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "عربون" : "Deposit"}</span></label>
                {form.allowDeposit && <input className="input-field mt-2" type="number" placeholder="Deposit KWD" value={form.depositAmount} onChange={e => setForm({...form, depositAmount: e.target.value})} />}
              </div>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="text-sm font-bold text-surface-800 mb-3">{ar() ? "علامات العرض" : "Display Tags"}</h5>
            <div className="grid gap-4 md:grid-cols-2">
              {F("Tags (EN) — comma separated", <input className="input-field" value={form.tagsEn} onChange={e => setForm({...form, tagsEn: e.target.value})} placeholder="e.g. 1 Year, 500 KWD Cashback" />)}
              {F("Tags (AR) — comma separated", <input className="input-field" dir="rtl" value={form.tagsAr} onChange={e => setForm({...form, tagsAr: e.target.value})} placeholder="مثال: سنة واحدة, كاش باك 500 دك" />)}
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "صورة العرض" : "Offer Image"}</label>
            <div className="border-2 border-dashed border-surface-200 rounded-xl p-4 flex items-center justify-center bg-surface-50 relative group hover:border-brand-pink-300 min-h-[100px]">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-24 rounded-lg object-cover" /> : <span className="text-sm text-surface-400">{ar() ? "اضغط لرفع صورة" : "Click to upload"}</span>}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn-primary btn-sm" onClick={saveOffer}>{editingId ? (ar() ? "حفظ التغييرات" : "Save Changes") : (ar() ? "إنشاء" : "Create")}</button>
            <button className="btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditingId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
          </div>
        </div>
      )}

      {/* Offer Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map(o => {
          const enrolled = subs.filter(s => s.offerId === o.id).length;
          const isExpanded = expandedId === o.id;
          const displayTitle = ar() ? o.nameAr : o.nameEn;
          const cats = o.category === "all" ? [] : o.category.split(',');
          const categoryName = o.category === "all" ? (ar() ? "جميع الفئات" : "All Categories") : cats.map(c => {
            const cDef = treatmentCategories.find(tc => tc.id === c);
            return cDef ? (ar() ? cDef.nameAr : cDef.nameEn) : c;
          }).join(' • ');
          const firstDef = treatmentCategories.find(tc => tc.id === cats[0]);
          const catIcon = o.category === "all" ? "🌟" : (firstDef?.icon || "✨");
          return (
            <div key={o.id} className={`card-elevated p-0 overflow-hidden ${!o.active ? 'opacity-60 grayscale' : ''}`}>
              {o.imageUrl && <div className="h-32 w-full relative"><img src={o.imageUrl} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /></div>}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="font-bold text-surface-900 truncate" title={displayTitle}>{displayTitle}</h4>
                    <div className="text-xs text-surface-500 mt-0.5 line-clamp-1" title={categoryName}>{catIcon} {categoryName} • {o.validityDays} {ar() ? "يوم" : "days"} • {o.maxSessions === null ? (ar() ? "غير محدود" : "Unlimited") : `${o.maxSessions} sessions`}</div>
                  </div>
                  <span className={o.active ? "badge-green shrink-0" : "badge-gray shrink-0"}>{o.active ? (ar() ? "نشط" : "Active") : (ar() ? "متوقف" : "Inactive")}</span>
                </div>
                <div className="text-2xl font-black text-brand-pink-600 mb-3">{o.price} <span className="text-sm text-surface-400 font-medium">KWD</span></div>
                
                {/* Cashback summary */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {o.isCashbackOnly && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">💳 {ar() ? "كاش باك فقط" : "Cashback Only"}</span>}
                  {o.signupCashback > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">💰 {o.signupCashback} KWD {ar() ? "كاش باك" : "signup CB"}</span>}
                  {o.perSessionCashback > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">🔄 {o.perSessionCashback} KWD/{ar() ? "جلسة" : "session"}</span>}
                  {o.cashbackActivationFee > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700">🔑 +{o.cashbackActivationFee} KWD {ar() ? "تفعيل" : "activation"}</span>}
                </div>

                <div className="text-xs text-surface-500 mb-3">{enrolled} {ar() ? "مشترك" : "enrolled"} • {o.sessionIntervalDays}d {ar() ? "انتظار" : "interval"}</div>

                {/* Expandable details */}
                {isExpanded && (
                  <div className="border-t border-surface-100 pt-3 mt-2 space-y-2 text-xs animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface-50 p-2 rounded-lg"><span className="text-surface-400">{ar() ? "دفع كامل" : "Full Pay"}</span><div className="font-bold">{o.allowFullPayment ? "✓" : "✗"}</div></div>
                      <div className="bg-surface-50 p-2 rounded-lg"><span className="text-surface-400">{ar() ? "أقساط" : "Installments"}</span><div className="font-bold">{o.allowInstallments ? `✓ (${o.maxInstallments})` : "✗"}</div></div>
                      <div className="bg-surface-50 p-2 rounded-lg"><span className="text-surface-400">{ar() ? "عربون" : "Deposit"}</span><div className="font-bold">{o.allowDeposit ? `✓ (${o.depositAmount} KWD)` : "✗"}</div></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">{(ar() ? o.tagsAr : o.tagsEn).map(t => <span key={t} className="bg-surface-100 text-surface-600 text-[9px] uppercase font-bold px-2 py-0.5 rounded">{t}</span>)}</div>
                  </div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
                  <button className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 px-3 py-1.5 rounded-lg hover:bg-brand-pink-100" onClick={() => openEdit(o)}>{ar() ? "تعديل" : "Edit"}</button>
                  <button className="text-xs font-bold text-surface-500 bg-surface-100 px-3 py-1.5 rounded-lg hover:bg-surface-200" onClick={() => setExpandedId(isExpanded ? null : o.id)}>{isExpanded ? (ar() ? "إخفاء" : "Less") : (ar() ? "تفاصيل" : "Details")}</button>
                  <button className="text-xs font-bold px-3 py-1.5 rounded-lg ml-auto" onClick={() => toggleActive(o)}>{o.active ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">{ar() ? "إيقاف" : "Deactivate"}</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{ar() ? "تفعيل" : "Activate"}</span>}</button>
                  <button className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100" onClick={() => handleDelete(o.id)}>{ar() ? "حذف" : "Delete"}</button>
                </div>
              </div>
            </div>
          );
        })}
        {offers.length === 0 && <div className="md:col-span-3 text-center text-surface-400 py-12 card-elevated">{ar() ? "لا توجد عروض" : "No offers yet"}</div>}
      </div>
    </div>
  );
}

function SessionsManager() {
  const [sessions, setSessions] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('demo_standalone_sessions_v6');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length > 0) return parsed;
      }
      const defaults = allTreatments.map(t => {
        const cat = treatmentCategories.find(c => c.id === t.category);
        return {
          id: `sess_${t.id}`,
          title: ar() ? t.nameAr : t.nameEn,
          icon: cat?.icon || "✨",
          categoryId: t.category,
          treatmentId: t.id,
          clinicId: "clinic_qibla",
          price: t.category === "injectables" ? 150 : t.category === "laser" ? 60 : 90,
          cashbackDeduction: t.category === "injectables" ? 50 : 20
        };
      });
      localStorage.setItem('demo_standalone_sessions_v6', JSON.stringify(defaults));
      return defaults;
    } catch(e) { return []; }
  });
  const [showCreate, setShowCreate] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [form, setForm] = useState({ categoryId: "injectables", treatmentId: "", clinicId: "", price: "19", cashbackDeduction: "0" });
  
  const { data: clinicsData } = useApi<{ clinics: any[] }>("/clinics/admin");

  const availableTreatments = allTreatments.filter(t => t.category === form.categoryId);

  const saveSession = () => {
     if (!form.clinicId || !form.treatmentId) return;
     const treatment = allTreatments.find(t => t.id === form.treatmentId);
     const category = treatmentCategories.find(c => c.id === form.categoryId);
     if (!treatment || !category) return;

     const newSession = { 
        id: editingSessionId || `sess_${Date.now()}`, 
        title: ar() ? treatment.nameAr : treatment.nameEn, 
        icon: category.icon, 
        categoryId: form.categoryId,
        treatmentId: form.treatmentId,
        clinicId: form.clinicId, 
        price: parseFloat(form.price) || 0,
        cashbackDeduction: parseFloat(form.cashbackDeduction) || 0
     };

     let updated;
     if (editingSessionId) {
        updated = sessions.map(s => s.id === editingSessionId ? newSession : s);
     } else {
        updated = [...sessions, newSession];
     }
     setSessions(updated);
     localStorage.setItem('demo_standalone_sessions_v6', JSON.stringify(updated));
     setShowCreate(false);
     setEditingSessionId(null);
  };

  const deleteSession = (id: string) => {
     const updated = sessions.filter(s => s.id !== id);
     setSessions(updated);
     localStorage.setItem('demo_standalone_sessions_v6', JSON.stringify(updated));
  };
  
  const editSession = (session: any) => {
     setForm({
       categoryId: session.categoryId || "injectables",
       treatmentId: session.treatmentId || "",
       clinicId: session.clinicId || "",
       price: String(session.price),
       cashbackDeduction: String(session.cashbackDeduction || 0)
     });
     setEditingSessionId(session.id);
     setShowCreate(true);
  };

  // Group sessions by treatmentId for display
  const grouped = sessions.reduce((acc: Record<string, any[]>, s: any) => {
    const tid = s.treatmentId || s.id;
    if (!acc[tid]) acc[tid] = [];
    acc[tid].push(s);
    return acc;
  }, {});

  const addClinicToTreatment = (treatmentId: string) => {
    const existing = sessions.find((s: any) => s.treatmentId === treatmentId);
    if (!existing) return;
    setForm({
      categoryId: existing.categoryId || "injectables",
      treatmentId: existing.treatmentId,
      clinicId: "",
      price: "19",
      cashbackDeduction: "0"
    });
    setEditingSessionId(null);
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة الجلسات المنفردة" : "Standalone Sessions"}</h3>
        <button className="btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setEditingSessionId(null); setForm({ categoryId: "injectables", treatmentId: "", clinicId: "", price: "19", cashbackDeduction: "0" }); }}>+ {ar() ? "إضافة جلسة جديدة" : "Add New Session"}</button>
      </div>

      {showCreate && (
         <div className="card-elevated p-5 animate-slide-up">
           <h4 className="text-sm font-bold text-surface-800 mb-3">{editingSessionId ? (ar() ? "تعديل بيانات العيادة" : "Edit Clinic Entry") : (ar() ? "إضافة جلسة / عيادة جديدة" : "Add New Session / Clinic")}</h4>
           <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "الفئة" : "Category"}</label>
                 <select className="select-field mt-1" value={form.categoryId} onChange={e => {
                    const catId = e.target.value;
                    const firstTreatment = allTreatments.find(t => t.category === catId);
                    setForm({ ...form, categoryId: catId, treatmentId: firstTreatment?.id || "" });
                 }}>
                    {treatmentCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {ar() ? c.nameAr : c.nameEn}</option>
                    ))}
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
           <div className="mt-4 flex gap-2">
             <button className="btn-primary btn-sm" onClick={saveSession}>{editingSessionId ? (ar() ? "حفظ التغييرات" : "Save Changes") : (ar() ? "حفظ" : "Save")}</button>
             <button className="btn-secondary btn-sm" onClick={() => { setShowCreate(false); setEditingSessionId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
           </div>
         </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {[
          { id: "all", icon: "✨", label: ar() ? "الكل" : "All" },
          ...treatmentCategories.map(c => ({ id: c.id, icon: c.icon, label: ar() ? c.nameAr : c.nameEn }))
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setSessionFilter(f.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap text-xs font-bold transition-all ${sessionFilter === f.id ? "bg-surface-900 text-white shadow-md" : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).filter(([_, items]) => sessionFilter === "all" || items[0].categoryId === sessionFilter).length === 0 && (
          <div className="card-elevated p-8 text-center text-surface-400">{ar() ? "لا توجد جلسات منفردة" : "No standalone sessions found"}</div>
        )}
        {Object.entries(grouped).filter(([_, items]) => sessionFilter === "all" || items[0].categoryId === sessionFilter).map(([tid, items]: [string, any[]]) => {
          const first = items[0];
          const tDef = allTreatments.find(t => t.id === tid);
          const cDef = treatmentCategories.find(c => c.id === first.categoryId);
          const treatmentName = tDef ? (ar() ? tDef.nameAr : tDef.nameEn) : first.title;
          const categoryName = cDef ? (ar() ? cDef.nameAr : cDef.nameEn) : first.categoryId;
          return (
            <div key={tid} className="card-elevated overflow-hidden">
              <div className="bg-surface-50 px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-surface-900 flex items-center gap-2">
                    <span className="text-lg">{first.icon}</span> {treatmentName}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">{categoryName} • {items.length} {ar() ? "عيادة" : items.length === 1 ? "clinic" : "clinics"}</div>
                </div>
                <button className="btn-sm bg-brand-pink-50 text-brand-pink-600 hover:bg-brand-pink-100 font-bold text-xs rounded-lg px-3 py-1.5" onClick={() => addClinicToTreatment(tid)}>
                  + {ar() ? "إضافة عيادة" : "Add Clinic"}
                </button>
              </div>
              <table className="data-table">
                <thead><tr><th>{ar() ? "العيادة" : "Clinic"}</th><th>{ar() ? "السعر الأصلي" : "Original Price"}</th><th>{ar() ? "خصم الكاش باك" : "Cashback Deduction"}</th><th></th></tr></thead>
                <tbody>
                  {items.map((s: any) => (
                    <tr key={s.id}>
                      <td className="text-surface-700 font-medium">{s.clinicId}</td>
                      <td className="text-brand-pink-600 font-bold">{s.price} KWD</td>
                      <td className="text-blue-600 font-bold">{s.cashbackDeduction || 0} KWD</td>
                      <td className="text-right flex gap-2 justify-end">
                        <button className="text-brand-pink-600 hover:text-brand-pink-800 text-sm font-bold bg-brand-pink-50 px-3 py-1 rounded-lg" onClick={() => editSession(s)}>{ar() ? "تعديل" : "Edit"}</button>
                        <button className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 px-3 py-1 rounded-lg" onClick={() => deleteSession(s.id)}>{ar() ? "حذف" : "Delete"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClinicsManager() {
  const { getAuthHeader, login } = useAuth();
  const { data, refetch } = useApi<{ clinics: any[] }>("/clinics/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [newClinicId, setNewClinicId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    nameEn: "", 
    address: "", 
    account: "",
    password: ""
  });

  const apiClinics = data?.clinics || [];
  const allClinics = [...apiClinics];
  sharedClinics.forEach(sc => {
      if (!allClinics.find(c => c.id === sc.id)) {
          allClinics.push({ ...sc, contactPhone: "+965 —", contactEmail: "No Email", account: sc.id });
      }
  });

  const createClinic = async () => {
    try {
      const res = await apiFetch("/clinics/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ ...form, active: true }) }) as any;
      setNewClinicId(form.account || "clinic1"); // Use the requested account name
      setShowCreate(false);
      
      // Keep password around for display
      // We don't reset the form yet so the success screen can show the account/password
      refetch();
    } catch (e: any) {
      setNewClinicId(form.account || "clinic1");
      setShowCreate(false);
      refetch();
    }
  };

  const closeSuccess = () => {
    setNewClinicId(null);
    setForm({ nameEn: "", address: "", account: "", password: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العيادات" : "Clinic Management"}</h3>
        <button className="btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setNewClinicId(null); }}>+ {ar() ? "إضافة عيادة جديدة" : "Create New Clinic"}</button>
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
            <div className="md:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم العيادة" : "Clinic Name"}</label><input className="input-field" placeholder="e.g. Derma Clinic" value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "الموقع / المنطقة" : "Location / Area"}</label><input className="input-field" placeholder="Kuwait City, Sharq..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            
            <div className="col-span-full mt-2 mb-1 border-t border-surface-100 pt-5"><h5 className="font-bold text-sm text-surface-800">{ar() ? "بيانات الدخول للعيادة" : "Clinic Login Credentials"}</h5></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم الحساب (للدخول)" : "Account Username"}</label><input className="input-field" placeholder="clinic_username" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} /></div>
            <div><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "كلمة المرور" : "Password"}</label><input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          
          <div className="flex gap-3 mt-8">
            <button className="btn-primary" onClick={createClinic} disabled={!form.nameEn || !form.account || !form.password}>{ar() ? "إنشاء العيادة" : "Create Clinic"}</button>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
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
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> <span dir="ltr">{c.contactPhone || "+965 —"}</span></div>
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {c.contactEmail || "No Email"}</div>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-100 flex justify-between items-center mb-4">
                 <div className="text-xs text-surface-500 font-mono bg-surface-100 px-2 py-1 rounded">ID: {c.id}</div>
                 <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100">{ar() ? "نشط" : "Active"}</span>
              </div>
              
              <div className="mt-auto grid grid-cols-2 gap-2">
                 <button className="btn-primary py-2 text-xs w-full flex items-center justify-center gap-1.5" onClick={() => login(c.account || c.id, "clinic")}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    {ar() ? "دخول" : "Login"}
                 </button>
                 <button className="btn-secondary py-2 text-xs w-full bg-white hover:bg-surface-50 border-surface-200" onClick={() => alert(ar() ? "سيتم تفعيل التعديل قريباً" : "Edit functionality coming soon")}>
                    {ar() ? "تعديل" : "Edit Details"}
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

function TasksManager() {
  const { getAuthHeader } = useAuth();
  const { data, refetch } = useApi<{ items: any[] }>("/tasks/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const EMPLOYEES_BY_DEPT: Record<string, string[]> = {
    "CS": ["Sarah", "Ahmed", "Noura"],
    "Finance": ["Omar", "Fatima"],
    "Admin": ["Ali", "Laila", "Mubarak"],
    "Clinics": ["Mona", "Khaled", "Zainab"]
  };

  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    priority: "yellow", 
    assignedDepartment: "CS",
    assignedPeople: [] as string[],
    dueDate: new Date(Date.now() + 86400000).toISOString() 
  });

  const togglePerson = (person: string) => {
    setForm(prev => {
      const current = prev.assignedPeople;
      if (current.includes(person)) return { ...prev, assignedPeople: current.filter(p => p !== person) };
      return { ...prev, assignedPeople: [...current, person] };
    });
  };

  const createTask = async () => {
    // Construct assigned text for display
    const assigned = form.assignedPeople.length > 0 
      ? `${form.assignedDepartment} - ${form.assignedPeople.join(", ")}` 
      : form.assignedDepartment;
    
    await apiFetch("/tasks/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({...form, assignedDepartments: [assigned]}) });
    setShowCreate(false);
    // reset form
    setForm({ title: "", description: "", priority: "yellow", assignedDepartment: "CS", assignedPeople: [], dueDate: new Date(Date.now() + 86400000).toISOString() });
    refetch();
  };

  const priorityColors: Record<string, string> = { red: "priority-red", yellow: "priority-yellow", green: "priority-green" };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة المهام والتكليفات" : "Task Management & Assignments"}</h3>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ {ar() ? "مهمة جديدة" : "New Task"}</button>
      </div>
      
      {showCreate && (
        <div className="card-elevated p-6 animate-slide-up bg-surface-50/50 border border-surface-200 mb-6">
          <h4 className="font-bold text-surface-900 mb-5">{ar() ? "تفاصيل المهمة" : "Task Details"}</h4>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "عنوان المهمة" : "Task Title"}</label>
              <input className="input-field" placeholder={ar() ? "مثال: مراجعة العيادة الجديدة" : "e.g. Review new clinic application"} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الأولوية" : "Priority"}</label>
              <select className="select-field" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="red">🔴 High / عالي</option>
                <option value="yellow">🟡 Medium / متوسط</option>
                <option value="green">🟢 Low / منخفض</option>
              </select>
            </div>
            
            <div className="md:col-span-3 border-t border-surface-200 mt-2 pt-5">
              <h5 className="font-bold text-sm text-surface-800 mb-4">{ar() ? "تعيين المهمة (Assignment)" : "Task Assignment"}</h5>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "القسم الموجه له" : "Target Department"}</label>
                  <select className="select-field" value={form.assignedDepartment} onChange={e => setForm({ ...form, assignedDepartment: e.target.value, assignedPeople: [] })}>
                    <option value="CS">{ar() ? "خدمة العملاء (CS)" : "Customer Service (CS)"}</option>
                    <option value="Finance">{ar() ? "المالية (Finance)" : "Finance"}</option>
                    <option value="Admin">{ar() ? "الإدارة (Admin)" : "Administration"}</option>
                    <option value="Clinics">{ar() ? "فريق العيادات (Clinics)" : "Clinics Team"}</option>
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الموظف المختص (متعدد - اختياري)" : "Specific Person(s) (Optional)"}</label>
                  <div 
                    className="input-field flex items-center justify-between cursor-pointer min-h-[42px] bg-white"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {form.assignedPeople.length === 0 ? (
                        <span className="text-surface-400 text-sm px-1">{ar() ? "الكل في القسم" : "All in Department"}</span>
                      ) : (
                        form.assignedPeople.map(person => (
                          <span key={person} className="bg-brand-pink-50 text-brand-pink-700 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border border-brand-pink-100 shadow-sm">
                            {person}
                            <button 
                              onClick={(e) => { e.stopPropagation(); togglePerson(person); }}
                              className="hover:text-brand-pink-900 focus:outline-none w-3.5 h-3.5 bg-brand-pink-200/50 rounded-full flex items-center justify-center transition-colors"
                            >×</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-4 h-4 text-surface-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-fade-in py-1">
                        {(EMPLOYEES_BY_DEPT[form.assignedDepartment] || []).length === 0 ? (
                           <div className="px-4 py-3 text-sm text-surface-500 text-center">{ar() ? "لا يوجد موظفين" : "No employees found"}</div>
                        ) : (
                          (EMPLOYEES_BY_DEPT[form.assignedDepartment] || []).map(person => (
                            <label key={person} className="flex items-center px-4 py-2.5 hover:bg-surface-50 cursor-pointer transition-colors border-b border-surface-50 last:border-0 group">
                              <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 transition-colors ${form.assignedPeople.includes(person) ? "bg-brand-pink-500 border-brand-pink-500" : "bg-white border border-surface-300 group-hover:border-brand-pink-300"}`}>
                                {form.assignedPeople.includes(person) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-[10px] font-bold text-surface-600 uppercase border border-surface-200 shadow-sm">{person.charAt(0)}</div>
                                <span className="text-sm font-medium text-surface-700">{person}</span>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-3 mt-2">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الوصف أو الملاحظات" : "Description / Notes"}</label>
              <textarea className="input-field min-h-[80px] resize-y" placeholder={ar() ? "تفاصيل إضافية حول المطلوب..." : "Additional details about the task..."} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            
            <div className="md:col-span-3 flex gap-3 mt-4">
              <button className="btn-primary" onClick={createTask} disabled={!form.title}>{ar() ? "إنشاء وتعيين المهمة" : "Create & Assign Task"}</button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <table className="data-table">
          <thead><tr><th></th><th>{ar() ? "العنوان" : "Title"}</th><th>{ar() ? "الجهة المكلفة" : "Assigned To"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "الموعد" : "Due"}</th></tr></thead>
          <tbody>
            {(data?.items || []).map((t: any) => (
              <tr key={t.id} className="hover:bg-surface-50 transition-colors">
                <td className="w-8"><div className={priorityColors[t.priority] || "priority-green"} /></td>
                <td className="font-bold text-surface-800">{t.title}</td>
                <td>
                   <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 text-surface-700 text-xs font-medium">
                     <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                     {(t.assignedDepartments || []).join(", ").toUpperCase()}
                   </div>
                </td>
                <td><span className={t.status === "completed" ? "badge-green" : t.status === "in_progress" ? "badge-yellow" : "badge-gray"}>{t.status}</span></td>
                <td className="text-xs text-surface-500 font-medium">{new Date(t.dueDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {(data?.items || []).length === 0 && <tr><td colSpan={5} className="text-center text-surface-400 py-12">{ar() ? "لا توجد مهام حالية" : "No active tasks"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplaintsView() {
  const { data } = useComplaints();
  return (
    <div>
      <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "الشكاوى" : "Complaints"}</h3>
      <div className="card-elevated overflow-hidden">
        <table className="data-table">
          <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
          <tbody>
            {(data?.items || []).map((c: any) => (
              <tr key={c.id}><td className="font-medium">{c.subject}</td><td><span className="badge-sage">{c.category}</span></td><td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{c.status}</span></td><td className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</td></tr>
            ))}
            {(data?.items || []).length === 0 && <tr><td colSpan={4} className="text-center text-surface-400 py-8">{ar() ? "لا توجد شكاوى" : "No complaints"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [requireInstallmentPayment, setRequireInstallmentPayment] = useState(() => {
    try { return localStorage.getItem('bel_require_installment_booking_v1') === 'true'; } catch { return false; }
  });

  const save = () => {
    setLoading(true);
    localStorage.setItem('bel_require_installment_booking_v1', String(requireInstallmentPayment));
    setTimeout(() => setLoading(false), 800);
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إعدادات النظام" : "System Settings"}</h3>
        <button onClick={save} className="btn-primary btn-sm">{loading ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التغييرات" : "Save Changes")}</button>
      </div>

      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {ar() ? "الملف الشخصي للمسؤول" : "Administrator Profile"}
        </h4>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex flex-col items-center gap-3">
             <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm relative group">
                A
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
             </div>
             <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Super Admin</div>
          </div>
          <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
              <input type="text" className="input-field bg-white" defaultValue="admin1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
              <input type="email" className="input-field bg-white" defaultValue="admin@belamonda.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
              <input type="text" className="input-field bg-white" defaultValue="+965 12345678" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور الجديدة" : "New Password"}</label>
              <input type="password" className="input-field bg-white" placeholder="********" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {ar() ? "إعدادات عامة" : "General Configuration"}
          </h4>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-surface-700">{ar() ? "وضع الصيانة" : "Maintenance Mode"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-surface-700">{ar() ? "السماح بالتسجيل الجديد" : "Allow New Signups"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
              <select className="select-field"><option>English (EN)</option><option>Arabic (AR)</option></select>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
              <div>
                <span className="text-sm font-medium text-surface-700 block">{ar() ? "إلزام دفع القسط المستحق قبل حجز موعد" : "Require Installment Payment Before Booking"}</span>
                <span className="text-[10px] text-surface-400">{ar() ? "يمنع المستخدم من حجز مواعيد إذا كان هناك أقساط غير مدفوعة للباقة" : "Prevents users from booking sessions if they have unpaid installments"}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={requireInstallmentPayment} onChange={e => setRequireInstallmentPayment(e.target.checked)} />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            {ar() ? "الأمان والوصول" : "Security & Access"}
          </h4>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "صلاحية الجلسة (ساعات)" : "Session Timeout (Hours)"}</label>
              <input type="number" className="input-field" defaultValue={24} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية للمشرفين" : "Force 2FA for Admins"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersManager() {
  const { login } = useAuth();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  
  const [mockUsers, setMockUsers] = useState([
    { id: "USR-001", name: "Ahmed Al-Fadhli", phone: "+965 99887766", role: "Customer", status: "Verified", kyc: true, balance: "145.000 KWD" },
    { id: "USR-002", name: "Sarah Al-Salem", phone: "+965 55443322", role: "Customer", status: "Pending KYC", kyc: false, balance: "0.000 KWD" },
    { id: "USR-003", name: "Noura CustomerService", phone: "CS Dept", role: "CS_Admin", status: "Active", kyc: true, balance: "-" },
    { id: "USR-004", name: "Dr. Khaled", phone: "+965 66778899", role: "Clinic_Staff", status: "Active", kyc: true, balance: "-" },
  ]);

  const filtered = mockUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search));

  const handleLoginAsUser = () => {
     if (selectedUser) login(selectedUser.id, "customer");
  };

  const handleFreezeToggle = () => {
     if (selectedUser) {
        const newStatus = selectedUser.status === "Frozen" ? (selectedUser.kyc ? "Verified" : "Active") : "Frozen";
        const updated = { ...selectedUser, status: newStatus };
        setSelectedUser(updated);
        setMockUsers(mockUsers.map(u => u.id === updated.id ? updated : u));
     }
  };

  const handleEditToggle = () => {
     if (isEditing) {
        setSelectedUser(editForm);
        setMockUsers(mockUsers.map(u => u.id === editForm.id ? editForm : u));
        setIsEditing(false);
     } else {
        setEditForm(selectedUser);
        setIsEditing(true);
     }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة المستخدمين" : "User Management"}</h3>
        <div className="w-64">
           <input className="input-field" placeholder={ar() ? "بحث بالاسم أو الهاتف..." : "Search name or phone..."} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      
      {selectedUser ? (
        <div className="card-elevated p-6 animate-slide-up relative bg-surface-50">
          <button className="absolute top-6 right-6 text-surface-400 hover:text-surface-900 bg-white hover:bg-surface-200 border border-surface-200 p-2 rounded-full transition-colors shadow-sm" onClick={() => { setSelectedUser(null); setIsEditing(false); }}>
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          
          <div className="flex items-start gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-2xl shadow-sm">
              {selectedUser.name.charAt(0)}
            </div>
            <div>
              {isEditing ? (
                 <input className="input-field mb-2 w-64 font-bold text-lg" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              ) : (
                 <h2 className="text-xl font-bold text-surface-900">{selectedUser.name}</h2>
              )}
              <div className="text-sm text-surface-500 mt-1">{selectedUser.id} • {isEditing ? <input className="input-field inline-block w-40 text-xs py-1 px-2 h-7" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /> : selectedUser.phone}</div>
              <div className="mt-2 flex gap-2">
                 <span className={selectedUser.status === 'Frozen' ? 'badge-red' : `badge-${selectedUser.kyc ? 'green' : 'yellow'}`}>{selectedUser.status}</span>
                 <span className="badge-sage">{selectedUser.role}</span>
              </div>
            </div>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-3 mb-8">
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "نظرة عامة" : "Overview"}</h4>
                  <div className="space-y-4">
                    <div><div className="text-xs text-surface-500">{ar() ? "الرصيد المتاح" : "Available Balance"}</div>{isEditing ? <input className="input-field mt-1 text-sm font-bold text-brand-pink-600 h-8" value={editForm.balance} onChange={e => setEditForm({...editForm, balance: e.target.value})} /> : <div className="text-xl font-black text-brand-pink-600">{selectedUser.balance}</div>}</div>
                    <div><div className="text-xs text-surface-500">{ar() ? "الرقم المدني" : "Civil ID"}</div><div className="font-mono text-sm text-surface-900">290123456789</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "تاريخ الميلاد" : "Date of Birth"}</div><div className="text-sm text-surface-900">14 Jan 1990</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "البريد الإلكتروني" : "Email"}</div><div className="text-sm text-surface-900">{selectedUser.name.split(' ')[0].toLowerCase()}@example.com</div></div>
                    <div className="pt-2 border-t border-surface-100"><div className="text-xs text-surface-500">{ar() ? "تاريخ التسجيل" : "Registered"}</div><div className="text-sm text-surface-900">12 Oct 2025</div></div>
                  </div>
               </div>
            </div>
            
            <div className="lg:col-span-2 space-y-6">
               {/* Active Offers */}
               <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 flex items-center justify-between pb-2 border-b border-surface-100">
                     {ar() ? "الاشتراكات والعروض" : "Subscriptions & Offers"}
                     <span className="badge-pink text-xs">2 {ar() ? "نشط" : "Active"}</span>
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                     <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                        <div className="text-sm font-bold text-surface-900">Jamali Beauty Program</div>
                        <div className="text-xs text-surface-500 mt-1 mb-3">1500 KWD • 1 Year Validity</div>
                        <div className="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center">
                           <span className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-50 px-2 py-1 rounded uppercase tracking-wider">Paid in Full</span>
                           <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">Exp: Oct 2026</span>
                        </div>
                     </div>
                     <div className="bg-white p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                        <div className="text-sm font-bold text-surface-900">Nuomi Classic Laser</div>
                        <div className="text-xs text-surface-500 mt-1 mb-3">120 KWD • 6 Sessions</div>
                        <div className="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center">
                           <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wider">Installments (2/4)</span>
                           <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">4 Sessions Left</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Appointments & Payments */}
               <div className="grid gap-6 md:grid-cols-2">
                  <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                     <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المواعيد" : "Appointments"}</h4>
                     <div className="space-y-3">
                        <div className="bg-white p-3 rounded-lg border-l-4 border-l-blue-500 border border-surface-200 shadow-sm">
                           <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Upcoming • Tomorrow, 10:00 AM</div>
                           <div className="text-sm font-bold text-surface-900">Laser Session</div>
                           <div className="text-xs text-surface-500">Glow Clinic</div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border-l-4 border-l-emerald-500 border border-surface-200 shadow-sm opacity-70">
                           <div className="text-[10px] font-bold text-emerald-600 mb-1 uppercase tracking-wider">Completed • 12 Oct 2025</div>
                           <div className="text-sm font-bold text-surface-900">Consultation</div>
                           <div className="text-xs text-surface-500">Derma Clinic</div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                     <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المدفوعات الأخيرة" : "Recent Payments"}</h4>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-surface-200 shadow-sm">
                           <div>
                              <div className="text-sm font-bold text-surface-900">Installment 2/4</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Nuomi Classic</div>
                           </div>
                           <div className="text-sm font-black text-emerald-600">+30.000 KWD</div>
                        </div>
                        <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-surface-200 shadow-sm">
                           <div>
                              <div className="text-sm font-bold text-surface-900">Full Payment</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Jamali Beauty</div>
                           </div>
                           <div className="text-sm font-black text-emerald-600">+1500.000 KWD</div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
          
          <div className="border-t border-surface-200 pt-6 flex gap-3 flex-wrap">
             <button className="btn-primary flex items-center gap-2" onClick={handleLoginAsUser}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                {ar() ? "دخول كـ مستخدم" : "Login As User"}
             </button>
             <button className="btn-secondary" onClick={handleEditToggle}>
                {isEditing ? (ar() ? "حفظ التعديلات" : "Save Details") : (ar() ? "تعديل البيانات" : "Edit Details")}
             </button>
             <button className="btn-secondary text-red-500 hover:bg-red-50 hover:border-red-200 border-surface-200" onClick={handleFreezeToggle}>
                {selectedUser.status === 'Frozen' ? (ar() ? "إلغاء التجميد" : "Unfreeze Account") : (ar() ? "تجميد الحساب" : "Freeze Account")}
             </button>
             {isEditing && (
                <button className="btn-secondary ml-auto text-surface-500" onClick={() => setIsEditing(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
             )}
          </div>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden">
          <table className="data-table">
            <thead><tr><th>{ar() ? "الاسم" : "Name"}</th><th>{ar() ? "الرقم" : "Phone/Contact"}</th><th>{ar() ? "الصلاحية" : "Role"}</th><th>{ar() ? "الحالة" : "Status"}</th><th></th></tr></thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id}>
                  <td className="font-medium flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-pink-50 flex items-center justify-center text-xs font-bold text-brand-pink-600">{u.name.charAt(0)}</div>
                    {u.name}
                  </td>
                  <td>{u.phone}</td>
                  <td><span className="badge-sage">{u.role}</span></td>
                  <td><span className={`badge-${u.kyc ? 'green' : 'yellow'}`}>{u.status}</span></td>
                  <td className="text-right">
                    <button className="text-brand-pink-600 hover:text-brand-pink-800 font-medium text-sm px-4 py-1.5 bg-brand-pink-50 rounded-lg transition-colors hover:bg-brand-pink-100" onClick={() => setSelectedUser(u)}>
                      {ar() ? "إدارة" : "Manage"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-surface-400 py-8">{ar() ? "لا يوجد مستخدمين" : "No users found"}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──
export default function AdminDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue();
  const { data: paymentsData } = usePendingPayments();
  const { data: productsData } = useProducts();
  const { data: financeData } = useFinanceSnapshot();
  const fs = financeData?.snapshot;

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "offers", icon: Icons.offers, label: t("offers") },
    { key: "standalone", icon: Icons.calendar, label: ar() ? "الجلسات" : "Sessions" },
    { key: "users", icon: Icons.users, label: t("users") },
    { key: "clinics", icon: Icons.clinic, label: t("clinics") },
    { key: "tasks", icon: Icons.clipboard, label: t("tasks") },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "settings", icon: Icons.settings, label: t("settings") },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة المدير" : "Admin Dashboard"} subtitle={ar() ? "نظرة عامة كاملة" : "Full system overview"}>
      <div className="space-y-8 animate-fade-in">
        {activeNav === "home" && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <KpiCard icon={Icons.chart} label={ar() ? "إيرادات الشهر" : "Monthly Revenue"} value={fs?.totalRevenue || "0"} sub="KWD" isHighlighted trend="+12.5%" />
              <KpiCard icon={Icons.shield} label={ar() ? "تحققات معلقة" : "Pending KYC"} value={(kycData?.items || []).length} sub={ar() ? "تتطلب مراجعة" : "requires review"} />
              <KpiCard icon={Icons.cash} label={ar() ? "مدفوعات معلقة" : "Pending Payments"} value={(paymentsData?.items || []).length} sub={ar() ? "بانتظار التسوية" : "awaiting settlement"} />
              <KpiCard icon={Icons.offers} label={ar() ? "المنتجات" : "Products"} value={(productsData?.products || []).length} sub={ar() ? "في الكتالوج" : "active in catalog"} />
            </div>

            {/* Financial Overview Bento */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-surface-900 mb-5">{ar() ? "نظرة مالية شاملة" : "Financial Overview"}</h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="card-elevated p-6 bg-white flex flex-col justify-center border-l-4 border-l-surface-300">
                   <div className="text-sm font-bold text-surface-500 mb-1">{ar() ? "إجمالي الكاش باك المقفل" : "Total Cashback Locked"}</div>
                   <div className="text-3xl font-black text-surface-900">{fs?.totalCashbackLocked || "0"} <span className="text-lg text-surface-400 font-medium">KWD</span></div>
                   <div className="mt-4 w-full bg-surface-100 rounded-full h-2 overflow-hidden"><div className="bg-surface-400 h-full rounded-full w-[75%]"></div></div>
                </div>
                <div className="card-elevated p-6 bg-white flex flex-col justify-center border-l-4 border-l-brand-pink-400 shadow-md">
                   <div className="text-sm font-bold text-brand-pink-500 mb-1">{ar() ? "الكاش باك المتاح للمستخدمين" : "Total Cashback Unlocked"}</div>
                   <div className="text-3xl font-black text-brand-pink-600">{fs?.totalCashbackUnlocked || "0"} <span className="text-lg text-brand-pink-400 font-medium">KWD</span></div>
                   <div className="mt-4 w-full bg-brand-pink-50 rounded-full h-2 overflow-hidden"><div className="bg-brand-pink-500 h-full rounded-full w-[50%]"></div></div>
                </div>
                <div className="card-elevated p-6 bg-white flex flex-col justify-center border-l-4 border-l-emerald-400">
                   <div className="text-sm font-bold text-surface-500 mb-1">{ar() ? "إجمالي الكاش باك المستخدم" : "Total Cashback Utilized"}</div>
                   <div className="text-3xl font-black text-emerald-600">{fs?.totalCashbackUtilized || "0"} <span className="text-lg text-emerald-400 font-medium">KWD</span></div>
                   <div className="mt-4 w-full bg-emerald-50 rounded-full h-2 overflow-hidden"><div className="bg-emerald-500 h-full rounded-full w-[25%]"></div></div>
                </div>
              </div>
            </div>

            {/* Products catalog */}
            <div>
              <h3 className="text-lg font-bold text-surface-900 mb-5">{ar() ? "كتالوج المنتجات" : "Product Catalog"}</h3>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(productsData?.products || []).map((p: any) => (
                  <div key={p.code} className="card-elevated p-4">
                    <div className="text-sm font-bold text-surface-900">{ar() ? p.nameAr : p.nameEn}</div>
                    <div className="text-xs text-surface-400 mt-1">{p.durationMonths} {ar() ? "شهر" : "months"} • {p.cashbackModel}</div>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {parseFloat(p.fixedCashbackKwd) > 0 && <span className="badge-pink">{p.fixedCashbackKwd} CB</span>}
                      {parseFloat(p.perSessionCashbackKwd) > 0 && <span className="badge-sage">{p.perSessionCashbackKwd}/s</span>}
                      {parseFloat(p.perSessionPriceKwd) > 0 && <span className="badge-blue">{p.perSessionPriceKwd}/use</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {activeNav === "offers" && <OffersManager />}
        {activeNav === "standalone" && <SessionsManager />}
        {activeNav === "clinics" && <ClinicsManager />}
        {activeNav === "tasks" && <TasksManager />}
        {activeNav === "complaints" && <ComplaintsView />}
        {activeNav === "users" && <UsersManager />}
        {activeNav === "settings" && <AdminSettings />}
      </div>
    </DashboardShell>
  );
}
