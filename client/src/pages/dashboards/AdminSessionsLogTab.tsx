import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useAuth } from "../../app/AuthContext";
import { useApi } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { sharedClinics } from "../../lib/clinics";
import { fmtDate, fmtDateTime } from "../../lib/dateFormat";
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClinic, setFilterClinic] = useState("all");

  const [changeClinicTarget, setChangeClinicTarget] = useState<any>(null);
  const [newClinicSelection, setNewClinicSelection] = useState("");
  const [changeIsPaid, setChangeIsPaid] = useState(false);
  const [changeFee, setChangeFee] = useState("5.000");
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [newDateStr, setNewDateStr] = useState("");
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{ requests: any[]; scans: any[] } | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const fetchSessions = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const p = new URLSearchParams();
      if (fromDate || toDate) {
        const startDayStr = fromDate || toDate;
        const endDayStr = toDate || fromDate;

        const [sy, sm, sd] = startDayStr.split("-").map(Number);
        const [ey, em, ed] = endDayStr.split("-").map(Number);

        const fromIso = new Date(sy, sm - 1, sd, 0, 0, 0, 0).toISOString();
        const toIso = new Date(ey, em - 1, ed, 23, 59, 59, 999).toISOString();

        p.set("from", fromIso);
        p.set("to", toIso);
      }
      if (status !== "all") p.set("status", status);
      if (filterClinic !== "all") p.set("clinicId", filterClinic);

      const q = p.toString() ? `?${p.toString()}` : "";
      const res: any = await apiFetch(`/scheduling/admin/sessions-log${q}`, {
        headers: getAuthHeader()
      });
      setSessions(res.items || []);
    } catch {
      setSessions([]);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeader, fromDate, toDate, status, filterClinic]);

  useEffect(() => {
    fetchSessions(sessions.length === 0);
  }, [fetchSessions]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = new Date();
    return sessions.filter(s => {
      if (filterClinic !== "all" && String(s.clinicId) !== filterClinic) return false;
      if (status === "no_show") {
        const isScheduled = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status);
        const isPast = s.scheduledAt && new Date(s.scheduledAt) < now;
        const isNoShow = s.status === 'no_show' || (isScheduled && isPast);
        if (!isNoShow) return false;
      }
      if (!q) return true;
      const name = (s.customerName || "").toLowerCase();
      const phone = (s.customerPhone || "").toLowerCase();
      const offer = (s.offerName || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || offer.includes(q);
    });
  }, [sessions, filterClinic, searchQuery, status]);

  const analytics = useMemo(() => {
    let completed = 0;
    let pendingPayment = 0;
    let awaitingAttendance = 0;

    const now = new Date();
    for (const s of filteredSessions) {
      if (s.status === 'completed') {
        completed++;
      }

      if (s.clinicPaymentStatus !== 'paid') {
        pendingPayment++;
      }

      const isAwaiting = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status);
      const isPast = s.scheduledAt && new Date(s.scheduledAt) < now;
      if (isAwaiting && !isPast) {
        awaitingAttendance++;
      }
    }

    return {
      total: filteredSessions.length,
      completed,
      pendingPayment,
      awaitingAttendance
    };
  }, [filteredSessions]);

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

  const submitReschedule = async () => {
    if (!newDateStr) return;
    setRescheduleSubmitting(true);
    try {
      const scheduledAtIso = new Date(newDateStr).toISOString();
      await apiFetch(`/scheduling/admin/sessions-log/${rescheduleTarget.id}/edit-date`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt: scheduledAtIso, type: rescheduleTarget.type })
      });
      alert(ar() ? "تم تغيير الموعد بنجاح" : "Rescheduled successfully");
      setRescheduleTarget(null);
      fetchSessions();
    } catch (err: any) {
      alert(err.message || "Failed to reschedule");
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const toggleExpand = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setExpandedData(null);
      return;
    }
    setExpandedUserId(userId);
    setExpandedLoading(true);
    setExpandedData(null);
    try {
      const res: any = await apiFetch(`/scheduling/admin/session-details?userId=${encodeURIComponent(userId)}`, {
        headers: getAuthHeader(),
      });
      setExpandedData({ requests: res.requests || [], scans: res.scans || [] });
    } catch {
      setExpandedData({ requests: [], scans: [] });
    } finally {
      setExpandedLoading(false);
    }
  };

  if (initialLoading && sessions.length === 0) {
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
        <button 
          onClick={() => fetchSessions(false)} 
          disabled={refreshing}
          className="btn-secondary shrink-0 hidden sm:flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? (ar() ? "جاري التحديث..." : "Refreshing...") : (ar() ? "تحديث السجل" : "Refresh Log")}
        </button>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="bg-white rounded-2xl p-4 border border-surface-200 shadow-sm flex items-center gap-3 transition-all">
          <div className="w-11 h-11 rounded-xl bg-brand-pink-50 flex items-center justify-center text-brand-pink-600 shrink-0 font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-500">{ar() ? "إجمالي الجلسات" : "Total Sessions"}</div>
            <div className="text-xl font-extrabold text-surface-900 mt-0.5">{analytics.total}</div>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm flex items-center gap-3 transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-500">{ar() ? "الجلسات المكتملة" : "Completed Sessions"}</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{analytics.completed}</div>
          </div>
        </div>

        {/* Awaiting Attendance */}
        <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm flex items-center gap-3 transition-all">
          <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-500">{ar() ? "في انتظار الحضور" : "Awaiting Attendance"}</div>
            <div className="text-xl font-extrabold text-blue-700 mt-0.5">{analytics.awaitingAttendance}</div>
          </div>
        </div>

        {/* Awaiting Payments */}
        <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm flex items-center gap-3 transition-all">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold text-surface-500">{ar() ? "في انتظار الدفع" : "Awaiting Payments"}</div>
            <div className="text-xl font-extrabold text-amber-700 mt-0.5">{analytics.pendingPayment}</div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <svg className={`w-5 h-5 text-surface-400 absolute top-1/2 -translate-y-1/2 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder={ar() ? "بحث فوري بالاسم او الهاتف..." : "Instant search by name or phone..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`input-field w-full ${ar() ? 'pr-10 pl-8' : 'pl-10 pr-8'}`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className={`absolute top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 text-xs w-5 h-5 rounded-full bg-surface-100 flex items-center justify-center ${ar() ? 'left-2.5' : 'right-2.5'}`}
            >
              ✕
            </button>
          )}
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
            <option value="no_show">{ar() ? "لم يحضر (المواعيد الفائتة)" : "No Show (Missed)"}</option>
            <option value="cancelled">{ar() ? "ملغي" : "Cancelled"}</option>
            <option value="request_received">{ar() ? "تم استلام الطلب" : "Request Received"}</option>
            <option value="slot_assigned">{ar() ? "تم تحديد الوقت" : "Slot Assigned"}</option>
            <option value="in_progress">{ar() ? "قيد التنفيذ" : "In Progress"}</option>
            <option value="rescheduled">{ar() ? "إعادة جدولة" : "Rescheduled"}</option>
          </select>
          <div className="w-full md:w-36 shrink-0">
            <DatePicker 
              value={fromDate} 
              onChange={e => setFromDate(e.target.value)} 
              placeholder={ar() ? "من تاريخ" : "From date"}
              className="input-field w-full font-medium text-surface-700" 
            />
          </div>
          <div className="w-full md:w-36 shrink-0">
            <DatePicker 
              value={toDate} 
              onChange={e => setToDate(e.target.value)} 
              placeholder={ar() ? "إلى تاريخ" : "To date"}
              className="input-field w-full font-medium text-surface-700" 
            />
          </div>
        </div>
        <button onClick={() => fetchSessions(false)} disabled={refreshing} className="btn-secondary w-full sm:hidden flex justify-center items-center gap-2">
          <svg className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {refreshing ? (ar() ? "جاري التحديث..." : "Refreshing...") : (ar() ? "تحديث السجل" : "Refresh Log")}
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
                  const isScheduledStatus = ['request_received', 'slot_assigned', 'scheduled', 'rescheduled', 'awaiting_session_payment', 'under_review', 'slot_proposed', 'slot_accepted', 'confirmed', 'pending'].includes(s.status);
                  const isPast = s.scheduledAt && new Date(s.scheduledAt) < new Date();

                  const attendanceStatus = ['checked_in', 'in_progress'].includes(s.status) ? 'checked_in'
                    : s.status === 'completed' ? 'attended'
                    : s.status === 'no_show' || (isScheduledStatus && isPast) ? 'no_show'
                    : isScheduledStatus ? 'awaiting'
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
                  
                  const isExpanded = expandedUserId === s.userId;
                  
                  return (
                    <Fragment key={s.id}>
                    <tr className={`hover:bg-surface-50 transition-colors ${isExpanded ? 'bg-brand-pink-50/30' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleExpand(s.userId)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isExpanded
                                ? 'bg-brand-pink-500 text-white shadow-sm'
                                : 'bg-surface-100 text-surface-500 hover:bg-brand-pink-50 hover:text-brand-pink-600'
                            }`}
                            title={ar() ? "عرض التفاصيل" : "Show Details"}
                          >
                            <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <div>
                            <div className="font-bold text-surface-900">{s.customerName || "—"}</div>
                            <div className="text-xs text-surface-500">{s.customerPhone || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-800">
                            {clinicName || s.clinicId}
                          </span>
                          {!['cancelled', 'rejected'].includes(s.status) && (
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
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-surface-900">{fmtDate(s.scheduledAt)}</div>
                            <div className="text-xs text-surface-500">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          {!['cancelled', 'rejected'].includes(s.status) && (
                            <button
                              onClick={() => {
                                setRescheduleTarget(s);
                                setNewDateStr(s.scheduledAt || "");
                              }}
                              className="ml-2 text-[10px] font-bold bg-surface-100 text-surface-600 hover:bg-surface-200 px-2 py-1 rounded transition-colors"
                            >
                              {ar() ? "تعديل الوقت" : "Edit Date"}
                            </button>
                          )}
                        </div>
                      </td>
                      {/* Appointment Status */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                          s.status === 'completed' && s.clinicPaymentStatus !== 'paid' 
                            ? "bg-amber-50 text-amber-700" 
                            : isScheduledStatus && isPast
                            ? "bg-rose-50 text-rose-700"
                            : SESSION_STATUS_STYLE[s.status] ?? "bg-surface-100 text-surface-500"
                        }`}>
                          {s.status === 'completed' && s.clinicPaymentStatus !== 'paid' 
                            ? "Awaiting Session Payment" 
                            : isScheduledStatus && isPast
                            ? (ar() ? "فائت (لم يحضر)" : "Missed (No Show)")
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
                          {s.clinicPaymentStatus !== 'paid' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(ar() ? "تأكيد الدفع؟" : "Confirm payment?")) return;
                                // Optimistic update
                                setSessions(prev => prev.map(row =>
                                  row.id === s.id ? { ...row, clinicPaymentStatus: 'paid' } : row
                                ));
                                try {
                                  const reqId = s.requestId || s.id;
                                  await apiFetch(`/scheduling/requests/${reqId}/mark-paid`, {
                                    method: "POST",
                                    headers: getAuthHeader(),
                                    body: JSON.stringify({})
                                  });
                                  fetchSessions(false);
                                } catch (err: any) {
                                  // Revert
                                  setSessions(prev => prev.map(row =>
                                    row.id === s.id ? { ...row, clinicPaymentStatus: 'pending' } : row
                                  ));
                                  alert(err.message || "Failed to mark as paid");
                                }
                              }}
                              className="text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                            >
                              {ar() ? "دفع" : "Paid"}
                            </button>
                          )}
                          {s.clinicPaymentStatus === 'paid' && (
                            <button
                              onClick={async () => {
                                if (!window.confirm(ar() ? "هل تريد إلغاء الدفع؟" : "Mark as unpaid?")) return;
                                // Optimistic update
                                setSessions(prev => prev.map(row =>
                                  row.id === s.id ? { ...row, clinicPaymentStatus: 'pending' } : row
                                ));
                                try {
                                  const reqId = s.requestId || s.id;
                                  await apiFetch(`/scheduling/requests/${reqId}/mark-unpaid`, {
                                    method: "POST",
                                    headers: getAuthHeader(),
                                    body: JSON.stringify({})
                                  });
                                  fetchSessions(false);
                                } catch (err: any) {
                                  // Revert
                                  setSessions(prev => prev.map(row =>
                                    row.id === s.id ? { ...row, clinicPaymentStatus: 'paid' } : row
                                  ));
                                  alert(err.message || "Failed to mark as unpaid");
                                }
                              }}
                              className="text-[10px] font-bold bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                            >
                              {ar() ? "غير مدفوع" : "Unpaid"}
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const currentPrice = s.sessionPriceKwd || "0.000";
                              const newPrice = prompt(ar() ? "أدخل السعر الجديد (د.ك):" : "Enter new price (KWD):", currentPrice);
                              if (newPrice !== null && newPrice.trim() !== "") {
                                const parsed = parseFloat(newPrice);
                                if (!isNaN(parsed)) {
                                  try {
                                    const reqId = s.requestId || s.id;
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
                        </div>
                        {s.sessionPriceKwd !== undefined && s.sessionPriceKwd !== null && (
                          <div className="mt-1 text-xs font-medium text-surface-500">
                            {parseFloat(s.sessionPriceKwd).toFixed(3)} {ar() ? "د.ك" : "KWD"}
                          </div>
                        )}
                      </td>
                      {/* Attendance Status */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide ${attendanceStyle}`}>
                              {attendanceLabel}
                            </span>
                            {(attendanceStatus === 'awaiting' || attendanceStatus === 'no_show') && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(ar() ? "تأكيد حضور العميل؟" : "Mark customer as attended?")) return;
                                  // Optimistic update: immediately flip the row to completed
                                  setSessions(prev => prev.map(row =>
                                    row.id === s.id ? { ...row, status: 'completed', completedAt: new Date().toISOString() } : row
                                  ));
                                  try {
                                    await apiFetch(`/scheduling/admin/sessions-log/${s.id}/mark-attended`, {
                                      method: "POST",
                                      headers: getAuthHeader(),
                                      body: JSON.stringify({ type: s.type, notes: "Marked attended by admin" })
                                    });
                                    // Silently refresh in background (no loading spinner)
                                    fetchSessions(false);
                                  } catch (err: any) {
                                    // Revert optimistic update on failure
                                    setSessions(prev => prev.map(row =>
                                      row.id === s.id ? { ...row, status: s.status, completedAt: s.completedAt } : row
                                    ));
                                    alert(err.message || "Failed to mark as attended");
                                  }
                                }}
                                className="text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                              >
                                {ar() ? "حضر" : "Attended"}
                              </button>
                            )}
                            {attendanceStatus === 'attended' && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(ar() ? "إلغاء التحضير وتعيينه كـ 'لم يحضر'؟" : "Unmark attendance and set as No Show?")) return;
                                  // Optimistic update: flip back to no_show
                                  setSessions(prev => prev.map(row =>
                                    row.id === s.id ? { ...row, status: 'no_show', completedAt: undefined } : row
                                  ));
                                  try {
                                    await apiFetch(`/scheduling/admin/sessions-log/${s.id}/mark-no-show`, {
                                      method: "POST",
                                      headers: getAuthHeader(),
                                      body: JSON.stringify({ type: s.type, notes: "Unmarked by admin" })
                                    });
                                    fetchSessions(false);
                                  } catch (err: any) {
                                    setSessions(prev => prev.map(row =>
                                      row.id === s.id ? { ...row, status: s.status, completedAt: s.completedAt } : row
                                    ));
                                    alert(err.message || "Failed to update status");
                                  }
                                }}
                                className="text-[10px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 px-2 py-1 rounded transition-colors"
                                title={ar() ? "إلغاء التحضير وتعيينه لم يحضر" : "Unmark and set as No Show"}
                              >
                                {ar() ? "لم يحضر" : "No Show"}
                              </button>
                            )}
                          </div>
                          {attendanceStatus === 'attended' && s.markedByName && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200" title={ar() ? `تم التحضير بواسطة ${s.markedByName}` : `Marked by ${s.markedByName}`}>
                              <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{ar() ? `تم بواسطة: ${s.markedByName}` : `Marked by: ${s.markedByName}`}</span>
                            </span>
                          )}
                          {attendanceStatus === 'attended' && !s.hasScanHistory && !s.markedByName && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title={ar() ? "تم تسجيل الحضور ولكن لا يوجد سجل فحص QR" : "Attended without QR scan history"}>
                              <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>{ar() ? "يجب التأكد من العيادة" : "you need to check with the clinic"}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Detail Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="px-0 py-0 bg-surface-50 border-b-2 border-brand-pink-100">
                          <div className="px-6 py-5 animate-fade-in">
                            {expandedLoading ? (
                              <div className="flex items-center justify-center py-6 gap-3">
                                <div className="w-5 h-5 border-2 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin" />
                                <span className="text-sm text-surface-500 font-medium">{ar() ? "جاري التحميل..." : "Loading details..."}</span>
                              </div>
                            ) : expandedData ? (
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* Booking Requests Panel */}
                                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden shadow-sm">
                                  <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <span className="text-sm font-black text-indigo-800">
                                      {ar() ? `طلبات الحجز (${expandedData.requests.length})` : `Booking Requests (${expandedData.requests.length})`}
                                    </span>
                                  </div>
                                  {expandedData.requests.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-sm text-surface-400">{ar() ? "لا توجد طلبات حجز" : "No booking requests"}</div>
                                  ) : (
                                    <div className="divide-y divide-surface-100 max-h-[300px] overflow-y-auto">
                                      {expandedData.requests.map((r: any) => {
                                        const statusStyle: Record<string, string> = {
                                          completed: "bg-emerald-50 text-emerald-700",
                                          scheduled: "bg-blue-50 text-blue-700",
                                          slot_assigned: "bg-indigo-50 text-indigo-700",
                                          request_received: "bg-amber-50 text-amber-700",
                                          cancelled: "bg-red-50 text-red-700",
                                          checked_in: "bg-teal-50 text-teal-700",
                                          no_show: "bg-rose-50 text-rose-700",
                                        };
                                        return (
                                          <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-50">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-surface-800 truncate">{ar() ? r.clinicNameAr : r.clinicNameEn}</span>
                                                <span className="text-surface-400">•</span>
                                                <span className="text-surface-600 truncate">{r.offerName}</span>
                                              </div>
                                              <div className="flex items-center gap-3 mt-1 text-surface-500">
                                                {r.adminSuggestedAt && (
                                                  <span className="flex items-center gap-1">
                                                    <span className="font-bold text-amber-600">{ar() ? "اقتراح:" : "Suggested:"}</span>
                                                    {fmtDateTime(r.adminSuggestedAt)}
                                                  </span>
                                                )}
                                                {r.clinicScheduledAt && (
                                                  <span className="flex items-center gap-1">
                                                    <span className="font-bold text-emerald-600">{ar() ? "مجدول:" : "Scheduled:"}</span>
                                                    {fmtDateTime(r.clinicScheduledAt)}
                                                  </span>
                                                )}
                                                {r.createdAt && (
                                                  <span className="flex items-center gap-1">
                                                    <span className="font-bold text-surface-500">{ar() ? "تاريخ الطلب:" : "Requested:"}</span>
                                                    {fmtDateTime(r.createdAt)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${statusStyle[r.status] || "bg-surface-100 text-surface-600"}`}>
                                              {r.status?.replace(/_/g, " ")}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* QR Scans Panel */}
                                <div className="bg-white rounded-xl border border-surface-200 overflow-hidden shadow-sm">
                                  <div className="px-4 py-3 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                    <span className="text-sm font-black text-teal-800">
                                      {ar() ? `سجلات الفحص QR (${expandedData.scans.length})` : `QR Scans (${expandedData.scans.length})`}
                                    </span>
                                  </div>
                                  {expandedData.scans.length === 0 ? (
                                    <div className="px-4 py-6 text-center">
                                      {attendanceStatus === 'attended' ? (
                                        <div className="flex flex-col items-center justify-center p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl max-w-sm mx-auto">
                                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1.5 text-sm font-bold">⚠️</div>
                                          <div className="text-xs font-black text-amber-900">
                                            {ar() ? "يجب التأكد من العيادة" : "you need to check with the clinic"}
                                          </div>
                                          <div className="text-[11px] text-amber-700 mt-0.5">
                                            {ar() ? "تم تسجيل الحضور ولكن لا يوجد أي سجل فحص QR" : "Attended without QR scan history"}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-surface-400">{ar() ? "لا توجد سجلات فحص" : "No QR scans recorded"}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-surface-100 max-h-[300px] overflow-y-auto">
                                      {expandedData.scans.map((sc: any) => {
                                        const scanStyle = sc.status === "attended" ? "bg-emerald-50 text-emerald-700"
                                          : sc.status === "no_scheduled_session" ? "bg-orange-50 text-orange-700"
                                          : "bg-surface-100 text-surface-600";
                                        return (
                                          <div key={sc.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-50">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-surface-800 truncate">{ar() ? sc.clinicNameAr : sc.clinicNameEn}</span>
                                                <span className="text-surface-400">•</span>
                                                <span className="text-surface-600 truncate">{sc.offerName}</span>
                                              </div>
                                              <div className="flex items-center gap-3 mt-1 text-surface-500">
                                                <span className="flex items-center gap-1">
                                                  <span className="font-bold text-teal-600">{ar() ? "وقت الفحص:" : "Scanned:"}</span>
                                                  {sc.scannedAt ? fmtDateTime(sc.scannedAt) : "—"}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                  <span className="font-bold text-surface-500">{ar() ? "بواسطة:" : "By:"}</span>
                                                  {sc.scannedBy}
                                                </span>
                                              </div>
                                            </div>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${scanStyle}`}>
                                              {sc.status?.replace(/_/g, " ")}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
                    <option key={c.id} value={c.id}>{c.nameEn} - {c.nameAr}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="mark-paid-checkbox" 
                  checked={changeIsPaid} 
                  onChange={e => setChangeIsPaid(e.target.checked)} 
                  className="w-4 h-4 text-brand-pink-500 rounded border-surface-300"
                />
                <label htmlFor="mark-paid-checkbox" className="text-sm font-medium text-surface-700">
                  {ar() ? "تحديد كمدفوع مسبقاً؟ (اختياري)" : "Mark as paid? (optional)"}
                </label>
              </div>

              {changeIsPaid && (
                <div>
                  <label className="block text-sm font-bold text-surface-700 mb-1">{ar() ? "المبلغ المدفوع (د.ك)" : "Paid Amount (KWD)"}</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    className="input-field w-full"
                    value={changeFee}
                    onChange={e => setChangeFee(e.target.value)}
                  />
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

      {rescheduleTarget && (
        <div className="fixed inset-0 z-[100] bg-surface-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up relative">
            <button className="absolute top-4 right-4 text-surface-400 hover:text-surface-900" onClick={() => setRescheduleTarget(null)}>✕</button>
            <h3 className="text-xl font-bold text-surface-900 mb-4">{ar() ? "تعديل الموعد" : "Reschedule Appointment"}</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1">{ar() ? "الموعد الجديد (يوم/شهر/سنة)" : "New Date & Time (DD/MM/YYYY)"}</label>
                <DatePicker 
                  value={newDateStr}
                  onChange={e => setNewDateStr(e.target.value)}
                  showTimeSelect={true}
                  className="input-field w-full font-medium text-surface-700"
                />
              </div>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setRescheduleTarget(null)}
                className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors"
                disabled={rescheduleSubmitting}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button 
                onClick={submitReschedule}
                className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold hover:bg-brand-pink-600 transition-colors"
                disabled={rescheduleSubmitting || !newDateStr}
              >
                {rescheduleSubmitting ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "تأكيد" : "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
