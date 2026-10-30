import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { API_BASE_URL } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

// ===========================================================================
// REPORTS TAB — pick a report, preview it with its totals, download Excel/PDF.
// The server returns one document that is both the preview and the download.
// ===========================================================================

type Label = { en: string; ar: string };
type Column = { key: string; label: Label; kind?: "text" | "kwd" | "int" };
type Table = { id: string; title: Label; columns: Column[]; rows: Record<string, string | number | null>[]; totals?: Record<string, string | number | null>; note?: Label };
type Card = { label: Label; value: string; hint?: Label; tone?: "good" | "bad" | "neutral" };
type ReportDoc = {
  type: string;
  title: Label;
  from: string;
  to: string;
  generatedAt: string;
  cards: Card[];
  tables: Table[];
  notes: Label[];
  check?: { ok: boolean; reportTotalKwd: string; ledgerTotalKwd: string; diffKwd: string };
};

const REPORTS: { type: string; icon: string; name: Label; desc: Label }[] = [
  { type: "monthly_summary", icon: "📊", name: { en: "Monthly Summary", ar: "الملخص الشهري" }, desc: { en: "One page for management, with change vs the previous period", ar: "صفحة واحدة للإدارة مع المقارنة بالفترة السابقة" } },
  { type: "package_sales", icon: "📦", name: { en: "Package Sales", ar: "مبيعات الباقات" }, desc: { en: "Per package: sold, collected, still to collect, granted, cancelled, referrals", ar: "لكل باقة: المباع والمحصّل والمتبقي والممنوح والملغى والإحالات" } },
  { type: "payments_ledger", icon: "💳", name: { en: "Payments Ledger", ar: "سجل المدفوعات" }, desc: { en: "Every payment, refund and manual entry, with who confirmed it", ar: "كل دفعة واسترداد وقيد يدوي ومن أكّده" } },
  { type: "installments_due", icon: "📅", name: { en: "Installments Due", ar: "الأقساط المستحقة" }, desc: { en: "Late and coming up, with phone numbers for follow-up", ar: "المتأخرة والقادمة مع أرقام الهواتف للمتابعة" } },
  { type: "clinic_sessions", icon: "🏥", name: { en: "Clinic Sessions", ar: "جلسات العيادات" }, desc: { en: "Sessions that happened at each clinic", ar: "الجلسات التي تمت في كل عيادة" } },
  { type: "cashback", icon: "🎁", name: { en: "Cashback & Adjustments", ar: "الكاش باك والتعديلات" }, desc: { en: "Balances owed, wallet activity and staff adjustments", ar: "الأرصدة المستحقة وحركة المحافظ وتعديلات الموظفين" } },
];

const PAGE = 50;
const t = (l?: Label) => (l ? (ar() ? l.ar || l.en : l.en) : "");

function fmtCell(col: Column, v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "";
  if (col.kind === "kwd") {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : String(v);
  }
  return String(v);
}

function ReportTable({ table }: { table: Table }) {
  const [shown, setShown] = useState(PAGE);
  const rows = table.rows.slice(0, shown);
  const align = (c: Column) => (c.kind ? "text-right rtl:text-left" : "text-left rtl:text-right");
  return (
    <div className="card-elevated p-4 border border-surface-200 shadow-sm">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h4 className="text-sm font-bold text-surface-900">{t(table.title)}</h4>
        <span className="text-[11px] text-surface-400">{table.rows.length} {ar() ? "صف" : "rows"}</span>
      </div>
      {table.rows.length === 0 ? (
        <div className="text-xs text-surface-400 py-6 text-center">{ar() ? "لا توجد بيانات في هذه الفترة" : "No records in this period"}</div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-surface-200 text-surface-500">
                {table.columns.map(c => <th key={c.key} className={`py-2 px-2 font-semibold whitespace-nowrap ${align(c)}`}>{t(c.label)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-surface-100 last:border-0">
                  {table.columns.map(c => (
                    <td key={c.key} className={`py-1.5 px-2 whitespace-nowrap ${align(c)} ${c.kind === "kwd" && String(r[c.key] ?? "").startsWith("-") ? "text-red-600" : "text-surface-700"}`}>
                      {/* Some text cells come with an Arabic version under "<key>Ar". */}
                      {fmtCell(c, ar() && r[`${c.key}Ar`] ? r[`${c.key}Ar`] : r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {table.totals && shown >= table.rows.length && (
                <tr className="bg-brand-pink-50 font-bold text-surface-900">
                  {table.columns.map(c => <td key={c.key} className={`py-2 px-2 whitespace-nowrap ${align(c)}`}>{fmtCell(c, table.totals![c.key])}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {shown < table.rows.length && (
        <button type="button" onClick={() => setShown(s => s + PAGE * 4)} className="mt-3 w-full text-xs font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 rounded-lg py-2">
          {ar() ? `عرض المزيد (${table.rows.length - shown} متبقي)` : `Show more (${table.rows.length - shown} left)`}
        </button>
      )}
      {table.note && <p className="mt-2 text-[11px] text-surface-500">{t(table.note)}</p>}
    </div>
  );
}

export function ReportsTab({ from, to }: { from: string; to: string }) {
  const { getAuthHeader } = useAuth();
  const [type, setType] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const q = new URLSearchParams({ type: type ?? "", from, to }).toString();
  const { data: doc, loading, error: loadError, refetch } = useApi<ReportDoc>(type ? `/reporting/finance/report?${q}` : null, { deps: [type, from, to] });
  const meta = REPORTS.find(r => r.type === type);

  const download = async (format: "xlsx" | "pdf") => {
    if (!type) return;
    setDownloading(format); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/reporting/finance/report/export?${q}&format=${format}`, { headers: { ...(getAuthHeader() ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `belamonda-${type.replace(/_/g, "-")}-${from}_${to}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  if (!type) {
    return (
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "التقارير المالية" : "Finance Reports"}</h3>
            <p className="text-xs text-surface-500 mt-1">
              {ar() ? "اختر تقريراً لمعاينته للفترة المحددة أعلاه، ثم حمّله Excel أو PDF" : "Pick a report to preview it for the period above, then download it as Excel or PDF"}
            </p>
          </div>
          <div className="text-[11px] text-surface-500 bg-surface-50 px-2 py-1 rounded-md whitespace-nowrap self-start">{fmtDate(from)} → {fmtDate(to)}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REPORTS.map(r => (
            <button key={r.type} type="button" onClick={() => setType(r.type)} className="flex items-start gap-3 text-left rtl:text-right rounded-xl border border-surface-200 bg-white p-4 hover:border-brand-pink-300 transition-colors">
              <span className="text-2xl">{r.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-surface-900">{t(r.name)}</span>
                <span className="block text-[11px] text-surface-500 mt-0.5">{t(r.desc)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated p-4 border border-surface-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => setType(null)} className="text-xs font-bold text-brand-pink-600 hover:underline">
              {ar() ? "→ كل التقارير" : "← All reports"}
            </button>
            <h3 className="text-base font-bold text-surface-900 mt-1">{meta?.icon} {t(meta?.name)}</h3>
            <p className="text-[11px] text-surface-500">
              {fmtDate(from)} → {fmtDate(to)}
              {doc && <> · {ar() ? "أُنشئ" : "Generated"} {new Date(doc.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Kuwait", dateStyle: "short", timeStyle: "short" })}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => download("xlsx")} disabled={!!downloading || !doc} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
              {downloading === "xlsx" ? "…" : (ar() ? "تحميل Excel" : "Download Excel")}
            </button>
            <button type="button" onClick={() => download("pdf")} disabled={!!downloading || !doc} className="bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap">
              {downloading === "pdf" ? "…" : (ar() ? "تحميل PDF" : "Download PDF")}
            </button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-200">{error}</div>}
      </div>

      {loading && !doc && <div className="card-elevated p-8 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>}
      {loadError && (
        <div className="rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-200 flex items-center justify-between gap-2">
          <span>{loadError}</span>
          <button type="button" onClick={() => refetch(true)} className="font-bold underline">{ar() ? "إعادة المحاولة" : "Retry"}</button>
        </div>
      )}

      {doc && (
        <>
          {doc.check && (
            <div className={`rounded-lg px-3 py-2 text-xs font-bold border ${doc.check.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {doc.check.ok
                ? (ar() ? `✓ مطابق لسجل المدفوعات (${doc.check.ledgerTotalKwd} د.ك)` : `✓ Matches the Payments Ledger (${doc.check.ledgerTotalKwd} KWD)`)
                : (ar()
                  ? `✗ غير مطابق لسجل المدفوعات — التقرير ${doc.check.reportTotalKwd}، السجل ${doc.check.ledgerTotalKwd}، الفرق ${doc.check.diffKwd}`
                  : `✗ Doesn't match the Payments Ledger — report ${doc.check.reportTotalKwd}, ledger ${doc.check.ledgerTotalKwd}, difference ${doc.check.diffKwd}`)}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {doc.cards.map((c, i) => (
              <div key={i} className="card-elevated p-3 border border-surface-200 min-w-0">
                <div className="text-[11px] text-surface-500 truncate">{t(c.label)}</div>
                <div className={`text-lg font-bold mt-0.5 truncate ${c.tone === "bad" ? "text-red-600" : c.tone === "good" ? "text-emerald-700" : "text-surface-900"}`}>{c.value}</div>
                {c.hint && <div className="text-[10px] text-surface-400 mt-0.5 truncate" title={t(c.hint)}>{t(c.hint)}</div>}
              </div>
            ))}
          </div>

          {doc.tables.map(tb => <ReportTable key={`${doc.type}-${tb.id}`} table={tb} />)}

          {doc.notes.length > 0 && (
            <ul className="text-[11px] text-surface-500 space-y-1 px-1">
              {doc.notes.map((n, i) => <li key={i}>• {t(n)}</li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
