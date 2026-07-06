import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { sharedClinics } from "../../lib/clinics";
import { fmtDate } from "../../lib/dateFormat";

const ar = () => i18n.language === "ar";

export default function AdminSessionsLogTab() {
  const { getAuthHeader } = useAuth();
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics/admin");
  const apiClinics = clinicsData?.items || [];

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [changeClinicTarget, setChangeClinicTarget] = useState<any>(null);
  const [newClinicSelection, setNewClinicSelection] = useState("");
  const [changeIsPaid, setChangeIsPaid] = useState(false);
  const [changeFee, setChangeFee] = useState("5.000");
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      let q = "";
      if (filterDate || status !== "all") {
        const p = new URLSearchParams();
        if (filterDate) {
           const d = new Date(filterDate);
           if (!isNaN(d.getTime())) {
             const from = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
             const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
             p.set("from", from);
             p.set("to", to);
           }
        }
        if (status !== "all") p.set("status", status);
        q = `?${p.toString()}`;
      }
      const res: any = await apiFetch(`/scheduling/admin/sessions-log${q}`, {
        headers: getAuthHeader()
      });
      setSessions(res.items || []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader, filterDate, status]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const filteredSessions = sessions.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (s.customerName || "").toLowerCase();
    const phone = (s.customerPhone || "").toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const submitChangeClinic = async () => {
    if (!newClinicSelection || newClinicSelection === changeClinicTarget.clinicId) {
      alert(ar() ? "الرجاء اختيار عيادة مختلفة" : "Please select a different clinic");
      return;
    }
    setChangeSubmitting(true);
    try {
      const endpoint = changeClinicTarget.type === "session"
        ? `/scheduling/admin/sessions/${changeClinicTarget.id}/change-clinic`
        : `/scheduling/admin/requests/${changeClinicTarget.id}/change-clinic`;
      
      const payload = {
        clinicId: newClinicSelection,
        isPaid: changeIsPaid,
        feeAmount: changeFee
      };
      
      await apiFetch(endpoint, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });
      
      alert(ar() ? "تم تغيير العيادة بنجاح" : "Clinic changed successfully");
      setChangeClinicTarget(null);
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to change clinic");
    } finally {
      setChangeSubmitting(false);
    }
  };

  const formatTimeOnly = (iso: string) => {
    return new Date(iso).toLocaleTimeString(ar() ? "ar-KW" : "en-KW", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kuwait",
    });
  };

  const formatDateOnly = (iso: string) => {
    return new Date(iso).toLocaleDateString(ar() ? "ar-KW" : "en-KW", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kuwait",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="w-8 h-8 animate-spin text-brand-pink-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-surface-900">{ar() ? "سجل الجلسات" : "Sessions Log"}</h3>
          <p className="text-sm text-surface-500 mt-1">
            {ar() ? "عرض جميع الجلسات والطلبات في العيادات" : "View all sessions and pending requests across clinics"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select value={status} onChange={e => setStatus(e.target.value)} className="input-field py-2 px-3 text-sm font-medium bg-white shadow-sm">
              <option value="all">{ar() ? "الكل" : "All Statuses"}</option>
              <option value="scheduled">{ar() ? "مجدول" : "Scheduled"}</option>
              <option value="completed">{ar() ? "مكتمل" : "Completed"}</option>
              <option value="no_show">{ar() ? "لم يحضر" : "No Show"}</option>
              <option value="cancelled">{ar() ? "ملغي" : "Cancelled"}</option>
              <option value="request_received">{ar() ? "تم استلام الطلب" : "Request Received"}</option>
              <option value="slot_assigned">{ar() ? "تم تحديد الوقت" : "Slot Assigned"}</option>
              <option value="in_progress">{ar() ? "قيد التنفيذ" : "In Progress"}</option>
              <option value="rescheduled">{ar() ? "إعادة جدولة" : "Rescheduled"}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="text" 
              placeholder={ar() ? "بحث بالاسم او الهاتف..." : "Search name or phone..."}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input-field py-2 px-3 text-sm w-48 font-medium bg-white shadow-sm"
            />
            <input 
              type="date" 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)} 
              className="input-field py-2 px-3 text-sm font-medium bg-white shadow-sm" 
            />
          </div>
          <button onClick={fetchSessions} className="btn-ghost py-2 px-4 bg-white border border-surface-200 shadow-sm rounded-xl font-bold text-surface-700 hover:bg-surface-50">
            ↻ {ar() ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="bg-surface-50/50 rounded-3xl border-2 border-dashed border-surface-200 p-12 text-center mt-6">
          <div className="text-surface-400 font-medium text-lg">{ar() ? "لا توجد جلسات." : "No sessions found."}</div>
        </div>
      ) : (
        <div className="space-y-4 mt-6">
          {filteredSessions.map((s) => {
            const clinic = apiClinics.find(c => String(c.id || c._id) === String(s.clinicId));
            const clinicName = ar() ? clinic?.nameAr : clinic?.nameEn;

            const attendanceStatus = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled'].includes(s.status)
              ? 'awaiting'
              : ['checked_in', 'in_progress'].includes(s.status) ? 'checked_in'
              : s.status === 'completed' ? 'attended'
              : s.status === 'no_show' ? 'no_show'
              : 'n_a';

            const attendanceLabel = attendanceStatus === 'awaiting' ? (ar() ? 'في الانتظار' : 'Awaiting')
              : attendanceStatus === 'checked_in' ? (ar() ? 'وصل' : 'Checked In')
              : attendanceStatus === 'attended' ? (ar() ? 'حضر' : 'Attended')
              : attendanceStatus === 'no_show' ? (ar() ? 'لم يحضر' : 'No Show')
              : '—';

            const isCompleted = s.status === "completed";
            const isNoShow = s.status === "no_show";
            const isInProgress = s.status === "in_progress";
            const isRescheduled = s.status === "rescheduled";
            const isCheckedIn = s.status === "checked_in";
            const isCancelled = s.status === "cancelled";
            const isReq = s.status === "request_received";
            const isSlot = s.status === "slot_assigned";

            const color = isCompleted ? "emerald" :
                          isNoShow ? "red" :
                          isInProgress ? "purple" :
                          isRescheduled ? "orange" :
                          isCheckedIn ? "teal" :
                          isReq ? "amber" :
                          isSlot ? "brand-pink" :
                          isCancelled ? "surface" :
                          "blue"; // scheduled

            return (
              <div key={s.id} className="relative bg-white rounded-2xl p-4 sm:p-5 border border-surface-200 shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl bg-${color}-500 opacity-80 group-hover:opacity-100 transition-opacity`} />
                
                <div className="flex items-center gap-5 flex-1 pl-2">
                  <div className="flex flex-col items-center justify-center shrink-0 w-20">
                    <span className="text-lg font-black text-surface-900 tracking-tight">{formatTimeOnly(s.scheduledAt)}</span>
                    <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest mt-0.5">{formatDateOnly(s.scheduledAt)}</span>
                  </div>

                  <div className="w-px h-12 bg-surface-200 hidden sm:block" />

                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-surface-900 tracking-tight">
                        {s.customerName || "Customer Name"}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface-100 text-surface-600 border border-surface-200 uppercase tracking-wider">
                        {clinicName || s.clinicId}
                      </span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-1.5">
                      <span className="text-xs text-surface-500 font-medium flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {s.offerName || "Session"}
                      </span>
                      {s.customerPhone && (
                        <>
                          <span className="hidden sm:block w-1 h-1 rounded-full bg-surface-300" />
                          <span className="text-xs text-surface-500 font-mono" dir="ltr">{s.customerPhone}</span>
                        </>
                      )}
                    </div>

                    {/* Action Buttons for Pending/Scheduled */}
                    {['request_received', 'slot_assigned', 'scheduled', 'rescheduled'].includes(s.status) && (
                      <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setChangeClinicTarget(s);
                            setNewClinicSelection("");
                            setChangeIsPaid(false);
                            setChangeFee("5.000");
                          }}
                          className="text-[10px] font-bold bg-brand-pink-50 text-brand-pink-700 hover:bg-brand-pink-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-pink-100"
                        >
                          {ar() ? "تغيير العيادة" : "Change Clinic"}
                        </button>
                        <button
                          onClick={async () => {
                            if (!window.confirm(ar() ? "هل أنت متأكد من الإلغاء؟" : "Are you sure you want to cancel this?")) return;
                            try {
                              if (s.type === "session") {
                                await apiFetch(`/scheduling/clinic/sessions/${s.id}/mark`, {
                                  method: "POST",
                                  headers: getAuthHeader(),
                                  body: JSON.stringify({ status: "cancelled", notes: "Cancelled by admin" })
                                });
                              } else {
                                await apiFetch(`/scheduling/requests/${s.id}/reject`, {
                                  method: "POST",
                                  headers: getAuthHeader(),
                                  body: JSON.stringify({ reason: "Cancelled by admin" })
                                });
                              }
                              fetchSessions();
                            } catch (err: any) {
                              alert(err.message || "Failed to cancel");
                            }
                          }}
                          className="text-[10px] font-bold bg-surface-50 text-surface-600 hover:bg-red-50 hover:text-red-700 hover:border-red-100 px-3 py-1.5 rounded-lg transition-colors border border-surface-200 ml-2"
                        >
                          {ar() ? "إلغاء الموعد" : "Cancel"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-col items-end gap-2 pl-2 sm:pl-0 sm:w-32">
                  <span className={`w-full text-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-${color}-50 text-${color}-700 border border-${color}-100 shadow-sm`}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                  
                  <span className={`w-full text-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${
                    s.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                    "bg-amber-50 text-amber-700 border border-amber-100"
                  }`}>
                    {s.clinicPaymentStatus === "paid" ? (ar() ? "دفع: مدفوع" : "Pay: Paid") : (ar() ? "دفع: معلق" : "Pay: Pending")}
                  </span>

                  <span className={`w-full text-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm ${
                    attendanceStatus === 'awaiting' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                    attendanceStatus === 'checked_in' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                    attendanceStatus === 'attended' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                    attendanceStatus === 'no_show' ? 'bg-red-50 text-red-700 border border-red-100' :
                    'bg-surface-50 text-surface-500 border border-surface-200'
                  }`}>
                    {attendanceLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {changeClinicTarget && (
        <div className="fixed inset-0 z-[100] bg-surface-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 animate-slide-up relative">
            <button className="absolute top-5 right-5 text-surface-400 hover:text-surface-900" onClick={() => setChangeClinicTarget(null)}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-black text-surface-900 mb-5">{ar() ? "تغيير العيادة" : "Change Clinic"}</h3>
            
            <div className="space-y-5 mb-8">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-2">{ar() ? "اختر العيادة الجديدة" : "Select New Clinic"}</label>
                <select 
                  className="input-field w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 font-medium"
                  value={newClinicSelection}
                  onChange={e => setNewClinicSelection(e.target.value)}
                >
                  <option value="">{ar() ? "-- اختر العيادة --" : "-- Select Clinic --"}</option>
                  {apiClinics.map(c => (
                    <option key={c.id || c._id} value={c.id || c._id}>
                      {ar() ? c.nameAr || c.nameEn : c.nameEn}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-surface-200 hover:bg-surface-50 transition-colors">
                <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-pink-600 focus:ring-brand-pink-600" checked={changeIsPaid} onChange={e => setChangeIsPaid(e.target.checked)} />
                <span className="text-sm font-bold text-surface-700">{ar() ? "تطبيق رسوم تغيير" : "Apply Change Fee"}</span>
              </label>

              {changeIsPaid && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-bold text-surface-700 mb-2">{ar() ? "قيمة الرسوم (د.ك)" : "Fee Amount (KWD)"}</label>
                  <input type="number" step="0.001" className="input-field w-full bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 font-medium" value={changeFee} onChange={e => setChangeFee(e.target.value)} />
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setChangeClinicTarget(null)}
                className="flex-1 px-4 py-3 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors"
                disabled={changeSubmitting}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button 
                onClick={submitChangeClinic}
                className="flex-1 px-4 py-3 bg-brand-pink-500 text-white rounded-xl font-bold hover:bg-brand-pink-600 transition-colors disabled:opacity-50"
                disabled={changeSubmitting || !newClinicSelection || newClinicSelection === changeClinicTarget.clinicId}
              >
                {changeSubmitting ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "تأكيد" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

