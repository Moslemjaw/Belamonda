import { useState, useEffect } from "react";
import DatePicker from "../../../components/DatePicker";
import { useApi } from "../../../hooks/useApi";
import { allTreatments } from "../../../lib/treatments";
import { ar } from "./shared";

export function SchedulingTool() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [form, setForm] = useState({
     treatment: "",
     clinicId: "",
     scheduledAt: "",
  });
  const [result, setResult] = useState<string | null>(null);
  const [coolingOffWarning, setCoolingOffWarning] = useState<number | null>(null);

  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  

  const mockTreatments = allTreatments.map(t => ({ id: t.id, name: ar() ? t.nameAr : t.nameEn, category: t.category }));

  useEffect(() => {
     if (!customerQuery || !form.treatment) {
        setCoolingOffWarning(null);
        return;
     }
     try {
       const offers = JSON.parse(localStorage.getItem('demo_offers_v4') || '[]');
       const userOffers = offers.filter((o: any) => o.userId === customerQuery || customerQuery === 'cust1');
       const treatmentCategory = mockTreatments.find(t => t.id === form.treatment)?.category;
       
       let warning = null;
       for (const o of userOffers) {
          if ((!o.category || o.category === treatmentCategory) && o.lastAppointmentDate) {
              const daysSince = Math.floor((new Date().getTime() - new Date(o.lastAppointmentDate).getTime()) / (1000 * 60 * 60 * 24));
              if (daysSince < 25) {
                  warning = 25 - daysSince;
                  break;
              }
          }
       }
       setCoolingOffWarning(warning);
     } catch (e) {
       setCoolingOffWarning(null);
     }
  }, [customerQuery, form.treatment]);

  const scheduleSession = () => {
    if (!customerQuery || !form.treatment || !form.clinicId || !form.scheduledAt) {
       setResult(ar() ? "❌ يرجى تعبئة جميع الحقول" : "❌ Please fill all fields");
       return;
    }

    if (coolingOffWarning !== null) {
       setResult(ar() ? `لا يمكن الحجز. العميل في فترة انتظار.` : `Cannot book. Customer is in cooling-off period.`);
       return;
    }

    setResult(ar() ? `تم الحجز بنجاح!` : `Successfully scheduled!`);
    
    try {
      const offers = JSON.parse(localStorage.getItem('demo_offers_v4') || '[]');
      const treatmentCategory = mockTreatments.find(t => t.id === form.treatment)?.category;
      let updated = false;
      const updatedOffers = offers.map((o: any) => {
         if (!updated && (o.userId === customerQuery || customerQuery === 'cust1') && (!o.category || o.category === treatmentCategory)) {
             updated = true;
             return { ...o, lastAppointmentDate: new Date(form.scheduledAt).toISOString() };
         }
         return o;
      });
      localStorage.setItem('demo_offers_v4', JSON.stringify(updatedOffers));
    } catch(e) {}

    setTimeout(() => setResult(null), 4000);
  };

  return (
    <div className="card-elevated p-6 animate-fade-in">
      <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "جدولة جلسة جديدة" : "Schedule New Session"}</h3>
      <p className="text-sm text-surface-500 mb-6">{ar() ? "قم بإنشاء موعد جديد لعميل محدد مع اختيار نوع العلاج والعيادة." : "Create a new appointment for a specific customer, select treatment and clinic."}</p>
      
      {coolingOffWarning !== null && (
         <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-center gap-3">
            <svg className="w-6 h-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span className="font-bold text-sm">{ar() ? `لا يمكن الحجز. يجب الانتظار ${coolingOffWarning} يوم للعميل حسب سياسة الباقة.` : `Cannot book. Must wait ${coolingOffWarning} days for this customer based on package cooling-off policy.`}</span>
         </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="lg:col-span-1">
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "العميل (هاتف، إيميل، هوية)" : "Customer (Phone, Email, ID)"}</label>
           <input 
             className="input-field bg-surface-50 focus:bg-white" 
             value={customerQuery} 
             onChange={e => setCustomerQuery(e.target.value)} 
             placeholder={ar() ? "بحث..." : "Search..."} 
           />
        </div>
        
        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "نوع الجلسة" : "Treatment Type"}</label>
           <select className="select-field bg-surface-50 focus:bg-white" value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })}>
             <option value="" disabled>{ar() ? "اختر الجلسة" : "Select Treatment"}</option>
             {mockTreatments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
           </select>
        </div>

        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "العيادة" : "Clinic"}</label>
           <select className="select-field bg-surface-50 focus:bg-white" value={form.clinicId} onChange={e => setForm({ ...form, clinicId: e.target.value })}>
             <option value="" disabled>{ar() ? "اختر العيادة" : "Select Clinic"}</option>
             {(clinicsData?.items || []).map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
           </select>
        </div>

        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "الموعد" : "Date & Time"}</label>
           <DatePicker 
             showTimeSelect
             className="input-field bg-surface-50 focus:bg-white w-full" 
             value={form.scheduledAt} 
             onChange={e => setForm({ ...form, scheduledAt: e.target.value })} 
           />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-surface-100 pt-5">
         <div className="text-sm font-medium">
            {result?.includes('✅') ? (
               <span className="text-emerald-600 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {result}
               </span>
            ) : result ? (
               <span className="text-red-500">{result}</span>
            ) : null}
         </div>
         <button className={`btn-primary px-8 shadow-md ${coolingOffWarning !== null ? 'opacity-50 cursor-not-allowed' : ''}`} disabled={coolingOffWarning !== null} onClick={scheduleSession}>{ar() ? "تأكيد الحجز" : "Confirm Booking"}</button>
      </div>
    </div>
  );
}
