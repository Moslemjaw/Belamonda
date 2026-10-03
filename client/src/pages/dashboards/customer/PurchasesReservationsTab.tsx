// "activeTab === "my-purchases" && purchasesSubTab === "reservations"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { fmtDate } from "../../../lib/dateFormat";
import { type ReservationItem } from "../../../hooks/useApi";
import { ReservationConvertControls } from "./ReservationConvertControls";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function PurchasesReservationsTab({ s }: { s: CustomerDashboardState }) {
  const { getAuthHeader, homeCatalogData, refetchMyOffers, refetchReservations, reservationsData, setSysAlert } = s;
  return (
    <section id="sec-reservations" className="space-y-6 animate-fade-in scroll-mt-24">
              <div>
                <h2 className="text-xl font-bold text-surface-900">{ar() ? "حجوزاتي بالعربون" : "My Deposit Reservations"}</h2>
                <p className="text-sm text-surface-500 mt-1">
                  {ar() ? "عروضك المحجوزة بعربون — أكملي الدفع قبل انتهاء مدة الحجز." : "Memberships held with a deposit — complete the balance before they expire."}
                </p>
              </div>

              {(reservationsData?.items ?? []).length === 0 ? (
                <div className="bg-white rounded-2xl border border-surface-200 p-10 text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="font-bold text-surface-700">{ar() ? "لا توجد حجوزات بالعربون بعد" : "No deposit reservations yet"}</p>
                  <p className="text-sm text-surface-400 mt-1">{ar() ? "يمكنك حجز عرض بدفع عربون من صفحة العروض." : "Reserve an offer with a deposit from the offers page."}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(reservationsData?.items ?? []).map((r: ReservationItem) => {
                    const isActive = r.status === "reserved";
                    const isConverted = r.status === "active";
                    const isExpired = r.status === "expired" || r.status === "cancelled";
                    const daysLeft = r.reservationExpiresAt
                      ? Math.ceil((new Date(r.reservationExpiresAt).getTime() - Date.now()) / 86400000)
                      : null;
                    const urgent = daysLeft !== null && daysLeft <= 3 && isActive;
                    return (
                      <div key={r.id} className={`bg-white rounded-2xl border overflow-hidden ${urgent ? "border-red-300" : isConverted ? "border-emerald-200" : isExpired ? "border-surface-200" : "border-blue-200"}`}>
                        <div className={`px-5 py-3 flex items-center justify-between ${urgent ? "bg-red-50" : isConverted ? "bg-emerald-50" : isExpired ? "bg-surface-50" : "bg-blue-50"}`}>
                          <div className="font-bold text-surface-900 text-sm">{r.isStandalone && r.standaloneName ? r.standaloneName : (r.offerName || homeCatalogData?.items?.find((x: any) => x.id === r.offerId)?.name || r.offerId)}</div>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${isActive ? "bg-blue-100 text-blue-700" : isConverted ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}>
                            {isActive ? (ar() ? "محجوز" : "Reserved") : isConverted ? (ar() ? "مُحوَّل" : "Converted") : (ar() ? "منتهي" : "Expired")}
                          </span>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-surface-400 font-medium">{ar() ? "العربون المدفوع" : "Deposit paid"}</div>
                              <div className="font-black text-brand-pink-600 text-sm mt-0.5">{r.depositAmountKwd ?? "—"} KWD</div>
                            </div>
                            {r.reservationPreferredPlan && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "الخطة المفضّلة" : "Preferred plan"}</div>
                                <div className="font-bold text-surface-700 mt-0.5">
                                  {r.reservationPreferredPlan === "full" ? (ar() ? "دفع كامل" : "Full") :
                                   r.reservationPreferredPlan === "installments_2" ? (ar() ? "قسطين" : "2 installments") :
                                   r.reservationPreferredPlan === "installments_3" ? (ar() ? "3 أقساط" : "3 installments") :
                                   ar() ? "4 أقساط ENET" : "4× ENET"}
                                </div>
                              </div>
                            )}
                            {isActive && r.reservationExpiresAt && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "ينتهي في" : "Expires"}</div>
                                <div className={`font-bold mt-0.5 ${urgent ? "text-red-600" : "text-surface-700"}`}>
                                  {fmtDate(r.reservationExpiresAt)}
                                  {daysLeft !== null && daysLeft >= 0 && (
                                    <span className="ml-1 text-[11px]">({daysLeft}d)</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {isConverted && r.activatedAt && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "تفعيل في" : "Activated"}</div>
                                <div className="font-bold text-emerald-600 mt-0.5">{fmtDate(r.activatedAt)}</div>
                              </div>
                            )}
                            {r.reservationCompletionExpectedAt && (
                              <div>
                                <div className="text-surface-400 font-medium">{ar() ? "موعد الإكمال المتوقع" : "Expected completion"}</div>
                                <div className="font-bold text-surface-700 mt-0.5">{fmtDate(r.reservationCompletionExpectedAt)}</div>
                              </div>
                            )}
                          </div>

                          {urgent && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-xs font-bold text-red-700">
                              {ar() ? `⚠️ ينتهي حجزك خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"} — أكملي الدفع الآن.` : `⚠️ Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — complete your balance now.`}
                            </div>
                          )}

                          {isActive && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                              <div className="text-xs font-bold text-blue-900 mb-2">{ar() ? "أكملي دفع الرصيد" : "Complete your balance"}</div>
                              <ReservationConvertControls
                                userOfferId={r.id}
                                preferredPlan={r.reservationPreferredPlan}
                                ar={ar()}
                                getAuthHeader={getAuthHeader}
                                onDone={async (msg) => {
                                  await refetchReservations();
                                  await refetchMyOffers();
                                  setSysAlert(msg);
                                  setTimeout(() => setSysAlert(null), 5000);
                                }}
                              />
                            </div>
                          )}

                          {isConverted && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-medium text-emerald-700">
                              {ar() ? "✅ تم إكمال الدفع وتفعيل العرض. يمكنك الآن حجز جلساتك." : "✅ Payment completed and offer activated. You can now book your sessions."}
                            </div>
                          )}

                          {isExpired && (
                            <div className="text-xs text-surface-500">
                              {ar() ? "انتهت صلاحية هذا الحجز. تصفحي العروض لحجز جديد." : "This reservation has expired. Browse offers to make a new reservation."}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
  );
}
