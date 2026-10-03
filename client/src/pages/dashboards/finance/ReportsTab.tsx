import { useState } from "react";
import { useAuth } from "../../../app/AuthContext";
import { API_BASE_URL } from "../../../lib/api";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

export function ReportsTab({ from, to }: { from: string; to: string }) {
  const { getAuthHeader } = useAuth();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reports = [
    { kind: "comprehensive", icon: "📚", name: ar() ? "التقرير الشامل" : "Master Data Report", desc: ar() ? "بيانات مجمعة تشمل العملاء والمدفوعات والمزيد" : "Merged data: Users, Memberships, Sessions, Payments" },
    { kind: "payments", icon: "💳", name: ar() ? "كل المدفوعات" : "All Payments", desc: ar() ? "سجل كامل لكل العمليات" : "Complete transaction ledger" },
    { kind: "subscriptions", icon: "👥", name: ar() ? "تقرير الاشتراكات" : "Subscriptions Report", desc: ar() ? "حالة الباقات والجلسات المتبقية" : "Memberships status & used sessions" },
    { kind: "offers", icon: "📦", name: ar() ? "تقرير العروض" : "Offers Report", desc: ar() ? "الإيرادات حسب العرض" : "Revenue by offer" },
    { kind: "referrals", icon: "🔗", name: ar() ? "تقرير الإحالات" : "Referrals Report", desc: ar() ? "أداء أكواد الإحالة والعمولات" : "Referral code performance" },
    { kind: "installments", icon: "📅", name: ar() ? "تقرير الأقساط" : "Installments Report", desc: ar() ? "المدفوعة والقادمة والمتأخرة" : "Paid, upcoming and late" },
    { kind: "clinics", icon: "🏥", name: ar() ? "أداء العيادات" : "Clinics Performance", desc: ar() ? "الاستخدام والإيرادات وجلسات التخلف" : "Utilization, revenue & no-shows" },
  ];

  const downloadXlsx = async (kind: string) => {
    setDownloading(kind); setError(null);
    try {
      const params = new URLSearchParams({ kind, from, to, format: "xlsx" });
      const res = await fetch(`${API_BASE_URL}/reporting/finance/export?${params.toString()}`, {
        headers: { ...(getAuthHeader() ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  return (
    <div className="space-y-5">
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "تصدير التقارير المالية" : "Export Financial Reports"}</h3>
            <p className="text-xs text-surface-500 mt-1">
              {ar() ? "ستُصدَّر التقارير بصيغة Excel (XLSX) ضمن نطاق التاريخ المحدد أعلاه" : "Reports export as Excel (XLSX) within the date range above"}
            </p>
          </div>
          <div className="text-[11px] text-surface-500 bg-surface-50 px-2 py-1 rounded-md whitespace-nowrap">
            {fmtDate(from)} → {fmtDate(to)}
          </div>
        </div>

        {error && <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2 border border-red-200">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          {reports.map(r => (
            <div key={r.kind} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white p-4 hover:border-brand-pink-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl">{r.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-surface-900 truncate">{r.name}</div>
                  <div className="text-[11px] text-surface-500 truncate">{r.desc}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadXlsx(r.kind)}
                  disabled={downloading !== null}
                  className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                >
                  {downloading === r.kind ? (ar() ? "..." : "...") : "XLSX"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// CLINICS TAB — per-clinic numbers, sessions, invoices, downloadable report
// ===========================================================================
