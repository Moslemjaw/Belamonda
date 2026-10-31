import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import type { ClinicSessionRow, ClinicSessionsSummary } from "../../../hooks/useApi";
import { fmtDateTime } from "../../../lib/dateFormat";
import { ar } from "./shared";
import { downloadClinicSessions } from "./ClinicsTab";

const PAGE = 50;

/** "12 / 95" with a progress bar: grey when nothing is paid, amber part way, green when all are paid. */
export function PaidProgress({ paid, total, className = "" }: { paid: number; total: number; className?: string }) {
  const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const done = total > 0 && paid === total;
  const tone = done ? "text-emerald-700" : paid > 0 ? "text-amber-700" : "text-surface-500";
  const bar = done ? "bg-emerald-500" : "bg-amber-400";
  return (
    <div className={className}>
      <div className={`text-sm font-bold tabular-nums ${tone}`}>
        {paid} <span className="font-medium text-surface-400">/ {total}</span>
      </div>
      <div
        className="mt-1 h-1.5 w-full rounded-full bg-surface-200 overflow-hidden"
        role="progressbar"
        aria-valuenow={paid}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={ar() ? "الجلسات المدفوعة للمركز" : "Sessions paid to clinic"}
      >
        <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${pct}%` }} />
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
    <div className="px-6 py-5 bg-surface-50 border-t border-surface-200 space-y-4 animate-fade-in">
      <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="text-xs font-bold text-surface-700 mb-1.5">{ar() ? "مدفوع لهذا المركز" : "Paid to this clinic"}</div>
          <PaidProgress paid={paidCount} total={completed.length} />
          <div className="mt-1.5 text-[11px] text-surface-500">
            {left === 0 && completed.length > 0
              ? (ar() ? "تم دفع كل الجلسات" : "All sessions paid")
              : (ar() ? `متبقي ${left} جلسة` : `${left} ${left === 1 ? "session" : "sessions"} left to pay`)}
          </div>
        </div>
        <div className="inline-flex self-start md:self-auto rounded-lg border border-surface-200 bg-surface-50 p-0.5" role="group" aria-label={ar() ? "فلتر الدفع للمركز" : "Paid to clinic filter"}>
          {filters.map(f => (
            <button
              key={f.key || "all"}
              type="button"
              aria-pressed={paidFilter === f.key}
              onClick={() => { setPaidFilter(f.key); setShown(PAGE); }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-colors ${paidFilter === f.key ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-800"}`}
            >
              {f.label} <span className="font-medium text-surface-400">{f.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white shadow-sm">
        <table className="data-table text-xs [&_td]:!px-3 [&_th]:!px-3">
          <thead>
            <tr className="bg-surface-50">
              <th>{ar() ? "التاريخ" : "Date"}</th>
              <th>{ar() ? "العميل" : "Customer"}</th>
              <th>{ar() ? "الباقة أو الخدمة" : "Package / service"}</th>
              <th>{ar() ? "إضافات" : "Extras"}</th>
              <th>{ar() ? "الحالة" : "Status"}</th>
              <th className="text-right">{ar() ? "القيمة" : "Value"}</th>
              <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
              <th className="text-right">{ar() ? "مدفوع في المركز" : "Paid at clinic"}</th>
              <th className="text-center">{ar() ? "مدفوع للمركز" : "Paid to clinic"}</th>
            </tr>
          </thead>
          <tbody>
            {list.slice(0, shown).map(r => (
              <tr key={r.sessionId} className={r.paidToClinic ? "!bg-emerald-50/50" : ""}>
                <td className="text-surface-500 whitespace-nowrap">{fmtDateTime(r.date)}</td>
                <td>
                  <div className="font-medium">{r.customerName}</div>
                  {r.customerPhone && <div className="text-[10px] text-surface-400">{r.customerPhone}</div>}
                </td>
                <td>
                  {r.packageName || "—"}
                  {r.membershipCancelled && (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-600">{ar() ? "اشتراك ملغي" : "Cancelled membership"}</span>
                  )}
                </td>
                <td className="text-surface-500">{r.extras || "—"}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${r.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {r.status === "completed" ? (ar() ? "حضر" : "Completed") : (ar() ? "لم يحضر" : "No-show")}
                  </span>
                </td>
                <td className="text-right font-bold text-surface-900">{r.sessionValueKwd}</td>
                <td className="text-right text-amber-700">{r.cashbackKwd}</td>
                <td className="text-right font-bold text-brand-pink-700">{r.paidAtClinicKwd}</td>
                <td className="text-center">
                  {r.status === "completed" ? (
                    <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-bold transition-colors ${saving === r.sessionId ? "opacity-60 cursor-wait" : "cursor-pointer"} ${r.paidToClinic ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-surface-200 bg-white text-surface-500 hover:border-surface-400"}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-600 cursor-[inherit]"
                        checked={r.paidToClinic}
                        disabled={saving === r.sessionId}
                        onChange={e => onTogglePaid(r.sessionId, e.target.checked)}
                        aria-label={`${ar() ? "مدفوع للمركز" : "Paid to clinic"}: ${r.customerName}`}
                      />
                      <span className="whitespace-nowrap">{r.paidToClinic ? (ar() ? "مدفوع" : "Paid") : (ar() ? "غير مدفوع" : "Not paid")}</span>
                    </label>
                  ) : <span className="text-surface-300">—</span>}
                </td>
              </tr>
            ))}
            <tr className="bg-surface-50 font-bold">
              <td colSpan={4}>{ar() ? "الإجمالي" : "Total"}</td>
              <td>{clinic.completed} / {clinic.noShow}</td>
              <td className="text-right">{clinic.sessionValueKwd}</td>
              <td className="text-right">{clinic.cashbackKwd}</td>
              <td className="text-right">{clinic.paidAtClinicKwd}</td>
              <td className="text-center tabular-nums">{paidCount} / {completed.length}</td>
            </tr>
          </tbody>
        </table>
        {list.length > shown && (
          <button className="w-full text-center py-2 text-xs text-brand-pink-700 font-bold border-t border-surface-100 hover:bg-surface-50" onClick={() => setShown(shown + PAGE)}>
            {ar() ? `عرض المزيد (${list.length - shown})` : `Show more (${list.length - shown})`}
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-surface-500 font-medium">{ar() ? "تقرير هذا المركز:" : "This clinic's report:"}</span>
        <button onClick={() => void download()} disabled={downloading}
          className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold disabled:opacity-50">
          {downloading ? "..." : "Excel"}
        </button>
      </div>
    </div>
  );
}
