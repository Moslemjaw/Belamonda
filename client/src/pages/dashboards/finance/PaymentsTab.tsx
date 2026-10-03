import { useState } from "react";
import { usePaymentsBreakdown, type EnrichedPaymentItem } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { fmtDate } from "../../../lib/dateFormat";
import { ar, METHOD_LABELS, PURPOSE_LABELS, METHOD_COLORS, STATUS_BADGE } from "./shared";

export function PaymentsTab({ from, to }: { from: string; to: string }) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterPurpose, setFilterPurpose] = useState("");

  const { data, loading } = usePaymentsBreakdown({
    status: filterStatus || undefined,
    method: filterMethod || undefined,
    purpose: filterPurpose || undefined,
    from, to,
  });

  const summary = data?.summary;
  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ar() ? "المحصّل" : "Collected"} value={`${summary?.totalCollectedKwd ?? "0.000"} KWD`} accent="emerald" icon="💰" />
        <KpiCard label={ar() ? "العضويات" : "Memberships"} value={`${summary?.membershipRevenueKwd ?? "0.000"} KWD`} accent="pink" icon="💳" />
        <KpiCard label={ar() ? "الجلسات" : "Sessions"} value={`${summary?.sessionRevenueKwd ?? "0.000"} KWD`} accent="indigo" icon="💆‍♀️" />
        <KpiCard label={ar() ? "كاش باك" : "Cashback"} value={`${summary?.cashbackAppliedKwd ?? "0.000"} KWD`} accent="amber" icon="🎁" />
      </div>

      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payments Ledger"} <span className="text-xs text-surface-400 font-medium">({items.length})</span></h3>
          <div className="flex flex-wrap gap-2">
            <select className="select-field text-xs py-1.5 h-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{ar() ? "كل الحالات" : "All Statuses"}</option>
              <option value="completed">{ar() ? "مكتمل" : "Completed"}</option>
              <option value="pending">{ar() ? "معلق" : "Pending"}</option>
              <option value="failed">{ar() ? "فشل" : "Failed"}</option>
              <option value="refunded">{ar() ? "مسترد" : "Refunded"}</option>
            </select>
            <select className="select-field text-xs py-1.5 h-auto" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
              <option value="">{ar() ? "كل الطرق" : "All Methods"}</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="select-field text-xs py-1.5 h-auto" value={filterPurpose} onChange={e => setFilterPurpose(e.target.value)}>
              <option value="">{ar() ? "كل الأنواع" : "All Types"}</option>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "لا توجد مدفوعات في هذه الفترة" : "No payments found in this range"}</div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            {/* Mobile view (Cards) */}
            <div className="md:hidden divide-y divide-surface-100">
              {items.map((p: EnrichedPaymentItem) => (
                <div key={p.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <div className="font-bold text-surface-900 line-clamp-1">{(p as any).customerName || p.offerName || "—"}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{p.offerName ? `${p.offerName} • ` : ""}{p.clinicNameEn || "—"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-surface-900">{p.amountKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                      <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(p.createdAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${METHOD_COLORS[p.method] ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>{METHOD_LABELS[p.method] ?? p.method}</span>
                    <span className="text-[10px] text-surface-600 bg-surface-50 px-2 py-0.5 rounded-md border border-surface-200">{PURPOSE_LABELS[p.purpose ?? ""] ?? (p.purpose || "—")}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[p.status] ?? "bg-surface-100 text-surface-500"}`}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view (Table) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table text-xs w-full">
                <thead>
                  <tr className="bg-surface-50">
                    <th>{ar() ? "المستخدم" : "User"}</th>
                    <th>{ar() ? "العرض" : "Offer"}</th>
                    <th>{ar() ? "العيادة" : "Clinic"}</th>
                    <th>{ar() ? "الطريقة" : "Method"}</th>
                    <th>{ar() ? "النوع" : "Type"}</th>
                    <th className="text-right">{ar() ? "المبلغ" : "Amount"}</th>
                    <th>{ar() ? "الحالة" : "Status"}</th>
                    <th>{ar() ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p: EnrichedPaymentItem) => (
                    <tr key={p.id}>
                      <td className="font-medium text-surface-800 max-w-[120px]">
                        <div className="truncate">{(p as any).customerName || p.userId}</div>
                        {(p as any).customerPhone && <div className="text-[10px] text-surface-400 font-normal truncate">{(p as any).customerPhone}</div>}
                      </td>
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
                      <td className="text-right font-bold text-surface-900">{p.amountKwd}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[p.status] ?? "bg-surface-100 text-surface-500"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="text-surface-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// INSTALLMENTS TAB — real data from UserOffer.installmentSchedule
// ===========================================================================
