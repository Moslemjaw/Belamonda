import { useState } from "react";
import { fmtDate } from "../../../lib/dateFormat";
import DatePicker from "../../../components/DatePicker";
import { useAuth } from "../../../app/AuthContext";
import { useApi } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";

export function CustomerMemberships({ onTransfer }: { onTransfer?: (id: string, clinicId: string) => void }) {
  const { getAuthHeader } = useAuth();
  const { data, loading, refetch } = useApi<{ items: any[] }>("/commerce/admin/user-offers");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending_payment" | "cancelled" | "expired">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [sessionDateModal, setSessionDateModal] = useState<{ id: string } | null>(null);
  const [sessionDateValue, setSessionDateValue] = useState(new Date().toISOString().split("T")[0]);

  const allOffers = (data?.items || []).filter((o: any) => !o.isStandalone);
  const filtered = allOffers
    .filter((o: any) => statusFilter === "all" || o.status === statusFilter)
    .filter((o: any) => !filterUser.trim() || o.userId?.toLowerCase().includes(filterUser.trim().toLowerCase()) || (o.offerName || "").toLowerCase().includes(filterUser.trim().toLowerCase()));

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiFetch(`/commerce/admin/user-offers/${id}`, { method: "DELETE", headers: getAuthHeader() });
      setConfirmId(null);
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to cancel membership");
    } finally {
      setCancellingId(null);
    }
  };

  const handleAdjustSessions = async (id: string, delta: number) => {
    if (delta > 0) {
      setSessionDateModal({ id });
      setSessionDateValue(new Date().toISOString().split("T")[0]);
      return;
    }

    setAdjustingId(id + "_dec");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${id}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, date: null }),
      });
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to adjust sessions");
    } finally {
      setAdjustingId(null);
    }
  };

  const submitSessionDate = async () => {
    if (!sessionDateModal) return;
    const id = sessionDateModal.id;
    setSessionDateModal(null);
    setAdjustingId(id + "_inc");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${id}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta: 1, date: sessionDateValue }),
      });
      refetch();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to adjust sessions");
    } finally {
      setAdjustingId(null);
    }
  };

  const statusCounts = {
    all: allOffers.length,
    active: allOffers.filter((o: any) => o.status === "active").length,
    pending_payment: allOffers.filter((o: any) => o.status === "pending_payment").length,
    cancelled: allOffers.filter((o: any) => o.status === "cancelled").length,
    expired: allOffers.filter((o: any) => o.status === "expired").length,
  };

  if (loading) return <div className="card-elevated p-5"><div className="shimmer h-32 rounded-xl" /></div>;

  const getMembershipTypeBadge = (type?: string) => {
    if (type === "cashback") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">💰 {ar() ? "كاش باك" : "Cashback"}</span>;
    if (type === "free_sessions") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">🎫 {ar() ? "جلسات مجانية" : "Free Sessions"}</span>;
    if (type === "group") return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">👥 {ar() ? "جماعي" : "Group"}</span>;
    return <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">—</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          {ar() ? "اشتراكات العملاء" : "Customer Memberships"}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 font-medium">{filtered.length} / {allOffers.length}</span>
          <button className="btn-ghost btn-sm" onClick={() => refetch()}>↻</button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={ar() ? "بحث بالمستخدم أو العرض..." : "Search by user or offer..."}
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="input-field text-xs py-2 pl-9 w-full"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "active", "pending_payment", "cancelled", "expired"] as const).map(s => {
            const labels: Record<string, string> = { all: ar() ? "الكل" : "All", active: ar() ? "نشط" : "Active", pending_payment: ar() ? "معلق" : "Pending", cancelled: ar() ? "ملغي" : "Cancelled", expired: ar() ? "منتهي" : "Expired" };
            const colors: Record<string, string> = { all: "bg-surface-100 text-surface-700", active: "bg-emerald-100 text-emerald-700", pending_payment: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700", expired: "bg-surface-200 text-surface-500" };
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${statusFilter === s ? colors[s] + " ring-2 ring-offset-1 ring-brand-pink-300 shadow-sm" : "bg-surface-50 text-surface-400 hover:bg-surface-100"}`}
              >
                {labels[s]} ({statusCounts[s]})
              </button>
            );
          })}
        </div>
      </div>

      {/* Memberships List */}
      {filtered.length === 0 ? (
        <div className="card-elevated text-center text-sm text-surface-400 py-12">✅ {ar() ? "لا توجد اشتراكات مطابقة" : "No matching memberships"}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o: any) => {
            const isAwaiting = o.status === 'pending_payment';
            const isExpired = o.status === 'expired';
            const isCancelled = o.status === 'cancelled';
            const isActive = o.status === 'active';
            const statusColor = isAwaiting ? 'bg-amber-100 text-amber-700' : isExpired ? 'bg-surface-100 text-surface-500' : isCancelled ? 'bg-red-100 text-red-700' : isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600';
            const statusText = isAwaiting ? (ar() ? "بانتظار الدفع" : "Awaiting Payment") : isExpired ? (ar() ? "منتهي" : "Expired") : isCancelled ? (ar() ? "ملغي" : "Cancelled") : isActive ? (ar() ? "نشط" : "Active") : o.status;
            const borderColor = isAwaiting ? 'border-l-amber-400' : isExpired ? 'border-l-surface-300' : isCancelled ? 'border-l-red-400' : isActive ? 'border-l-emerald-500' : 'border-l-surface-300';
            const isConfirming = confirmId === o.id;
            const isCancelling = cancellingId === o.id;
            const canCancel = !isCancelled && !isExpired;
            const isExpanded = expandedId === o.id;

            return (
              <div key={o.id} className={`bg-white rounded-xl border border-surface-200 border-l-4 shadow-sm transition-all hover:shadow-md ${borderColor} ${isCancelled ? 'opacity-60' : ''}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${statusColor}`}>{statusText}</span>
                        {getMembershipTypeBadge(o.membershipType)}
                        {o.purchaseMode && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-surface-50 text-surface-500 border border-surface-200">{o.purchaseMode}</span>}
                      </div>
                      <div className="text-sm font-bold text-surface-900">{o.offerName ? Array.from(new Set(o.offerName.split(" - "))).join(" - ") : (ar() ? "عرض" : "Offer")}</div>
                      <div className="text-xs text-surface-400 mt-0.5 font-mono">{o.userName || o.userId}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button className="text-xs font-medium text-surface-500 hover:text-surface-700 bg-surface-50 hover:bg-surface-100 px-2.5 py-1.5 rounded-lg transition-colors border border-surface-200" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                        {isExpanded ? "▲" : "▼"}
                      </button>
                      {!isActive && (
                        <button
                          className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
                          onClick={async () => {
                            if (!window.confirm(ar() ? "تأكيد إعادة تفعيل العضوية؟" : "Reactivate this membership?")) return;
                            try {
                              await apiFetch(`/commerce/admin/user-offers/${o.id}`, {
                                method: "PATCH",
                                headers: getAuthHeader(),
                                body: JSON.stringify({ status: "active" })
                              });
                              refetch();
                              alert(ar() ? "تم إعادة تفعيل العضوية بنجاح" : "Membership reactivated");
                            } catch (err: any) {
                              alert(err.message || "Failed to reactivate membership");
                            }
                          }}
                        >
                          {ar() ? "إعادة تفعيل" : "Reactivate"}
                        </button>
                      )}
                      {canCancel && !isConfirming && (
                        <>
                          <button 
                            className="text-[11px] font-bold text-brand-pink-600 bg-brand-pink-50 border border-brand-pink-200 hover:bg-brand-pink-100 px-2.5 py-1 rounded-lg transition-colors" 
                            onClick={() => onTransfer && onTransfer(o.id, o.clinicId || "")}
                          >
                            {ar() ? "تغيير العيادة" : "Change Clinic"}
                          </button>
                          <button className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors font-medium" onClick={() => setConfirmId(o.id)}>{ar() ? "إلغاء" : "Cancel"}</button>
                        </>
                      )}
                      {isConfirming && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-surface-600 whitespace-nowrap">{ar() ? "تأكيد؟" : "Sure?"}</span>
                          <button className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg disabled:opacity-50" disabled={isCancelling} onClick={() => void handleCancel(o.id)}>{isCancelling ? "…" : (ar() ? "نعم" : "Yes")}</button>
                          <button className="text-xs text-surface-600 border border-surface-200 bg-white px-2.5 py-1 rounded-lg" onClick={() => setConfirmId(null)}>{ar() ? "لا" : "No"}</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick Stats Row */}
                  <div className="flex flex-wrap gap-3 mt-3">
                    <div className="text-xs"><span className="text-surface-400">{ar() ? "الدفع:" : "Payment:"}</span> <span className="font-bold text-surface-700">{o.paymentAmountKwd || '0.000'} KWD</span></div>
                    {o.installmentSchedule?.length > 0 && (
                      <div className="text-xs">
                        <span className="text-surface-400">{ar() ? "المتبقي:" : "Unpaid:"}</span>{' '}
                        <span className="font-bold text-red-600">
                          {Math.max(0, (parseFloat(o.paymentAmountKwd || '0') - o.installmentSchedule.filter((i: any) => i.paid).reduce((sum: number, i: any) => sum + parseFloat(i.amountKwd || '0'), 0))).toFixed(3)} KWD
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-surface-400">{ar() ? "الجلسات:" : "Sessions:"}</span>
                      <span className="font-bold text-surface-700">{o.sessionsUsed || 0}{o.maxSessions ? ` / ${o.maxSessions}` : ' / ∞'}</span>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-red-100 hover:text-red-600 text-surface-500 transition-colors disabled:opacity-40"
                        disabled={adjustingId !== null || (o.sessionsUsed || 0) <= 0}
                        onClick={() => handleAdjustSessions(o.id, -1)}
                        title={ar() ? "تقليل الجلسات" : "Decrement sessions"}
                      >−</button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-emerald-100 hover:text-emerald-600 text-surface-500 transition-colors disabled:opacity-40"
                        disabled={adjustingId !== null || (o.maxSessions != null && (o.sessionsUsed || 0) >= o.maxSessions)}
                        onClick={() => handleAdjustSessions(o.id, +1)}
                        title={ar() ? "زيادة الجلسات" : "Increment sessions"}
                      >+</button>
                    </div>
                    {o.membershipType === 'cashback' && o.cashbackBalanceKwd && (
                      <div className="text-xs"><span className="text-surface-400">{ar() ? "رصيد الكاش باك:" : "CB Balance:"}</span> <span className="font-bold text-amber-600">{o.cashbackBalanceKwd} KWD</span></div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-surface-100 p-4 bg-surface-50/50 space-y-2 text-xs animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div><span className="text-surface-400 block">{ar() ? "المعرف" : "ID"}</span><span className="font-mono font-bold text-surface-700">{o.id}</span></div>
                      <div><span className="text-surface-400 block">{ar() ? "العرض" : "Offer ID"}</span><span className="font-mono text-surface-700">{o.offerId}</span></div>
                      <div><span className="text-surface-400 block">{ar() ? "العيادة" : "Clinic"}</span><span className="font-bold text-surface-700">{o.clinicId}</span></div>
                      {o.paymentMethod && <div><span className="text-surface-400 block">{ar() ? "طريقة الدفع" : "Pay Method"}</span><span className="font-bold text-surface-700">{o.paymentMethod}</span></div>}
                      {o.activatedAt && <div><span className="text-surface-400 block">{ar() ? "تم التفعيل" : "Activated"}</span><span className="font-bold text-surface-700">{fmtDate(o.activatedAt)}</span></div>}
                      {o.expiresAt && <div><span className="text-surface-400 block">{ar() ? "ينتهي" : "Expires"}</span><span className="font-bold text-surface-700">{fmtDate(o.expiresAt)}</span></div>}
                      {o.groupInviteCode && <div><span className="text-surface-400 block">{ar() ? "كود الدعوة" : "Invite Code"}</span><span className="font-mono font-bold text-purple-600">{o.groupInviteCode}</span></div>}
                      {o.sharedWith?.length > 0 && <div><span className="text-surface-400 block">{ar() ? "مشارك مع" : "Shared With"}</span><span className="font-bold text-purple-600">{o.sharedWith.length} {ar() ? "عضو" : "members"}</span></div>}
                      {o.cashbackAppliedKwd && o.cashbackAppliedKwd !== '0.000' && <div><span className="text-surface-400 block">{ar() ? "كاش باك مطبق" : "CB Applied"}</span><span className="font-bold text-emerald-600">{o.cashbackAppliedKwd} KWD</span></div>}
                    </div>
                    {o.installmentSchedule?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-surface-200">
                        <span className="font-bold text-surface-700 block mb-2">{ar() ? "جدول الأقساط" : "Installment Schedule"}</span>
                        <div className="flex gap-1">
                          {o.installmentSchedule.map((inst: any, i: number) => (
                            <div key={i} className={`flex-1 h-2 rounded-full ${inst.paid ? 'bg-emerald-500' : 'bg-surface-200'}`} title={`#${inst.number}: ${inst.amountKwd} KWD`} />
                          ))}
                        </div>
                        <div className="text-[10px] text-surface-400 mt-1">{o.installmentsPaid || 0} / {o.installmentCount || 0} {ar() ? "مدفوع" : "paid"}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sessionDateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative">
            <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "تاريخ الجلسة" : "Session Date"}</h3>
            <p className="text-sm text-surface-500 mb-4">{ar() ? "الرجاء إدخال تاريخ الجلسة" : "Please enter the session date"}</p>
            <DatePicker
              className="input-field w-full mb-4"
              value={sessionDateValue}
              onChange={(e) => setSessionDateValue(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                onClick={() => setSessionDateModal(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all"
                onClick={submitSessionDate}
                disabled={!sessionDateValue}
              >
                {ar() ? "تأكيد" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
