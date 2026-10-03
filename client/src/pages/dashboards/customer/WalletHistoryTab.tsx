// "activeTab === "wallet" && walletSubTab === "history"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { fmtDate, fmtDateTime } from "../../../lib/dateFormat";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function WalletHistoryTab({ s }: { s: CustomerDashboardState }) {
  const { localLedger, myServerPayments, t } = s;
  return (
    <section id="sec-history" className="space-y-6 animate-fade-in scroll-mt-24">
              <h2 className="text-xl font-bold text-surface-900">{ar() ? "سجل المدفوعات" : "Payment History"}</h2>

              {/* Server-side session payments */}
              {(myServerPayments?.items ?? []).filter((p) => p.purpose === "session_payment").length > 0 && (
                <div>
                  <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "مدفوعات الجلسات" : "Session Payments"}</h3>
                  <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden divide-y divide-surface-100">
                    {(myServerPayments?.items ?? [])
                      .filter((p) => p.purpose === "session_payment")
                      .map((p) => (
                        <div key={p.id} className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 text-emerald-500">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                              <div className="font-semibold text-surface-900 text-sm">{ar() ? "رسوم جلسة" : "Session fee"}</div>
                              <div className="text-xs text-surface-400 mt-0.5">
                                {fmtDate(p.createdAt)} · <span className={`font-medium ${p.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{p.status}</span>
                              </div>
                            </div>
                          </div>
                          <div className="font-bold text-surface-900">{p.amountKwd} KWD</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "مدفوعات العضوية" : "Membership Payments"}</h3>
              <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                {localLedger.length === 0 ? (
                  <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                ) : (
                  <div className="divide-y divide-surface-100">
                    {[...localLedger].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(txn => (
                      <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-surface-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div>
                            <div className="font-semibold text-surface-900 text-sm">{txn.description || txn.type.replace(/_/g, ' ').toUpperCase()}</div>
                            <div className="text-xs text-surface-400 mt-0.5">{fmtDateTime(txn.createdAt)}</div>
                          </div>
                        </div>
                        <div className="font-bold text-surface-900">{txn.amount} KWD</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </section>
  );
}
