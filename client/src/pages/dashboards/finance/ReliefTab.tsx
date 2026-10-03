import { useState } from "react";
import { usePaymentsBreakdown, type EnrichedPaymentItem } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { fmtDate } from "../../../lib/dateFormat";
import { ar, fmt, parseKwd, METHOD_LABELS, PURPOSE_LABELS, METHOD_COLORS } from "./shared";

export function ReliefTab({ from, to }: { from: string; to: string }) {
  const [filterMethod, setFilterMethod] = useState("");
  const { data, loading } = usePaymentsBreakdown({ status: "refunded", method: filterMethod || undefined, from, to });

  const items = data?.items ?? [];
  const totalRefundedMils = items.reduce((s, p) => s + parseKwd(p.amountKwd), 0);
  const avgRefund = items.length > 0 ? totalRefundedMils / items.length : 0;

  // Breakdown by method
  const byMethod: Record<string, { count: number; total: number }> = {};
  items.forEach(p => {
    if (!byMethod[p.method]) byMethod[p.method] = { count: 0, total: 0 };
    byMethod[p.method].count++;
    byMethod[p.method].total += parseKwd(p.amountKwd);
  });

  const byMethodSorted = Object.entries(byMethod).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label={ar() ? "إجمالي المستردّ" : "Total Refunded"}
          value={`${fmt(totalRefundedMils)} KWD`}
          accent="rose"
          icon="↩️"
        />
        <KpiCard
          label={ar() ? "عدد الاستردادات" : "Refund Count"}
          value={String(items.length)}
          accent="red"
          icon="🔄"
        />
        <KpiCard
          label={ar() ? "متوسط الاسترداد" : "Avg Refund"}
          value={`${fmt(avgRefund)} KWD`}
          accent="amber"
          icon="📊"
        />
        <KpiCard
          label={ar() ? "طرق مختلفة" : "Methods Used"}
          value={String(byMethodSorted.length)}
          accent="indigo"
          icon="💳"
        />
      </div>

      {/* Method breakdown cards */}
      {byMethodSorted.length > 0 && (
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "الاستردادات حسب طريقة الدفع" : "Refunds by Payment Method"}</h3>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
            {byMethodSorted.map(([method, v]) => (
              <div key={method} className="rounded-xl border border-surface-100 bg-surface-50 p-4 flex flex-col gap-1">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full self-start border ${METHOD_COLORS[method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                  {METHOD_LABELS[method] ?? method}
                </span>
                <div className="text-lg font-black text-rose-600 mt-1">{fmt(v.total)} <span className="text-xs font-medium text-surface-400">KWD</span></div>
                <div className="text-xs text-surface-500">{v.count} {ar() ? "استرداد" : v.count === 1 ? "refund" : "refunds"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Refunds table */}
      <div className="card-elevated p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-surface-900">
            {ar() ? "سجل الاستردادات" : "Refunds Ledger"}
            <span className="ml-2 text-xs font-medium text-surface-400">({items.length})</span>
          </h3>
          <select className="select-field text-xs py-1.5 h-auto w-full sm:w-40" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="">{ar() ? "كل الطرق" : "All Methods"}</option>
            {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>

        {loading && items.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">✅</div>
            <div className="text-sm font-bold text-surface-700">{ar() ? "لا توجد استردادات في هذه الفترة" : "No refunds in this period"}</div>
            <div className="text-xs text-surface-400 mt-1">{ar() ? "هذا مؤشر ممتاز للجودة" : "That's a great quality indicator"}</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-xs">
              <thead>
                <tr className="bg-rose-50">
                  <th>{ar() ? "المستخدم" : "User"}</th>
                  <th>{ar() ? "العرض" : "Offer"}</th>
                  <th>{ar() ? "العيادة" : "Clinic"}</th>
                  <th>{ar() ? "الطريقة" : "Method"}</th>
                  <th>{ar() ? "النوع" : "Type"}</th>
                  <th className="text-right">{ar() ? "المبلغ المسترد" : "Refunded Amount"}</th>
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p: EnrichedPaymentItem) => (
                  <tr key={p.id} className="hover:bg-rose-50/30">
                    <td className="font-mono text-[10px] text-surface-500 max-w-[80px] truncate">{p.userId}</td>
                    <td className="max-w-[140px]">
                      <div className="font-medium text-surface-800 truncate">{p.offerName || "—"}</div>
                      {p.membershipType && <div className="text-[10px] text-surface-400 capitalize">{p.membershipType}</div>}
                    </td>
                    <td className="text-surface-600">{p.clinicNameEn || "—"}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${METHOD_COLORS[p.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                        {METHOD_LABELS[p.method] ?? p.method}
                      </span>
                    </td>
                    <td className="text-surface-600">{PURPOSE_LABELS[p.purpose ?? ""] ?? (p.purpose || "—")}</td>
                    <td className="text-right font-black text-rose-600">{p.amountKwd} KWD</td>
                    <td className="text-surface-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// PROFILE TAB — finance staff own account
// ===========================================================================
