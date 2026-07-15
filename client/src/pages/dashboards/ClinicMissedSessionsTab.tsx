import { useState, useEffect } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import { fmtDate } from "../../lib/dateFormat";
import DatePicker from "../../components/DatePicker";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

function RescheduleModal({ isOpen, session, onClose, onSubmit }: {
  isOpen: boolean;
  session: any;
  onClose: () => void;
  onSubmit: (scheduledAt: string) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDate("");
      setTime("");
    }
  }, [isOpen]);

  if (!isOpen || !session) return null;

  // Determine the minimum allowed date
  // If adminSuggestedAt exists, lock dates before it. Otherwise allow any date (or just today).
  // The DatePicker takes minDate in YYYY-MM-DD format.
  const minDate = session.adminSuggestedAt ? new Date(session.adminSuggestedAt).toISOString().split('T')[0] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
          <h3 className="font-bold text-surface-900">{ar() ? "إعادة جدولة الجلسة" : "Reschedule Session"}</h3>
          <button onClick={onClose} className="p-1.5 text-surface-400 hover:text-surface-700 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-surface-700 block mb-1">{ar() ? "التاريخ الجديد" : "New Date"}</label>
            <DatePicker value={date} onChange={e => setDate(e.target.value)} minDate={minDate} className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-bold text-surface-700 block mb-1">{ar() ? "الوقت الجديد" : "New Time"}</label>
            <DatePicker showTimeSelectOnly value={time} onChange={e => setTime(e.target.value)} className="input-field w-full" />
          </div>
          <button 
            disabled={loading || !date || !time} 
            onClick={async () => {
              setLoading(true);
              try { 
                const scheduledAt = new Date(`${date}T${time}`).toISOString();
                await onSubmit(scheduledAt); 
                onClose(); 
              } catch(e:any) { 
                alert(e.message); 
              } finally { 
                setLoading(false); 
              }
            }} 
            className="btn-primary w-full mt-2"
          >
            {loading ? "..." : (ar() ? "تأكيد" : "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClinicMissedSessionsTab({ clinicId, onCountLoaded }: { clinicId: string, onCountLoaded?: (count: number) => void }) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleSession, setRescheduleSession] = useState<any | null>(null);
  const { getAuthHeader } = useAuth();

  const fetchMissedSessions = async () => {
    try {
      setLoading(true);
      const res: any = await apiFetch(`/scheduling/clinic/${clinicId}/missed-sessions`, {
        headers: getAuthHeader()
      });
      setSessions(res.items || []);
      if (onCountLoaded) onCountLoaded(res.items?.length || 0);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinicId) {
      fetchMissedSessions();
    }
  }, [clinicId]);

  const handleReschedule = async (scheduledAt: string) => {
    if (!rescheduleSession) return;
    await apiFetch(`/scheduling/clinic/sessions/${rescheduleSession.id}/reschedule`, {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({ scheduledAt, notes: "Rescheduled from Missed Sessions tab" })
    });
    await fetchMissedSessions();
  };

  if (loading) return <div className="p-8 text-center text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>;

  return (
    <div className="p-4 sm:p-5 space-y-4 animate-fade-in">
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 bg-surface-50 rounded-2xl flex items-center justify-center text-2xl mb-3 border border-surface-100">✅</div>
          <h4 className="text-sm font-bold text-surface-700 mb-1">{ar() ? "لا توجد جلسات فائتة" : "All Clear"}</h4>
          <p className="text-[11px] text-surface-400 max-w-[180px]">{ar() ? "لا توجد جلسات فائتة حالياً" : "No missed sessions at the moment"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card-elevated p-5 border border-surface-200 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${s.status === "no_show" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                      {(s.customerName || "?")[0]}
                    </div>
                    <div>
                      <div className="font-bold text-surface-900">{s.customerName || "—"}</div>
                      <div className="text-xs text-surface-500">{s.customerPhone || ""}</div>
                    </div>
                    <span className={`ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${s.status === "no_show" ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                      {s.status === "no_show" ? (ar() ? "لم يحضر" : "No Show") : (ar() ? "موعد فائت" : "Past Date")}
                    </span>
                  </div>

                  <div className="text-sm text-surface-600 mb-2">
                    <span className="font-medium">{ar() ? "الخدمة:" : "Service:"}</span>{" "}
                    {s.offerName || "Session"}
                  </div>

                  {/* Scheduled date */}
                  <div className="bg-red-50 text-red-800 px-3 py-2 rounded-lg text-sm border border-red-100 flex gap-2 items-center">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <div>
                      <span className="font-bold">{ar() ? "الموعد المحدد:" : "Scheduled Date:"}</span>{" "}
                      {fmtDate(s.scheduledAt)} {new Date(s.scheduledAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  {/* Admin suggested date */}
                  {s.adminSuggestedAt && (
                    <div className="mt-2 bg-amber-50 text-amber-800 px-3 py-2 rounded-lg text-sm border border-amber-100 flex gap-2 items-center">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <div>
                        <span className="font-bold">{ar() ? "اقتراح الإدارة:" : "Admin Suggested:"}</span>{" "}
                        {fmtDate(s.adminSuggestedAt)} {new Date(s.adminSuggestedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )}

                  {/* Admin notes */}
                  {s.notes && (
                    <div className="mt-2 text-sm text-surface-600 bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                      <span className="font-bold">{ar() ? "ملاحظات الإدارة:" : "Admin Notes:"}</span> {s.notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[180px]">
                  <button 
                    onClick={() => setRescheduleSession(s)} 
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2.5 rounded-xl text-sm transition-colors border border-blue-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {ar() ? "إعادة جدولة" : "Reschedule"}
                  </button>
                  <button 
                    onClick={async () => {
                      if (!window.confirm(ar() ? "هل أنت متأكد من حذف هذه الجلسة؟" : "Are you sure you want to delete this session?")) return;
                      try {
                        await apiFetch(`/scheduling/clinic/sessions/${s.id}/mark`, {
                          method: "POST",
                          headers: getAuthHeader(),
                          body: JSON.stringify({ status: "cancelled", notes: "Deleted from Missed Sessions" })
                        });
                        await fetchMissedSessions();
                      } catch (e: any) {
                        alert(e.message || "Failed to delete");
                      }
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl text-sm transition-colors border border-red-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    {ar() ? "حذف" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RescheduleModal 
        isOpen={!!rescheduleSession} 
        session={rescheduleSession}
        onClose={() => setRescheduleSession(null)}
        onSubmit={handleReschedule}
      />
    </div>
  );
}
