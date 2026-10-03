// "activeTab === "overview"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { fmtDate } from "../../../lib/dateFormat";
import { Link } from "react-router-dom";
import { SITE_BASE_URL } from "../../../lib/api";
import { treatmentCategories, clinics } from "../../../lib/treatments";
import { getCategoryIcon } from "../../../components/CategoryIcons";
import { ar, computeOfferCashbackParts } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function OverviewTab({ s }: { s: CustomerDashboardState }) {
  const { attemptCheckout, cardData, categoryFilters, clinicsById, clinicsPublic, copiedCode, dynamicTreatments, homeCatalogData, myClinicChanges, offers, requireKyc, sessionClinicByTreatmentId, sessionFilter, setActiveTab, setCopiedCode, setNewClinicSelection, setPurchasesSubTab, setSessionClinicByTreatmentId, setSessionFilter, setShowBookingModal, setShowChangeClinicModal, setSysAlert, t, wallet, walletData } = s;
  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
              {/* Wallet Hero Card */}
              {(() => {
                const walletUnlocked = parseFloat(wallet?.unlockedBalance || "0");
                const walletLocked = parseFloat(wallet?.lockedBalance || "0");
                const walletTxns = walletData?.txns ?? [];
                const used = walletTxns.filter(t => t.type === "deduction").reduce((s, t) => s + parseFloat(t.amountKwd || "0"), 0);
                const total = walletUnlocked + walletLocked;
                const pctUnlocked = total > 0 ? (walletUnlocked / total) * 100 : 0;
                const pctUsed = total > 0 ? (used / total) * 100 : 0;
                const pctLocked = Math.max(0, 100 - pctUnlocked);
                
                return (
              <div className="wallet-card shadow-glow-lg" style={{ cursor: "pointer" }} onClick={() => setActiveTab("wallet")}>
                {/* Header */}
                <div className="flex justify-between items-start gap-3 mb-5">
                  <div className="min-w-0">
                    <div className="text-white/70 text-[11px] sm:text-xs font-semibold uppercase tracking-wider">{ar() ? "محفظة الكاش باك" : "Cashback Wallet"}</div>
                    <div className="text-3xl sm:text-4xl font-black mt-1 text-white tabular-nums tracking-tight">{walletUnlocked.toFixed(3)} <span className="text-lg sm:text-xl opacity-70 font-bold">KWD</span></div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold text-white backdrop-blur-md shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    {total > 0 ? (ar() ? "نشطة" : "Active") : (ar() ? "غير نشط" : "Inactive")}
                  </div>
                </div>

                {/* Segmented Progress Bar */}
                <div className="mb-4">
                  <div className="h-3 w-full rounded-full overflow-hidden flex bg-black/15">
                    {pctUnlocked > 0 && <div className="h-full bg-white transition-all duration-500" style={{ width: `${pctUnlocked}%` }} />}
                    {pctLocked > 0 && <div className="h-full bg-white/30 transition-all duration-500" style={{ width: `${pctLocked}%` }} />}
                  </div>
                </div>

                {/* Three stat columns */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-white/20 border border-white/30 rounded-xl py-2.5 px-2 text-center backdrop-blur-sm shadow-sm">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full bg-white" />
                      <span className="text-white/90 text-[10px] font-bold">{ar() ? "متاح للاستخدام" : "Available"}</span>
                    </div>
                    <div className="text-white font-black text-base sm:text-lg tabular-nums">{walletUnlocked.toFixed(3)}</div>
                  </div>
                  <div className="bg-white/10 border border-white/15 rounded-xl py-2.5 px-2 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <svg className="w-3 h-3 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      <span className="text-white/70 text-[10px] font-semibold">{ar() ? "مقفل" : "Locked"}</span>
                    </div>
                    <div className="text-white/80 font-black text-base sm:text-lg tabular-nums">{walletLocked.toFixed(3)}</div>
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
                {walletLocked > 0 && (
                  <div className="mt-3 text-white/60 text-[10px] sm:text-[11px] text-center font-medium">
                    {ar() 
                      ? "💡 ادفع أقساطك لفتح الرصيد المقفل"
                      : "💡 Pay your installments to unlock locked balance"}
                  </div>
                )}
              </div>
                );
              })()}

              {/* Active Memberships */}
              <div>
                <div className="editorial-header justify-between">
                  <div className="flex items-center gap-3">
                    <span className="accent" />
                    <div>
                      <h3>{ar() ? "عروضي النشطة" : "Active Memberships"}</h3>
                      <div className="meta">{ar() ? "باقاتك المفعّلة وحالة استخدامها" : "Your active packages and usage status"}</div>
                    </div>
                  </div>
                  <button onClick={() => setActiveTab("store")} className="text-xs sm:text-sm font-semibold text-brand-pink-500 hover:text-brand-pink-600 flex items-center gap-1 w-full justify-end sm:w-auto sm:ms-auto shrink-0">
                    {ar() ? "تصفح باقاتنا" : "Browse Memberships"} <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                {(() => {
                  const activeOffers = offers.filter(o => 
                    !(o.maxSessions && o.sessionsUsed >= o.maxSessions && !o.allowExtraPaidSessions) && 
                    !o.isStandalone &&
                    (o.status === "active" || o.status === "pending_payment" || o.status === "reserved" || o.status === "pending payment")
                  );
                  return activeOffers.length === 0 ? (
                    <div className="bg-white border border-surface-200 border-dashed rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 text-center text-surface-500 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-brand-gradient-soft text-brand-pink-600 flex items-center justify-center mb-3 sm:mb-4 shadow-sm">
                        <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                      </div>
                      <p className="mb-1 text-surface-900 font-bold text-sm sm:text-base">{ar() ? "لا توجد عضويات نشطة بعد" : "No active memberships yet"}</p>
                      <p className="mb-4 sm:mb-5 text-surface-500 text-xs sm:text-sm max-w-sm leading-relaxed">{ar() ? "استكشف باقاتنا المختارة بعناية وابدأ رحلتك مع بيلاموندو" : "Explore our curated packages and start your Belamonda journey"}</p>
                      <button onClick={() => setActiveTab("store")} className="btn-primary px-6 py-2.5 flex items-center gap-2">
                         {ar() ? "تصفح باقاتنا" : "Browse Memberships"}
                         <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                      {activeOffers.map(o => {
                        const isCashback = !!o.isCashbackOnly;
                        const hasCashbackFeature = o.isCashbackOnly || o.membershipType === "cashback" || parseFloat(o.cashbackPerSessionKwd || "0") > 0;
                        const isPending = o.status === 'pending payment' || o.status === 'pending_payment';
                        const isInstallment = o.method === "Installments";
                        const paidInst = o.paidInstallments || 0;
                        const sessionsUsed = o.sessionsUsed || 0;
                        let bookingLocked = isPending;
                        let lockedReason = ar() ? "بانتظار تأكيد الدفع" : "Awaiting Payment";
                        let rebookDateStr = "";

                        const isGroupPending = o.isGroupOffer && isPending;
                        const sharedWith = (o as any).sharedWith || [];
                        const membersNeeded = (o.groupSizeRequired || 2) - 1;
                        const isLockedGroup = isGroupPending && sharedWith.length < membersNeeded;

                        const hasActiveBooking = o.hasActiveBooking;
                        const lastCompleted = o.lastCompletedSessionAt ? new Date(o.lastCompletedSessionAt) : null;
                        const sessionIntervalDays = o.sessionIntervalDays || 0;
                        let coolingActive = false;

                        const isOverrideUnlocked = !!(o as any).bookingOverrideUnlocked;
                        const cooldownOverrideAt = (o as any).bookingCooldownEndOverrideAt ? new Date((o as any).bookingCooldownEndOverrideAt) : null;

                        if (isOverrideUnlocked) {
                          bookingLocked = false;
                          coolingActive = false;
                          lockedReason = "";
                        } else if (cooldownOverrideAt) {
                          if (new Date() < cooldownOverrideAt) {
                            coolingActive = true;
                            bookingLocked = true;
                            const formattedDate = fmtDate(cooldownOverrideAt);
                            rebookDateStr = formattedDate;
                            lockedReason = ar() ? `إعادة الحجز في ${formattedDate}` : `Rebook at ${formattedDate}`;
                          } else {
                            coolingActive = false;
                            bookingLocked = false;
                          }
                        } else if (sessionIntervalDays > 0 && lastCompleted) {
                          const nextEligible = new Date(lastCompleted.getTime() + sessionIntervalDays * 24 * 60 * 60 * 1000);
                          if (new Date() < nextEligible) {
                            coolingActive = true;
                            bookingLocked = true;
                            const formattedDate = fmtDate(nextEligible);
                            rebookDateStr = formattedDate;
                            lockedReason = ar() ? `إعادة الحجز في ${formattedDate}` : `Rebook at ${formattedDate}`;
                          }
                        }

                        if (!isPending && !coolingActive && !isOverrideUnlocked) {
                          if (hasActiveBooking) {
                            bookingLocked = true;
                            lockedReason = ar() ? "يوجد حجز قيد المعالجة" : "Active booking exists";
                          } else if (isInstallment) {
                            if (paidInst === 0) {
                              bookingLocked = true;
                              lockedReason = ar() ? "يجب دفع القسط الأول" : "First installment required";
                            } else if (paidInst < (o.totalInstallments || 1) && sessionsUsed >= paidInst) {
                              bookingLocked = true;
                              lockedReason = ar() ? "يجب دفع القسط التالي" : "Next installment required";
                            }
                          }
                        }

                        const cardCls = `membership-card p-4 sm:p-5 lg:p-6 ${isPending ? 'is-pending' : isCashback ? 'is-cashback' : ''}`;
                        const offerName = o.offerName || homeCatalogData?.items?.find((x: any) => x.id === o.offerId)?.name || o.offerId || "Special Package";
                        const usedPct = o.maxSessions ? Math.min((sessionsUsed / o.maxSessions) * 100, 100) : 0;
                        return (
                        <div key={o.id} className={cardCls}>
                          <span className="ribbon" />
                          <span className="blob" />
                          <div className="relative">
                            <div className="flex justify-between items-start gap-3 mb-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  {isLockedGroup ? (
                                    <span className="status-pill-pending !text-purple-700 !bg-purple-50 !border-purple-200"><span className="dot !bg-purple-500" />{ar() ? "مغلق" : "Locked"}</span>
                                  ) : isPending ? (
                                    <span className="status-pill-pending"><span className="dot" />{ar() ? "بانتظار الدفع" : "Pending Payment"}</span>
                                  ) : (
                                    <span className="status-pill-active"><span className="dot" />{ar() ? "نشط" : "Active"}</span>
                                  )}
                                  {hasCashbackFeature && (
                                    <span className="badge-sage text-[10px]">{ar() ? "كاش باك" : "Cashback"}</span>
                                  )}
                                  {o.method === "Installments" && (
                                    <span className="badge-blue text-[10px]">{o.paidInstallments}/{o.totalInstallments} {ar() ? "أقساط" : "installments"}</span>
                                  )}
                                </div>
                                <h4 className="font-bold text-surface-900 text-lg leading-tight tracking-tight">{offerName}</h4>
                                {o.activatedAt && (
                                  <div className="text-[11px] text-surface-500 mt-1">
                                    {ar() ? "تاريخ التفعيل" : "Activated"}: {fmtDate(o.activatedAt)}
                                  </div>
                                )}
                                {o.expiresAt && (
                                  <div className={`text-[11px] mt-0.5 font-medium ${new Date(o.expiresAt) < new Date() ? "text-red-500" : new Date(o.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 ? "text-amber-600" : "text-surface-500"}`}>
                                    {ar() ? "تاريخ الانتهاء" : "Expires"}: {fmtDate(o.expiresAt)}
                                  </div>
                                )}
                              </div>
                              {isCashback ? (
                                <div className="bg-surface-50 px-3.5 py-2.5 rounded-2xl text-center shrink-0 border border-surface-200/70 min-w-[88px]">
                                  <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">{ar() ? "متاح للاستخدام" : "Available"}</div>
                                  <div className="font-black text-surface-900 text-xl leading-none mt-1">
                                    {parseFloat(cardData?.card?.cashbackUnlockedKwd || "0").toFixed(1)}
                                    <span className="text-surface-400 text-sm font-bold ml-1">KWD</span>
                                  </div>
                                </div>
                              ) : !isPending ? (
                                <div className="bg-surface-50 px-3.5 py-2.5 rounded-2xl text-center shrink-0 border border-surface-200/70 min-w-[88px]">
                                  <div className="text-[9px] text-surface-500 uppercase font-bold tracking-wider">{ar() ? "جلسات" : "Sessions"}</div>
                                  <div className="font-black text-surface-900 text-xl leading-none mt-1">
                                    {o.sessionsUsed || 0}
                                    {o.maxSessions ? <span className="text-surface-400 text-base font-bold">/{o.maxSessions}</span> : <span className="text-surface-400 text-base font-bold text-2xl relative top-[2px]">/∞</span>}
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Sessions progress bar (Cashback is handled in the pink card below) */}
                            {!isCashback && o.maxSessions && !isPending && (
                              <div className="mb-4">
                                <div className="flex justify-between text-[11px] font-semibold text-surface-500 mb-1.5">
                                  <span>{ar() ? "الاستخدام" : "Usage"}</span>
                                  <span className="text-brand-pink-600">{usedPct.toFixed(0)}%</span>
                                </div>
                                <div className="progress-bar">
                                  <div className="progress-bar-fill" style={{ width: `${usedPct}%` }} />
                                </div>
                              </div>
                            )}

                            {/* Clinic section: Select or Change */}
                            {!o.clinicId && !isPending ? (
                              <div className="mb-4 space-y-2">
                                <div className="rounded-xl bg-gradient-to-br from-surface-50 to-white border border-surface-200 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-brand-pink-50 text-brand-pink-600 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{ar() ? "العيادة" : "Clinic"}</div>
                                        <div className="text-xs font-bold text-red-500 mt-0.5">{ar() ? "لم يتم تحديد عيادة" : "No clinic selected"}</div>
                                      </div>
                                    </div>
                                    <button onClick={() => { setShowChangeClinicModal({ ...o, currentFee: 0 }); setNewClinicSelection(""); }} className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors">
                                      {ar() ? "تحديد العيادة" : "Select Clinic"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : o.clinicId && !isPending && (() => {
                               const clinic = (clinicsPublic?.items || []).find(c => c.id === o.clinicId);
                               const clinicName = ar() ? (o.clinicNameAr || o.clinicNameEn || (clinic as any)?.nameAr || clinic?.nameEn || o.clinicId) : (o.clinicNameEn || o.clinicNameAr || clinic?.nameEn || (clinic as any)?.nameAr || o.clinicId);
                               const sessionPrice = (o.branchSessionPrices || []).find((b: any) => b.clinicId === o.clinicId)?.sessionPriceKwd;
                               const approvedChanges = myClinicChanges.filter(r => r.userOfferId === o.id && r.status === "approved").length;
                               const pendingRequest = myClinicChanges.find(r => r.userOfferId === o.id && r.status === "pending");
                               const nextFee = o.clinicLocked ? (approvedChanges === 0 ? 10 : approvedChanges === 1 ? 20 : 30) : parseFloat(o.clinicTransferFeeKwd || "0");
                               return (
                                 <div className="mb-4 space-y-2">
                                   <div className="rounded-xl bg-gradient-to-br from-surface-50 to-white border border-surface-200 p-3">
                                     <div className="flex items-start justify-between gap-3">
                                       <div className="flex items-start gap-2.5 min-w-0">
                                         <div className="w-8 h-8 rounded-lg bg-brand-pink-50 text-brand-pink-600 flex items-center justify-center shrink-0">
                                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                         </div>
                                         <div className="min-w-0">
                                           <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400">{ar() ? "العيادة المحددة" : "Assigned Clinic"}</div>
                                           <div className="text-sm font-bold text-surface-900 truncate">{clinicName}</div>
                                           {sessionPrice && <div className="text-[11px] text-surface-500 mt-0.5">{sessionPrice} {ar() ? "د.ك / جلسة" : "KWD / session"}</div>}
                                         </div>
                                       </div>
                                       {!pendingRequest ? (
                                         <button onClick={() => { setShowChangeClinicModal({ ...o, currentFee: nextFee }); setNewClinicSelection(o.clinicId || ""); }} className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 px-2.5 py-1.5 rounded-lg whitespace-nowrap shrink-0 transition-colors">
                                           {ar() ? `تغيير · ${nextFee} د.ك` : `Change · ${nextFee} KD`}
                                         </button>
                                       ) : (
                                         <span className="status-pill-pending text-[10px] shrink-0"><span className="dot" />{ar() ? "قيد المراجعة" : "Pending"}</span>
                                       )}
                                     </div>
                                   </div>
                                   {pendingRequest && (
                                     <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                                       <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                       <span>
                                         {ar()
                                           ? `طلب تغيير العيادة إلى "${pendingRequest.toClinicNameAr || pendingRequest.toClinicNameEn}" قيد مراجعة فريق خدمة العملاء.`
                                           : `Clinic change request to "${pendingRequest.toClinicNameEn || pendingRequest.toClinicNameAr}" is under CS review.`}
                                       </span>
                                     </div>
                                   )}
                                 </div>
                               );
                            })()}

                            {/* Installment / Deposit Button */}
                            {(() => {
                              const isDeposit = o.purchaseMode === 'deposit' || o.method === 'Deposit';
                              const verbEn = isDeposit ? 'Pay remaining balance' : 'Pay installment';
                              const verbAr = isDeposit ? 'ادفع المبلغ المتبقي' : 'ادفع القسط';
                              const hasRemainingPayments = o.purchaseMode === 'deposit' || 
                                (o.purchaseMode === 'installments' && (o.installmentsPaid || 0) < (o.installmentCount || 1));

                              if (!hasRemainingPayments) return null;

                              return (
                                <div className="pt-2 flex flex-col gap-2 mb-3">
                                  <button
                                    className="w-full mt-1 bg-brand-pink-600 hover:bg-brand-pink-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      setActiveTab("my-purchases"); 
                                      setPurchasesSubTab("packages"); 
                                      setTimeout(() => {
                                        const el = document.getElementById("sec-packages");
                                        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                      }, 100);
                                    }}
                                  >
                                    🔓 {(() => {
                                      const parts = computeOfferCashbackParts(o);
                                      if (isCashback && parts.locked > 0) {
                                        return ar() ? `${verbAr} لفتح ${parts.locked.toFixed(3)} د.ك` : `${verbEn} to unlock ${parts.locked.toFixed(3)} KWD`;
                                      }
                                      return ar() ? `${verbAr} لفتح الجلسة القادمة` : `${verbEn} to unlock next session`;
                                    })()}
                                  </button>
                                </div>
                              );
                            })()}

                            {/* Cashback features block */}
                            {(() => {
                              const parts = computeOfferCashbackParts(o);
                              
                              if (parseFloat(o.cashbackPerSessionKwd || "0") === 0) return null;

                              return (
                              <div className="pt-2 flex flex-col gap-2 mb-3">
                                {parseFloat(o.cashbackPerSessionKwd || "0") > 0 && (
                                  <div className="mt-1 text-emerald-600 bg-emerald-50 text-[11px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    {ar() ? `+${o.cashbackPerSessionKwd} د.ك إضافية مع كل زيارة` : `+${o.cashbackPerSessionKwd} KWD extra per visit`}
                                  </div>
                                )}
                              </div>
                              );
                            })()}

                            {/* Booking Button */}
                            {((o as any).allowAppointmentBooking ?? true) && (() => {
                              const isUnlockMembershipPending = (o as any).isGroupOffer && (o.status === 'pending_payment' || o.status === 'pending payment');
                              if (isUnlockMembershipPending) return null;
                              return (
                                <button
                                  className={`w-full font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 ${coolingActive ? 'bg-blue-50 text-blue-700 border border-blue-200 cursor-not-allowed' : bookingLocked ? 'bg-red-50 text-red-600 border border-red-200 cursor-not-allowed' : 'bg-surface-900 text-white hover:bg-surface-800 shadow-md hover:shadow-lg hover:-translate-y-0.5'}`}
                                  onClick={() => {
                                    const isExtra = o.maxSessions && o.sessionsUsed >= o.maxSessions && o.allowExtraPaidSessions;
                                    setShowBookingModal({ 
                                      ...o, 
                                      userOfferId: o.id,
                                      priceKwd: isExtra ? (o.extraSessionPriceKwd || "0") : (o.priceKwd || "0"),
                                      isExtraSession: isExtra
                                    });
                                  }}
                                  disabled={bookingLocked}
                                >
                                  {coolingActive ? (
                                    <>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      {ar() ? `إعادة الحجز في ${rebookDateStr}` : `Rebook at ${rebookDateStr}`}
                                    </>
                                  ) : bookingLocked ? (
                                    <>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                      {lockedReason}
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                      {o.maxSessions && o.sessionsUsed >= o.maxSessions && o.allowExtraPaidSessions && o.extraSessionPriceKwd
                                        ? (ar() ? `حجز جلسة إضافية (${o.extraSessionPriceKwd} د.ك)` : `Book Extra Session (${o.extraSessionPriceKwd} KD)`)
                                        : (ar() ? "حجز موعد" : "Book Appointment")}
                                    </>
                                  )}
                                </button>
                              );
                            })()}
                            {(o as any).groupInviteCode && (() => {
                              const link = `${SITE_BASE_URL}/dashboard?inviteCode=${(o as any).groupInviteCode}`;
                              const isCopied = copiedCode === (o as any).groupInviteCode;
                              return (
                                <div className="mt-3 rounded-2xl border border-brand-pink-200 bg-brand-pink-50/50 p-3">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <svg className="w-3.5 h-3.5 text-brand-pink-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <span className="text-[11px] font-bold text-brand-pink-700 uppercase tracking-wide">{ar() ? "رابط الدعوة الجماعي" : "Group Invite Link"}</span>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <input readOnly value={link} className="flex-1 text-[11px] font-mono bg-white border border-surface-200 rounded-lg px-2.5 py-1.5 text-surface-700 min-w-0 select-all" dir="ltr" onFocus={e => e.target.select()} />
                                    <button
                                      onClick={() => { navigator.clipboard.writeText(link).catch(() => {}); setCopiedCode((o as any).groupInviteCode); setTimeout(() => setCopiedCode(null), 2000); }}
                                      className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors ${isCopied ? 'bg-emerald-500 text-white' : 'bg-brand-pink-500 hover:bg-brand-pink-600 text-white'}`}
                                    >
                                      {isCopied ? (ar() ? "تم!" : "Copied!") : (ar() ? "نسخ" : "Copy")}
                                    </button>
                                  </div>
                                  {(() => {
                                    const sharedWith = (o as any).sharedWith || [];
                                    const membersJoined = sharedWith.length;
                                    const offerData = (homeCatalogData?.items || []).find((x: any) => x.id === o.offerId);
                                    const groupSizeRequired = offerData?.groupSizeRequired || (o as any).groupSizeRequired || 2;
                                    const membersNeeded = groupSizeRequired - 1;
                                    const isComplete = membersJoined >= membersNeeded;
                                    const rewardType = offerData?.groupRewardType || '';
                                    return (
                                      <>
                                        {/* Progress bar */}
                                        <div className="mt-2">
                                          <div className="flex justify-between text-[10px] font-bold text-surface-500 mb-1">
                                            <span>{ar() ? "تقدم المجموعة" : "Group Progress"}</span>
                                            <span className={isComplete ? "text-emerald-600" : "text-brand-pink-600"}>{membersJoined}/{membersNeeded}</span>
                                          </div>
                                          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-brand-pink-500'}`}
                                              style={{ width: `${Math.min(100, membersNeeded > 0 ? (membersJoined / membersNeeded) * 100 : 0)}%` }} />
                                          </div>
                                        </div>
                                        {/* Reward description */}
                                        <div className={`mt-1.5 text-[11px] font-medium ${isComplete ? 'text-emerald-600' : 'text-brand-pink-600'}`}>
                                          {isComplete ? (
                                            ar() ? "🎉 اكتملت المجموعة! مكافأتك مفعّلة" : "🎉 Group complete! Your reward is active"
                                          ) : rewardType === 'unlock_membership' ? (
                                            ar() ? `🔓 ادعُ ${membersNeeded - membersJoined} أصدقاء لفتح العضوية` : `🔓 Invite ${membersNeeded - membersJoined} more to unlock membership`
                                          ) : rewardType === 'free_session' ? (
                                            ar() ? `🎁 ادعُ ${membersNeeded - membersJoined} أصدقاء للحصول على جلسة مجانية` : `🎁 Invite ${membersNeeded - membersJoined} more to earn a free session`
                                          ) : rewardType === 'discount' ? (
                                            ar() ? `💰 ادعُ ${membersNeeded - membersJoined} أصدقاء للحصول على خصم ${offerData?.groupRewardValue || ''}` : `💰 Invite ${membersNeeded - membersJoined} more for a ${offerData?.groupRewardValue || ''} discount`
                                          ) : rewardType === 'cashback_bonus' ? (
                                            ar() ? `💎 ادعُ ${membersNeeded - membersJoined} أصدقاء للحصول على ${offerData?.groupRewardValue || ''} KWD كاش باك` : `💎 Invite ${membersNeeded - membersJoined} more to earn ${offerData?.groupRewardValue || ''} KWD cashback`
                                          ) : rewardType === 'split_bill' ? (
                                            ar() ? `🧾 ادعُ ${membersNeeded - membersJoined} أصدقاء لتقسيم الفاتورة` : `🧾 Invite ${membersNeeded - membersJoined} more to split the bill`
                                          ) : (
                                            ar() ? `ادعُ ${membersNeeded - membersJoined} أصدقاء لتفعيل المكافأة الجماعية` : `Invite ${membersNeeded - membersJoined} more to unlock your group reward`
                                          )}
                                        </div>
                                      </>
                                    );
                                  })()}
                                  {/* Unlock Membership Purchase Button */}
                                  {(() => {
                                    const sharedWith = (o as any).sharedWith || [];
                                    const groupSizeRequired = (o as any).groupSizeRequired || 2;
                                    const isComplete = sharedWith.length >= (groupSizeRequired - 1);
                                    const rewardType = (o as any).groupRewardType || '';
                                    if (isComplete && (o.status === 'pending_payment' || o.status === 'pending payment')) {
                                      return (
                                        <button
                                          className="w-full mt-3 bg-brand-pink-600 hover:bg-brand-pink-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md hover:shadow-lg"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const catalogOffer = (homeCatalogData?.items || []).find((x: any) => x.id === o.offerId);
                                            // Merge: catalog offer (full data) + myOffer item (has pricing from /me/offers enrichment)
                                            // IMPORTANT: id must be the OFFER id (for checkout API), userOfferId is the UserOffer id
                                            const base = { ...(catalogOffer || {}), ...o, id: o.offerId, userOfferId: o.id, groupInviteCode: (o as any).groupInviteCode };
                                            // Split the price by group size
                                            const groupSize = (base as any).groupSizeRequired || 2;
                                            const fullPrice = parseFloat((base as any).subscriptionPriceKwd || (base as any).price || "0");
                                            const splitPrice = (fullPrice / groupSize).toFixed(3);
                                            (base as any).subscriptionPriceKwd = splitPrice;
                                            (base as any).price = splitPrice;
                                            // Also split deposit if applicable
                                            if ((base as any).depositAmountKwd) {
                                              (base as any).depositAmountKwd = (parseFloat((base as any).depositAmountKwd) / groupSize).toFixed(3);
                                            }
                                            attemptCheckout(base);
                                          }}
                                        >
                                          {ar() ? "اشترِ العضوية الآن" : "Purchase Membership Now"}
                                        </button>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>



              {/* ── Book a Session ── */}
              <div className="mt-10">
                 <div className="flex flex-col min-[380px]:flex-row items-start gap-3 sm:gap-4 mb-6">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-brand-pink-50 flex items-center justify-center text-brand-pink-500 shrink-0">
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-surface-900">{ar() ? "حجز جلسة / خدمة جديدة" : "Book a Session"}</h3>
                       <p className="text-sm text-surface-500 mt-1">{ar() ? "تصفح جميع الخدمات المتاحة واحجز موعدك بسهولة" : "Browse all available services and book your appointment easily"}</p>
                    </div>
                 </div>

                 {/* Session Categories Filter — horizontal scroll on small screens, wrap from md */}
                 <div className="relative -mx-1 px-1 sm:mx-0 sm:px-0 mb-4">
                    <div
                      className="flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0 touch-pan-x overscroll-x-contain"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                    <button
                      type="button"
                      onClick={() => setSessionFilter("all")}
                      className={`snap-start shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm whitespace-nowrap sm:whitespace-normal font-medium transition-all ${sessionFilter === "all" ? "bg-surface-900 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                    >
                      {ar() ? "الكل" : "All"}
                    </button>
                    {categoryFilters.filter(c => c.slug !== "all").map(cat => {
                      const icon = getCategoryIcon(cat.slug);
                      return (
                        <button
                          type="button"
                          key={cat.slug}
                          onClick={() => setSessionFilter(cat.slug)}
                          className={`snap-start shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm whitespace-nowrap sm:whitespace-normal font-medium transition-all ${sessionFilter === cat.slug ? "bg-brand-pink-500 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
                        >
                          <span className="shrink-0">{icon}</span>
                          <span className="max-w-[10rem] sm:max-w-none truncate sm:overflow-visible sm:text-balance">{ar() ? cat.nameAr : cat.nameEn}</span>
                        </button>
                      );
                    })}
                    </div>
                 </div>

                 {/* Sessions Grid — 1 col phone, 2 tablet/desktop, 3 wide */}
                 <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                    {dynamicTreatments.filter((t: any) => sessionFilter === "all" || t.category === sessionFilter).map((t: any) => {
                       const activeOffers = offers.filter(o => o.status === 'active');
                       // Any active membership that covers this session category counts.
                       // Use offerCategory (joined from offer doc) when available; fall back to o.category.
                       const applicableCashbackOffer = activeOffers.find(o => {
                          const cat = (o as any).offerCategory || o.category || "";
                          if (cat === "all") return true;
                          if (cat) return cat.split(',').map((s: string) => s.trim()).includes(t.category);
                          return false;
                       });
                       const hasMembership = !!applicableCashbackOffer;
                       const availableClinics = t.clinicIds.map((id: string) => clinicsById.get(id) || (clinicsPublic?.items || []).find(c => c.id === id) || { id, nameEn: id, nameAr: id });
                       const offeringsBy = (t.offeringsByClinic || {}) as Record<string, { priceKwd: number; cashbackKwd: number }>;
                       const defaultClinicId = availableClinics[0]?.id ?? "";
                       const storedClinic = sessionClinicByTreatmentId[t.id];
                       const selectedClinicForCard =
                         storedClinic && availableClinics.some((cl: any) => cl.id === storedClinic)
                           ? storedClinic
                           : defaultClinicId;
                       const clinicOffering = selectedClinicForCard ? offeringsBy[selectedClinicForCard] : undefined;
                       const basePrice = clinicOffering?.priceKwd ?? t.priceKwd;
                       const baseCashbackKwd = clinicOffering?.cashbackKwd ?? t.cashbackKwd;
                       const actualDiscountPct = hasMembership ? t.discountPct : 0;
                       // Per-session cashback: prefer the session-specific override, then the offer's general rate.
                       const offerCashbackPerSession = parseFloat((applicableCashbackOffer as any)?.cashbackPerSessionKwd || "0");
                       const maxAllowedCashbackKwd = hasMembership ? (baseCashbackKwd || offerCashbackPerSession) : 0;
                       const walletUnlocked = wallet ? parseFloat(wallet.unlockedBalance || "0") : 0;
                       const actualCashbackKwd = hasMembership ? Math.min(maxAllowedCashbackKwd, walletUnlocked) : 0;

                       const discountAmt = actualDiscountPct > 0 ? +(basePrice * actualDiscountPct / 100).toFixed(3) : 0;
                       const priceAfterDiscount = +(basePrice - discountAmt).toFixed(3);
                       // Effective price shown to member = pay priceAfterDiscount, earn cashback back
                       const effectivePrice = hasMembership && actualCashbackKwd > 0
                         ? +(priceAfterDiscount - actualCashbackKwd).toFixed(3)
                         : priceAfterDiscount;
                       const finalPrice = priceAfterDiscount;
                       
                       const savingsKwd = hasMembership && actualCashbackKwd > 0 ? actualCashbackKwd : 0;
                       const savingsPct = basePrice > 0 && savingsKwd > 0 ? Math.round((savingsKwd / basePrice) * 100) : 0;
                       return (
                       <div key={t.id} className={`relative rounded-3xl overflow-hidden flex flex-col transition-all duration-300 group border ${hasMembership ? 'bg-white border-brand-pink-200 shadow-md hover:shadow-xl hover:border-brand-pink-400 hover:-translate-y-1' : 'bg-white border-surface-200 shadow-sm hover:shadow-lg hover:border-surface-300 hover:-translate-y-0.5'}`}>

                          {/* Member benefit ribbon */}
                          {hasMembership && (
                            <div className="bg-brand-gradient px-4 py-2 flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-white/90" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/></svg>
                              <span className="text-[11px] font-black text-white uppercase tracking-wider">{ar() ? "سعر الأعضاء الحصري" : "Members-only price"}</span>
                              {savingsPct > 0 && (
                                <span className="ms-auto bg-white/25 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{ar() ? `وفّري ${savingsPct}%` : `Save ${savingsPct}%`}</span>
                              )}
                            </div>
                          )}

                          <div className="p-4 sm:p-6 flex flex-col flex-1 min-w-0">
                            {/* Corner accent blob */}
                            <div className={`absolute top-0 end-0 w-28 h-28 ${hasMembership ? 'bg-brand-pink-100/50' : 'bg-surface-50'} rounded-bl-[80px] pointer-events-none group-hover:scale-110 transition-transform duration-500 origin-top-right -z-0`} />

                            <div className="relative z-10 flex flex-col flex-1">
                              {/* Category badge */}
                              <div className="flex items-center gap-2.5 mb-3">
                                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-lg ${hasMembership ? 'bg-brand-pink-100' : 'bg-surface-100'}`}>
                                  {getCategoryIcon(t.category)}
                                </div>
                                <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">
                                  {ar() ? treatmentCategories.find(c => c.id === t.category)?.nameAr : treatmentCategories.find(c => c.id === t.category)?.nameEn}
                                </span>
                              </div>

                              {/* Title */}
                              <h3 className="text-base sm:text-lg font-black text-surface-900 leading-snug mb-3 sm:mb-4 tracking-tight break-words">
                                {ar() ? t.nameAr : t.nameEn}
                              </h3>

                              {/* Clinic selector */}
                              <div className="mb-5">
                                {availableClinics.length > 0 ? (
                                  <div className="relative">
                                    <select
                                      className={`w-full border rounded-2xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer pe-10 ${hasMembership ? 'bg-brand-pink-50/50 border-brand-pink-200 text-surface-700 focus:ring-brand-pink-400' : 'bg-surface-50 border-surface-200 text-surface-700 focus:ring-surface-900'}`}
                                      value={selectedClinicForCard}
                                      onChange={(e) =>
                                        setSessionClinicByTreatmentId((prev) => ({ ...prev, [t.id]: e.target.value }))
                                      }
                                    >
                                      {availableClinics.map((cl: any) => (
                                        <option key={cl.id} value={cl.id}>
                                          {ar() ? cl.nameAr : cl.nameEn}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="absolute end-4 top-1/2 -translate-y-1/2 pointer-events-none text-surface-400">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full bg-surface-50 border border-dashed border-surface-300 rounded-2xl px-3 py-3 text-sm text-center text-surface-400 italic">
                                    {ar() ? "لا توجد عيادات حالياً" : "No clinics available"}
                                  </div>
                                )}
                              </div>

                              {/* Cashback pricing breakdown */}
                              <div className="mt-auto">
                                {hasMembership && actualCashbackKwd > 0 ? (
                                  <div className="rounded-2xl mb-4 border border-surface-200 bg-white px-4 py-3 space-y-2">
                                    {/* Header */}
                                    <div className="flex items-center gap-2 pb-2 border-b border-surface-100">
                                      <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/></svg>
                                      <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">{ar() ? "ملخص التوفير" : "Savings breakdown"}</span>
                                    </div>
                                    {/* Rows */}
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-surface-500 font-medium">{ar() ? "السعر الأصلي" : "Original price"}</span>
                                      <span className="text-sm font-medium text-surface-400 line-through">{basePrice.toFixed(3)} KWD</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-xs text-surface-600 font-medium">{ar() ? "خصم كاش باك العضوية" : "Membership cashback"}</span>
                                      </div>
                                      <span className="text-sm font-black text-emerald-600">−{actualCashbackKwd.toFixed(3)} KWD</span>
                                    </div>
                                    <div className="border-t border-surface-100 pt-2 flex justify-between items-center">
                                      <span className="text-xs font-bold text-surface-700 uppercase tracking-wide">{ar() ? "المبلغ المستحق" : "Amount due"}</span>
                                      <div className="flex items-baseline gap-1">
                                        <span className="text-xl font-black text-surface-900 leading-none">{effectivePrice >= 0 ? effectivePrice.toFixed(3) : "0.000"}</span>
                                        <span className="text-xs font-bold text-surface-500">KWD</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : !hasMembership ? (
                                  <div className="mb-4 flex items-center gap-2 text-surface-400">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
                                    <span className="text-xs font-medium">{ar() ? "السعر القياسي" : "Standard price"}</span>
                                  </div>
                                ) : null}

                                {/* Price + CTA row — always stack vertically for grid layout safety */}
                                <div className="flex flex-col gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-baseline gap-1.5 flex-wrap">
                                      <span className={`text-2xl sm:text-3xl font-black leading-none tracking-tight ${hasMembership && actualCashbackKwd > 0 ? 'text-brand-pink-600' : 'text-surface-900'}`}>
                                        {(hasMembership && actualCashbackKwd > 0 ? Math.max(0, effectivePrice) : finalPrice).toFixed(3)}
                                      </span>
                                      <span className="text-[11px] font-black text-surface-400 uppercase">KWD</span>
                                    </div>
                                    {hasMembership && actualCashbackKwd > 0 && (
                                      <div className="text-[10px] text-surface-400 mt-0.5">{ar() ? `بدلاً من ${basePrice.toFixed(3)}` : `vs ${basePrice.toFixed(3)} standard`}</div>
                                    )}
                                  </div>

                                  <button
                                    className={`w-full px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-black transition-all duration-200 flex items-center justify-center gap-2 ${availableClinics.length > 0 ? hasMembership ? 'bg-brand-gradient text-white shadow-glow hover:opacity-90 hover:-translate-y-0.5' : 'bg-surface-900 text-white shadow-md hover:bg-surface-800 hover:shadow-lg hover:-translate-y-0.5' : 'bg-surface-100 text-surface-400 cursor-not-allowed'}`}
                                    disabled={availableClinics.length === 0}
                                    onClick={() => {
                                      if (!requireKyc()) return;
                                      if (applicableCashbackOffer) {
                                        const hasUnpaidInstallments = applicableCashbackOffer.method === "Installments" && (applicableCashbackOffer.totalInstallments || 1) > (applicableCashbackOffer.paidInstallments || 0);
                                        const requireInstallmentPayment = localStorage.getItem('bel_require_installment_booking_v1') === 'true';
                                        if (hasUnpaidInstallments && requireInstallmentPayment) {
                                          setSysAlert(ar() ? "يجب دفع القسط المستحق أولاً قبل حجز الجلسة باستخدام رصيد الكاش باك." : "You must pay your due installment before booking a session using cashback.");
                                          setTimeout(() => setSysAlert(null), 5000);
                                          return;
                                        }
                                      }
                                      const bookingPayload = {
                                        userOfferId: applicableCashbackOffer ? applicableCashbackOffer.id : null,
                                        id: applicableCashbackOffer ? applicableCashbackOffer.id : `temp_${t.id}`,
                                        offerId: ar() ? t.nameAr : t.nameEn,
                                        offerName: ar() ? t.nameAr : t.nameEn,
                                        treatmentName: ar() ? t.nameAr : t.nameEn,
                                        treatmentId: t.id,
                                        treatmentCategory: t.category,
                                        status: "active",
                                        method: applicableCashbackOffer ? "Membership" : "Standalone",
                                        priceKwd: basePrice,
                                        discountPct: actualDiscountPct,
                                        cashbackKwd: actualCashbackKwd,
                                        finalPrice,
                                        applicableCashbackOfferId: applicableCashbackOffer ? applicableCashbackOffer.id : null,
                                        clinicId: selectedClinicForCard || undefined,
                                        standaloneClinicIds: t.clinicIds?.length ? [...t.clinicIds] : undefined
                                      };
                                      setShowBookingModal(bookingPayload);
                                    }}
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                    {ar() ? "احجز جلستك" : "Book Session"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                       </div>
                    );})}
                 </div>
              </div>
            </div>
  );
}
