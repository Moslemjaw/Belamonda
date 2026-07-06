import { fmtDate } from "../lib/dateFormat";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";

interface PublicCard {
  displayName: string;
  memberSince: string | null;
  kycVerified: boolean;
  activeOfferCount: number;
  activeOfferNames?: string[];
  activeSessionCount: number;
}

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const [card, setCard] = useState<PublicCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setError("Invalid link"); setLoading(false); return; }
    apiFetch(`/public/customer/${token}`)
      .then((d) => { setCard(d as PublicCard); setLoading(false); })
      .catch(() => { setError("Member not found"); setLoading(false); });
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-pink-50 via-white to-surface-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="#F59AB9" opacity="0.9"/>
            <path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="#F59AB9" opacity="0.6"/>
            <path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="#F59AB9" opacity="0.6"/>
          </svg>
          <span className="text-xl font-black text-surface-900">Belamonda</span>
        </div>

        {loading && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="w-10 h-10 border-4 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-surface-500 text-sm">Verifying membership…</p>
          </div>
        )}

        {error && (
          <div className="bg-white rounded-3xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="font-bold text-surface-900 text-lg mb-1">Not Found</h2>
            <p className="text-surface-500 text-sm">{error}</p>
            <Link to="/" className="mt-6 inline-block text-brand-pink-500 font-medium text-sm hover:underline">Return to Belamonda</Link>
          </div>
        )}

        {card && !loading && (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-brand-pink-500 to-brand-pink-700 px-6 py-8 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-brand-pink-200 mb-1">Membership Card</div>
                  <h1 className="text-2xl font-black">{card.displayName}</h1>
                  {card.memberSince && (
                    <div className="text-sm text-brand-pink-200 mt-1">Member since {fmtDate(card.memberSince)}</div>
                  )}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black text-white backdrop-blur-sm">
                  {card.displayName.charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {card.kycVerified ? (
                  <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Identity Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-black/20 text-brand-pink-100 text-xs font-bold px-3 py-1.5 rounded-full">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Verification Pending
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-50 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-brand-pink-600">{card.activeOfferCount}</div>
                  <div className="text-xs font-medium text-surface-500 mt-1">Active Memberships</div>
                </div>
                <div className="bg-surface-50 rounded-2xl p-4 text-center">
                  <div className="text-3xl font-black text-emerald-600">{card.activeSessionCount}</div>
                  <div className="text-xs font-medium text-surface-500 mt-1">Upcoming Sessions</div>
                </div>
              </div>

              {card.activeOfferNames && card.activeOfferNames.length > 0 && (
                <div className="bg-surface-50 rounded-2xl p-4">
                  <div className="text-xs font-bold text-surface-400 uppercase tracking-wider mb-2 text-center">Membership Packages</div>
                  <div className="flex flex-col gap-2">
                    {card.activeOfferNames.map((name, i) => (
                      <div key={i} className="bg-white border border-surface-100 rounded-xl px-3 py-2 text-sm font-bold text-surface-800 text-center">
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-surface-100 flex items-center justify-between">
                <div className="text-xs text-surface-400">Verified by Belamonda · Kuwait</div>
                <svg width="20" height="20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M40 10C40 10 25 25 25 40C25 48 32 55 40 55C48 55 55 48 55 40C55 25 40 10 40 10Z" fill="#F9B8CC" opacity="0.9"/>
                  <path d="M20 25C20 25 15 38 20 48C24 56 32 55 40 55C32 55 18 50 20 25Z" fill="#F9B8CC" opacity="0.6"/>
                  <path d="M60 25C60 25 65 38 60 48C56 56 48 55 40 55C48 55 62 50 60 25Z" fill="#F9B8CC" opacity="0.6"/>
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
