import { fmtDateTime } from "../../lib/dateFormat";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";
import DatePicker from "../../components/DatePicker";
const ar = () => i18n.language === "ar";

export default function ClinicBookingRequestsTab({ clinicId }: { clinicId: string }) {
  const { getAuthHeader } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ scheduledAt: string; notes: string }>({ scheduledAt: "", notes: "" });
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiFetch(`/scheduling/clinic/requests?clinicId=${clinicId}&status=open`, {
        headers: getAuthHeader()
      });
      setRequests(res.items || []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, getAuthHeader]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const confirmDate = async (requestId: string, overrideDate?: string) => {
    const req = requests.find((r: any) => r.id === requestId);
    if (!req) return;

    const finalDate = overrideDate || req.proposedAt;
    if (!finalDate) return;

    setProcessing(requestId);
    try {
      const iso = new Date(finalDate).toISOString();
      await apiFetch(`/scheduling/clinic/requests/${encodeURIComponent(requestId)}/confirm`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt: iso, notes: scheduleForm.notes || undefined })
      });

      setScheduleForm({ scheduledAt: "", notes: "" });
      setSelectedRequest(null);
      await fetchRequests();
      alert(ar() ? "تم تأكيد الموعد بنجاح!" : "Booking confirmed successfully!");
    } catch (e: any) {
      alert(e.message || "Failed to confirm booking.");
    } finally {
      setProcessing(null);
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-surface-900">{ar() ? "طلبات الحجز" : "Booking Requests"}</h3>
          <p className="text-sm text-surface-500 mt-1">
            {ar() ? "مراجعة وتأكيد طلبات الحجز والمواعيد المقترحة" : "Review and confirm booking requests and proposed dates"}
          </p>
        </div>
        <button onClick={fetchRequests} className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg">
          ↻ {ar() ? "تحديث" : "Refresh"}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="card-elevated p-16 text-center border-dashed border-2 border-surface-200 bg-surface-50/50">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4">
            <svg className="w-10 h-10 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h4 className="text-lg font-bold text-surface-700 mb-1">{ar() ? "لا توجد طلبات حجز" : "No Pending Requests"}</h4>
          <p className="text-sm text-surface-500">{ar() ? "ستظهر هنا طلبات الحجز الجديدة والمقترحة." : "New and proposed booking requests will appear here."}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((r: any) => (
            <div key={r.id} className="card-elevated p-5 border border-surface-200 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-brand-pink-50 text-brand-pink-600 flex items-center justify-center font-bold text-sm">
                      {(r.customerName || "?")[0]}
                    </div>
                    <div>
                      <div className="font-bold text-surface-900">{r.customerName || "—"}</div>
                      <div className="text-xs text-surface-500">{r.customerPhone || ""}</div>
                    </div>
                  </div>

                  <div className="text-sm text-surface-600 mb-2">
                    <span className="font-medium">{ar() ? "الخدمة:" : "Service:"}</span>{" "}
                    {r.offerName || (ar() ? "حجز مستقل" : "Standalone Booking")}
                  </div>

                  {r.proposedAt ? (
                    <div className="bg-amber-50 text-amber-800 px-3 py-2 rounded-lg text-sm border border-amber-100 flex gap-2 items-center">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <div>
                        <span className="font-bold">{ar() ? "الموعد المقترح:" : "Suggested Date:"}</span>{" "}
                        {fmtDateTime(r.proposedAt)}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-blue-50 text-blue-800 px-3 py-2 rounded-lg text-sm border border-blue-100 flex gap-2 items-center">
                      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <div>
                        <span className="font-bold">{ar() ? "طلب جديد" : "New Request"}</span>{" "}
                        {r.preferredAt && <span className="block text-xs mt-0.5 opacity-90">{ar() ? "الوقت المفضل:" : "Preferred:"} {fmtDateTime(r.preferredAt)}</span>}
                      </div>
                    </div>
                  )}

                  {r.notes && (
                    <div className="mt-2 text-sm text-surface-600 bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                      <span className="font-bold">{ar() ? "ملاحظات الإدارة:" : "Admin Notes:"}</span> {r.notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 w-full md:w-auto md:min-w-[200px]">
                  {selectedRequest === r.id ? (
                    <div className="bg-surface-50 p-3 rounded-xl border border-surface-200 flex flex-col gap-2">
                      <label className="text-xs font-bold text-surface-700">{ar() ? "اختر موعداً جديداً:" : "Select new date:"}</label>
                      <DatePicker
                        showTimeSelect
                        className="w-full bg-white border border-surface-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-pink-500"
                        value={scheduleForm.scheduledAt}
                        onChange={e => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                      />
                      <div className="flex gap-2 mt-1">
                        <button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                          disabled={!scheduleForm.scheduledAt || processing === r.id}
                          onClick={() => confirmDate(r.id, scheduleForm.scheduledAt)}
                        >
                          {processing === r.id ? "..." : ar() ? "تأكيد" : "Confirm"}
                        </button>
                        <button
                          className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-600 font-bold py-2 rounded-lg text-sm transition-colors"
                          onClick={() => setSelectedRequest(null)}
                        >
                          {ar() ? "إلغاء" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {r.proposedAt && (
                        <button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                          disabled={processing === r.id}
                          onClick={() => confirmDate(r.id)}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {processing === r.id ? "..." : ar() ? "تأكيد الموعد المقترح" : "Confirm Suggested Date"}
                        </button>
                      )}
                      <button
                        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2.5 rounded-xl text-sm transition-colors border border-blue-200 flex items-center justify-center gap-2"
                        onClick={() => setSelectedRequest(r.id)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {ar() ? (r.proposedAt ? "تغيير الموعد وتأكيد" : "تحديد موعد وتأكيد") : (r.proposedAt ? "Change Date & Confirm" : "Set Date & Confirm")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
