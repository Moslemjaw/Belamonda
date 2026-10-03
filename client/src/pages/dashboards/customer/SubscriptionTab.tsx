// "activeTab === "subscription"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { InvoiceUploader } from "./InvoiceUploader";
import { SubscriptionPage } from "./SubscriptionPage";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function SubscriptionTab({ s }: { s: CustomerDashboardState }) {
  const { cardData, getAuthHeader, requireKyc, setSubscriptionSubTab, subscriptionSubTab } = s;
  const proTabs = [
              { id: "status",   label: ar() ? "حالة الاشتراك" : "Status",   icon: "👑" },
              { id: "invoices", label: ar() ? "مسح الفواتير"  : "Invoices", icon: "📸" },
            ] as const;
  return (
              <div className="animate-fade-in">
                <div className="mb-4 sm:mb-6 sticky top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-20 lg:static lg:z-auto pt-3 sm:pt-4 py-1.5 px-3 sm:px-0 bg-surface-50/95 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none transition-all">
                  <div className="flex bg-surface-200/60 p-1.5 rounded-[16px] max-w-sm mx-auto shadow-inner border border-surface-200/30">
                    {proTabs.map(pt => {
                      const isActive = subscriptionSubTab === pt.id;
                      return (
                        <button
                          key={pt.id}
                          onClick={() => setSubscriptionSubTab(pt.id as any)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-[12px] text-xs font-bold transition-all duration-300 relative ${isActive ? "text-brand-pink-600 shadow-sm bg-white" : "text-surface-500 hover:text-surface-700 hover:bg-surface-200/50"}`}
                        >
                          <span aria-hidden="true" className="text-sm">{pt.icon}</span>
                          <span className="truncate">{pt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {subscriptionSubTab === "status" ? (
                  <SubscriptionPage 
                    getAuthHeader={getAuthHeader}
                    ar={ar()}
                    currentPlan={cardData?.card?.belmondoPlan}
                    expiresAt={cardData?.card?.belmondoProExpiresAt}
                    commitmentEndsAt={(cardData?.card as any)?.belmondoProCommitmentEndsAt}
                    paymentType={cardData?.card?.belmondoProPaymentType}
                    requireKyc={requireKyc}
                  />
                ) : (
                  <section id="sec-invoices" className="animate-fade-in scroll-mt-24">
                    <InvoiceUploader 
                      getAuthHeader={getAuthHeader} 
                      ar={ar()} 
                      isPro={cardData?.card?.belmondoPlan === "pro"} 
                      onContactCS={() => {
                        setSubscriptionSubTab("status");
                      }}
                    />
                  </section>
                )}
              </div>
            );
}
