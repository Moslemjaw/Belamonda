import { useState } from "react";
import { fmtDate, fmtDateTime } from "../../../lib/dateFormat";
import { useAdminUserOffers } from "../../../hooks/useApi";
import { ar } from "./shared";
import { PaymentQueue } from "./PaymentQueue";

export function PaymentsManager() {
  const { data, loading } = useAdminUserOffers();
  const [filterUser, setFilterUser] = useState("");
  const [tab, setTab] = useState<"pending" | "overdue" | "upcoming" | "deposits">("pending");

  const items = data?.items || [];
  
  const overdueItems = items.filter((uo: any) => {
    if (uo.status !== "active" || uo.purchaseMode !== "installments") return false;
    if (!uo.nextInstallmentDueAt) return false;
    return new Date(uo.nextInstallmentDueAt).getTime() < Date.now();
  });

  const activeInstallments = items.filter((uo: any) => {
    if (uo.status !== "active" || uo.purchaseMode !== "installments") return false;
    if (!uo.nextInstallmentDueAt) return false;
    return new Date(uo.nextInstallmentDueAt).getTime() >= Date.now();
  });

  const depositItems = items.filter((uo: any) => uo.purchaseMode === "deposit" && (uo.status === "reserved" || uo.status === "pending_payment"));

  const filterFn = (uo: any) => {
    if (!filterUser) return true;
    const s = filterUser.toLowerCase();
    return (uo.userName?.toLowerCase() || "").includes(s) || (uo.offerName?.toLowerCase() || "").includes(s) || (uo.userPhone || "").includes(s);
  };

  if (loading) return <div className="card-elevated p-5"><div className="shimmer h-64 rounded-2xl" /></div>;

  const tabs = [
    { id: "pending", label: ar() ? "معلقة للاعتماد" : "Pending Verifications", count: undefined },
    { id: "overdue", label: ar() ? "متأخرة" : "Overdue", count: overdueItems.filter(filterFn).length },
    { id: "upcoming", label: ar() ? "قادمة" : "Upcoming", count: activeInstallments.filter(filterFn).length },
    { id: "deposits", label: ar() ? "عربونات" : "Deposits", count: depositItems.filter(filterFn).length },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{ar() ? "المدفوعات والمستحقات" : "Payments & Ledgers"}</h2>
          <p className="text-sm text-surface-500 mt-1">{ar() ? "تتبع المدفوعات المعلقة، المتأخرات، والعربونات." : "Track pending payments, overdue installments, and deposits."}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            placeholder={ar() ? "بحث باسم العميل أو الباقة..." : "Search customer or package..."}
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="input-field py-2.5 pl-10 w-full bg-white shadow-sm border-surface-200"
          />
        </div>
      </div>

      <div className="flex border-b border-surface-200 overflow-x-auto hide-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`whitespace-nowrap py-4 px-6 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${tab === t.id ? 'border-brand-pink-500 text-brand-pink-600' : 'border-transparent text-surface-500 hover:text-surface-900 hover:border-surface-300'}`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${tab === t.id ? 'bg-brand-pink-100 text-brand-pink-700' : 'bg-surface-100 text-surface-600'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "pending" && <PaymentQueue />}

        {tab === "overdue" && overdueItems.filter(filterFn).length > 0 && (
        <div className="card-elevated border border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50/50 p-5 border-b border-red-100 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="font-bold text-red-900">{ar() ? "دفعات متأخرة" : "Overdue Installments"}</h3>
                <div className="text-sm text-red-700">{overdueItems.filter(filterFn).length} {ar() ? "عميل متأخر عن السداد" : "customers behind on payments"}</div>
              </div>
            </div>
          </div>
          <div className="divide-y divide-surface-100">
            {overdueItems.filter(filterFn).map((uo: any) => {
              const overdueDays = Math.floor((Date.now() - new Date(uo.nextInstallmentDueAt).getTime()) / (1000 * 60 * 60 * 24));
              const firstUnpaid = (uo.installmentSchedule || []).find((s: any) => !s.paid);
              return (
                <div key={uo.id} className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between hover:bg-surface-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="avatar avatar-md bg-surface-200 text-surface-600 font-bold">{uo.userName?.charAt(0)?.toUpperCase() || "U"}</div>
                    <div>
                      <div className="font-bold text-surface-900">{uo.userName || uo.userId}</div>
                      <div className="text-sm text-surface-500 mt-0.5">{uo.userPhone || "—"} • {ar() && uo.offerNameAr ? uo.offerNameAr : (uo.offerName || uo.offerId)}</div>
                      <div className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded-lg inline-flex items-center gap-1 mt-2 border border-red-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {ar() ? `متأخر ${overdueDays} يوم` : `${overdueDays} days overdue`} ({fmtDate(uo.nextInstallmentDueAt)})
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1 pl-14 sm:pl-0">
                    <div className="text-sm text-surface-500">{ar() ? "المبلغ المستحق:" : "Amount Due:"}</div>
                    <div className="text-xl font-black text-surface-900">{Number(firstUnpaid?.amountKwd || 0).toFixed(3)} KWD</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "upcoming" && (
        <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex justify-between items-center">
          <h3 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            {ar() ? "الأقساط القادمة" : "Upcoming Installments"}
          </h3>
        </div>
        {activeInstallments.filter(filterFn).length === 0 ? (
           <div className="p-8 text-center text-sm text-surface-500">{ar() ? "لا توجد أقساط قادمة" : "No upcoming installments"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-surface-50 text-xs uppercase text-surface-500 font-bold">
                <tr>
                  <th className="px-6 py-3">{ar() ? "العميل" : "Customer"}</th>
                  <th className="px-6 py-3">{ar() ? "الباقة" : "Package"}</th>
                  <th className="px-6 py-3">{ar() ? "القسط القادم" : "Next Due Date"}</th>
                  <th className="px-6 py-3 text-right">{ar() ? "المبلغ المستحق" : "Amount Due"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {activeInstallments.filter(filterFn).map((uo: any) => {
                  const firstUnpaid = (uo.installmentSchedule || []).find((s: any) => !s.paid);
                  return (
                    <tr key={uo.id} className="hover:bg-surface-50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-surface-900">{uo.userName || uo.userId}</div>
                        <div className="text-xs text-surface-500">{uo.userPhone || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-surface-900">{ar() && uo.offerNameAr ? uo.offerNameAr : (uo.offerName || uo.offerId)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg border border-blue-100 text-xs">
                          {fmtDate(uo.nextInstallmentDueAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-surface-900">
                        {Number(firstUnpaid?.amountKwd || 0).toFixed(3)} KWD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {tab === "deposits" && depositItems.filter(filterFn).length > 0 && (
        <div className="card-elevated border border-surface-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-surface-100 flex justify-between items-center">
            <h3 className="font-bold text-surface-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              {ar() ? "العربونات المحجوزة" : "Reserved Deposits"}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-surface-50 text-xs uppercase text-surface-500 font-bold">
                <tr>
                  <th className="px-6 py-3">{ar() ? "العميل" : "Customer"}</th>
                  <th className="px-6 py-3">{ar() ? "الباقة" : "Package"}</th>
                  <th className="px-6 py-3">{ar() ? "انتهاء الحجز" : "Reservation Expiry"}</th>
                  <th className="px-6 py-3">{ar() ? "الحالة" : "Status"}</th>
                  <th className="px-6 py-3 text-right">{ar() ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-sm">
                {depositItems.filter(filterFn).map((uo: any) => {
                  const isExpired = uo.reservationExpiresAt && new Date(uo.reservationExpiresAt).getTime() < Date.now();
                  return (
                    <tr key={uo.id} className={`hover:bg-surface-50 ${isExpired ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="font-bold text-surface-900">{uo.userName || uo.userId}</div>
                        <div className="text-xs text-surface-500">{uo.userPhone || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-surface-900">{ar() && uo.offerNameAr ? uo.offerNameAr : (uo.offerName || uo.offerId)}</div>
                      </td>
                      <td className="px-6 py-4">
                        {uo.reservationExpiresAt ? (
                          <span className={`font-semibold px-2.5 py-1 rounded-lg border text-xs ${isExpired ? 'bg-red-50 text-red-700 border-red-100' : 'bg-surface-100 text-surface-700 border-surface-200'}`}>
                            {fmtDateTime(uo.reservationExpiresAt)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4">
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase ${uo.status === 'reserved' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                           {uo.status}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-surface-900">
                        {Number(uo.depositAmountKwd || 0).toFixed(3)} KWD
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
