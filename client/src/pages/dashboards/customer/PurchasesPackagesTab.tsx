// "activeTab === "my-purchases" && purchasesSubTab === "packages"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { fmtDate, fmtDateTime } from "../../../lib/dateFormat";
import { Link } from "react-router-dom";
import { apiFetch } from "../../../lib/api";
import { ReservationConvertControls } from "./ReservationConvertControls";
import { SessionPaymentRow } from "./SessionPaymentRow";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function PurchasesPackagesTab({ s }: { s: CustomerDashboardState }) {
  const { clinicsById, getAuthHeader, homeCatalogData, myRequestsData, offers, offersData, refetchMyOffers, refetchMyRequests, sessions, setActiveTab, setChatConvId, setSysAlert, setUnsignedBannerDismissed, t, unsignedBannerDismissed, unsignedForms } = s;
  return (
    <section id="sec-packages" className="space-y-8 animate-fade-in scroll-mt-24">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-surface-900">{ar() ? "عضوياتي وجلساتي" : "My Memberships & Sessions"}</h2>
                <button onClick={() => setActiveTab("store")} className="text-sm font-semibold text-brand-pink-600 hover:text-brand-pink-700 flex items-center gap-1">
                  {ar() ? "تصفح العضويات" : "Browse memberships"}
                  <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Unsigned forms banner */}
              {unsignedForms.length > 0 && !unsignedBannerDismissed && (
                <div className="sticky top-0 z-20 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm animate-slide-up">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-800">
                      {ar()
                        ? `لديك ${unsignedForms.length} ${unsignedForms.length === 1 ? "نموذج يحتاج" : "نماذج تحتاج"} إلى توقيعك`
                        : `You have ${unsignedForms.length} unsigned form${unsignedForms.length > 1 ? "s" : ""} requiring your signature`}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {ar() ? "يرجى توقيع النماذج المطلوبة قبل موعدك القادم." : "Please sign the required forms before your next session."}
                    </p>
                    <Link
                      to={`/forms/fill/${unsignedForms[0].id}?return=/dashboard`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                    >
                      {ar() ? "وقّع الآن" : "Sign now"}
                      <svg className="h-3.5 w-3.5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                  <button
                    onClick={() => setUnsignedBannerDismissed(true)}
                    aria-label={ar() ? "إغلاق" : "Dismiss"}
                    className="shrink-0 rounded-full p-1 text-amber-500 hover:bg-amber-100 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              {/* Real server-backed offers w/ installment + reservation status */}
              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "اشتراكاتي النشطة" : "Active Memberships"}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {(offersData?.items || []).filter((uo) => !uo.isStandalone).length === 0 ? (
                    <div className="p-8 text-center text-surface-400 text-sm">{ar() ? "لا توجد اشتراكات بعد" : "No active memberships yet"}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {(offersData?.items || []).filter((uo) => !uo.isStandalone).map((uo) => {
                        const statusBadge = (() => {
                          const paid = uo.installmentsPaid ?? 0;
                          const total = uo.installmentCount ?? 0;
                          if (uo.status === "active") {
                            if (uo.purchaseMode === "installments" && total > 0) {
                              if (paid >= total) return { en: "Fully Paid", ar: "مدفوع بالكامل", cls: "bg-emerald-50 text-emerald-700" };
                              return { en: `On Installments ${paid}/${total}`, ar: `أقساط ${paid}/${total}`, cls: "bg-indigo-50 text-indigo-700" };
                            }
                            if (uo.purchaseMode === "enet") return { en: "ENET Approved", ar: "اعتماد ENET", cls: "bg-emerald-50 text-emerald-700" };
                            return { en: "Fully Paid", ar: "مدفوع بالكامل", cls: "bg-emerald-50 text-emerald-700" };
                          }
                          switch (uo.status) {
                            case "pending_payment": {
                              if (uo.isGroupOffer) {
                                const sharedWith = (uo as any).sharedWith || [];
                                const membersNeeded = (uo.groupSizeRequired || 2) - 1;
                                if (sharedWith.length < membersNeeded) {
                                  return { en: "Locked (Group not full)", ar: "مغلق (المجموعة غير مكتملة)", cls: "bg-purple-50 text-purple-700 border border-purple-200" };
                                }
                              }
                              return { en: "Pending payment", ar: "بانتظار الدفع", cls: "bg-amber-50 text-amber-700" };
                            }
                            case "reserved": return { en: "Reserved (deposit)", ar: "محجوز (دفعة)", cls: "bg-blue-50 text-blue-700" };
                            case "enet_pending": return { en: "ENET Pending", ar: "مراجعة ENET", cls: "bg-purple-50 text-purple-700" };
                            case "enet_rejected": return { en: "ENET Rejected", ar: "رفض ENET", cls: "bg-red-50 text-red-700" };
                            case "expired": return { en: "Expired", ar: "منتهي", cls: "bg-surface-100 text-surface-600" };
                            default: return { en: uo.status, ar: uo.status, cls: "bg-surface-100 text-surface-600" };
                          }
                        })();
                        const isInstallments = uo.purchaseMode === "installments";
                        const nextInst = uo.installmentSchedule?.find((s: { paid?: boolean }) => !s.paid);
                        return (
                          <div key={uo.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-bold text-surface-900 text-sm truncate">{(uo as { offerName?: string }).offerName || homeCatalogData?.items?.find((x: any) => x.id === uo.offerId)?.name || uo.offerId}</div>
                                <div className="text-[11px] text-surface-500 mt-0.5">
                                  {uo.activatedAt && <>{ar() ? "مفعّل:" : "Activated:"} {fmtDate(uo.activatedAt)} · </>}
                                  {ar() ? "الجلسات:" : "Sessions:"} {uo.sessionsUsed ?? 0}{uo.maxSessions ? ` / ${uo.maxSessions}` : " / ∞"}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${statusBadge.cls}`}>{ar() ? statusBadge.ar : statusBadge.en}</span>
                                {uo.expiresAt && (
                                  <div className={`text-[10px] font-medium ${new Date(uo.expiresAt) < new Date() ? "text-red-500" : new Date(uo.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000 ? "text-amber-600" : "text-surface-500"}`}>
                                    {ar() ? "ينتهي في:" : "Exp:"} {fmtDate(uo.expiresAt)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {isInstallments && uo.installmentSchedule && (
                              <div className="bg-surface-50 rounded-xl p-3">
                                <div className="flex items-center justify-between text-xs mb-2">
                                  <span className="font-bold text-surface-700">{ar() ? "تقدم الأقساط" : "Installment progress"}</span>
                                  <span className="text-surface-500">{uo.installmentsPaid ?? 0}/{uo.installmentCount ?? 0}</span>
                                </div>
                                <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-brand-pink-500 transition-all" style={{ width: `${((uo.installmentsPaid ?? 0) / (uo.installmentCount || 1)) * 100}%` }} />
                                </div>
                                {nextInst && (
                                  <div className="mt-3 flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-surface-600">
                                      {ar() ? "القسط القادم" : "Next"}: <span className="font-bold text-surface-900">{nextInst.amountKwd} KWD</span>
                                      <span className="text-surface-400"> · {fmtDate(nextInst.dueDate)}</span>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        try {
                                          const res = await apiFetch("/checkout/installments/pay-next", {
                                            method: "POST",
                                            headers: getAuthHeader(),
                                            body: JSON.stringify({ userOfferId: uo.id })
                                          });
                                          await refetchMyOffers();
                                          setSysAlert(ar() ? "تم إرسال طلب الدفع لخدمة العملاء" : "Payment request submitted. Awaiting confirmation.");
                                          setTimeout(() => setSysAlert(null), 4000);
                                        } catch (e: unknown) {
                                          const msg = e instanceof Error ? e.message : "Payment failed";
                                          setSysAlert(msg);
                                          setTimeout(() => setSysAlert(null), 5000);
                                        }
                                      }}
                                      className="text-xs font-bold bg-brand-pink-500 hover:bg-brand-pink-600 text-white px-3 py-1.5 rounded-lg whitespace-nowrap"
                                    >
                                      {ar() ? "ادفع الآن" : "Pay now"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {uo.status === "reserved" && uo.reservationExpiresAt && (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs">
                                <div className="font-bold text-blue-900">
                                  {ar() ? "محجوز حتى" : "Reserved until"} {fmtDateTime(uo.reservationExpiresAt)}
                                </div>
                                <div className="text-blue-700 mt-0.5">
                                  {ar() ? "أكملي الرصيد لتفعيل العرض." : "Complete the balance to activate this offer."}
                                </div>
                                <ReservationConvertControls
                                  userOfferId={uo.id}
                                  preferredPlan={uo.reservationPreferredPlan}
                                  ar={ar()}
                                  getAuthHeader={getAuthHeader}
                                  onDone={async (msg) => {
                                    await refetchMyOffers();
                                    setSysAlert(msg);
                                    setTimeout(() => setSysAlert(null), 5000);
                                  }}
                                />
                              </div>
                            )}

                            {uo.status === "enet_pending" && (
                              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800">
                                {ar() ? "في انتظار موافقة ENET. ستصلك إشعار عند الانتهاء." : "Waiting for ENET approval. You'll be notified when it completes."}
                              </div>
                            )}

                            {uo.status === "enet_rejected" && (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                                {ar() ? "رفضت ENET الطلب. جرّبي خطة دفع أخرى." : "ENET declined. Try a different payment plan."}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>


              {/* Awaiting session payment requests */}
              {(() => {
                const pendingPayments = (myRequestsData?.items ?? []).filter((r) => r.status === "awaiting_session_payment");
                if (pendingPayments.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "طلبات بانتظار دفع رسوم الجلسة" : "Session Fees Awaiting Payment"}</h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden divide-y divide-amber-200">
                      {pendingPayments.map((r) => {
                        const clinic = clinicsById.get(r.clinicId);
                        const clinicName = clinic ? (ar() ? clinic.nameAr : clinic.nameEn) : r.clinicId;
                        return (
                          <SessionPaymentRow
                            key={r.id}
                            request={r}
                            clinicName={clinicName}
                            ar={ar()}
                            getAuthHeader={getAuthHeader}
                            onDone={async () => {
                              await refetchMyRequests();
                              setSysAlert(ar() ? "تم الدفع — طلبك قيد المراجعة" : "Payment complete — your request is now under review");
                              setTimeout(() => setSysAlert(null), 5000);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Active booking requests (non awaiting_payment) - hidden per configuration */}
              {(() => {
                return null;
                const activeRequests = (myRequestsData?.items ?? []).filter(
                  (r) => r.status !== "awaiting_session_payment"
                );
                if (activeRequests.length === 0) return null;
                const statusMeta: Record<string, { label: string; labelAr: string; color: string }> = {
                  request_received: { label: "Request Received", labelAr: "تم استلام الطلب", color: "bg-amber-100 text-amber-800" },
                  slot_assigned:    { label: "Slot Assigned",    labelAr: "تم تحديد الوقت", color: "bg-blue-100 text-blue-800" },
                  scheduled:        { label: "Scheduled",        labelAr: "مجدول",           color: "bg-emerald-100 text-emerald-800" },
                  in_progress:      { label: "In Progress",      labelAr: "قيد التنفيذ",     color: "bg-purple-100 text-purple-800" },
                  rescheduled:      { label: "Rescheduled",      labelAr: "تمت إعادة الجدولة", color: "bg-orange-100 text-orange-800" },
                  checked_in:       { label: "Checked In",       labelAr: "تم الحضور",       color: "bg-teal-100 text-teal-800" },
                  completed:        { label: "Completed",        labelAr: "مكتمل",           color: "bg-emerald-100 text-emerald-800" },
                  no_show:          { label: "No Show",          labelAr: "لم يحضر",         color: "bg-red-100 text-red-800" },
                  cancelled:        { label: "Cancelled",        labelAr: "ملغى",            color: "bg-surface-100 text-surface-500" },
                };
                return (
                  <div>
                    <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "طلبات الحجز" : "Booking Requests"}</h3>
                    <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden divide-y divide-surface-100">
                      {activeRequests.map((r) => {
                        const clinic = clinicsById.get(r.clinicId);
                        const clinicName = clinic ? (ar() ? clinic.nameAr : clinic.nameEn) : r.clinicId;
                        const meta = statusMeta[r.status] ?? { label: r.status, labelAr: r.status, color: "bg-surface-100 text-surface-700" };
                        return (
                          <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${r.status === "scheduled" ? "bg-emerald-50 text-emerald-600" : r.status === "cancelled" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"}`}>
                                {r.status === "scheduled"
                                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  : r.status === "cancelled"
                                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                }
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-surface-900 text-sm">{(r as any).offerName || (r as any).standaloneName || (ar() ? "طلب حجز" : "Booking Request")}</span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{ar() ? meta.labelAr : meta.label}</span>
                                </div>
                                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة:" : "Clinic:"} <span className="font-semibold text-surface-700">{clinicName}</span></div>
                                {r.proposedAt && r.status === "scheduled" && <div className="text-xs text-blue-600 mt-0.5 font-medium">{ar() ? "وقت الموعد:" : "Scheduled time:"} {fmtDateTime(r.proposedAt)}</div>}
                                {r.rejectionReason && <div className="text-xs text-red-500 mt-0.5">{ar() ? "السبب:" : "Reason:"} {r.rejectionReason}</div>}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0 flex-wrap">
                              {r.conversationId && (
                                <button
                                  type="button"
                                  className="text-xs font-bold bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                  onClick={() => { setChatConvId(r.conversationId!); setActiveTab("chat"); }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                  {ar() ? "المحادثة" : "View chat"}
                                </button>
                              )}
                              {r.status === "slot_assigned" && (
                                <button
                                  type="button"
                                  className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={async () => {
                                    try {
                                      await apiFetch(`/scheduling/me/requests/${r.id}/accept`, { method: "POST", headers: getAuthHeader() });
                                      await refetchMyRequests();
                                      setSysAlert(ar() ? "تم قبول الوقت المقترح" : "Slot accepted");
                                      setTimeout(() => setSysAlert(null), 4000);
                                    } catch (e: any) { alert(e.message); }
                                  }}
                                >{ar() ? "قبول الوقت" : "Accept slot"}</button>
                              )}
                              {["request_received", "slot_assigned"].includes(r.status) && (
                                <button
                                  type="button"
                                  className="text-xs font-bold bg-surface-100 hover:bg-surface-200 text-surface-700 px-3 py-1.5 rounded-lg transition-colors"
                                  onClick={async () => {
                                    if (!confirm(ar() ? "هل تريد إلغاء طلب الحجز؟" : "Cancel this booking request?")) return;
                                    try {
                                      await apiFetch(`/scheduling/me/requests/${r.id}/cancel`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({}) });
                                      await refetchMyRequests();
                                    } catch (e: any) { alert(e.message); }
                                  }}
                                >{ar() ? "إلغاء" : "Cancel"}</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "الجلسات المحجوزة" : "Booked Sessions"}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {sessions.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {sessions.map((b: any) => {
                        const clinic = clinicsById.get(b.clinicId);
                        const clinicName = clinic ? (ar() ? clinic.nameAr : clinic.nameEn) : b.clinicId;
                        return (
                          <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                              <div>
                                <div className="font-bold text-surface-900 text-sm">{b.offerName || b.standaloneName || (ar() ? "جلسة" : "Session")}</div>
                                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة:" : "Clinic:"} <span className="font-semibold text-surface-700">{clinicName}</span></div>
                              </div>
                            </div>
                            <div className="flex sm:flex-col items-center sm:items-end justify-between">
                              <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{b.status}</div>
                              <div className="text-[10px] text-surface-400 mt-1">{fmtDateTime(b.scheduledAt)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Purchased Packages (Moved here) */}
              <div>
                <h3 className="text-base font-bold text-surface-700 mb-3">{ar() ? "الباقات المشتراة" : "Purchased Packages"}</h3>
                <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                  {offers.length === 0 ? (
                    <div className="p-8 text-center text-surface-400">{t("noData")}</div>
                  ) : (
                    <div className="divide-y divide-surface-100">
                      {offers.map(o => (
                        <div key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand-pink-50 text-brand-pink-500 shrink-0">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                              <div className="font-bold text-surface-900 text-sm">{o.offerName || o.offerId || "Package"}</div>
                              <div className="text-xs text-surface-500 mt-0.5">{ar() ? "طريقة الدفع:" : "Method:"} {o.paymentMethod || o.method || o.purchaseMode || (ar() ? "خدمة العملاء / العيادة" : "Customer Service / Clinic")}</div>
                            </div>
                          </div>
                          <div className="flex sm:flex-col items-center sm:items-end justify-between">
                            <div className="font-black text-brand-pink-500">{o.paymentAmountKwd || o.amount || o.subscriptionPriceKwd || o.totalSignupCashbackKwd || "0"} KWD</div>
                            <div className="text-[10px] text-surface-400 mt-1">{fmtDate(o.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
  );
}
