import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import PublicLayout from "../components/PublicLayout";
import { useAuth } from "../app/AuthContext";

export default function PromoPage() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const ar = () => i18n.language === "ar";
  const navigate = useNavigate();
  const { auth } = useAuth();

  const { data: promo, loading, error } = useApi<any>(`/promotions/public/${slug}`);

  const handleSelectPackage = (offerId: string) => {
    if (auth) {
      navigate(`/memberships/${offerId}`);
    } else {
      navigate(`/signup?offerId=${offerId}&promo=${slug}`);
    }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex justify-center items-center pt-32 pb-16">
          <div className="w-10 h-10 border-4 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin"></div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !promo) {
    return (
      <PublicLayout>
        <div className="flex flex-col justify-center items-center pt-32 pb-16 px-4">
          <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
            <svg className="w-16 h-16 text-surface-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <h2 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "العرض غير موجود" : "Promotion Not Found"}</h2>
            <p className="text-sm text-surface-500 mb-6">{ar() ? "عذراً، هذا الرابط غير صالح أو انتهت صلاحيته." : "Sorry, this promotion link is invalid or has expired."}</p>
            <button onClick={() => navigate("/")} className="btn-primary w-full">{ar() ? "العودة للرئيسية" : "Back to Home"}</button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <main className="pt-24 pb-20 px-4 max-w-3xl mx-auto animate-fade-in">
        <div className="text-center mb-10">
          <span className="inline-block px-3 py-1 bg-brand-pink-100 text-brand-pink-600 font-bold text-xs rounded-full mb-4 uppercase tracking-wider">
            {ar() ? "عرض حصري" : "Exclusive Offer"}
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-surface-900 mb-4">{promo.title}</h1>
          <p className="text-base sm:text-lg text-surface-600 max-w-2xl mx-auto leading-relaxed">{promo.description}</p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold text-surface-900 mb-4 px-1">{ar() ? "الباقات المتاحة في هذا العرض:" : "Available Packages:"}</h3>
          
          <div className="grid gap-4 sm:gap-6">
            {promo.offerIds?.map((offer: any) => (
              <div key={offer._id || offer.id} className="bg-white rounded-2xl shadow-sm border border-surface-100 overflow-hidden hover:border-brand-pink-200 transition-all hover:shadow-md flex flex-col sm:flex-row">
                {offer.imageUrl && (
                  <div className="sm:w-1/3 h-48 sm:h-auto shrink-0 relative">
                    <img src={offer.imageUrl} alt={ar() ? offer.nameAr || offer.name : offer.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:hidden"></div>
                  </div>
                )}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-center">
                  <h4 className="text-xl font-bold text-surface-900 mb-1">{ar() ? offer.nameAr || offer.name : offer.name}</h4>
                  {offer.subtitle && <p className="text-sm text-surface-500 mb-4">{offer.subtitle}</p>}
                  
                  <div className="flex items-end justify-between mt-auto pt-4 border-t border-surface-100">
                    <div>
                      {offer.originalClinicPriceKwd && offer.originalClinicPriceKwd !== offer.subscriptionPriceKwd && (
                        <div className="text-xs text-surface-400 line-through mb-0.5">{offer.originalClinicPriceKwd} KWD</div>
                      )}
                      <div className="text-2xl font-black text-brand-pink-600">{offer.subscriptionPriceKwd} <span className="text-sm font-bold text-surface-500 uppercase">KWD</span></div>
                    </div>
                    
                    <button 
                      onClick={() => handleSelectPackage(offer._id || offer.id)}
                      className="btn-primary py-2 px-6 shadow-sm hover:-translate-y-0.5 transition-transform"
                    >
                      {ar() ? "احصل على الباقة" : "Get Package"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}
