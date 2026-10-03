import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

// ── KYC Review Card (expandable with docs) ──
export function KycReviewCard({ items }: { items: any[] }) {
  const { getAuthHeader } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/kyc/cs/${id}/approve`, { method: "POST", headers: getAuthHeader() });
      window.location.reload();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { alert(ar() ? "أدخل سبب الرفض" : "Enter a reason"); return; }
    setBusy(id);
    try {
      await apiFetch(`/kyc/cs/${id}/reject`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ reason: rejectReason }) });
      window.location.reload();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); setRejectId(null); setRejectReason(""); }
  };

  return (
    <div className="card-elevated bg-white rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-bold text-amber-800">{ar() ? "تحققات KYC معلقة" : "Pending KYC"}</span>
        </div>
        <span className="text-xs font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="divide-y divide-surface-100">
        {items.length === 0 && (
          <div className="px-5 py-6 text-center text-xs text-surface-400">{ar() ? "لا توجد تحققات معلقة" : "No pending KYC submissions"}</div>
        )}
        {items.map((k: any) => (
          <div key={k.id}>
            <button onClick={() => setExpandedId(expandedId === k.id ? null : k.id)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors">
              <div className="text-left">
                <div className="text-xs font-bold text-surface-900">{k.userName || "Unknown User"}</div>
                <div className="text-[10px] text-surface-500 mt-0.5 font-mono">
                  {k.civilIdNumberMasked || k.civilIdNumber || "—"} {k.userPhone ? `· ${k.userPhone}` : ""}
                </div>
                <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(k.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Pending</span>
                <svg className={`w-4 h-4 text-surface-400 transition-transform ${expandedId === k.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>
            {expandedId === k.id && (
              <div className="px-5 pb-4 space-y-3 animate-fade-in">
                {/* Documents */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: ar() ? "أمامية" : "Front", ref: k.civilIdFrontRef },
                    { label: ar() ? "خلفية" : "Back", ref: k.civilIdBackRef },
                    { label: ar() ? "توقيع" : "Signature", ref: k.signatureRef },
                  ].filter(d => d.ref).map(doc => (
                    <div key={doc.label} className="rounded-lg border border-surface-200 overflow-hidden">
                      <div className="text-[10px] font-bold text-surface-500 px-2 py-1 bg-surface-50 border-b border-surface-100">{doc.label}</div>
                      <img src={doc.ref.startsWith('http') || doc.ref.startsWith('data:') ? doc.ref : `/uploads/${doc.ref}`} alt={doc.label} className="w-full h-24 object-contain bg-white p-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  ))}
                </div>
                {/* Checkboxes */}
                {k.checkboxes && (
                  <div className="text-[10px] text-surface-500 flex flex-wrap gap-2">
                    {Object.entries(k.checkboxes).map(([key, val]) => (
                      <span key={key} className={`px-2 py-0.5 rounded-full font-bold ${val ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {val ? "✓" : "✗"} {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    ))}
                  </div>
                )}
                {/* Actions */}
                {rejectId === k.id ? (
                  <div className="space-y-2">
                    <textarea className="input-field text-xs w-full" rows={2} placeholder={ar() ? "سبب الرفض..." : "Rejection reason..."} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button disabled={busy === k.id} onClick={() => reject(k.id)} className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-50">{busy === k.id ? "…" : (ar() ? "تأكيد الرفض" : "Confirm Reject")}</button>
                      <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="text-xs font-bold text-surface-500 px-3 py-2">{ar() ? "إلغاء" : "Cancel"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={busy === k.id} onClick={() => approve(k.id)} className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {busy === k.id ? "…" : (ar() ? "✓ موافقة" : "✓ Approve")}
                    </button>
                    <button onClick={() => setRejectId(k.id)} className="text-xs font-bold bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">
                      {ar() ? "✗ رفض" : "✗ Reject"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
