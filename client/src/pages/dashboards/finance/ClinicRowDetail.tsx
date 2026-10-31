import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import type { ClinicSessionRow, ClinicSessionsSummary } from "../../../hooks/useApi";
import { fmtDateTime } from "../../../lib/dateFormat";
import { ar } from "./shared";
import { downloadClinicSessions } from "./ClinicsTab";

const PAGE = 50;

/** A progress bar and "12 / 95": amber part way, green when everything is paid. */
export function PaidProgress({ paid, total, className = "" }: { paid: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const done = total > 0 && paid === total;
  return (
    <div className={`items-center gap-3 ${className}`}>
      <div
        className="h-1.5 flex-1 rounded-full bg-surface-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={paid}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={ar() ? "الجلسات المدفوعة للمركز" : "Sessions paid to clinic"}
      >
        <div className={`h-full rounded-full transition-all duration-300 ${done ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`shrink-0 text-sm font-bold tabular-nums ${done ? "text-emerald-700" : "text-surface-900"}`}>
        {paid} <span className="font-medium text-surface-400">/ {total}</span>
      </div>
    </div>
  );
}

export function ClinicRowDetail({ clinic, rows, range, saving, onTogglePaid }: {
  clinic: ClinicSessionsSummary;
  rows: ClinicSessionRow[];
  range: { from: string; to: string };
  saving: string | null;
  onTogglePaid: (sessionId: string, paid: boolean) => void;
}) {
  const { getAuthHeader } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [paidFilter, setPaidFilter] = useState<"" | "paid" | "unpaid">("");
  const completed = rows.filter(r => r.status === "completed");
  const paidCount = completed.filter(r => r.paidToClinic).length;
  const left = completed.length - paidCount;
  const filters: { key: "" | "paid" | "unpaid"; label: string; count: number }[] = [
    { key: "", label: ar() ? "الكل" : "All", count: rows.length },
    { key: "unpaid", label: ar() ? "غير مدفوعة" : "Not paid", count: left },
    { key: "paid", label: ar() ? "مدفوعة" : "Paid", count: paidCount },
  ];
  const list = rows.filter(r =>
    !paidFilter || (r.status === "completed" && r.paidToClinic === (paidFilter === "paid"))
  );

  const download = async () => {
    setDownloading(true);
    try { await downloadClinicSessions(getAuthHeader() ?? undefined, range, clinic.clinicId); }
    catch (e: any) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="px-6 py-4 bg-surface-50/60 border-b border-surface-100 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1" role="group" aria-label={ar() ? "فلتر الدفع للمركز" : "Paid to clinic filter"}>
          {filters.map(f => (
            <button
              key={f.key || "all"}
              type="button"
              aria-pressed={paidFilter === f.key}
              onClick={() => { setPaidFilter(f.key); setShown(PAGE); }}
              className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${paidFilter === f.key ? "bg-surface-900 text-white" : "text-surface-500 hover:bg-surface-100"}`}
            >
              {f.label} {f.count}
            </button>
          ))}
        </div>
        <button onClick={() => void download()} disabled={downloading} className="text-xs font-bold text-emerald-700 hover:underline disabled:opacity-50 whitespace-nowrap">
          {downloading ? "..." : (ar() ? "تحميل Excel" : "Excel")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white">
        <table className="data-table text-xs [&_td]:!px-4 [&_th]:!px-4 [&_td]:!py-2.5 [&_th]:!py-2.5">
          <thead>
            <tr>
              <th>{ar() ? "التاريخ" : "Date"}</th>
              <th>{ar() ? "العميل" : "Customer"}</th>
              <th>{ar() ? "الباقة أو الخدمة" : "Package / service"}</th>
              <th className="text-right">{ar() ? "القيمة" : "Value"}</th>
              <th className="text-center">{ar() ? "مدفوع" : "Paid"}</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map(r => (
              <tr key={r.sessionId}>
                <td className="text-surface-500 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                <td>
                  <div className="font-medium text-surface-900">{r.customerName}</div>
                  {r.customerPhone && <div className="text-[11px] text-surface-400">{r.customerPhone}</div>}
                </td>
                <td>
                  {r.packageName || "—"}
                  {r.extras && <span className="text-surface-400"> + {r.extras}</span>}
                  {r.membershipCancelled && <span className="ml-1.5 rtl:ml-0 rtl:mr-1.5 text-[10px] font-bold text-red-600">{ar() ? "اشتراك ملغي" : "Cancelled"}</span>}
                </td>
                <td className="text-right font-bold text-surface-900 whitespace-nowrap">{r.sessionValueKwd}</td>
                <td className="text-center">
                  {r.status === "completed" ? (
                    <input
                      type="checkbox"
                      className={`h-[18px] w-[18px] align-middle accent-emerald-600 ${saving === r.sessionId ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                      checked={r.paidToClinic}
                      disabled={saving === r.sessionId}
                      onChange={e => onTogglePaid(r.sessionId, e.target.checked)}
                      aria-label={`${ar() ? "مدفوع للمركز" : "Paid to clinic"}: ${r.customerName}`}
                    />
                  ) : <span className="text-[11px] font-bold text-red-600 whitespace-nowrap">{ar() ? "لم يحضر" : "No-show"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="py-6 text-center text-xs text-surface-400">{ar() ? "لا توجد جلسات" : "No sessions"}</div>}
        {list.length > shown && (
          <button className="w-full text-center py-2 text-xs text-brand-pink-700 font-bold border-t border-surface-100 hover:bg-surface-50" onClick={() => setShown(shown + PAGE)}>
            {ar() ? `عرض المزيد (${list.length - shown})` : `Show more (${list.length - shown})`}
          </button>
        )}
      </div>
    </div>
  );
}
