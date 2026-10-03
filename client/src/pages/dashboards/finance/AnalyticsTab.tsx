import { useMemo } from "react";
import { ResponsiveContainer, Line, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useFinanceTimeseries, useRevenueByOffer, useRevenueByReferral } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { ar, fmt, parseKwd, COLORS } from "./shared";

export function AnalyticsTab({ from, to }: { from: string; to: string }) {
  const { data: offers, loading: offersLoading } = useRevenueByOffer({ from, to });
  const { data: referrals, loading: refLoading } = useRevenueByReferral({ from, to });
  const { data: ts } = useFinanceTimeseries("daily", { from, to });

  const offerChart = useMemo(() => (offers?.items ?? []).slice(0, 8).map(o => ({
    name: o.offerName.length > 24 ? o.offerName.slice(0, 22) + "…" : o.offerName,
    Revenue: parseKwd(o.revenueKwd),
    Sales: o.salesCount,
  })), [offers]);

  // Daily performance data for the last 7 visible points
  const dailyPerf = useMemo(() => {
    const pts = ts?.points ?? [];
    return pts.slice(-14).map(p => ({
      date: p.bucket,
      Revenue: parseKwd(p.revenueKwd),
      Cashback: parseKwd(p.cashbackKwd),
      Txns: p.transactions,
    }));
  }, [ts]);

  // Revenue composition: membership vs session
  const totalOfferRevenue = (offers?.items ?? []).reduce((s, o) => s + parseKwd(o.revenueKwd), 0);
  const totalOfferSales = (offers?.items ?? []).reduce((s, o) => s + o.salesCount, 0);
  const topOffer = (offers?.items ?? []).sort((a, b) => parseKwd(b.revenueKwd) - parseKwd(a.revenueKwd))[0];

  return (
    <div className="space-y-5">

      {/* Top-line analytics KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={ar() ? "إجمالي إيرادات العروض" : "Total Offer Revenue"} value={`${fmt(totalOfferRevenue)} KWD`} accent="emerald" icon="📦" />
        <KpiCard label={ar() ? "إجمالي المبيعات" : "Total Sales"} value={String(totalOfferSales)} accent="indigo" icon="🛒" />
        <KpiCard label={ar() ? "عدد العروض" : "Active Offers"} value={String((offers?.items ?? []).length)} accent="blue" icon="📋" />
        <KpiCard label={ar() ? "أفضل عرض" : "Top Offer"} value={topOffer ? `${fmt(parseKwd(topOffer.revenueKwd))} KWD` : "—"} sub={topOffer?.offerName ?? ""} accent="pink" icon="🏆" isHighlighted />
      </div>

      {/* Daily Performance Chart — Revenue vs Cashback */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-surface-900">{ar() ? "الأداء اليومي" : "Daily Performance"}</h3>
            <p className="text-xs text-surface-500 mt-0.5">{ar() ? "الإيرادات والكاش باك والمعاملات يومياً" : "Revenue, cashback & transactions per day"}</p>
          </div>
          <span className="text-xs text-surface-400">{dailyPerf.length} {ar() ? "يوم" : "days"}</span>
        </div>
        {dailyPerf.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات" : "No data"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyPerf} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.emerald} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={COLORS.emerald} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip formatter={(v: any, name: any) => name === "Txns" ? v : `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="url(#dailyRevGrad)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Cashback" fill={COLORS.amber} radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line type="monotone" dataKey="Txns" stroke={COLORS.indigo} strokeWidth={2} dot={{ r: 3 }} yAxisId={0} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily Performance Table */}
      {dailyPerf.length > 0 && (
        <div className="card-elevated p-5 border border-surface-200 shadow-sm">
          <h3 className="text-sm font-bold text-surface-900 mb-3">{ar() ? "جدول الأداء اليومي" : "Daily Performance Table"}</h3>
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-xs">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "التاريخ" : "Date"}</th>
                  <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                  <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
                  <th className="text-center">{ar() ? "المعاملات" : "Txns"}</th>
                  <th>{ar() ? "مؤشر" : "Indicator"}</th>
                </tr>
              </thead>
              <tbody>
                {[...dailyPerf].reverse().map(d => {
                  const avgRev = dailyPerf.reduce((s, x) => s + x.Revenue, 0) / dailyPerf.length;
                  const isHigh = d.Revenue > avgRev * 1.2;
                  const isLow = d.Revenue < avgRev * 0.5 && d.Revenue > 0;
                  return (
                    <tr key={d.date}>
                      <td className="font-medium text-surface-900 whitespace-nowrap">{d.date}</td>
                      <td className="text-right font-bold text-emerald-700">{fmt(d.Revenue)} KWD</td>
                      <td className="text-right text-amber-600">{fmt(d.Cashback)} KWD</td>
                      <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold">{d.Txns}</span></td>
                      <td>
                        {isHigh && <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">🔥 Above Avg</span>}
                        {isLow && <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">⚠️ Below Avg</span>}
                        {!isHigh && !isLow && d.Revenue > 0 && <span className="text-surface-400 text-[10px]">— Normal</span>}
                        {d.Revenue === 0 && <span className="text-surface-300 text-[10px]">No activity</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offers Chart */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "أفضل العروض من حيث الإيرادات" : "Top Offers by Revenue"}</h3>
        {offersLoading && offerChart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : offerChart.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد بيانات" : "No data"}</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(240, offerChart.length * 40)}>
            <BarChart data={offerChart} layout="vertical" margin={{ top: 5, right: 16, left: 140, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" width={140} />
              <Tooltip formatter={(v: any, name: any) => name === "Sales" ? v : `${fmt(Number(v))} KWD`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill={COLORS.emerald} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Offers Table */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "تفاصيل العروض" : "Offers Detail"}</h3>
        <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          {/* Mobile view (Cards) */}
          <div className="md:hidden divide-y divide-surface-100">
            {(offers?.items ?? []).length === 0 ? (
              <div className="p-8 text-center"><div className="empty-state-icon mx-auto"><svg className="w-7 h-7 mx-auto text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><div className="text-sm font-bold mt-2">{ar() ? "لا توجد بيانات" : "No data yet"}</div></div>
            ) : (offers?.items ?? []).map(o => (
              <div key={o.offerId} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="font-bold text-surface-900 line-clamp-1">{o.offerName}</div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-emerald-700">{o.revenueKwd}</div>
                    <div className="text-[10px] text-surface-500">{ar() ? "المتوقع:" : "Expected:"} {o.expectedKwd}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-surface-500 bg-surface-50 border border-surface-200 px-2 py-0.5 rounded-md capitalize">{o.membershipType}</span>
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold">{o.salesCount} {ar() ? "مبيعات" : "Sales"}</span>
                  <span className="text-[10px] text-amber-600 font-bold ml-auto">{o.cashbackKwd} CB</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop view (Table) */}
          <div className="overflow-x-auto hidden md:block">
            <table className="data-table text-sm w-full">
              <thead>
                <tr className="bg-surface-50">
                  <th>{ar() ? "العرض" : "Offer"}</th>
                  <th>{ar() ? "النوع" : "Type"}</th>
                  <th className="text-center">{ar() ? "المبيعات" : "Sales"}</th>
                  <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                  <th className="text-right">{ar() ? "المتوقع" : "Expected"}</th>
                  <th className="text-right">{ar() ? "كاش باك" : "Cashback"}</th>
                </tr>
              </thead>
              <tbody>
                {(offers?.items ?? []).length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد بيانات" : "No data yet"}</div><div className="empty-state-sub">{ar() ? "ستظهر النتائج هنا بمجرد توفرها." : "Results will appear here once available."}</div></div></td></tr>
                ) : (offers?.items ?? []).map(o => (
                  <tr key={o.offerId}>
                    <td className="font-medium">{o.offerName}</td>
                    <td className="text-xs text-surface-500 capitalize">{o.membershipType}</td>
                    <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold">{o.salesCount}</span></td>
                    <td className="text-right font-bold text-emerald-700">{o.revenueKwd}</td>
                    <td className="text-right font-bold text-blue-700">{o.expectedKwd}</td>
                    <td className="text-right text-amber-600">{o.cashbackKwd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Referrals */}
      <div className="card-elevated p-5 border border-surface-200 shadow-sm">
        <h3 className="text-sm font-bold text-surface-900 mb-4">{ar() ? "الإيرادات حسب رمز الإحالة" : "Revenue by Referral Code"}</h3>
        {refLoading && (referrals?.items ?? []).length === 0 ? (
          <div className="text-sm text-surface-400 py-6 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : (referrals?.items ?? []).length === 0 ? (
          <div className="text-sm text-surface-400 py-6 text-center">{ar() ? "لا توجد إحالات في هذه الفترة" : "No referrals in this range"}</div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            {/* Mobile view (Cards) */}
            <div className="md:hidden divide-y divide-surface-100">
              {(referrals?.items ?? []).map(r => (
                <div key={r.referrerId} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="font-bold text-surface-900 line-clamp-1">{r.displayName}</div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-emerald-700">{r.revenueKwd} <span className="text-[10px] text-surface-500">KWD</span></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] bg-brand-pink-50 text-brand-pink-700 px-2 py-0.5 rounded-md font-bold">{r.referralCode}</span>
                    <span className="text-[10px] text-surface-500 bg-surface-50 border border-surface-200 px-2 py-0.5 rounded-md capitalize">{r.role}</span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] font-bold ml-auto">{r.salesCount} {ar() ? "مبيعات" : "Sales"}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop view (Table) */}
            <div className="overflow-x-auto hidden md:block">
              <table className="data-table text-sm w-full">
                <thead>
                  <tr className="bg-surface-50">
                    <th>{ar() ? "المحيل" : "Referrer"}</th>
                    <th>{ar() ? "الكود" : "Code"}</th>
                    <th>{ar() ? "الدور" : "Role"}</th>
                    <th className="text-center">{ar() ? "المبيعات" : "Sales"}</th>
                    <th className="text-right">{ar() ? "الإيرادات" : "Revenue"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(referrals?.items ?? []).map(r => (
                    <tr key={r.referrerId}>
                      <td className="font-medium">{r.displayName}</td>
                      <td><span className="font-mono text-xs bg-brand-pink-50 text-brand-pink-700 px-2 py-0.5 rounded-md font-bold">{r.referralCode}</span></td>
                      <td className="text-xs text-surface-500 capitalize">{r.role}</td>
                      <td className="text-center"><span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold">{r.salesCount}</span></td>
                      <td className="text-right font-bold text-emerald-700">{r.revenueKwd} KWD</td>
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
// REPORTS TAB — real CSV export
// ===========================================================================
