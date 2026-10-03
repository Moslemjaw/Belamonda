// "activeTab === "wallet" && walletSubTab === "cashback"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { fmtDateTime } from "../../../lib/dateFormat";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function WalletCashbackTab({ s }: { s: CustomerDashboardState }) {
  const { offers, t, wallet, walletData } = s;
  return (
    <section id="sec-cashback" className="space-y-4 sm:space-y-6 animate-fade-in scroll-mt-24">
              <h2 className="text-lg sm:text-xl font-bold text-surface-900">{ar() ? "محفظة الكاش باك" : "Cashback Wallet"}</h2>
              {(() => {
                const walletTxns = walletData?.txns ?? [];
                const unlocked = parseFloat(wallet?.unlockedBalance || "0");
                const locked = parseFloat(wallet?.lockedBalance || "0");
                const used = walletTxns.filter(t => t.type === "deduction").reduce((s, t) => s + parseFloat(t.amountKwd || "0"), 0);
                const total = unlocked + locked;
                const txnLabels: Record<string, { en: string; ar: string; color: string; sign: string }> = {
                  signup_bonus:          { en: "Signup bonus",         ar: "مكافأة التسجيل",    color: "text-emerald-600", sign: "+" },
                  unlock:                { en: "Session unlock",        ar: "رصيد مكتسب",        color: "text-emerald-600", sign: "+" },
                  deduction:             { en: "Cashback used",         ar: "كاش باك مستخدم",    color: "text-red-500",     sign: "-" },
                  adjustment:            { en: "Manual adjustment",     ar: "تعديل يدوي",        color: "text-blue-600",    sign: "±" },
                  reversal:              { en: "Reversal",              ar: "استرداد",           color: "text-amber-600",   sign: "+" },
                  forfeited_due_to_ceiling: { en: "Forfeited (ceiling)", ar: "مصادر (حد أقصى)", color: "text-surface-400",  sign: "-" },
                };
                return (
                  <>
                    <div className="wallet-card shadow-glow-lg">
                      <div className="flex justify-between items-start gap-3 mb-5">
                        <div className="min-w-0">
                          <div className="text-white/70 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">{ar() ? "محفظة الكاش باك" : "Cashback Wallet"}</div>
                          <div className="text-3xl sm:text-4xl font-black mt-1 text-white tabular-nums tracking-tight">{unlocked.toFixed(3)} <span className="text-lg sm:text-xl opacity-70 font-bold">KWD</span></div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-white backdrop-blur-md shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          {total > 0 ? (ar() ? "نشطة" : "Active") : (ar() ? "غير نشط" : "Inactive")}
                        </div>
                      </div>

                      {/* Segmented Progress Bar */}
                      {(() => {
                        const pctUnlocked = total > 0 ? (unlocked / total) * 100 : 0;
                        const pctLocked = Math.max(0, 100 - pctUnlocked);
                        return (
                          <div className="mb-4">
                            <div className="h-3 w-full rounded-full overflow-hidden flex bg-black/15">
                              {pctUnlocked > 0 && <div className="h-full bg-white transition-all duration-500" style={{ width: `${pctUnlocked}%` }} />}
                              {pctLocked > 0 && <div className="h-full bg-white/30 transition-all duration-500" style={{ width: `${pctLocked}%` }} />}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Three stat columns */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <div className="bg-white/20 border border-white/30 rounded-xl py-2.5 px-2 text-center backdrop-blur-sm shadow-sm">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <span className="w-2 h-2 rounded-full bg-white" />
                            <span className="text-white/90 text-[10px] font-bold">{ar() ? "متاح للاستخدام" : "Available"}</span>
                          </div>
                          <div className="text-white font-black text-base sm:text-lg tabular-nums">{unlocked.toFixed(3)}</div>
                        </div>
                        <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مقفل" : "Locked"}</span>
                          </div>
                          <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{locked.toFixed(3)}</div>
                        </div>
                        <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مستخدم" : "Used"}</span>
                          </div>
                          <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{used.toFixed(3)}</div>
                        </div>
                      </div>

                      {/* Locked hint */}
                      {locked > 0 && (
                        <div className="mt-3 text-white/60 text-[10px] sm:text-[11px] text-center font-medium">
                          {ar() 
                            ? "💡 ادفع أقساطك لفتح الرصيد المقفل"
                            : "💡 Pay your installments to unlock locked balance"}
                        </div>
                      )}
                    </div>

                    {/* Transaction History */}
                    <div>
                      <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "سجل المعاملات" : "Transaction History"}</h3>
                      <div className="bg-white rounded-2xl border border-surface-200 divide-y divide-surface-100">
                        {walletTxns.length === 0 ? (
                          <div className="p-6 text-center text-surface-400 text-sm">{ar() ? "لا توجد معاملات بعد" : "No transactions yet"}</div>
                        ) : (() => {
                          // Compute running unlocked balance per txn (newest first, so reverse for running calc)
                          let runningBal = unlocked;
                          const txnsWithBal = walletTxns.map(txn => {
                            const amt = parseFloat(txn.amountKwd || "0");
                            const balAfter = runningBal;
                            if (txn.type === "deduction" || txn.type === "forfeited_due_to_ceiling") runningBal += amt;
                            else if (txn.type === "signup_bonus" || txn.type === "unlock" || txn.type === "reversal" || txn.type === "adjustment") runningBal -= amt;
                            return { txn, balAfter };
                          });
                          return txnsWithBal.map(({ txn, balAfter }) => {
                            const meta = txnLabels[txn.type] ?? { en: txn.type, ar: txn.type, color: "text-surface-700", sign: "+" };
                            const rawAmt = parseFloat(txn.amountKwd || "0");
                            // For signed txn types (adjustment), derive sign and color from the amount's actual polarity
                            const isSignedType = txn.type === "adjustment";
                            const displaySign = isSignedType ? (rawAmt >= 0 ? "+" : "-") : meta.sign;
                            const displayColor = isSignedType ? (rawAmt >= 0 ? "text-emerald-600" : "text-red-500") : meta.color;
                            const displayAmt = Math.abs(rawAmt).toFixed(3);
                            return (
                              <div key={txn.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${txn.type === "deduction" ? "bg-red-50" : txn.type === "signup_bonus" || txn.type === "unlock" ? "bg-emerald-50" : "bg-blue-50"}`}>
                                    {txn.type === "signup_bonus" ? "🎁" : txn.type === "deduction" ? "💳" : txn.type === "unlock" ? "✅" : txn.type === "reversal" ? "↩️" : "⚙️"}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-surface-900 text-sm">{ar() ? meta.ar : meta.en}</div>
                                    {txn.reason && <div className="text-xs text-surface-400 mt-0.5">{txn.reason}</div>}
                                    <div className="text-xs text-surface-400 mt-0.5">{fmtDateTime(txn.createdAt)}</div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className={`font-bold text-sm ${displayColor}`}>{displaySign}{displayAmt} KWD</div>
                                  <div className="text-[10px] text-surface-400 mt-0.5">{ar() ? "رصيد" : "Bal"}: {balAfter.toFixed(3)}</div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>

                    {/* Active Offer Cashback (local) */}
                    {offers.filter(o => o.status === 'active' && parseFloat(o.cashbackBalanceKwd || '0') > 0).length > 0 && (
                      <div>
                        <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "كاش باك العروض النشطة" : "Active Offer Cashback"}</h3>
                        <div className="bg-white rounded-2xl border border-surface-200 divide-y divide-surface-100">
                          {offers.filter(o => o.status === 'active' && parseFloat(o.cashbackBalanceKwd || '0') > 0).map(o => (
                            <div key={o.id} className="p-4 flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-surface-900 text-sm">{o.offerName || o.offerId || "Package"}</div>
                                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "كاش باك مكتسب" : "Earned cashback"}</div>
                              </div>
                              <div className="font-black text-brand-pink-500">{parseFloat(o.cashbackBalanceKwd || '0').toFixed(3)} KWD</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
  );
}
