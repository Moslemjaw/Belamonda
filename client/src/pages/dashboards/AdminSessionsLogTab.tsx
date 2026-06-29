import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import { sharedClinics } from "../../lib/clinics";
import { fmtDate } from "../../lib/dateFormat";

const ar = () => i18n.language === "ar";

export default function AdminSessionsLogTab() {
  const { getAuthHeader } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("all");

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      let q = "";
      if (startDate || endDate || status !== "all") {
        const p = new URLSearchParams();
        if (startDate) p.set("from", startDate);
        if (endDate) p.set("to", endDate);
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
  }, [getAuthHeader, startDate, endDate, status]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-surface-900">{ar() ? "سجل الجلسات" : "Sessions Log"}</h3>
          <p className="text-sm text-surface-500 mt-1">
            {ar() ? "عرض جميع الجلسات والطلبات في العيادات" : "View all sessions and pending requests across clinics"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <select value={status} onChange={e => setStatus(e.target.value)} className="input-field py-1.5 text-sm">
              <option value="all">{ar() ? "الكل" : "All Statuses"}</option>
              <option value="scheduled">{ar() ? "مجدول" : "Scheduled"}</option>
              <option value="completed">{ar() ? "مكتمل" : "Completed"}</option>
              <option value="no_show">{ar() ? "لم يحضر" : "No Show"}</option>
              <option value="cancelled">{ar() ? "ملغي" : "Cancelled"}</option>
              <option value="pending">{ar() ? "قيد الانتظار" : "Pending"}</option>
              <option value="under_review">{ar() ? "قيد المراجعة" : "Under Review"}</option>
              <option value="slot_proposed">{ar() ? "تم اقتراح موعد" : "Slot Proposed"}</option>
              <option value="slot_accepted">{ar() ? "تم قبول الموعد" : "Slot Accepted"}</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field py-1.5 text-sm" />
            <span className="text-surface-400">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field py-1.5 text-sm" />
          </div>
          <button onClick={fetchSessions} className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg">
            ↻ {ar() ? "تحديث" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="card-elevated overflow-hidden border border-surface-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-surface-600">
            <thead className="bg-surface-50 border-b border-surface-200 text-surface-700 uppercase font-bold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-4">{ar() ? "العميل" : "Customer"}</th>
                <th className="px-6 py-4">{ar() ? "العيادة" : "Clinic"}</th>
                <th className="px-6 py-4">{ar() ? "الخدمة" : "Service"}</th>
                <th className="px-6 py-4">{ar() ? "تاريخ الموعد" : "Scheduled At"}</th>
                <th className="px-6 py-4">{ar() ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-surface-500">
                    {ar() ? "لا توجد جلسات." : "No sessions found."}
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const clinic = sharedClinics.find(c => c.id === s.clinicId);
                  const clinicName = ar() ? clinic?.nameAr : clinic?.nameEn;
                  
                  return (
                    <tr key={s.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-surface-900">{s.customerName || "—"}</div>
                        <div className="text-xs text-surface-500">{s.customerPhone || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-100 text-surface-800">
                          {clinicName || s.clinicId}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-surface-700">
                        {s.offerName}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-surface-900">{fmtDate(s.scheduledAt)}</div>
                        <div className="text-xs text-surface-500">{new Date(s.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide
                          ${s.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : ''}
                          ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : ''}
                          ${s.status === 'no_show' ? 'bg-red-50 text-red-700' : ''}
                          ${s.status === 'cancelled' ? 'bg-surface-100 text-surface-600' : ''}
                          ${['pending', 'under_review'].includes(s.status) ? 'bg-amber-50 text-amber-700' : ''}
                          ${s.status === 'slot_proposed' ? 'bg-brand-pink-50 text-brand-pink-700' : ''}
                          ${s.status === 'slot_accepted' ? 'bg-indigo-50 text-indigo-700' : ''}
                        `}>
                          {s.status.replace(/_/g, ' ')}
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
    </div>
  );
}
