// Helpers, constants and small components shared by the CustomerDashboard tabs.
import i18n from "../../../app/i18n";

export type ApiOfferRow = {
  id: string;
  _id?: string;
  name: string;
  subtitle?: string;
  originalClinicPriceKwd?: string;
  type: "A" | "B";
  category: string;
  clinicId: string;
  subscriptionPriceKwd: string;
  maxSessions?: number;
  active: boolean;
  allowFullPayment?: boolean;
  allowInstallments?: boolean;
  maxInstallments?: number;
  allowDeposit?: boolean;
  depositAmountKwd?: string;
  signupCashbackKwd?: string;
  cashbackPerSessionKwd?: string;
  isCashbackOnly?: boolean;
  isGroupOffer?: boolean;
  groupSizeRequired?: number;
  groupRewardType?: string;
  groupRewardValue?: string;
};

export const ar = () => i18n.language === "ar";

export function computeOfferCashbackParts(o: {
  cashbackBalanceKwd?: string;
  totalSignupCashbackKwd?: string;
  cashbackGrantedKwd?: string;
  signupCashbackKwd?: string;
}) {
  const remainingCb = parseFloat(o.cashbackBalanceKwd || "0");
  const totalSignup = parseFloat(o.totalSignupCashbackKwd || o.signupCashbackKwd || "0");
  const granted = parseFloat(o.cashbackGrantedKwd || "0");
  if (totalSignup > 0) {
    return {
      unlocked: remainingCb,
      locked: Math.max(0, totalSignup - granted),
      total: totalSignup,
      hasInstallmentTracking: true,
    };
  }
  return {
    unlocked: remainingCb,
    locked: 0,
    total: remainingCb,
    hasInstallmentTracking: false,
  };
}

export function CashbackProgressBar({ unlocked, locked }: { unlocked: number; locked: number }) {
  const total = unlocked + locked;
  const pct = total > 0 ? Math.min((unlocked / total) * 100, 100) : 0;
  return (
    <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const CustomerIcons = {
  home: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  offers: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>,
  wallet: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  profile: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>,
  help: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0 9 9 0 0112.728 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01M11 13a1 1 0 011-1 2 2 0 10-2-2"/></svg>,
  card: <svg className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>,
};

export type EFormPending = { id?: string; formId?: string; title: string };
