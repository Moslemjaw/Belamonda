import { useMemo, useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useClinicSessionsReport, type ClinicSessionsReport } from "../../../hooks/useApi";
import { API_BASE_URL, apiFetch } from "../../../lib/api";
import { KpiCard } from "../../../components/KpiCard";
import { ar, parseKwd } from "./shared";
import { ClinicRowDetail, PaidProgress } from "./ClinicRowDetail";

// Header and rows share one template so the columns always line up.
const GRID = "sm:grid-cols-[2fr_0.8fr_1fr_1.6fr_20px]";

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
  const { data, loading, setData } = useClinicSessionsReport(range);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"value" | "completed" | "left" | "name">("value");
  const [downloading, setDownloading] = useState(false);

  // Counted from the sessions on screen, so the numbers always match the checkboxes.
  const paidByClinic = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data?.rows ?? []) if (r.paidToClinic) counts.set(r.clinicId, (counts.get(r.clinicId) ?? 0) + 1);
    return counts;
  }, [data?.rows]);
  const leftToPay = (c: { clinicId: string; completed: number }) => c.completed - (paidByClinic.get(c.clinicId) ?? 0);
  const name = (c: { clinicNameEn: string; clinicNameAr: string }) => (ar() ? c.clinicNameAr || c.clinicNameEn : c.clinicNameEn);
  const clinics = (data?.clinics ?? []).filter(c =>
    !search ||
    c.clinicNameEn.toLowerCase().includes(search.toLowerCase()) ||
    c.clinicNameAr.includes(search)
  ).sort((a, b) => {
    if (sort === "name") return name(a).localeCompare(name(b));
    if (sort === "completed") return b.completed - a.completed;
    if (sort === "left") return leftToPay(b) - leftToPay(a);
    return parseKwd(b.sessionValueKwd) - parseKwd(a.sessionValueKwd);
  });
  const t = data?.totals;
  const totalPaid = [...paidByClinic.values()].reduce((sum, n) => sum + n, 0);
  const totalLeft = (t?.completed ?? 0) - totalPaid;

  const [saving, setSaving] = useState<string | null>(null);
  const togglePaid = async (sessionId: string, paid: boolean) => {
    setSaving(sessionId);
    try {
      await apiFetch(`/reporting/finance/clinic-sessions/${sessionId}/paid-to-clinic`, {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify({ paid }),
      });
      setData(prev => prev && { ...prev, rows: prev.rows.map(r => (r.sessionId === sessionId ? { ...r, paidToClinic: paid } : r)) });
    } catch (e: any) {
      alert(e?.message || (ar() ? "تعذر الحفظ" : "Could not save"));
    } finally {
      setSaving(null);
    }
  };

  const download = async () => {
    setDownloading(true);
    try { await downloadClinicSessions(getAuthHeader() ?? undefined, range); }
    catch (e: any) { alert(e.message); }
    finally { setDownloading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          label={ar() ? "جلسات حضرت" : "Completed sessions"}
          value={String(t?.completed ?? 0)}
          sub={ar() ? `لم يحضر ${t?.noShow ?? 0}` : `${t?.noShow ?? 0} ${t?.noShow === 1 ? "no-show" : "no-shows"}`}
          accent="emerald" icon="✅"
        />
        <KpiCard
          label={ar() ? "قيمة الجلسات" : "Session value"}
          value={`${t?.sessionValueKwd ?? "0.000"} KWD`}
          sub={ar() ? `كاش باك ${t?.cashbackKwd ?? "0.000"}` : `${t?.cashbackKwd ?? "0.000"} cashback used`}
          accent="indigo" icon="🧾"
        />
        <KpiCard
          label={ar() ? "مدفوع للمراكز" : "Paid to clinics"}
          value={`${totalPaid} / ${t?.completed ?? 0}`}
          sub={ar() ? `متبقي ${totalLeft} جلسة` : `${totalLeft} left to pay`}
          accent="teal" icon="🏦"
        />
      </div>

      <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 border-b border-surface-100">
          <h3 className="text-base font-bold text-surface-900">{ar() ? "المراكز" : "Clinics"} <span className="text-xs text-surface-400 font-medium">({clinics.length})</span></h3>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
            <input type="text" placeholder={ar() ? "ابحث عن مركز..." : "Search clinic..."}
              className="input-field text-xs py-1.5 h-auto w-full sm:w-48"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="select-field text-xs py-1.5 h-auto sm:w-40" value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label={ar() ? "ترتيب" : "Sort"}>
              <option value="value">{ar() ? "الأعلى قيمة" : "Highest value"}</option>
              <option value="left">{ar() ? "الأكثر غير مدفوع" : "Most left to pay"}</option>
              <option value="completed">{ar() ? "الأكثر جلسات" : "Most sessions"}</option>
              <option value="name">{ar() ? "الاسم" : "Name"}</option>
            </select>
            <button onClick={() => void download()} disabled={downloading}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold disabled:opacity-50 whitespace-nowrap">
              {downloading ? "..." : (ar() ? "تحميل Excel" : "Download Excel")}
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : clinics.length === 0 ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "لا توجد جلسات في هذه الفترة" : "No sessions in this period"}</div>
        ) : (
          <div>
            <div className={`hidden sm:grid ${GRID} gap-6 px-6 py-2.5 bg-surface-50 border-b border-surface-100 text-[10px] uppercase tracking-wider font-bold text-surface-500 whitespace-nowrap`}>
              <div>{ar() ? "المركز" : "Clinic"}</div>
              <div className="text-center">{ar() ? "الجلسات" : "Sessions"}</div>
              <div className="text-right">{ar() ? "القيمة (د.ك)" : "Value (KWD)"}</div>
              <div>{ar() ? "مدفوع للمركز" : "Paid to clinic"}</div>
              <div />
            </div>

            {clinics.map(c => {
              const open = expandedId === c.clinicId;
              const paid = paidByClinic.get(c.clinicId) ?? 0;
              return (
                <div key={c.clinicId}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    className={`grid grid-cols-[1fr_20px] ${GRID} gap-x-6 gap-y-2 px-6 py-3.5 border-b border-surface-100 hover:bg-surface-50 transition-colors cursor-pointer items-center ${open ? "bg-surface-50" : ""}`}
                    onClick={() => setExpandedId(open ? null : c.clinicId)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(open ? null : c.clinicId); } }}
                  >
                    <div>
                      <div className="font-bold text-surface-900 text-sm">{name(c)}</div>
                      <div className="sm:hidden text-xs text-surface-500 mt-1">
                        {c.completed} {ar() ? "جلسة" : "sessions"} · {c.sessionValueKwd} KWD
                      </div>
                      <PaidProgress paid={paid} total={c.completed} className="flex sm:hidden mt-2" />
                    </div>
                    <div className="hidden sm:block text-center font-bold text-surface-900">
                      {c.completed}
                      {c.noShow > 0 && <span className="block text-[11px] font-medium text-red-600">{ar() ? `لم يحضر ${c.noShow}` : `${c.noShow} no-show`}</span>}
                    </div>
                    <div className="hidden sm:block text-right font-bold text-surface-900 tabular-nums">{c.sessionValueKwd}</div>
                    <PaidProgress paid={paid} total={c.completed} className="hidden sm:flex" />
                    <svg className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {open && (
                    <ClinicRowDetail
                      clinic={c}
                      rows={(data?.rows ?? []).filter(r => r.clinicId === c.clinicId)}
                      range={range}
                      saving={saving}
                      onTogglePaid={togglePaid}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
