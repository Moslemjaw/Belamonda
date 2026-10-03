// "activeTab === "wallet" && walletSubTab === "card" && offers.some(o => o.status === "active")" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { SITE_BASE_URL } from "../../../lib/api";
import { BelamondaLogo } from "../../../components/BelamondaLogo";
import QRCodeCanvas from "../../../components/QRCodeCanvas";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function WalletCardTab({ s }: { s: CustomerDashboardState }) {
  const { cardData, cardError, cardLoading, sysAlert } = s;
  return (
    <section id="sec-card" className="space-y-6 animate-fade-in scroll-mt-24">
              <div>
                <h2 className="text-xl font-bold text-surface-900">{ar() ? "بطاقتي الرقمية" : "My Digital Card"}</h2>
                <p className="text-sm text-surface-500 mt-1">{ar() ? "امسح رمز QR في العيادة للتحقق من هويتك وعضويتك." : "Scan this QR at the clinic to verify your identity and membership."}</p>
              </div>

              {cardLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-10 h-10 border-4 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin" />
                </div>
              ) : (cardError || !cardData) ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-surface-900 text-sm">{ar() ? "تعذّر تحميل بطاقتك" : "Unable to load your card"}</p>
                    <p className="text-xs text-surface-500 mt-1">{ar() ? "يرجى تسجيل الخروج وإعادة الدخول إذا استمرت المشكلة." : "Please log out and log back in if this persists."}</p>
                  </div>
                  <button onClick={() => window.location.reload()} className="btn-primary btn-sm text-xs">{ar() ? "إعادة المحاولة" : "Try Again"}</button>
                </div>
              ) : (
                                <div className="max-w-md mx-auto lg:mx-0">
                  {/* Visa-style Membership Card */}
                  <div className={`relative rounded-2xl shadow-2xl overflow-hidden aspect-[1.586/1] text-white p-6 flex flex-col justify-between mb-8 group ${cardData.card.belmondoPlan === "pro" ? "bg-gradient-to-br from-surface-900 via-amber-800 to-amber-600 border-[3px] border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.3)]" : "bg-gradient-to-br from-surface-900 via-brand-pink-900 to-brand-pink-700"}`}>
                    {/* Glossy overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                    
                    <div className="flex justify-between items-start z-10">
                      <div className={`text-xs font-bold uppercase tracking-[0.2em] ${cardData.card.belmondoPlan === "pro" ? "text-amber-200 drop-shadow-md" : "text-brand-pink-200/80"}`}>
                        {cardData.card.belmondoPlan === "pro" ? (ar() ? "بيلاموندو برو" : "BELMONDO PRO") : (ar() ? "بطاقة الحساب" : "ACCOUNT CARD")}
                      </div>
                      {/* QR Code on the card (top right) */}
                      {cardData.card.publicToken && (
                        <div className="bg-white p-1.5 rounded-xl shadow-lg transform group-hover:scale-105 transition-transform">
                          <QRCodeCanvas
                            value={`${SITE_BASE_URL}/verify/${cardData.card.publicToken}`}
                            size={64}
                            className="block w-16 h-16 rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="z-10 space-y-3">
                      <div className="text-2xl font-black tracking-widest drop-shadow-md">
                        {cardData.card.displayName}
                      </div>
                      
                      <div className="flex items-end justify-between">
                        <div>
                          {/* Member Since removed per request */}
                          <div className="flex items-center gap-2">
                            {cardData.card.kycVerified ? (
                              <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm border border-white/10">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                {ar() ? "هوية موثقة" : "Identity Verified"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-black/30 text-white/80 text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm border border-white/5">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {ar() ? "التحقق معلق" : "Verification Pending"}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="opacity-90 flex items-center gap-2">
                           <BelamondaLogo size={40} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {sysAlert && (
                <div className="max-w-md mx-auto lg:mx-0 bg-surface-900 text-white text-sm font-medium px-4 py-3 rounded-2xl animate-fade-in">
                  {sysAlert}
                </div>
              )}
            </section>
  );
}
