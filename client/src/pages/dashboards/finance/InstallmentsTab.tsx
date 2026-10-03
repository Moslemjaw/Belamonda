import { useState } from "react";
import { useFinanceInstallments } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

export function InstallmentsTab({ from, to }: { from: string; to: string }) {
  const [statusFilter, setStatusFilter] = useState<"" | "paid" | "late" | "upcoming">("");
  const { data, loading } = useFinanceInstallments({ from, to });
  const summary = data?.summary;
  const items = (data?.items ?? []).filter(i => !statusFilter || i.status === statusFilter);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ar() ? "أقساط مدفوعة" : "Paid Installments"} value={`${summary?.paidKwd ?? "0.000"} KWD`} accent="emerald" icon="✅" />
        <KpiCard label={ar() ? "أقساط قادمة" : "Upcoming"} value={`${summary?.upcomingKwd ?? "0.000"} KWD`} sub={`${summary?.upcomingCount ?? 0} ${ar() ? "قسط" : "items"}`} accent="amber" icon="⏳" />
        <KpiCard label={ar() ? "أقساط متأخرة" : "Late"} value={`${summary?.lateKwd ?? "0.000"} KWD`} sub={`${summary?.lateCount ?? 0} ${ar() ? "قسط" : "items"}`} accent="red" icon="⚠️" />
        <KpiCard label={ar() ? "الإيرادات المتوقعة" : "Forecast Revenue"} value={`${summary?.forecastKwd ?? "0.000"} KWD`} accent="pink" icon="📊" />
      </div>

      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-surface-900">{ar() ? "متتبع الأقساط" : "Installment Tracker"}</h3>
          <select className="select-field text-xs py-1.5 h-auto w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="">{ar() ? "الكل" : "All"}</option>
            <option value="paid">{ar() ? "مدفوعة" : "Paid"}</option>
            <option value="late">{ar() ? "متأخرة" : "Late"}</option>
            <option value="upcoming">{ar() ? "قادمة" : "Upcoming"}</option>
          </select>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-surface-400 py-8 text-center">{ar() ? "لا توجد أقساط" : "No installments"}</div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            {/* Mobile view (Cards) */}
            <div className="md:hidden divide-y divide-surface-100">
              {items.map((i, idx) => (
                <div key={`${i.userOfferId}-${i.installmentNumber}-${idx}`} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <div className="font-bold text-surface-900 line-clamp-1">{i.offerName}</div>
                      <div className="text-[10px] text-surface-500 font-mono mt-0.5">{i.customerName || i.userId}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-surface-900">{i.amountKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                      <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(i.dueDate)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-surface-500 bg-surface-50 px-2 py-0.5 rounded-md border border-surface-200">
                      #{i.installmentNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${i.status === "paid" ? "bg-emerald-50 text-emerald-700" : i.status === "late" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {i.status === "paid" ? (ar() ? "مدفوع" : "Paid") : i.status === "late" ? (ar() ? "متأخر" : "Late") : (ar() ? "قادم" : "Upcoming")}
                    </span>
                    {i.method && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                        {i.method === "cash" ? (ar() ? "نقد" : "Cash") : i.method === "knet" ? "KNET" : i.method === "bank_transfer" ? (ar() ? "تحويل بنكي" : "Bank Transfer") : i.method === "card" ? (ar() ? "بطاقة" : "Card") : i.method === "link" ? (ar() ? "رابط" : "Link") : i.method}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view (Table) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table text-sm w-full">
                <thead>
                  <tr className="bg-surface-50">
                    <th>{ar() ? "العميل" : "Customer"}</th>
                    <th>{ar() ? "الباقة" : "Package"}</th>
                    <th className="text-center">#</th>
                    <th className="text-right">{ar() ? "المبلغ" : "Amount"}</th>
                    <th>{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                    <th>{ar() ? "طريقة الدفع" : "Method"}</th>
                    <th>{ar() ? "الحالة" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={`${i.userOfferId}-${i.installmentNumber}-${idx}`}>
                      <td className="font-medium text-surface-900">{i.customerName || i.userId}</td>
                      <td className="font-medium">{i.offerName}</td>
                      <td className="text-center text-surface-500">{i.installmentNumber}</td>
                      <td className="text-right font-bold text-surface-900">{i.amountKwd} KWD</td>
                      <td className="text-surface-600">{fmtDate(i.dueDate)}</td>
                      <td>
                        {i.method ? (
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700">
                            {i.method === "cash" ? (ar() ? "نقد" : "Cash") : i.method === "knet" ? "KNET" : i.method === "bank_transfer" ? (ar() ? "تحويل بنكي" : "Bank Transfer") : i.method === "card" ? (ar() ? "بطاقة" : "Card") : i.method === "link" ? (ar() ? "رابط" : "Link") : i.method}
                          </span>
                        ) : (
                          <span className="text-surface-300">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${i.status === "paid" ? "bg-emerald-50 text-emerald-700" : i.status === "late" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                          {i.status === "paid" ? (ar() ? "مدفوع" : "Paid") : i.status === "late" ? (ar() ? "متأخر" : "Late") : (ar() ? "قادم" : "Upcoming")}
                        </span>
                      </td>
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
// CUSTOMERS TAB — top customers by LTV
// ===========================================================================
