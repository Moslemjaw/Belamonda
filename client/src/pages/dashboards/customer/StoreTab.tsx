// "activeTab === "store"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).

import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function StoreTab({ s }: { s: CustomerDashboardState }) {
  const { attemptCheckout, categoriesData, categoryFilters, homeCatalogData, offerFilter, sessions, setGroupModal, setOfferFilter } = s;
  const allOffers = homeCatalogData?.items || [];
  // Only show categories that have at least one membership
          const offerCategorySlugs = new Set(allOffers.map((o: any) => o.category).filter(Boolean));
  const activeFilters = categoryFilters.filter(cf => cf.slug === "all" || offerCategorySlugs.has(cf.slug));
  const filtered = allOffers.filter((o: any) => offerFilter === "all" || o.category === offerFilter);
  // Sort: custom admin order first, fallback to highest price (premium plans on top)
          const sorted = [...filtered].sort((a: any, b: any) => {
            const orderA = a.sortOrder ?? 0;
            const orderB = b.sortOrder ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return parseFloat(b.subscriptionPriceKwd || "0") - parseFloat(a.subscriptionPriceKwd || "0");
          });
  // Featured = the first plan in the sorted list
          const featuredId = sorted.length > 1 ? sorted[0]?.id : null;
  return (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-pink-50 border border-brand-pink-100 text-brand-pink-600 text-xs font-bold uppercase tracking-wider mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-pink-500 animate-pulse" />
                  {ar() ? "خطط العضوية" : "Choose Your Plan"}
                </div>
                <h2 className="text-3xl lg:text-4xl font-black text-surface-900 mb-2 tracking-tight">{ar() ? "اختاري الخطة المثالية لكِ" : "Find Your Perfect Plan"}</h2>
                <p className="text-surface-500 text-sm lg:text-base">{ar() ? "باقات شاملة بأسعار حصرية وكاش باك تلقائي على كل جلسة." : "Comprehensive packages with exclusive pricing and automatic cashback on every session."}</p>
              </div>
              {/* Horizontally scrollable filters on mobile, wrapping on desktop */}
              <div className="relative -mx-3 px-3 sm:mx-0 sm:px-0">
                <div
                  className="flex gap-2 overflow-x-auto overflow-y-hidden no-scrollbar pb-2 sm:pb-0 sm:flex-wrap sm:justify-center sm:overflow-visible touch-pan-x overscroll-x-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {activeFilters.map(cf => {
                    const count = cf.slug === "all" ? allOffers.length : allOffers.filter((o: any) => o.category === cf.slug).length;
                    return (
                      <button
                        key={cf.slug}
                        onClick={() => setOfferFilter(cf.slug)}
                        className={`snap-start shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap ${offerFilter === cf.slug ? "bg-brand-pink-500 text-white shadow-md" : "bg-white text-surface-600 border border-surface-200 hover:border-brand-pink-300 hover:text-brand-pink-600"}`}
                      >
                        {ar() ? cf.nameAr : cf.nameEn}
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${offerFilter === cf.slug ? "bg-white/25 text-white" : "bg-surface-100 text-surface-500"}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 pt-2">
                {sorted.map((o: any) => {
                  const isFeatured = o.id === featuredId && sorted.length > 1;
                  const sessions = o.sessionCount || o.maxSessions;
                  const cashbackPct = o.cashbackPercent;
                  const branches = o.branchCount;
                  const savings = o.originalClinicPriceKwd && o.subscriptionPriceKwd
                    ? (parseFloat(o.originalClinicPriceKwd) - parseFloat(o.subscriptionPriceKwd)).toFixed(3)
                    : null;
                  // Resolve category name from API data
                  const catDef = (categoriesData?.items || []).find(c => c.slug === o.category);
                  const categoryLabel = catDef ? (ar() ? catDef.nameAr : catDef.nameEn) : o.category;
                  return (
                    <div key={o.id} className={`plan-card ${isFeatured ? "is-featured" : ""}`}>
                      {isFeatured && <span className="plan-badge">{ar() ? "الأكثر شعبية" : "Most Popular"}</span>}
                      <div className="text-[10px] font-bold text-brand-pink-500 uppercase tracking-wider mb-2">{categoryLabel}</div>
                      <h3 className="text-lg font-black text-surface-900 leading-tight mb-1">{ar() ? (o.nameAr || o.name) : o.name}</h3>
                      {o.subtitle && <p className="text-xs text-surface-500 line-clamp-2 mb-4">{o.subtitle}</p>}
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-black text-surface-900 tracking-tight">{o.subscriptionPriceKwd}</span>
                        <span className="text-sm font-bold text-surface-500">KWD</span>
                      </div>
                      {o.originalClinicPriceKwd && (
                        <div className="flex items-center gap-2 mb-5">
                          <span className="text-sm text-surface-400 line-through">{o.originalClinicPriceKwd} KWD</span>
                          {savings && <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">{ar() ? `وفّري ${savings}` : `Save ${savings}`}</span>}
                        </div>
                      )}
                      {!o.originalClinicPriceKwd && <div className="mb-5" />}
                      <div className="space-y-2.5 mb-6 flex-1">
                        {sessions && (
                          <div className="plan-feature">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span><b>{sessions}</b> {ar() ? "جلسة مدرجة" : "sessions included"}</span>
                          </div>
                        )}
                        {cashbackPct && (
                          <div className="plan-feature">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span><b>{cashbackPct}%</b> {ar() ? "كاش باك تلقائي" : "automatic cashback"}</span>
                          </div>
                        )}
                        {branches && (
                          <div className="plan-feature">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span>{ar() ? `متوفر في ${branches} فرع` : `Available at ${branches} branches`}</span>
                          </div>
                        )}
                        <div className="plan-feature">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{ar() ? "حجز مرن بدون رسوم" : "Flexible booking, no fees"}</span>
                        </div>
                        <div className="plan-feature">
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>{ar() ? "دعم عملاء مخصص" : "Priority customer support"}</span>
                        </div>
                      </div>
                      
                      {/* Group offer badge */}
                      {o.isGroupOffer && (
                        <div className={`plan-feature mb-6 ${o.isGroupOffer ? '!text-purple-600' : '!text-emerald-600'}`}>
                          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          <span>
                            {o.groupRewardType === 'unlock_membership'
                              ? (ar() ? `🔓 يحتاج ${(o.groupSizeRequired || 2) - 1} أشخاص لفتح العضوية` : `🔓 Needs ${(o.groupSizeRequired || 2) - 1} people to unlock`)
                              : o.groupRewardType === 'free_session'
                              ? (ar() ? `🎁 جلسة مجانية مع ${(o.groupSizeRequired || 2) - 1} أصدقاء` : `🎁 Free session with ${(o.groupSizeRequired || 2) - 1} friends`)
                              : o.groupRewardType === 'discount'
                              ? (ar() ? `💰 خصم مع ${(o.groupSizeRequired || 2) - 1} أصدقاء` : `💰 Discount with ${(o.groupSizeRequired || 2) - 1} friends`)
                              : o.groupRewardType === 'cashback_bonus'
                              ? (ar() ? `💎 كاش باك إضافي مع ${(o.groupSizeRequired || 2) - 1} أصدقاء` : `💎 Bonus cashback with ${(o.groupSizeRequired || 2) - 1} friends`)
                              : o.groupRewardType === 'split_bill'
                              ? (ar() ? `🧾 تقسيم الفاتورة بين ${o.groupSizeRequired || 2} أشخاص` : `🧾 Split bill between ${o.groupSizeRequired || 2} people`)
                              : (ar() ? `👥 عرض جماعي` : `👥 Group offer`)}
                          </span>
                        </div>
                      )}
                      <button
                        className={isFeatured ? "btn-primary w-full py-3 text-sm font-bold shadow-glow" : "w-full py-3 rounded-2xl text-sm font-bold border-2 border-surface-200 text-surface-700 bg-white hover:border-brand-pink-400 hover:text-brand-pink-600 transition-colors"}
                        onClick={() => {
                          if (o.isGroupOffer) {
                            // Start group creation flow with confirm step
                            setGroupModal({
                              pkg: o,
                              step: "confirm",
                              membersJoined: 0,
                              membersNeeded: (o.groupSizeRequired || 2) - 1,
                              loading: false,
                            });
                          } else {
                            attemptCheckout(o);
                          }
                        }}
                      >
                        {o.isGroupOffer
                          ? (ar() ? "🔓 أنشئ مجموعة" : "🔓 Create Group")
                          : (ar() ? "اختاري هذه الخطة" : "Choose this Plan")}
                      </button>
                    </div>
                  );
                })}
              </div>
              {sorted.length === 0 && (
                <div className="text-center py-16 text-surface-400">
                  <div className="text-5xl mb-3">🌸</div>
                  <p className="font-medium">{ar() ? "لا توجد عروض في هذه الفئة" : "No memberships in this category"}</p>
                </div>
              )}
            </div>
          );
}
