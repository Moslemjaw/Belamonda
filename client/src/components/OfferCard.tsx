import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getCategoryIcon } from "./CategoryIcons";

export type PublicOffer = {
  id: string;
  name: string;
  nameAr?: string;
  type: "A" | "B";
  category: string;
  subscriptionPriceKwd: string;
  signupCashbackKwd?: string;
  cashbackPerSessionKwd?: string;
  validityDays?: number;
  maxSessions?: number;
  featured?: boolean;
  imageUrl?: string;
  tagsEn?: string[];
  tagsAr?: string[];
  perVisitPriceKwd?: string;
  originalClinicPriceKwd?: string;
  status?: string;
};

export default function OfferCard({ offer }: { offer: PublicOffer }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const tags = (isAr ? offer.tagsAr : offer.tagsEn) ?? [];
  const cashback = parseFloat(offer.signupCashbackKwd ?? "0");
  const perSession = parseFloat(offer.cashbackPerSessionKwd ?? "0");

  return (
    <Link
      to={`/memberships/${offer.id}`}
      className="group card-elevated p-0 overflow-hidden flex flex-col hover:shadow-xl transition-all"
    >
      <div className="relative h-32 bg-gradient-to-br from-brand-pink-100 via-brand-pink-50 to-brand-sage-100 flex items-center justify-center">
        {offer.imageUrl ? (
          <img
            src={offer.imageUrl}
            alt={offer.name}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => ((e.currentTarget.style.display = "none"))}
          />
        ) : (
          <div className="text-brand-pink-400/70 [&_svg]:!w-12 [&_svg]:!h-12">
            {getCategoryIcon(offer.category)}
          </div>
        )}
        {offer.status === "expired" ? (
          <span className="absolute top-2 start-2 rounded-full bg-red-500 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm z-10">
            {isAr ? "منتهي" : "Expired"}
          </span>
        ) : offer.featured && (
          <span className="absolute top-2 start-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-pink-600 shadow-sm z-10">
            {isAr ? "مميّز" : "Featured"}
          </span>
        )}
        <span className="absolute top-2 end-2 rounded-full bg-surface-900/70 backdrop-blur px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {offer.type === "A" ? (isAr ? "اشتراك" : "Subscription") : (isAr ? "بزيارة" : "Per visit")}
        </span>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-pink-500">
          <span className="[&_svg]:!w-3.5 [&_svg]:!h-3.5">{getCategoryIcon(offer.category)}</span>
          <span>{offer.category}</span>
        </div>
        <h3 className="font-bold text-surface-900 leading-snug line-clamp-2 group-hover:text-brand-pink-700 transition-colors">
          {isAr ? (offer.nameAr || offer.name) : offer.name}
        </h3>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-brand-sage-50 px-2 py-0.5 text-[10px] font-medium text-brand-sage-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto pt-2 flex items-end justify-between">
          <div>
            <div className="text-lg font-black text-brand-pink-600 leading-none">
              {offer.subscriptionPriceKwd}
              <span className="text-[10px] font-bold text-surface-400 ms-1">KWD</span>
            </div>
            {offer.type === "B" && offer.originalClinicPriceKwd && (
              <div className="text-[10px] text-surface-400 line-through mt-0.5">
                {offer.originalClinicPriceKwd} KWD
              </div>
            )}
          </div>
          {cashback > 0 || perSession > 0 ? (
            <div className="text-end text-[10px] font-semibold text-brand-sage-700 leading-tight">
              {cashback > 0 && (
                <div>+{offer.signupCashbackKwd} {isAr ? "كاش باك" : "cashback"}</div>
              )}
              {perSession > 0 && (
                <div>+{offer.cashbackPerSessionKwd}/{isAr ? "جلسة" : "session"}</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
