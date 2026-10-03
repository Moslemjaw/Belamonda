import { useState } from "react";
import { fmtDateTime } from "../../../lib/dateFormat";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function SubscriptionRequests() {
  const { data, refetch: mutate } = useApi<{ items: any[] }>("/users/subscription-requests?status=pending");
  const { getAuthHeader } = useAuth();
  const [busy, setBusy] = useState<string|null>(null);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    let reason = "";
    if (action === "reject") {
      reason = prompt(ar() ? "سبب الرفض:" : "Rejection Reason:") || "";
      if (!reason) return;
    }
    setBusy(id);
    try {
      await apiFetch(`/users/subscription-requests/${id}/${action}`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ reason })
      });
      mutate();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBusy(null);
    }
  };

  const reqs = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-surface-900">{ar() ? "طلبات الاشتراك (بيلاموندو برو)" : "Belmondo Pro Requests"}</h2>
          <p className="text-surface-500">{ar() ? "مراجعة وتأكيد مدفوعات اشتراكات العملاء" : "Review and confirm customer subscription payments"}</p>
        </div>
        <div className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full font-bold whitespace-nowrap shrink-0 self-start sm:self-auto text-sm sm:text-base">
          {reqs.length} {ar() ? "طلبات معلقة" : "Pending"}
        </div>
      </div>

      {reqs.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="text-sm font-bold text-surface-900">{ar() ? "لا توجد طلبات اشتراك معلقة حالياً" : "No pending subscription requests"}</div>
          <div className="text-xs text-surface-500 mt-1">{ar() ? "جميع الطلبات تم معالجتها" : "All requests have been processed"}</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reqs.map(req => (
            <div key={req.id} className="card-elevated overflow-hidden flex flex-col border-t-4 border-amber-400">
              {/* Header with user info */}
              <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                  {(req.userName || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-surface-900 text-sm truncate">{req.userName}</div>
                  <div className="text-xs text-surface-500">{req.userPhone}</div>
                  {req.userEmail && <div className="text-xs text-surface-400 truncate">{req.userEmail}</div>}
                </div>
              </div>

              {/* Details */}
              <div className="px-5 pb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-500">{ar() ? "خطة الدفع" : "Payment Plan"}</span>
                  <span className="bg-surface-100 text-surface-700 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize">{req.paymentOption}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-surface-500">{ar() ? "المبلغ" : "Amount"}</span>
                  <span className="text-amber-600 font-black text-base">{req.amountKwd} KWD</span>
                </div>
                <div className="text-[11px] text-surface-400">{ar() ? "تاريخ الطلب:" : "Submitted:"} {fmtDateTime(req.createdAt)}</div>
              </div>

              {/* Actions */}
              <div className="px-5 pb-4 pt-2 border-t border-surface-100 flex gap-2 mt-auto">
                <button
                  disabled={busy === req.id}
                  onClick={() => handleAction(req.id, "reject")}
                  className="btn-secondary flex-1 btn-sm text-red-500 hover:bg-red-50 border border-red-200"
                >
                  {busy === req.id ? "..." : (ar() ? "رفض" : "Reject")}
                </button>
                <button
                  disabled={busy === req.id}
                  onClick={() => handleAction(req.id, "approve")}
                  className="btn-primary flex-1 btn-sm bg-amber-500 hover:bg-amber-600 border-none shadow-sm"
                >
                  {busy === req.id ? "..." : (ar() ? "تأكيد وتفعيل" : "Approve & Activate")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
