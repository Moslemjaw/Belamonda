import { useState } from "react";
import { fmtDate } from "../../../lib/dateFormat";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function SessionPaymentRow({
  request,
  clinicName,
  ar,
  getAuthHeader,
  onDone
}: {
  request: { id: string; sessionPriceKwd?: string; preferredAt?: string; createdAt: string };
  clinicName: string;
  ar: boolean;
  getAuthHeader: () => Record<string, string> | undefined;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    try {
      await apiFetch(`/scheduling/me/requests/${request.id}/pay-session`, {
        method: "POST",
        headers: getAuthHeader()
      });
      await onDone();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ar ? "فشل الدفع" : "Payment failed";
      alert(msg);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-100 text-amber-600 shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <div className="font-bold text-amber-900 text-sm">{ar ? "رسوم الجلسة مطلوبة" : "Session fee required"}</div>
          <div className="text-xs text-amber-700 mt-0.5">{ar ? "العيادة:" : "Clinic:"} <span className="font-semibold">{clinicName}</span></div>
          {request.preferredAt && (
            <div className="text-xs text-amber-600 mt-0.5">{ar ? "التاريخ المفضل:" : "Preferred:"} {fmtDate(request.preferredAt)}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {request.sessionPriceKwd && (
          <span className="font-black text-amber-700">{request.sessionPriceKwd} KWD</span>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void pay()}
          className="text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-2 rounded-xl transition-colors"
        >
          {busy ? (ar ? "جاري…" : "Processing…") : ar ? "ادفع رسوم الجلسة" : "Pay session fee"}
        </button>
      </div>
    </div>
  );
}
