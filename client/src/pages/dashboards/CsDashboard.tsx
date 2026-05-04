import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useKycQueue, usePendingPayments, useComplaints, useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

function KycQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useKycQueue();
  const [processing, setProcessing] = useState<string | null>(null);

  const reviewKyc = async (submissionId: string, decision: "approve" | "reject") => {
    setProcessing(submissionId);
    try {
      if (decision === "approve") {
        await apiFetch(`/kyc/cs/${submissionId}/approve`, { method: "POST", headers: getAuthHeader() });
      } else {
        await apiFetch(`/kyc/cs/${submissionId}/reject`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ reason: "Documents unclear" }) });
      }
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "طابور التحققات" : "KYC Queue"}</h3>
        <div className="flex items-center gap-2">
          <span className="badge-yellow">{(data?.items || []).length} {ar() ? "معلق" : "pending"}</span>
          <button className="btn-ghost btn-sm" onClick={refetch}>↻</button>
        </div>
      </div>
      {loading ? <div className="shimmer h-32 rounded-xl" /> : (data?.items || []).length === 0 ? (
        <div className="text-center text-sm text-surface-400 py-8">✅ {ar() ? "لا توجد تحققات معلقة" : "All clear — no pending verifications"}</div>
      ) : (data?.items || []).map((k: any) => (
        <div key={k.id} className="flex items-center gap-4 py-3 border-b border-surface-100 last:border-0">
          <div className="avatar avatar-sm">{k.userId?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-surface-800">{k.userId}</div>
            <div className="text-xs text-surface-400">{k.civilIdNumber} • {new Date(k.createdAt).toLocaleTimeString()}</div>
          </div>
          <div className="flex gap-1.5">
            <button className="btn-sm bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg px-3 py-1 text-xs font-medium" disabled={processing === k.id} onClick={() => reviewKyc(k.id, "approve")}>{processing === k.id ? "..." : ar() ? "قبول" : "Approve"}</button>
            <button className="btn-sm bg-red-50 text-red-500 hover:bg-red-100 rounded-lg px-3 py-1 text-xs font-medium" disabled={processing === k.id} onClick={() => reviewKyc(k.id, "reject")}>{ar() ? "رفض" : "Reject"}</button>
          </div>
        </div>
      ))}
    </div>
  );
}



function PaymentQueue({ mockPayments, setMockPayments }: { mockPayments: any[], setMockPayments: any }) {
  const { getAuthHeader } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const confirmPayment = async (paymentId: string) => {
    setProcessing(paymentId);
    try {
      const updatedPending = mockPayments.filter(p => p.id !== paymentId);
      setMockPayments(updatedPending);
      
      try {
         localStorage.setItem('demo_pending_payments', JSON.stringify(updatedPending));
         const offers = JSON.parse(localStorage.getItem('demo_offers') || '[]');
         const updatedOffers = offers.map((o: any) => {
            if (o.id === paymentId) {
               return { 
                 ...o, 
                 status: "active", 
                 paidInstallments: (o.paidInstallments || 0) + 1 
               };
            }
            return o;
         });
         localStorage.setItem('demo_offers', JSON.stringify(updatedOffers));
      } catch (e) {}

      await apiFetch("/payments/cs/confirm", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ userOfferId: paymentId, proofRef: "verified", method: "bank_transfer", amountKwd: "99.000" }) });
    } catch (e: any) { console.log(e.message); } // silent fail for demo
    finally { setProcessing(null); }
  };

  const items = mockPayments;

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "مدفوعات معلقة" : "Pending Payments"}</h3>
        <div className="flex items-center gap-2">
          <span className="badge-pink">{items.length} {ar() ? "معلق" : "pending"}</span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-sm text-surface-400 py-8">✅ {ar() ? "لا مدفوعات معلقة" : "No pending payments"}</div>
      ) : items.map((p: any) => (
        <div key={p.id} className="flex items-center gap-4 py-3 border-b border-surface-100 last:border-0">
          <div className="avatar avatar-sm bg-amber-100 text-amber-700">{p.userId?.charAt(0)?.toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-surface-800">{p.userId}</div>
            <div className="text-xs text-surface-400">{ar() ? "عرض" : "Offer"}: {p.offerId?.slice(0, 20)} • {p.method}</div>
          </div>
          <div className="text-sm font-bold text-brand-pink-600 mr-2">{p.amount}</div>
          <div className="flex items-center gap-2">
            <button className="bg-surface-100 hover:bg-surface-200 text-surface-600 font-medium px-3 py-1.5 rounded-xl text-xs transition-colors" onClick={() => setSelectedPayment(p)}>{ar() ? "التفاصيل" : "Details"}</button>
            <button className="btn-primary btn-sm px-4" disabled={processing === p.id} onClick={() => confirmPayment(p.id)}>{processing === p.id ? "..." : ar() ? "تأكيد" : "Confirm"}</button>
          </div>
        </div>
      ))}

      {/* Payment Details Modal */}
      {selectedPayment && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
             <button className="absolute top-5 right-5 text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedPayment(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
             <h3 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {ar() ? "تفاصيل الدفع" : "Payment Details"}
             </h3>

             <div className="space-y-4">
               {/* Customer Details */}
               <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                  <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "بيانات العميل" : "Customer Information"}</h4>
                  <div className="flex items-center gap-3 mb-2">
                     <div className="avatar avatar-sm bg-amber-100 text-amber-700">{selectedPayment.userId?.charAt(0)?.toUpperCase()}</div>
                     <div>
                        <div className="font-bold text-surface-900">{selectedPayment.userId}</div>
                        <div className="text-xs text-surface-500">+965 99887766 • {selectedPayment.userId}@example.com</div>
                     </div>
                  </div>
               </div>

               {/* Offer Details */}
               <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100">
                  <h4 className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-3">{ar() ? "تفاصيل الباقة" : "Offer Details"}</h4>
                  <div className="flex justify-between items-center mb-2">
                     <span className="font-medium text-surface-800">{selectedPayment.offerId}</span>
                     <span className="font-black text-brand-pink-600">{selectedPayment.amount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                     <span className="text-surface-500">{ar() ? "طريقة الدفع" : "Payment Method"}</span>
                     <span className="font-bold text-surface-900 bg-white px-2 py-1 border border-surface-200 rounded-lg">{selectedPayment.method}</span>
                  </div>
               </div>

               {/* Installment Details (Conditional) */}
               {selectedPayment.method === "Installments" && (
                  <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                     <h4 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">{ar() ? "خطة الأقساط" : "Installment Plan"}</h4>
                     <div className="flex justify-between items-center text-sm text-blue-900 mb-1">
                        <span>{ar() ? "الدفعة الأولى المطلوبة" : "First Payment Required"}</span>
                        <span className="font-bold">{(parseFloat(selectedPayment.amount) / 3).toFixed(3)} KWD</span>
                     </div>
                     <div className="flex justify-between items-center text-sm text-blue-900">
                        <span>{ar() ? "المتبقي" : "Remaining Balance"}</span>
                        <span className="font-bold">{(parseFloat(selectedPayment.amount) * 2 / 3).toFixed(3)} KWD (2 Months)</span>
                     </div>
                  </div>
               )}
             </div>

             <div className="mt-8 flex gap-3">
                <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors" onClick={() => setSelectedPayment(null)}>{ar() ? "إغلاق" : "Close"}</button>
                <button className="flex-1 bg-brand-pink-400 hover:bg-brand-pink-500 text-white font-bold py-3 rounded-xl transition-colors shadow-sm" disabled={processing === selectedPayment.id} onClick={() => {
                   confirmPayment(selectedPayment.id);
                   setSelectedPayment(null);
                }}>{processing === selectedPayment.id ? "..." : ar() ? "تأكيد الدفع" : "Confirm Payment"}</button>
             </div>
           </div>
        </div>, document.body
      )}
    </div>
  );
}

function SchedulingTool() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [form, setForm] = useState({
     treatment: "",
     clinicId: "",
     scheduledAt: "",
  });
  const [result, setResult] = useState<string | null>(null);

  const mockClinics = [
    { id: "clinic_glow", name: "Glow Clinic (Hawally)" },
    { id: "clinic_derma", name: "Derma Center (Salmiya)" },
    { id: "clinic_elite", name: "Elite Beauty (Kuwait City)" }
  ];

  const mockTreatments = [
    { id: "laser", name: ar() ? "جلسة ليزر" : "Laser Session" },
    { id: "fillers", name: ar() ? "فيلر" : "Fillers" },
    { id: "botox", name: ar() ? "بوتوكس" : "Botox" },
    { id: "skincare", name: ar() ? "عناية بالبشرة" : "Skin Care" },
  ];

  const scheduleSession = () => {
    if (!customerQuery || !form.treatment || !form.clinicId || !form.scheduledAt) {
       setResult(ar() ? "❌ يرجى تعبئة جميع الحقول" : "❌ Please fill all fields");
       return;
    }
    setResult(ar() ? `✅ تم الحجز بنجاح!` : `✅ Successfully scheduled!`);
    setTimeout(() => setResult(null), 4000);
  };

  return (
    <div className="card-elevated p-6 animate-fade-in">
      <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "جدولة جلسة جديدة" : "Schedule New Session"}</h3>
      <p className="text-sm text-surface-500 mb-6">{ar() ? "قم بإنشاء موعد جديد لعميل محدد مع اختيار نوع العلاج والعيادة." : "Create a new appointment for a specific customer, select treatment and clinic."}</p>
      
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
             {mockClinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
           </select>
        </div>

        <div>
           <label className="text-xs font-bold text-surface-700 mb-1.5 block uppercase tracking-wider">{ar() ? "الموعد" : "Date & Time"}</label>
           <input 
             className="input-field bg-surface-50 focus:bg-white" 
             type="datetime-local" 
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
         <button className="btn-primary px-8 shadow-md" onClick={scheduleSession}>{ar() ? "تأكيد الحجز" : "Confirm Booking"}</button>
      </div>
    </div>
  );
}

function CustomerLookup() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const mockUsers = [
    { id: "USR-001", name: "Ahmed Al-Fadhli", username: "ahmedf", email: "ahmed@example.com", phone: "+965 99887766", role: "Customer", status: "Verified", balance: "145.000 KWD", dob: "14 Jan 1990", civilId: "290123456789" },
    { id: "USR-002", name: "Sarah Al-Salem", username: "sarah_s", email: "sarah.s@domain.com", phone: "+965 55443322", role: "Customer", status: "Pending KYC", balance: "0.000 KWD", dob: "22 May 1995", civilId: "295052212345" },
    { id: "USR-003", name: "Fatima Khalid", username: "fatimak", email: "f.khalid@mail.com", phone: "+965 11223344", role: "Customer", status: "Frozen", balance: "20.000 KWD", dob: "05 Dec 1988", civilId: "288120598765" }
  ];

  const handleLookup = () => {
    if (!search.trim()) {
       setResult(null);
       setHasSearched(false);
       return;
    }
    const lowerQuery = search.toLowerCase();
    const found = mockUsers.find(u => 
       u.id.toLowerCase().includes(lowerQuery) ||
       u.name.toLowerCase().includes(lowerQuery) ||
       u.username.toLowerCase().includes(lowerQuery) ||
       u.email.toLowerCase().includes(lowerQuery) ||
       u.phone.toLowerCase().includes(lowerQuery)
    );
    setResult(found || null);
    setHasSearched(true);
  };

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6 animate-fade-in">
        <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "بحث العملاء الشامل" : "Comprehensive Customer Lookup"}</h3>
        <p className="text-sm text-surface-500 mb-6">{ar() ? "ابحث بواسطة: المعرف، الاسم، اسم المستخدم، البريد، أو الهاتف" : "Search by: ID, Name, Username, Email, or Phone Number"}</p>
        
        <div className="flex gap-3">
          <div className="relative flex-1">
             <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </div>
             <input 
               className="input-field pl-11 py-3 w-full bg-surface-50 border-surface-200 focus:bg-white" 
               placeholder={ar() ? "أدخل كلمة البحث هنا..." : "Enter search term here..."} 
               value={search} 
               onChange={e => { setSearch(e.target.value); setHasSearched(false); }} 
               onKeyDown={e => e.key === 'Enter' && handleLookup()}
             />
          </div>
          <button className="btn-primary px-8" onClick={handleLookup}>{ar() ? "بحث" : "Search"}</button>
        </div>
      </div>

      {hasSearched && !result && (
         <div className="card-elevated p-12 flex flex-col items-center justify-center text-center animate-fade-in">
            <div className="w-16 h-16 bg-surface-100 text-surface-400 rounded-full flex items-center justify-center mb-4">
               <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h4 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "لم يتم العثور على نتائج" : "No results found"}</h4>
            <p className="text-surface-500 max-w-sm">{ar() ? "يرجى التحقق من صحة البيانات المدخلة والمحاولة مرة أخرى." : "Please check your search term and try again. Ensure there are no typos."}</p>
         </div>
      )}

      {result && (
        <div className="card-elevated p-6 animate-slide-up relative bg-surface-50">
          <div className="flex items-start gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-2xl shadow-sm">
              {result.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-surface-900">{result.name} <span className="text-base text-surface-400 font-normal">(@{result.username})</span></h2>
              <div className="text-sm text-surface-500 mt-1">{result.id} • {result.phone}</div>
              <div className="mt-2 flex gap-2">
                 <span className={result.status === 'Frozen' ? 'badge-red' : result.status === 'Verified' ? 'badge-green' : 'badge-yellow'}>{result.status}</span>
                 <span className="badge-sage">{result.role}</span>
              </div>
            </div>
          </div>
          
          <div className="grid gap-6 lg:grid-cols-3 mb-4">
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "نظرة عامة" : "Overview"}</h4>
                  <div className="space-y-4">
                    <div><div className="text-xs text-surface-500">{ar() ? "الرصيد المتاح" : "Available Balance"}</div><div className="text-xl font-black text-brand-pink-600">{result.balance}</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "الرقم المدني" : "Civil ID"}</div><div className="font-mono text-sm text-surface-900">{result.civilId}</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "تاريخ الميلاد" : "Date of Birth"}</div><div className="text-sm text-surface-900">{result.dob}</div></div>
                    <div><div className="text-xs text-surface-500">{ar() ? "البريد الإلكتروني" : "Email"}</div><div className="text-sm text-surface-900">{result.email}</div></div>
                  </div>
               </div>
            </div>
            
            <div className="lg:col-span-2 space-y-6">
               <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                  <h4 className="font-bold text-surface-900 mb-4 flex items-center justify-between pb-2 border-b border-surface-100">
                     {ar() ? "الاشتراكات والعروض" : "Subscriptions & Offers"}
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                     <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                        <div className="text-sm font-bold text-surface-900">Jamali Beauty Program</div>
                        <div className="text-xs text-surface-500 mt-1 mb-3">1500 KWD • 1 Year Validity</div>
                        <div className="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center">
                           <span className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-50 px-2 py-1 rounded uppercase tracking-wider">Paid in Full</span>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="grid gap-6 md:grid-cols-2">
                  <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                     <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المواعيد" : "Appointments"}</h4>
                     <div className="space-y-3">
                        <div className="bg-surface-50 p-3 rounded-lg border-l-4 border-l-blue-500 border border-surface-200 shadow-sm">
                           <div className="text-[10px] font-bold text-blue-600 mb-1 uppercase tracking-wider">Upcoming • Tomorrow</div>
                           <div className="text-sm font-bold text-surface-900">Laser Session</div>
                        </div>
                     </div>
                  </div>

                  <div className="bg-white rounded-xl p-5 border border-surface-200 shadow-sm">
                     <h4 className="font-bold text-surface-900 mb-4 pb-2 border-b border-surface-100">{ar() ? "المدفوعات" : "Payments"}</h4>
                     <div className="space-y-3">
                        <div className="flex items-center justify-between bg-surface-50 p-3 rounded-lg border border-surface-200 shadow-sm">
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
        </div>
      )}
    </div>
  );
}
function CustomersManager() {
  const { login } = useAuth();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  
  const [mockUsers, setMockUsers] = useState([
    { id: "USR-001", name: "Ahmed Al-Fadhli", phone: "+965 99887766", role: "Customer", status: "Verified", kyc: true, balance: "145.000 KWD" },
    { id: "USR-002", name: "Sarah Al-Salem", phone: "+965 55443322", role: "Customer", status: "Pending KYC", kyc: false, balance: "0.000 KWD" },
    { id: "USR-003", name: "Fatima Khalid", phone: "+965 11223344", role: "Customer", status: "Frozen", kyc: true, balance: "20.000 KWD" }
  ]);

  const filtered = mockUsers.filter(u => 
    u.role === "Customer" && 
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search))
  );

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
        <h3 className="text-base font-bold text-surface-900">{ar() ? "العملاء (المرضى)" : "Customers (Patients)"}</h3>
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
                     <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
                        <div className="text-sm font-bold text-surface-900">Jamali Beauty Program</div>
                        <div className="text-xs text-surface-500 mt-1 mb-3">1500 KWD • 1 Year Validity</div>
                        <div className="mt-auto pt-3 border-t border-surface-100 flex justify-between items-center">
                           <span className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-50 px-2 py-1 rounded uppercase tracking-wider">Paid in Full</span>
                        </div>
                     </div>
                     <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 shadow-sm flex flex-col">
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
                  <td><span className={u.status === 'Frozen' ? 'badge-red' : `badge-${u.kyc ? 'green' : 'yellow'}`}>{u.status}</span></td>
                  <td className="text-right">
                    <button className="text-brand-pink-600 hover:text-brand-pink-800 font-medium text-sm px-4 py-1.5 bg-brand-pink-50 rounded-lg transition-colors hover:bg-brand-pink-100" onClick={() => setSelectedUser(u)}>
                      {ar() ? "إدارة" : "Manage"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center text-surface-400 py-8">{ar() ? "لا يوجد عملاء" : "No customers found"}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CsSettings() {
  const [loading, setLoading] = useState(false);
  const saveSettings = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إعدادات النظام" : "System Settings"}</h3>
        <button onClick={saveSettings} className="btn-primary btn-sm">{loading ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التغييرات" : "Save Changes")}</button>
      </div>

      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {ar() ? "الملف الشخصي للموظف" : "Agent Profile"}
        </h4>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex flex-col items-center gap-3">
             <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm relative group">
                N
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
             </div>
             <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Customer Service</div>
          </div>
          <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
              <input type="text" className="input-field bg-white" defaultValue="Noura CustomerService" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
              <input type="email" className="input-field bg-white" defaultValue="noura.cs@belamonda.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
              <input type="text" className="input-field bg-white" defaultValue="+965 22334455" />
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
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
              <select className="select-field"><option>English (EN)</option><option>Arabic (AR)</option></select>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "تلقي إشعارات الحجوزات" : "Receive Booking Alerts"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
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
              <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية (2FA)" : "Enable 2FA Authentication"}</span>
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

export default function CsDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue();
  const { data: complaintsData } = useComplaints();

  const [mockPayments, setMockPayments] = useState<any[]>(() => {
    try {
      const stored = localStorage.getItem('demo_pending_payments');
      if (stored) return JSON.parse(stored);
      // default mock
      const defaults = [
        { id: "pay_001", userId: "cust1", offerId: "Jamali Beauty Program", amount: "1500 KWD", method: "Installments", totalInstallments: 3, createdAt: new Date().toISOString() },
        { id: "pay_002", userId: "sarah_s", offerId: "Nuomi Classic", amount: "120 KWD", method: "Full Payment", totalInstallments: 1, createdAt: new Date().toISOString() }
      ];
      localStorage.setItem('demo_pending_payments', JSON.stringify(defaults));
      return defaults;
    } catch { return []; }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const stored = localStorage.getItem('demo_pending_payments');
        if (stored) setMockPayments(JSON.parse(stored));
      } catch (e) {}
    };
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 1000);
    return () => { window.removeEventListener('storage', sync); clearInterval(interval); };
  }, []);

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "kyc", icon: Icons.shield, label: t("kyc") },
    { key: "payments", icon: Icons.cash, label: t("payments") },
    { key: "customers", icon: Icons.users, label: ar() ? "العملاء" : "Customers" },
    { key: "scheduling", icon: Icons.calendar, label: t("schedule") },
    { key: "lookup", icon: Icons.search, label: ar() ? "بحث العملاء" : "Customer Lookup" },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "settings", icon: Icons.settings, label: ar() ? "الإعدادات" : "Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "خدمة العملاء" : "Customer Service"} subtitle={ar() ? "إدارة التحققات والمدفوعات" : "Manage verifications, payments & bookings"}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="stat-card"><div className="stat-label">{ar() ? "تحققات معلقة" : "Pending KYC"}</div><div className="stat-value text-amber-600">{(kycData?.items || []).length}</div></div>
              <div className="stat-card"><div className="stat-label">{ar() ? "مدفوعات معلقة" : "Pending Payments"}</div><div className="stat-value text-brand-pink-500">{mockPayments.length}</div></div>
              <div className="stat-card"><div className="stat-label">{ar() ? "شكاوى مفتوحة" : "Open Complaints"}</div><div className="stat-value">{(complaintsData?.items || []).filter((c: any) => c.status === "open").length}</div></div>
              <div className="stat-card"><div className="stat-label">{ar() ? "إجمالي الشكاوى" : "Total Complaints"}</div><div className="stat-value">{complaintsData?.total || 0}</div></div>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <KycQueue />
              <PaymentQueue mockPayments={mockPayments} setMockPayments={setMockPayments} />
            </div>
          </>
        )}
        {activeNav === "kyc" && <KycQueue />}
        {activeNav === "payments" && <PaymentQueue mockPayments={mockPayments} setMockPayments={setMockPayments} />}
        {activeNav === "customers" && <CustomersManager />}
        {activeNav === "scheduling" && <SchedulingTool />}
        {activeNav === "lookup" && <CustomerLookup />}
        {activeNav === "complaints" && (
          <div className="card-elevated overflow-hidden">
            <div className="p-5"><h3 className="text-base font-bold text-surface-900">{ar() ? "الشكاوى" : "Complaints"}</h3></div>
            <table className="data-table">
              <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
              <tbody>
                {(complaintsData?.items || []).map((c: any) => (
                  <tr key={c.id}><td className="font-medium">{c.subject}</td><td><span className="badge-sage">{c.category}</span></td><td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{c.status}</span></td><td className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</td></tr>
                ))}
                {(complaintsData?.items || []).length === 0 && <tr><td colSpan={4} className="text-center py-8 text-surface-400">{ar() ? "لا شكاوى" : "No complaints"}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {activeNav === "settings" && <CsSettings />}
      </div>
    </DashboardShell>
  );
}
