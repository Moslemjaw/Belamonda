import { useEffect, useState } from "react";
import { usePaymentsBreakdown, type EnrichedPaymentItem, type PaymentsType } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { fmtDate } from "../../../lib/dateFormat";
import { ar, fmt, paidVia, parseKwd, PURPOSE_LABELS, STATUS_BADGE } from "./shared";
import { ManualEntriesSection } from "./ManualEntriesSection";

const TYPES: { key: PaymentsType; en: string; ar: string }[] = [
  { key: "", en: "All", ar: "الكل" },
  { key: "packages", en: "Packages", ar: "الباقات" },
  { key: "sessions", en: "Sessions", ar: "الجلسات" },
  { key: "refunds", en: "Refunds", ar: "الاستردادات" },
  { key: "manual", en: "Manual entries", ar: "قيود يدوية" },
];

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  paid: { en: "Paid", ar: "مدفوع" },
  completed: { en: "Paid", ar: "مدفوع" },
  payment_pending: { en: "Awaiting payment", ar: "بانتظار الدفع" },
  failed: { en: "Failed", ar: "فشل" },
  refunded: { en: "Refunded", ar: "مسترد" },
};

const statusLabel = (s: string) => (ar() ? STATUS_LABELS[s]?.ar : STATUS_LABELS[s]?.en) ?? s;
const purposeLabel = (p?: string) => (p === "refund" ? (ar() ? "استرداد" : "Refund") : PURPOSE_LABELS[p ?? ""] ?? (p || "—"));

export function PaymentsTab({ from, to, initialType = "", initialStatus = "" }: { from: string; to: string; initialType?: PaymentsType; initialStatus?: string }) {
  const [type, setType] = useState<PaymentsType>(initialType);
  const [filterStatus, setFilterStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("");

  useEffect(() => setFilterStatus(initialStatus), [initialStatus]);
  useEffect(() => setType(initialType), [initialType]);
  // Search after the user stops typing for a moment.
  useEffect(() => {
    const t = setTimeout(() => setCustomer(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, loading } = usePaymentsBreakdown({
    type: type === "manual" ? undefined : type || undefined,
    status: filterStatus || undefined,
    customer: customer || undefined,
    from, to,
  });

  // The cards always show the whole period, so picking one doesn't change the others.
  const { data: totals } = usePaymentsBreakdown({ customer: customer || undefined, from, to });
  const summary = totals?.summary;
  const items = data?.items ?? [];

  // A payment with several extras is listed once per extra; count and add it once.
  const unique = (list: EnrichedPaymentItem[]) => [...new Map(list.map(p => [p.id, p])).values()];
  const rows = unique(items);
  const shownTotal = rows.reduce((sum, p) => sum + (isRefund(p) ? -1 : 1) * parseKwd(p.amountKwd), 0);
  const pendingKwd = unique(totals?.items ?? []).filter(p => p.status === "payment_pending").reduce((sum, p) => sum + parseKwd(p.amountKwd), 0);
  const filtered = !!(type || filterStatus || search);
  const clearFilters = () => { setType(""); setFilterStatus(""); setSearch(""); };
  const pick = (next: PaymentsType, status = "") => {
    const same = type === next && filterStatus === status;
    setType(same ? "" : next);
    setFilterStatus(same ? "" : status);
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TYPES.map(t => (
          <button
            key={t.key || "all"}
            type="button"
            onClick={() => setType(t.key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${type === t.key ? "bg-brand-pink-600 text-white border-brand-pink-600" : "bg-white text-surface-600 border-surface-200 hover:border-brand-pink-300"}`}
          >
            {ar() ? t.ar : t.en}
          </button>
        ))}
      </div>

      {type === "manual" ? (
        <ManualEntriesSection from={from} to={to} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard label={ar() ? "الباقات (المحصّل)" : "Packages collected"} value={`${summary?.packagesCollectedKwd ?? "0.000"} KWD`} accent="emerald" icon="💳" active={type === "packages" && !filterStatus} onClick={() => pick("packages")} />
            <KpiCard label={ar() ? "الجلسات (ليست إيراد)" : "Sessions (not revenue)"} value={`${summary?.sessionRevenueKwd ?? "0.000"} KWD`} accent="indigo" icon="💆‍♀️" active={type === "sessions" && !filterStatus} onClick={() => pick("sessions")} />
            <KpiCard label={ar() ? "الاستردادات" : "Refunds"} value={`${summary?.refundsKwd ?? "0.000"} KWD`} sub={`${summary?.refundsCount ?? 0} ${ar() ? "عملية" : "refunds"}`} accent="rose" icon="↩️" active={type === "refunds" && !filterStatus} onClick={() => pick("refunds")} />
            <KpiCard label={ar() ? "بانتظار الدفع" : "Awaiting payment"} value={`${fmt(pendingKwd)} KWD`} sub={`${summary?.pendingCount ?? 0} ${ar() ? "دفعة" : "payments"}`} accent="amber" icon="⏳" active={!type && filterStatus === "payment_pending"} onClick={() => pick("", "payment_pending")} />
          </div>

          <div className="card-elevated p-5 border border-surface-200 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3">
              <div>
                <h3 className="text-sm font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payments"} <span className="text-xs text-surface-400 font-medium">({rows.length})</span></h3>
                {filtered && rows.length > 0 && <p className="text-[11px] text-surface-500 mt-0.5">{ar() ? "إجمالي النتائج:" : "Total shown:"} <span className="font-bold text-surface-700">{fmt(shownTotal)} KWD</span></p>}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
                <input
                  className="input-field text-xs py-1.5 h-auto sm:w-56"
                  placeholder={ar() ? "بحث باسم العميل أو الهاتف" : "Search customer name or phone"}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <select className="select-field text-xs py-1.5 h-auto sm:w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">{ar() ? "كل الحالات" : "All statuses"}</option>
                  <option value="paid">{ar() ? "مدفوع" : "Paid"}</option>
                  <option value="payment_pending">{ar() ? "بانتظار الدفع" : "Awaiting payment"}</option>
                  <option value="failed">{ar() ? "فشل" : "Failed"}</option>
                  <option value="refunded">{ar() ? "مسترد" : "Refunded"}</option>
                </select>
                {filtered && (
                  <button type="button" onClick={clearFilters} className="text-xs font-bold text-brand-pink-600 hover:text-brand-pink-800 whitespace-nowrap px-1">
                    {ar() ? "مسح الفلاتر" : "Clear filters"}
                  </button>
                )}
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
                  {items.map((p: EnrichedPaymentItem, idx) => {
                    const refund = isRefund(p);
                    return (
                      <div key={`${p.id}-${idx}`} className="p-4 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-bold text-surface-900 truncate">{customerName(p)}</div>
                            {customerPhone(p) && <div className="text-[11px] text-surface-400">{customerPhone(p)}</div>}
                            <div className="text-xs text-surface-500 mt-0.5 truncate">{p.offerName || "—"}{p.clinicNameEn ? ` • ${p.clinicNameEn}` : ""}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`font-bold ${refund ? "text-rose-600" : "text-surface-900"}`}>{refund ? "−" : ""}{p.amountKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                            <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(p.createdAt)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${paidVia(p).badge}`}>{paidVia(p).label}</span>
                          <span className="text-[10px] text-surface-600 bg-surface-50 px-2 py-0.5 rounded-md border border-surface-200">{purposeLabel(p.purpose)}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[p.status] ?? "bg-surface-100 text-surface-500"}`}>{statusLabel(p.status)}</span>
                        </div>
                        {refund && notes(p) && <div className="text-[11px] text-surface-500">{ar() ? "السبب: " : "Reason: "}{notes(p)}</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop view (Table) */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="data-table text-xs w-full">
                    <thead>
                      <tr className="bg-surface-50">
                        <th>{ar() ? "العميل" : "Customer"}</th>
                        <th>{ar() ? "الباقة" : "Package"}</th>
                        <th>{ar() ? "العيادة" : "Clinic"}</th>
                        <th>{ar() ? "الطريقة" : "Method"}</th>
                        <th>{ar() ? "النوع" : "Type"}</th>
                        <th className="text-right">{ar() ? "المبلغ" : "Amount"}</th>
                        <th>{ar() ? "الحالة" : "Status"}</th>
                        <th>{ar() ? "التاريخ" : "Date"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p: EnrichedPaymentItem, idx) => {
                        const refund = isRefund(p);
                        return (
                          <tr key={`${p.id}-${idx}`} className={refund ? "bg-rose-50/40" : undefined}>
                            <td className="font-medium text-surface-800 max-w-[160px]">
                              <div className="truncate">{customerName(p)}</div>
                              {customerPhone(p) && <div className="text-[10px] text-surface-400 font-normal truncate">{customerPhone(p)}</div>}
                            </td>
                            <td className="max-w-[160px]">
                              <div className="font-medium text-surface-800 truncate">{p.offerName || "—"}</div>
                              {refund && notes(p) && <div className="text-[10px] text-surface-500 truncate" title={notes(p)}>{notes(p)}</div>}
                            </td>
                            <td className="text-surface-600">{p.clinicNameEn || "—"}</td>
                            <td>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${paidVia(p).badge}`}>
                                {paidVia(p).label}
                              </span>
                            </td>
                            <td className="text-surface-600">{purposeLabel(p.purpose)}</td>
                            <td className={`text-right font-bold whitespace-nowrap ${refund ? "text-rose-600" : "text-surface-900"}`}>{refund ? "−" : ""}{p.amountKwd}</td>
                            <td>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_BADGE[p.status] ?? "bg-surface-100 text-surface-500"}`}>
                                {statusLabel(p.status)}
                              </span>
                            </td>
                            <td className="text-surface-500 whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const isRefund = (p: EnrichedPaymentItem) => p.purpose === "refund" || p.status === "refunded";
const customerName = (p: EnrichedPaymentItem) => (p as any).customerName || (p.userId === "manual" ? (ar() ? "قيد يدوي" : "Manual entry") : p.userId);
const customerPhone = (p: EnrichedPaymentItem) => (p as any).customerPhone as string | undefined;
const notes = (p: EnrichedPaymentItem) => (p as any).notes as string | undefined;
