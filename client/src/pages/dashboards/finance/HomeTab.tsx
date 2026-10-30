import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useFinanceInstallments, useFinanceSnapshot, usePackageRevenue, type RevenueGranularity } from "../../../hooks/useApi";
import { KpiCard } from "../../../components/KpiCard";
import { ar, parseKwd, COLORS } from "./shared";

export function HomeTab({
  from, to, granularity, onOpenInstallments, onOpenPendingPayments,
}: {
  from: string;
  to: string;
  granularity: RevenueGranularity;
  onOpenInstallments: () => void;
  onOpenPendingPayments: () => void;
}) {
  const { data: rev, loading } = usePackageRevenue({ from, to, granularity });
  // Not date-filtered: the cashback balance and the review queue are "right now" numbers.
  const { data: snapshotData } = useFinanceSnapshot();
  const { data: installments } = useFinanceInstallments();

  const snapshot = snapshotData?.snapshot;
  const lateCount = installments?.summary?.lateCount ?? 0;
  const lateKwd = installments?.summary?.lateKwd ?? "0.000";
  const pendingCount = snapshot?.pendingPaymentsCount ?? 0;

  const chartData = useMemo(
    () => (rev?.points ?? []).map(p => ({ bucket: p.bucket, Revenue: parseKwd(p.revenueKwd) })),
    [rev],
  );

  const kwd = (v?: string) => `${v ?? "0.000"} KWD`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label={ar() ? "الإيرادات (الباقات)" : "Revenue (packages)"}
          value={kwd(rev?.revenueKwd)}
          sub={ar()
            ? `${rev?.paymentsCount ?? 0} دفعة · بعد خصم الاستردادات`
            : `${rev?.paymentsCount ?? 0} payments · after refunds`}
          accent="emerald" icon="💰" isHighlighted
        />
        <KpiCard
          label={ar() ? "المتبقي للتحصيل" : "Still to collect"}
          value={kwd(rev?.outstandingKwd)}
          sub={ar()
            ? `من باقات هذه الفترة (${rev?.outstandingCount ?? 0}) · متأخر ${rev?.lateKwd ?? "0.000"}`
            : `from ${rev?.outstandingCount ?? 0} packages sold in this period · ${rev?.lateKwd ?? "0.000"} late`}
          accent="amber" icon="⏳"
        />
        <KpiCard
          label={ar() ? "الاستردادات والإلغاءات" : "Refunds & cancellations"}
          value={kwd(rev?.refundsKwd)}
          sub={ar()
            ? `${rev?.refundsCount ?? 0} استرداد · ${rev?.cancelled.count ?? 0} اشتراك ملغي`
            : `${rev?.refundsCount ?? 0} refunds · ${rev?.cancelled.count ?? 0} cancelled`}
          accent="rose" icon="↩️"
        />
        <KpiCard
          label={ar() ? "باقات ممنوحة (ليست إيراد)" : "Granted (not revenue)"}
          value={`${rev?.granted.count ?? 0}`}
          sub={ar() ? `قيمتها ${rev?.granted.listValueKwd ?? "0.000"} د.ك بسعر القائمة` : `${rev?.granted.listValueKwd ?? "0.000"} KWD at list price`}
          accent="violet" icon="🎁"
        />
        <KpiCard
          label={ar() ? "الباقات المباعة" : "Packages sold"}
          value={`${rev?.packagesSold ?? 0}`}
          sub={ar() ? "في هذه الفترة" : "in this period"}
          accent="pink" icon="📦"
        />
        <KpiCard
          label={ar() ? "رصيد الكاش باك المستحق" : "Cashback owed"}
          value={kwd(snapshot?.cashback?.netLiabilityKwd)}
          sub={ar() ? "الرصيد الحالي، لا يتأثر بالتاريخ" : "current balance, not date-filtered"}
          accent="indigo" icon="⚖️"
        />
      </div>

      <div className="card-elevated p-5">
        <h3 className="text-sm font-bold text-surface-900 mb-3">{ar() ? "يحتاج إجراء" : "Needs action"}</h3>
        <div className="divide-y divide-surface-100">
          <ActionRow
            text={ar() ? `${lateCount} قسط متأخر بالإجمالي (${lateKwd} د.ك)` : `${lateCount} late installments in total (${lateKwd} KWD)`}
            tone={lateCount > 0 ? "red" : "ok"}
            onClick={onOpenInstallments}
          />
          <ActionRow
            text={ar() ? `${pendingCount} دفعة بانتظار المراجعة` : `${pendingCount} payments awaiting review`}
            tone={pendingCount > 0 ? "amber" : "ok"}
            onClick={onOpenPendingPayments}
          />
        </div>
      </div>

      <div className="card-elevated p-5">
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-surface-900">{ar() ? "الإيرادات خلال الفترة" : "Revenue over the period"}</h3>
          <span className="text-xs text-surface-500">{kwd(rev?.revenueKwd)}</span>
        </div>
        {loading && !rev ? (
          <div className="h-56 flex items-center justify-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-surface-400">{ar() ? "لا توجد إيرادات في هذه الفترة" : "No revenue in this period"}</div>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [`${Number(v ?? 0).toFixed(3)} KWD`, ar() ? "الإيرادات" : "Revenue"]} />
                <Bar dataKey="Revenue" fill={COLORS.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="card-elevated p-5">
          <h3 className="text-sm font-bold text-surface-900 mb-3">{ar() ? "أعلى 5 باقات" : "Top 5 packages"}</h3>
          {(rev?.topPackages ?? []).length === 0 ? (
            <div className="text-sm text-surface-400 py-4 text-center">—</div>
          ) : (
            <ul className="divide-y divide-surface-100 text-sm">
              {rev!.topPackages.map(p => (
                <li key={p.offerId || "other"} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium text-surface-800 truncate">{p.offerName}</div>
                    <div className="text-[11px] text-surface-400">{p.count} {ar() ? "دفعة" : p.count === 1 ? "payment" : "payments"}</div>
                  </div>
                  <div className="font-bold text-surface-900 whitespace-nowrap">{p.revenueKwd} KWD</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({ text, tone, onClick }: { text: string; tone: "red" | "amber" | "ok"; onClick: () => void }) {
  const dot = tone === "red" ? "bg-red-500" : tone === "amber" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center justify-between gap-3 py-2.5 text-left rtl:text-right hover:bg-surface-50 rounded-lg px-1">
      <span className="flex items-center gap-2 text-sm text-surface-800 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="truncate">{text}</span>
      </span>
      <span className="text-xs font-bold text-brand-pink-600 shrink-0">{ar() ? "عرض ←" : "View →"}</span>
    </button>
  );
}
