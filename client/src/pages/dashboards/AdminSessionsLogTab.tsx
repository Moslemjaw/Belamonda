import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { sharedClinics } from "../../lib/clinics";
import { fmtDate } from "../../lib/dateFormat";
import DatePicker from "../../components/DatePicker";

const ar = () => i18n.language === "ar";

const SESSION_STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  scheduled: "bg-indigo-50 text-indigo-700",
  no_show:   "bg-red-50 text-red-700",
  cancelled: "bg-surface-100 text-surface-600",
  request_received: "bg-amber-50 text-amber-700",
  slot_assigned: "bg-brand-pink-50 text-brand-pink-700",
  checked_in: "bg-teal-50 text-teal-700",
  in_progress: "bg-purple-50 text-purple-700",
  rescheduled: "bg-orange-50 text-orange-700",
  // Legacy statuses
  awaiting_session_payment: "bg-amber-50 text-amber-700",
  under_review: "bg-amber-50 text-amber-700",
  slot_proposed: "bg-blue-50 text-blue-700",
  slot_accepted: "bg-indigo-50 text-indigo-700",
  confirmed: "bg-indigo-50 text-indigo-700",
  rejected: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
};

export default function AdminSessionsLogTab() {
  const { getAuthHeader } = useAuth();
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics/admin");
  const apiClinics = clinicsData?.items || [];

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClinic, setFilterClinic] = useState("all");

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
    if (filterClinic !== "all" && String(s.clinicId) !== filterClinic) return false;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-surface-900">{ar() ? "سجل الجلسات" : "Sessions Log"}</h3>
          <p className="text-sm text-surface-500 mt-1">
            {ar() ? "عرض جميع الجلسات والطلبات في العيادات" : "View all sessions and pending requests across clinics"}
          </p>
        </div>
        <button onClick={fetchSessions} className="btn-secondary shrink-0 hidden sm:flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {ar() ? "تحديث السجل" : "Refresh Log"}
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <svg className={`w-5 h-5 text-surface-400 absolute top-1/2 -translate-y-1/2 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder={ar() ? "بحث بالاسم او الهاتف..." : "Search customer name or phone..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`input-field w-full ${ar() ? 'pr-10' : 'pl-10'}`}
          />
        </div>
        <div className="w-full md:w-auto flex flex-wrap md:flex-nowrap gap-3">
          <select value={filterClinic} onChange={e => setFilterClinic(e.target.value)} className="input-field w-full md:w-40 font-medium text-surface-700">
            <option value="all">{ar() ? "جميع العيادات" : "All Clinics"}</option>
            {apiClinics.map(c => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {ar() ? c.nameAr || c.nameEn : c.nameEn}
              </option>
            ))}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-full md:w-40 font-medium text-surface-700">
            <option value="all">{ar() ? "جميع الحالات" : "All Statuses"}</option>
            <option value="scheduled">{ar() ? "مجدول" : "Scheduled"}</option>
            <option value="completed">{ar() ? "مكتمل" : "Completed"}</option>
            <option value="no_show">{ar() ? "لم يحضر" : "No Show"}</option>
            <option value="cancelled">{ar() ? "ملغي" : "Cancelled"}</option>
            <option value="request_received">{ar() ? "تم استلام الطلب" : "Request Received"}</option>
            <option value="slot_assigned">{ar() ? "تم تحديد الوقت" : "Slot Assigned"}</option>
            <option value="in_progress">{ar() ? "قيد التنفيذ" : "In Progress"}</option>
            <option value="rescheduled">{ar() ? "إعادة جدولة" : "Rescheduled"}</option>
          </select>
          <div className="w-full md:w-40 shrink-0">
            <DatePicker 
              value={filterDate} 
              onChange={e => setFilterDate(e.target.value)} 
              className="input-field w-full font-medium text-surface-700" 
            />
          </div>
        </div>
        <button onClick={fetchSessions} className="btn-secondary w-full sm:hidden flex justify-center items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {ar() ? "تحديث السجل" : "Refresh Log"}
        </button>
      </div>

      <div className="card-elevated overflow-hidden border border-surface-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-surface-600">
            <thead className="bg-surface-50 border-b border-surface-200 text-surface-700 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="px-5 py-4">{ar() ? "العميل" : "Customer"}</th>
                <th className="px-5 py-4">{ar() ? "العيادة" : "Clinic"}</th>
                <th className="px-5 py-4">{ar() ? "الخدمة" : "Service"}</th>
                <th className="px-5 py-4">{ar() ? "تاريخ الموعد" : "Scheduled At"}</th>
                <th className="px-5 py-4">{ar() ? "حالة الموعد" : "Appointment"}</th>
                <th className="px-5 py-4">{ar() ? "حالة الدفع" : "Payment"}</th>
                <th className="px-5 py-4">{ar() ? "حالة الحضور" : "Attendance"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-surface-500">
                    {ar() ? "لا توجد جلسات." : "No sessions found."}
                  </td>
                </tr>
              ) : (
                filteredSessions.map((s) => {
                  const clinic = apiClinics.find(c => String(c.id || c._id) === String(s.clinicId));
                  const clinicName = ar() ? clinic?.nameAr : clinic?.nameEn;

                  // Derive attendance status from appointment status
                  const attendanceStatus = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status)
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

                  const attendanceStyle = attendanceStatus === 'awaiting' ? 'bg-blue-50 text-blue-700'
                    : attendanceStatus === 'checked_in' ? 'bg-teal-50 text-teal-700'
                    : attendanceStatus === 'attended' ? 'bg-emerald-50 text-emerald-700'
                    : attendanceStatus === 'no_show' ? 'bg-red-50 text-red-700'
                    : 'bg-surface-100 text-surface-500';

                  const paymentLabel = s.clinicPaymentStatus === 'paid' ? (ar() ? 'مدفوع' : 'Paid') : (ar() ? 'معلق' : 'Pending');
                  const paymentStyle = s.clinicPaymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
                  
                  return (
                    <tr key={s.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-surface-900">{s.customerName || "—"}</div>
                        <div className="text-xs text-surface-500">{s.customerPhone || "—"}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-800">
                            {clinicName || s.clinicId}
                          </span>
                          {['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'slot_proposed', 'under_review', 'pending'].includes(s.status) && (
                            <>
                              <button 
                                onClick={() => {
                                  setChangeClinicTarget(s);
                                  setNewClinicSelection("");
                                  setChangeIsPaid(false);
                                  setChangeFee("5.000");
                                }}
                                className="text-[10px] font-bold bg-brand-pink-50 text-brand-pink-600 hover:bg-brand-pink-100 px-2 py-1 rounded transition-colors"
                              >
                                {ar() ? "تغيير" : "Change"}
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
                                className="text-[10px] font-bold bg-surface-100 text-surface-600 hover:bg-red-50 hover:text-red-600 px-2 py-1 rounded transition-colors ml-2"
                              >
                                {ar() ? "إلغاء" : "Cancel"}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-surface-700">
                        {s.offerName}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-surface-900">{fmtDate(s.scheduledAt)}</div>
                        <div className="text-xs text-surface-500">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      {/* Appointment Status */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                          s.status === 'completed' && s.clinicPaymentStatus !== 'paid' 
                            ? "bg-amber-50 text-amber-700" 
                            : SESSION_STATUS_STYLE[s.status] ?? "bg-surface-100 text-surface-500"
                        }`}>
                          {s.status === 'completed' && s.clinicPaymentStatus !== 'paid' 
                            ? "Awaiting Session Payment" 
                            : s.status === 'slot_accepted' ? (ar() ? "مجدول" : "Scheduled")
                            : s.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      {/* Payment Status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${paymentStyle}`}>
                            {paymentLabel}
                          </span>
                          {s.clinicPaymentStatus !== 'paid' && (s.type === 'request' || s.requestId) && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(ar() ? "تأكيد الدفع؟" : "Confirm payment?")) return;
                                try {
                                  const reqId = s.type === 'request' ? s.id : s.requestId;
                                  await apiFetch(`/scheduling/requests/${reqId}/mark-paid`, {
                                    method: "POST",
                                    headers: getAuthHeader(),
                                    body: JSON.stringify({})
                                  });
                                  fetchSessions();
                                } catch (err: any) {
                                  alert(err.message || "Failed to mark as paid");
                                }
                              }}
                              className="text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                            >
                              {ar() ? "دفع" : "Paid"}
                            </button>
                          )}
                          {s.clinicPaymentStatus === 'paid' && (s.type === 'request' || s.requestId) && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(ar() ? "هل تريد إلغاء الدفع؟" : "Mark as unpaid?")) return;
                                try {
                                  const reqId = s.type === 'request' ? s.id : s.requestId;
                                  await apiFetch(`/scheduling/requests/${reqId}/mark-unpaid`, {
                                    method: "POST",
                                    headers: getAuthHeader(),
                                    body: JSON.stringify({})
                                  });
                                  fetchSessions();
                                } catch (err: any) {
                                  alert(err.message || "Failed to mark as unpaid");
                                }
                              }}
                              className="text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                            >
                              {ar() ? "غير مدفوع" : "Unpaid"}
                            </button>
                          )}
                          {(s.type === 'request' || s.requestId) && (
                            <button
                              onClick={async () => {
                                const currentPrice = s.sessionPriceKwd || "0.000";
                                const newPrice = prompt(ar() ? "أدخل السعر الجديد (د.ك):" : "Enter new price (KWD):", currentPrice);
                                if (newPrice !== null && newPrice.trim() !== "") {
                                  const parsed = parseFloat(newPrice);
                                  if (!isNaN(parsed)) {
                                    try {
                                      const reqId = s.type === 'request' ? s.id : s.requestId;
                                      await apiFetch(`/scheduling/requests/${reqId}/update-price`, {
                                        method: "POST",
                                        headers: getAuthHeader(),
                                        body: JSON.stringify({ sessionPriceKwd: parsed.toFixed(3) })
                                      });
                                      fetchSessions();
                                    } catch (err: any) {
                                      alert(err.message || "Failed to update price");
                                    }
                                  } else {
                                    alert(ar() ? "سعر غير صالح" : "Invalid price");
                                  }
                                }
                              }}
                              className="text-[10px] font-bold bg-surface-100 text-surface-600 hover:bg-surface-200 px-2 py-1 rounded transition-colors"
                            >
                              {ar() ? "تعديل السعر" : "Edit Price"}
                            </button>
                          )}
                        </div>
                        {s.sessionPriceKwd !== undefined && s.sessionPriceKwd !== null && (
                          <div className="mt-1 text-xs font-medium text-surface-500">
                            {parseFloat(s.sessionPriceKwd).toFixed(3)} {ar() ? "د.ك" : "KWD"}
                          </div>
                        )}
                      </td>
                      {/* Attendance Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${attendanceStyle}`}>
                          {attendanceLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {changeClinicTarget && (
        <div className="fixed inset-0 z-[100] bg-surface-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up relative">
            <button className="absolute top-4 right-4 text-surface-400 hover:text-surface-900" onClick={() => setChangeClinicTarget(null)}>✕</button>
            <h3 className="text-xl font-bold text-surface-900 mb-4">{ar() ? "تغيير العيادة" : "Change Clinic"}</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1">{ar() ? "اختر العيادة الجديدة" : "Select New Clinic"}</label>
                <select 
                  className="input-field w-full"
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

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-brand-pink-600 focus:ring-brand-pink-600" checked={changeIsPaid} onChange={e => setChangeIsPaid(e.target.checked)} />
                <span className="text-sm font-medium text-surface-700">{ar() ? "تطبيق رسوم تغيير" : "Apply Change Fee"}</span>
              </label>

              {changeIsPaid && (
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1">{ar() ? "قيمة الرسوم (د.ك)" : "Fee Amount (KWD)"}</label>
                  <input type="number" step="0.001" className="input-field w-full" value={changeFee} onChange={e => setChangeFee(e.target.value)} />
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setChangeClinicTarget(null)}
                className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors"
                disabled={changeSubmitting}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button 
                onClick={submitChangeClinic}
                className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold hover:bg-brand-pink-600 transition-colors"
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
