import { useState, useEffect } from "react";
import { useAuth } from "../app/AuthContext";
import { apiFetch } from "../lib/api";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

interface ReferredUser {
  id: string;
  username?: string;
  fullName?: string;
  joinedAt?: string;
}

interface ReferralStats {
  referredCount: number;
  convertedCount: number;
  totalAmountKwd: string;
  referredUsers: ReferredUser[];
}

interface ReferralStatsResponse {
  referredCount: number;
  convertedCount: number;
  totalAmountKwd: string;
  referredUsers: ReferredUser[];
}

interface LeaderboardRow {
  userId: string;
  username: string;
  role: string;
  referralCode?: string;
  referredCount: number;
  convertedCount: number;
  totalAmountKwd: string;
}

interface LeaderboardResponse {
  items: LeaderboardRow[];
}

export function ReferralActivityWidget() {
  const { getAuthHeader } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setFetchError(false);
    const headers = getAuthHeader();
    apiFetch("/referral/stats", { headers })
      .then((d) => { if (mounted) { setStats(d as ReferralStatsResponse); setLoading(false); } })
      .catch((err: unknown) => {
        if (!mounted) return;
        console.error("[ReferralActivityWidget] Failed to load referral stats:", err);
        setFetchError(true);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [getAuthHeader, retryCount]);

  return (
    <div className="card-elevated p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {ar() ? "نشاط الإحالة" : "Referral Activity"}
        </h3>
        {fetchError && (
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="text-xs text-brand-pink-500 underline underline-offset-2"
          >
            {ar() ? "إعادة المحاولة" : "Try Again"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-24 animate-pulse bg-surface-100 rounded-xl" />
      ) : fetchError ? (
        <p className="text-sm text-surface-400 text-center py-4">
          {ar() ? "تعذّر تحميل البيانات." : "Unable to load referral data."}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 text-center">
            <div className="text-2xl font-black text-surface-900">{stats?.referredCount ?? 0}</div>
            <div className="text-xs text-surface-500 mt-1 font-medium">{ar() ? "إجمالي المُحالين" : "Total Referred"}</div>
          </div>
          <div className="bg-brand-pink-50 rounded-xl p-4 border border-brand-pink-100 text-center">
            <div className="text-2xl font-black text-brand-pink-600">{stats?.convertedCount ?? 0}</div>
            <div className="text-xs text-brand-pink-400 mt-1 font-medium">{ar() ? "تحويلات مؤكدة" : "Converted"}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
            <div className="text-2xl font-black text-emerald-600">
              {stats?.referredCount ? Math.round(((stats.convertedCount ?? 0) / stats.referredCount) * 100) : 0}%
            </div>
            <div className="text-xs text-emerald-500 mt-1 font-medium">{ar() ? "معدل التحويل" : "Conversion Rate"}</div>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-center">
            <div className="text-lg font-black text-amber-700 leading-tight">{stats?.totalAmountKwd ?? "0.000"}</div>
            <div className="text-xs text-amber-500 mt-1 font-medium">{ar() ? "إجمالي المبيعات (KWD)" : "Revenue (KWD)"}</div>
          </div>
        </div>
      )}

      {(stats?.referredUsers?.length ?? 0) > 0 && (
        <div className="mt-4 pt-4 border-t border-surface-100">
          <div className="text-xs font-semibold text-surface-500 mb-2 uppercase tracking-wider">{ar() ? "المُحالون الأخيرون" : "Recently Referred"}</div>
          <div className="flex flex-wrap gap-2">
            {(stats?.referredUsers ?? []).slice(0, 5).map((u, i) => (
              <span key={i} className="text-xs bg-white border border-surface-200 rounded-full px-3 py-1 text-surface-700">
                {u.username || u.id}
              </span>
            ))}
            {(stats?.referredUsers?.length ?? 0) > 5 && (
              <span className="text-xs text-surface-400 px-2 py-1">+{(stats?.referredUsers?.length ?? 0) - 5} {ar() ? "آخرين" : "more"}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReferralLeaderboardWidget({ allowedRoles }: { allowedRoles?: string[] }) {
  const { getAuthHeader } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setFetchError(false);
    const headers = getAuthHeader();
    apiFetch("/referral/admin/all", { headers })
      .then((d) => { if (mounted) { setRows((d as LeaderboardResponse).items || []); setLoading(false); } })
      .catch((err: unknown) => {
        if (!mounted) return;
        console.error("[ReferralLeaderboardWidget] Failed to load leaderboard:", err);
        setFetchError(true);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [getAuthHeader, retryCount]);

  const filteredByProps = allowedRoles ? rows.filter(r => allowedRoles.includes(r.role)) : rows;
  const filteredByState = roleFilter === "all" ? filteredByProps : filteredByProps.filter(r => r.role === roleFilter);
  const sorted = [...filteredByState].sort((a, b) => (b.referredCount ?? 0) - (a.referredCount ?? 0));

  const availableRoles = Array.from(new Set(filteredByProps.map(r => r.role))).filter(Boolean);

  const handleDownload = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + "Staff,Role,Referred,Converted,Rate,Revenue (KWD)\n"
      + sorted.map(s => {
          const rate = s.referredCount ? Math.round(((s.convertedCount ?? 0) / s.referredCount) * 100) : 0;
          return `${s.username},${s.role},${s.referredCount ?? 0},${s.convertedCount ?? 0},${rate}%,${s.totalAmountKwd ?? "0.000"}`;
        }).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `referral_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card-elevated p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          {ar() ? "نشاط الإحالة — تقرير الموظفين" : "Referral Activity — Staff Report"}
        </h3>
        <div className="flex items-center gap-2">
          {fetchError && (
            <button
              onClick={() => setRetryCount((c) => c + 1)}
              className="text-xs text-brand-pink-500 underline underline-offset-2"
            >
              {ar() ? "إعادة المحاولة" : "Try Again"}
            </button>
          )}
          {!loading && !fetchError && (
            <>
              <select
                className="select-field text-xs py-1 px-2 pr-6"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="all">{ar() ? "جميع الأدوار" : "All Roles"}</option>
                {availableRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button onClick={handleDownload} className="btn-secondary btn-sm flex items-center gap-1.5 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {ar() ? "تحميل التقرير" : "Download"}
              </button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse bg-surface-100 rounded-xl" />
      ) : fetchError ? (
        <p className="text-sm text-surface-400 text-center py-4">
          {ar() ? "تعذّر تحميل البيانات." : "Unable to load referral data."}
        </p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-4">{ar() ? "لا توجد بيانات إحالة بعد" : "No referral data yet"}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-200">
          <table className="data-table text-sm">
            <thead>
              <tr>
                <th>{ar() ? "الموظف" : "Staff"}</th>
                <th>{ar() ? "الدور" : "Role"}</th>
                <th>{ar() ? "المُحالون" : "Referred"}</th>
                <th>{ar() ? "تحويلات" : "Converted"}</th>
                <th>{ar() ? "معدل التحويل" : "Rate"}</th>
                <th>{ar() ? "إجمالي المبيعات" : "Revenue (KWD)"}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => (
                <tr key={s.userId}>
                  <td className="font-semibold">{s.username}</td>
                  <td><span className="badge-sage text-[10px]">{s.role}</span></td>
                  <td className="font-bold">{s.referredCount ?? 0}</td>
                  <td className="font-bold text-brand-pink-600">{s.convertedCount ?? 0}</td>
                  <td>
                    <span className="text-xs font-bold text-emerald-600">
                      {s.referredCount ? Math.round(((s.convertedCount ?? 0) / s.referredCount) * 100) : 0}%
                    </span>
                  </td>
                  <td className="font-bold text-amber-700">{s.totalAmountKwd ?? "0.000"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
