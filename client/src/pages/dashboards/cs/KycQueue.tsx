import { useState } from "react";
import { fmtDateTime } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { createPortal } from "react-dom";
import { useAuth } from "../../../app/AuthContext";
import { useKycQueue, invalidateCache } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function KycQueue() {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useKycQueue();
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewingKyc, setViewingKyc] = useState<any>(null);
  const [kycExpiryDate, setKycExpiryDate] = useState("");

  const reviewKyc = async (submissionId: string, decision: "approve" | "reject") => {
    setProcessing(submissionId);
    try {
      if (decision === "approve") {
        await apiFetch(`/kyc/cs/${submissionId}/approve`, { 
          method: "POST", 
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(kycExpiryDate ? { expiryDate: kycExpiryDate } : {})
        });
      } else {
        await apiFetch(`/kyc/cs/${submissionId}/reject`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ reason: "Documents unclear" }) });
      }
      invalidateCache("/kyc");
      refetch(true);
    } catch (e: any) { alert(e.message); }
    finally { setProcessing(null); }
  };

  const items = data?.items || [];
  const fmtAge = (iso: string) => {
    const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 60) return ar() ? `${mins} د` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return ar() ? `${hrs} س` : `${hrs}h`;
    return ar() ? `${Math.floor(hrs / 24)} ي` : `${Math.floor(hrs / 24)}d`;
  };
  return (
    <div className="card-elevated p-3 sm:p-5 flex flex-col h-[400px] overflow-hidden">
      <div className="editorial-header justify-between shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <span className="accent" />
          <div>
            <h3>{ar() ? "طابور التحققات" : "KYC Verification Queue"}</h3>
            <div className="meta">{ar() ? "مراجعة وثائق الهوية للأعضاء الجدد" : "Review identity documents for new members"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {items.length > 0 && <span className="status-pill-pending"><span className="dot" aria-hidden="true" />{items.length} {ar() ? "معلق" : "pending"}</span>}
          <button className="icon-btn" onClick={() => refetch()} aria-label={ar() ? "تحديث القائمة" : "Refresh queue"} title={ar() ? "تحديث" : "Refresh"}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>
      {loading ? <div className="shimmer h-32 rounded-2xl" /> : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "كل التحققات مكتملة" : "All caught up"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "لا توجد تحققات معلقة حالياً" : "No pending verifications"}</div>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto overflow-x-hidden flex-1 pr-2">
          {items.map((k: any) => {
            const ageMins = (Date.now() - new Date(k.createdAt).getTime()) / 60000;
            const priority = ageMins > 240 ? "red" : ageMins > 60 ? "yellow" : "green";
            return (
              <div key={k.id} className="queue-row group flex-wrap">
                <div className={`priority-${priority} shrink-0 hidden sm:block`} aria-hidden="true" />
                <span className="sr-only">{priority === "red" ? (ar() ? "أولوية عالية" : "High priority") : priority === "yellow" ? (ar() ? "أولوية متوسطة" : "Medium priority") : (ar() ? "أولوية منخفضة" : "Low priority")}</span>
                <div className="avatar avatar-sm sm:avatar-md" aria-hidden="true">{(k.userName || "?")?.charAt(0)?.toUpperCase()}</div>
                <div className="flex-1 min-w-[9rem]">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="text-xs sm:text-sm font-bold text-surface-900 truncate">{k.userName || "Unknown User"}</div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-surface-400 bg-surface-100 px-1 sm:px-1.5 py-0.5 rounded shrink-0" title={fmtDateTime(k.createdAt)}>{fmtAge(k.createdAt)}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-surface-500 mt-0.5 flex items-center gap-1 sm:gap-2 truncate">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                    <span className="font-mono truncate">{k.civilIdNumberMasked || k.civilIdNumber || "—"}</span>
                    {k.userPhone && (
                      <>
                        <span>·</span>
                        <span className="font-mono truncate">{k.userPhone}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <button
                    className="icon-btn"
                    onClick={() => setViewingKyc(k)}
                    aria-label={ar() ? `عرض وثائق ${k.userName || "Unknown"}` : `View documents for ${k.userName || "Unknown"}`}
                    title={ar() ? "عرض الوثائق" : "View Documents"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </button>
                  <button
                    className="icon-btn-success"
                    disabled={processing === k.id}
                    onClick={() => reviewKyc(k.id, "approve")}
                    aria-label={ar() ? `قبول التحقق لـ ${k.userName || "Unknown"}` : `Approve verification for ${k.userName || "Unknown"}`}
                    title={ar() ? "قبول" : "Approve"}
                  >
                    {processing === k.id ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                  <button
                    className="icon-btn-danger"
                    disabled={processing === k.id}
                    onClick={() => reviewKyc(k.id, "reject")}
                    aria-label={ar() ? `رفض التحقق لـ ${k.userName || "Unknown"}` : `Reject verification for ${k.userName || "Unknown"}`}
                    title={ar() ? "رفض" : "Reject"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingKyc && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-slide-up relative flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-surface-100 shrink-0">
              <h3 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                {ar() ? "وثائق الهوية" : "Identity Documents"} - {viewingKyc.userName || "Unknown User"}
              </h3>
              <button className="text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setViewingKyc(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-100">
                  <h4 className="text-sm font-bold text-surface-700 mb-3 text-center">{ar() ? "البطاقة المدنية (الجهة الأمامية)" : "Civil ID (Front)"}</h4>
                  <img src={viewingKyc.civilIdFrontRef?.startsWith('http') || viewingKyc.civilIdFrontRef?.startsWith('data:') ? viewingKyc.civilIdFrontRef : `/uploads/${viewingKyc.civilIdFrontRef}`} alt="Civil ID Front" className="w-full h-auto rounded-lg shadow-sm" />
                </div>
                <div className="bg-surface-50 p-4 rounded-2xl border border-surface-100">
                  <h4 className="text-sm font-bold text-surface-700 mb-3 text-center">{ar() ? "البطاقة المدنية (الجهة الخلفية)" : "Civil ID (Back)"}</h4>
                  <img src={viewingKyc.civilIdBackRef?.startsWith('http') || viewingKyc.civilIdBackRef?.startsWith('data:') ? viewingKyc.civilIdBackRef : `/uploads/${viewingKyc.civilIdBackRef}`} alt="Civil ID Back" className="w-full h-auto rounded-lg shadow-sm" />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-surface-50 border-t border-surface-100 flex items-center justify-between">
              <div>
                <label className="block text-sm font-bold text-surface-700 mb-1">{ar() ? "تاريخ انتهاء البطاقة (اختياري)" : "Expiry Date (Optional)"}</label>
                <DatePicker 
                  className="input-field max-w-[200px]" 
                  value={kycExpiryDate}
                  onChange={e => setKycExpiryDate(e.target.value)}
                />
              </div>
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-surface-100 shrink-0 flex gap-3">
              <button className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm" onClick={() => { setViewingKyc(null); setKycExpiryDate(""); }}>{ar() ? "إغلاق" : "Close"}</button>
              <button
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
                disabled={processing === viewingKyc.id}
                onClick={() => { reviewKyc(viewingKyc.id, "approve"); setViewingKyc(null); setKycExpiryDate(""); }}
              >
                {processing === viewingKyc.id ? "..." : ar() ? "قبول وتوثيق" : "Approve & Verify"}
              </button>
            </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
