import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useClinicSessionsReport } from "../../../hooks/useApi";
import { API_BASE_URL } from "../../../lib/api";
import { KpiCard } from "../../../components/KpiCard";
import { ar, parseKwd } from "./shared";
import { ClinicRowDetail } from "./ClinicRowDetail";

/** Downloads the clinic sessions Excel report for a period (all clinics, or one). */
export async function downloadClinicSessions(
  authHeader: Record<string, string> | undefined,
  range: { from: string; to: string },
  clinicId?: string,
) {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (clinicId) params.set("clinicId", clinicId);
  const res = await fetch(`${API_BASE_URL}/reporting/finance/clinic-sessions/export?${params.toString()}`, {
    headers: { ...(authHeader ?? {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clinic-sessions-${range.from}_${range.to}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function ClinicsTab({ from, to }: { from: string; to: string }) {
  const { getAuthHeader } = useAuth();
  const range = { from: from.slice(0, 10), to: to.slice(0, 10) };
  const { data, loading } = useClinicSessionsReport(range);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"value" | "completed" | "noShow" | "name">("value");
  const [downloading, setDownloading] = useState(false);

  const name = (c: { clinicNameEn: string; clinicNameAr: string }) => (ar() ? c.clinicNameAr || c.clinicNameEn : c.clinicNameEn);
  const clinics = (data?.clinics ?? []).filter(c =>
    !search ||
    c.clinicNameEn.toLowerCase().includes(search.toLowerCase()) ||
    c.clinicNameAr.includes(search)
  ).sort((a, b) => {
    if (sort === "name") return name(a).localeCompare(name(b));
    if (sort === "completed") return b.completed - a.completed;
    if (sort === "noShow") return b.noShow - a.noShow;
    return parseKwd(b.sessionValueKwd) - parseKwd(a.sessionValueKwd);
  });
  const t = data?.totals;

  const download = async () => {
    setDownloading(true);
    try { await downloadClinicSessions(getAuthHeader() ?? undefined, range); }
    catch (e: any) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="card-elevated border border-surface-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-surface-900">{ar() ? "جلسات المراكز" : "Clinic sessions"}</h3>
          <p className="text-xs text-surface-500 mt-0.5">
            {ar() ? "الجلسات التي تمت في كل مركز (حضر أو لم يحضر)" : "Sessions that happened at each clinic (completed or no-show)"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void download()} disabled={downloading}
            className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold disabled:opacity-50">
            {downloading ? "..." : (ar() ? "تحميل Excel" : "Download Excel")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
        <KpiCard label={ar() ? "جلسات حضرت" : "Completed"} value={String(t?.completed ?? 0)} accent="emerald" icon="✅" />
        <KpiCard label={ar() ? "لم يحضر" : "No-shows"} value={String(t?.noShow ?? 0)} accent="red" icon="🚫" />
        <KpiCard label={ar() ? "قيمة الجلسات" : "Session value"} value={`${t?.sessionValueKwd ?? "0.000"} KWD`} accent="indigo" icon="🧾" />
        <KpiCard label={ar() ? "كاش باك مستخدم" : "Cashback used"} value={`${t?.cashbackKwd ?? "0.000"} KWD`} accent="amber" icon="🎁" />
        <KpiCard label={ar() ? "مدفوع في المركز" : "Paid at clinic"} value={`${t?.paidAtClinicKwd ?? "0.000"} KWD`} accent="pink" icon="💳" />
      </div>

      <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-3 border-b border-surface-100">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "المراكز" : "Clinics"} <span className="text-xs text-surface-400 font-medium">({clinics.length})</span></h3>
            <p className="text-xs text-surface-500 mt-0.5">{ar() ? "انقر على مركز لعرض جلساته" : "Click a clinic to see its sessions"}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <input type="text" placeholder={ar() ? "ابحث عن مركز..." : "Search clinic..."}
              className="input-field text-xs py-1.5 h-auto w-full sm:w-52"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select-field text-xs py-1.5 h-auto sm:w-44" value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label={ar() ? "ترتيب" : "Sort"}>
              <option value="value">{ar() ? "الأعلى قيمة" : "Highest value"}</option>
              <option value="completed">{ar() ? "الأكثر جلسات" : "Most sessions"}</option>
              <option value="noShow">{ar() ? "الأكثر عدم حضور" : "Most no-shows"}</option>
              <option value="name">{ar() ? "الاسم" : "Name"}</option>
            </select>
          </div>
        </div>

        {loading && !data ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : clinics.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "لا توجد جلسات في هذه الفترة" : "No sessions in this period"}</div>
        ) : (
          <div>
            <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1.2fr_1.2fr_1.2fr_28px] gap-4 px-6 py-3 bg-surface-50 border-b border-surface-100 text-[10px] uppercase tracking-wider font-bold text-surface-500">
              <div>{ar() ? "المركز" : "Clinic"}</div>
              <div className="text-center">{ar() ? "حضر" : "Completed"}</div>
              <div className="text-center">{ar() ? "لم يحضر" : "No-show"}</div>
              <div className="text-right">{ar() ? "قيمة الجلسات" : "Session value"}</div>
              <div className="text-right">{ar() ? "كاش باك" : "Cashback"}</div>
              <div className="text-right">{ar() ? "مدفوع في المركز" : "Paid at clinic"}</div>
              <div />
            </div>

            {clinics.map(c => (
              <div key={c.clinicId}>
                <div
                  className={`grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_1.2fr_1.2fr_1.2fr_28px] gap-4 px-6 py-4 border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer items-center ${expandedId === c.clinicId ? "bg-brand-pink-50/20" : ""}`}
                  onClick={() => setExpandedId(expandedId === c.clinicId ? null : c.clinicId)}
                >
                  <div>
                    <div className="font-bold text-surface-900 text-sm">{ar() ? (c.clinicNameAr || c.clinicNameEn) : c.clinicNameEn}</div>
                    <div className="sm:hidden text-xs text-surface-500 mt-1 flex gap-3 flex-wrap">
                      <span>{c.completed} {ar() ? "حضر" : "completed"}</span>
                      <span>{c.noShow} {ar() ? "لم يحضر" : "no-show"}</span>
                      <span className="text-emerald-700 font-bold">{c.sessionValueKwd} KWD</span>
                    </div>
                  </div>
                  <div className="hidden sm:block text-center font-bold text-emerald-700">{c.completed}</div>
                  <div className="hidden sm:block text-center font-bold text-red-600">{c.noShow}</div>
                  <div className="hidden sm:block text-right font-bold text-surface-900">{c.sessionValueKwd}</div>
                  <div className="hidden sm:block text-right text-amber-700">{c.cashbackKwd}</div>
                  <div className="hidden sm:block text-right font-bold text-brand-pink-700">{c.paidAtClinicKwd}</div>
                  <div className="flex items-center">
                    <svg className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${expandedId === c.clinicId ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {expandedId === c.clinicId && (
                  <ClinicRowDetail
                    clinic={c}
                    rows={(data?.rows ?? []).filter(r => r.clinicId === c.clinicId)}
                    range={range}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
