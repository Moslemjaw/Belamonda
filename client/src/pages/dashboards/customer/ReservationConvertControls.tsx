import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

// ==========================================
// Purchase Modal Component
// ==========================================
export function ReservationConvertControls({
  userOfferId,
  preferredPlan,
  ar,
  getAuthHeader,
  onDone
}: {
  userOfferId: string;
  preferredPlan?: string;
  ar: boolean;
  getAuthHeader: () => Record<string, string> | undefined;
  onDone: (message: string) => void | Promise<void>;
}) {
  const initialPlan = (preferredPlan as "full" | "installments_2" | "installments_3" | "installments_4_enet" | undefined) || "full";
  const [plan, setPlan] = useState<"full" | "installments_2" | "installments_3" | "installments_4_enet">(initialPlan);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await apiFetch("/checkout/deposit/convert", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ userOfferId, plan })
      });
      await onDone(ar ? "تم تفعيل العرض" : "Offer activated");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ar ? "فشل الإكمال" : "Failed";
      await onDone(msg);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={plan}
        onChange={(e) => setPlan(e.target.value as typeof plan)}
        disabled={busy}
        className="text-xs rounded-lg border border-blue-300 bg-white px-2 py-1.5 font-medium"
      >
        <option value="full">{ar ? "دفع كامل" : "Full payment"}</option>
        <option value="installments_2">{ar ? "قسطين" : "2 installments"}</option>
        <option value="installments_4_enet">{ar ? "٤ أقساط (ENET)" : "4 installments (ENET)"}</option>
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg"
      >
        {busy ? (ar ? "جاري…" : "Working…") : ar ? "أكملي الدفع" : "Complete balance"}
      </button>
    </div>
  );
}
