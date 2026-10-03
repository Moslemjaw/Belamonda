import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../../app/AuthContext";
import { useClinicChangeRequestsCs, invalidateCache } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function ClinicChangeRequestsQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useClinicChangeRequestsCs();
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null);

  const clinicLabel = (r: any, dir: "from" | "to") => {
    if (dir === "from") return ar() ? (r.fromClinicNameAr || r.fromClinicNameEn || r.fromClinicId) : (r.fromClinicNameEn || r.fromClinicNameAr || r.fromClinicId);
    return ar() ? (r.toClinicNameAr || r.toClinicNameEn || r.toClinicId) : (r.toClinicNameEn || r.toClinicNameAr || r.toClinicId);
  };

  const approveChange = async (id: string) => {
    setProcessing(id);
    try {
      await apiFetch(`/commerce/cs/clinic-change-requests/${id}/approve`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      invalidateCache("/commerce/cs/clinic-change-requests");
      refetch();
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const rejectChange = async (id: string, reason?: string) => {
    setProcessing(id);
    try {
      await apiFetch(`/commerce/cs/clinic-change-requests/${id}/reject`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ reason: reason || undefined }),
      });
      invalidateCache("/commerce/cs/clinic-change-requests");
      refetch();
      setRejectModal(null);
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const items = data?.items || [];
  const pending = items.filter(r => r.status === "pending");

  return (
    <div className="card-elevated p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "طلبات تغيير العيادة" : "Clinic Change Requests"}</h3>
        <div className="flex items-center gap-2">
          <span className="badge-pink">{pending.length} {ar() ? "معلق" : "pending"}</span>
          <button className="btn-ghost btn-sm" onClick={() => refetch()}>↻</button>
        </div>
      </div>

      {loading ? <div className="shimmer h-32 rounded-xl" /> : pending.length === 0 ? (
        <div className="text-center text-sm text-surface-400 py-8">✅ {ar() ? "لا توجد طلبات تغيير عيادة" : "No pending clinic change requests"}</div>
      ) : pending.map(r => (
        <div key={r.id} className="py-4 border-b border-surface-100 last:border-0">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
              {(r.userName || r.userId)?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-bold text-surface-900">{r.userName || r.userId}</span>
                {r.userPhone && <span className="text-xs text-surface-400">{r.userPhone}</span>}
              </div>
              {r.offerName && <div className="text-xs text-surface-500 mb-1">{ar() && r.offerNameAr ? r.offerNameAr : r.offerName}</div>}
              <div className="flex items-center gap-1.5 text-xs text-surface-700 font-medium">
                <span className="bg-surface-100 px-2 py-0.5 rounded-lg">{clinicLabel(r, "from")}</span>
                <span className="text-surface-400">→</span>
                <span className="bg-brand-pink-50 text-brand-pink-700 px-2 py-0.5 rounded-lg">{clinicLabel(r, "to")}</span>
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                  {ar() ? `الطلب ${r.changeNumber}` : `Request #${r.changeNumber}`}
                </span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  {r.feeKwd} KWD
                </span>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                className="btn-primary btn-sm px-3 bg-emerald-500 hover:bg-emerald-600 border-none text-xs"
                disabled={processing === r.id}
                onClick={() => approveChange(r.id)}
              >
                {processing === r.id ? "..." : ar() ? "موافقة" : "Approve"}
              </button>
              <button
                className="btn-sm bg-red-50 text-red-500 hover:bg-red-100 rounded-lg px-3 py-1 text-xs font-medium"
                disabled={processing === r.id}
                onClick={() => setRejectModal({ id: r.id, reason: "" })}
              >
                {ar() ? "رفض" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Reject reason modal */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-surface-900 mb-3">{ar() ? "سبب الرفض" : "Rejection Reason"}</h3>
            <textarea
              className="input-field w-full h-24 text-sm resize-none mb-4"
              placeholder={ar() ? "اختياري..." : "Optional..."}
              value={rejectModal.reason}
              onChange={e => setRejectModal(m => m ? { ...m, reason: e.target.value } : null)}
            />
            <div className="flex gap-3">
              <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-2.5 rounded-xl text-sm" onClick={() => setRejectModal(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
              <button className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm" disabled={processing === rejectModal.id} onClick={() => rejectChange(rejectModal.id, rejectModal.reason)}>{ar() ? "تأكيد الرفض" : "Confirm Reject"}</button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
