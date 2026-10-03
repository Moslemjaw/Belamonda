import { useAdminReservations, type ReservationItem } from "../../../hooks/useApi";
import { fmtDate } from "../../../lib/dateFormat";
import { ar } from "./shared";

// ── Reservations Panel ──
export function AdminReservationsPanel() {
  const { data, loading } = useAdminReservations();
  const items: ReservationItem[] = data?.items ?? [];

  const statusLabel = (r: ReservationItem) => {
    if (r.status === "reserved") return { en: "Reserved", ar: "محجوز", cls: "bg-blue-50 text-blue-700" };
    if (r.status === "active") return { en: "Converted", ar: "تحويل", cls: "bg-emerald-50 text-emerald-700" };
    if (r.status === "expired") return { en: "Expired", ar: "منتهي", cls: "bg-surface-100 text-surface-600" };
    if (r.status === "cancelled") return { en: "Cancelled", ar: "ملغي", cls: "bg-red-50 text-red-600" };
    return { en: r.status, ar: r.status, cls: "bg-surface-100 text-surface-600" };
  };

  const planLabel = (plan?: string) => {
    if (!plan) return "—";
    const map: Record<string, string> = { full: "Full", installments_2: "2×", installments_3: "3×", installments_4_enet: "4× ENET" };
    return map[plan] ?? plan;
  };

  const reserved = items.filter((r) => r.status === "reserved");
  const converted = items.filter((r) => r.status === "active");
  const expired = items.filter((r) => r.status === "expired" || r.status === "cancelled");
  const depositTotal = items.reduce((s, r) => s + parseFloat(r.depositAmountKwd ?? "0"), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "حجوزات العربون" : "Deposit Reservations"}</h2>
        <p className="text-sm text-surface-500 mt-1">
          {ar() ? "جميع عمليات الحجز عبر دفع العربون وحالة التحويل." : "All deposit-based reservations and their conversion status."}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-elevated p-4 bg-white border-l-4 border-l-blue-400">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "حجوزات نشطة" : "Active"}</div>
          <div className="text-3xl font-black text-blue-600 mt-1">{reserved.length}</div>
        </div>
        <div className="card-elevated p-4 bg-white border-l-4 border-l-emerald-400">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "تم التحويل" : "Converted"}</div>
          <div className="text-3xl font-black text-emerald-600 mt-1">{converted.length}</div>
        </div>
        <div className="card-elevated p-4 bg-white border-l-4 border-l-surface-300">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "منتهية/ملغية" : "Expired / Cancelled"}</div>
          <div className="text-3xl font-black text-surface-500 mt-1">{expired.length}</div>
        </div>
        <div className="card-elevated p-4 bg-white border-l-4 border-l-brand-pink-400">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "إجمالي العربون" : "Total Deposits"}</div>
          <div className="text-3xl font-black text-brand-pink-600 mt-1">{depositTotal.toFixed(3)} <span className="text-sm font-medium text-surface-400">KWD</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-surface-400">{ar() ? "جاري التحميل…" : "Loading…"}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-surface-400">{ar() ? "لا توجد حجوزات عربون بعد" : "No deposit reservations yet"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "العرض" : "Offer"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "المستخدم" : "User"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "العربون" : "Deposit"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "الخطة المفضّلة" : "Pref. Plan"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "انتهاء الحجز" : "Expiry"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "تاريخ الإنشاء" : "Created"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {items.map((r) => {
                  const sl = statusLabel(r);
                  return (
                    <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-surface-900">{r.offerName || r.offerId}</td>
                      <td className="px-4 py-3 text-surface-600 font-mono text-xs">{r.userId.slice(-8)}</td>
                      <td className="px-4 py-3 font-bold text-brand-pink-600">{r.depositAmountKwd ?? "—"} KWD</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${sl.cls}`}>{ar() ? sl.ar : sl.en}</span>
                      </td>
                      <td className="px-4 py-3 text-surface-600">{planLabel(r.reservationPreferredPlan)}</td>
                      <td className="px-4 py-3 text-surface-600 text-xs">
                        {r.reservationExpiresAt
                          ? fmtDate(r.reservationExpiresAt)
                          : r.status === "active" ? <span className="text-emerald-600 font-medium">{ar() ? "تم التحويل" : "Converted"}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">{fmtDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
