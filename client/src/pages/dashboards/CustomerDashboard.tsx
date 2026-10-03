import { fmtDate, fmtDateTime } from "../../lib/dateFormat";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { type ReservationItem } from "../../hooks/useApi";
import { invalidateCache } from "../../hooks/useApi";
import { apiFetch, SITE_BASE_URL } from "../../lib/api";
import i18n from "../../app/i18n";
import { BelamondaLogo } from "../../components/BelamondaLogo";
import { allTreatments } from "../../lib/treatments";
import CheckoutModal from "../../components/CheckoutModal";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReservationConvertControls } from "./customer/ReservationConvertControls";
import { SessionPaymentRow } from "./customer/SessionPaymentRow";
import { KycVerificationPage } from "./customer/KycVerificationPage";
import { MyFormsSection } from "./customer/MyFormsSection";
import { ar, CustomerIcons, EFormPending } from "./customer/shared";
import { useCustomerDashboard } from "./customer/useCustomerDashboard";
import { PurchasesPackagesTab } from "./customer/PurchasesPackagesTab";
import { PurchasesReservationsTab } from "./customer/PurchasesReservationsTab";
import { StoreTab } from "./customer/StoreTab";
import { OverviewTab } from "./customer/OverviewTab";
import { WalletCashbackTab } from "./customer/WalletCashbackTab";
import { WalletHistoryTab } from "./customer/WalletHistoryTab";
import { ProfileSettingsTab } from "./customer/ProfileSettingsTab";
import { WalletCardTab } from "./customer/WalletCardTab";
import { ComplaintsTab } from "./customer/ComplaintsTab";
import { SubscriptionTab } from "./customer/SubscriptionTab";

export default function CustomerDashboard() {
  const s = useCustomerDashboard();
  const { navigate, t, auth, logout, getAuthHeader, activeTab, setActiveTab, isMobileMenuOpen, setIsMobileMenuOpen, purchasesSubTab, setPurchasesSubTab, walletSubTab, setWalletSubTab, profileSubTab, setProfileSubTab, showKyc, setShowKyc, chatConvId, setChatConvId, selectedPkg, setSelectedPkg, checkoutPkg, setCheckoutPkg, pendingInviteCode, setPendingInviteCode, copiedCode, setCopiedCode, groupModal, setGroupModal, isBookingSubmitting, setIsBookingSubmitting, offersData, refetchMyOffers, reservationsData, refetchReservations, refetchMySessions, notifData, refetchChats, clinicsPublic, myRequestsData, refetchMyRequests, unsignedForms, unsignedBannerDismissed, setUnsignedBannerDismissed, clinicsById, homeCatalogData, selectedClinic, setSelectedClinic, showChangeClinicModal, setShowChangeClinicModal, newClinicSelection, setNewClinicSelection, standaloneSessions, dynamicTreatments, sessions, refetchClinicChanges, sysAlert, setSysAlert, showBookingModal, setShowBookingModal, showBookingPromptModal, setShowBookingPromptModal, showClinicHandlesPrompt, setShowClinicHandlesPrompt, paymentOption, setPaymentOption, installments, setInstallments, bookFirstSession, setBookFirstSession, selectedFirstSession, setSelectedFirstSession, selectedFirstClinic, setSelectedFirstClinic, kycStatus, requireKyc, attemptCheckout, displayName, wallet, offers, unreadNotifs, unreadChats } = s;
  if (showKyc) {
    return <KycVerificationPage onComplete={() => setShowKyc(false)} onCancel={() => setShowKyc(false)} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-surface-50 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] lg:pb-0 flex flex-col lg:flex-row overflow-x-hidden">
      
      {/* Mobile Header */}
      <header className="lg:hidden bg-white/90 backdrop-blur-md px-4 pb-3.5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] flex items-center justify-between sticky top-0 z-30 border-b border-surface-100/80 supports-[backdrop-filter]:bg-white/75">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-sm shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-surface-500 leading-tight">{ar() ? "مرحباً،" : "Hello,"}</div>
            <div className="text-sm font-bold text-surface-900 leading-snug truncate">{displayName}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => i18n.changeLanguage(ar() ? "en" : "ar")} className="w-10 h-10 flex items-center justify-center text-sm font-bold text-brand-pink-600 rounded-lg hover:bg-brand-pink-50">
            {ar() ? "EN" : "ع"}
          </button>
          <button
            type="button"
            className="relative w-10 h-10 flex items-center justify-center rounded-lg text-surface-600 hover:bg-surface-50"
            aria-label={ar() ? "محادثة مباشرة" : "Live Chat"}
            onClick={() => { setChatConvId(undefined); setActiveTab("chat"); }}
          >
            <svg className="w-5 h-5 transition-colors text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            {unreadChats > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-brand-pink-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold ring-2 ring-white">{unreadChats > 9 ? '9+' : unreadChats}</span>}
          </button>
          <button
            type="button"
            className="relative w-10 h-10 flex items-center justify-center rounded-lg text-surface-600 hover:bg-surface-50"
            aria-label={ar() ? "الإشعارات" : "Notifications"}
            onClick={() => {
              setActiveTab("profile");
              setProfileSubTab("notifications");
              setTimeout(() => {
                const el = document.getElementById("sec-notifications");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 120);
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
            {unreadNotifs > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />}
          </button>
        </div>
      </header>

      {/* Mobile KYC Banners (visible only on lg:hidden) */}
      <div className="lg:hidden px-4 pt-4 -mb-2">
        {kycStatus === "unverified" && (
          <div className="bg-brand-pink-50 border border-brand-pink-200 rounded-xl px-4 py-3 shadow-sm flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-pink-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-brand-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="min-w-0">
                <div className="text-surface-900 font-bold text-sm truncate">{ar() ? "استكمال التوثيق مطلوب" : "Verification Required"}</div>
                <div className="text-surface-600 text-[11px] leading-tight mt-0.5">{ar() ? "أكملي التوثيق لتفعيل الدفع والكاش باك." : "Complete verification to enable payments."}</div>
              </div>
            </div>
            <button className="bg-brand-pink-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm hover:bg-brand-pink-700 transition-colors w-full" onClick={() => setShowKyc(true)}>
              {ar() ? "تحديث الآن" : "Update Profile"}
            </button>
          </div>
        )}
        {kycStatus === "pending" && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
            <svg className="w-6 h-6 text-blue-500 animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
            <div className="min-w-0">
              <div className="text-surface-900 font-bold text-sm truncate">{ar() ? "التحقق قيد المراجعة" : "Under Review"}</div>
              <div className="text-surface-600 text-[11px] leading-tight mt-0.5">{ar() ? "يرجى الانتظار لحين اعتماد بياناتك." : "Please wait for approval."}</div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Sidebar (Optional, but kept minimal to feel like an app menu) */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-surface-200 flex-col sticky top-0 h-screen z-30 overflow-y-auto">
        <div className="p-6 pb-2 border-b border-surface-100 flex items-center">
          <BelamondaLogo size={40} />
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-lg">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-surface-900">{displayName}</div>
              <div className="text-xs text-surface-500">{ar() ? "عضو" : "Member"}</div>
            </div>
          </div>
          <nav className="space-y-1">
            {[
              { tab: "overview", sub: "", label: ar() ? "الرئيسية" : "Home", icon: CustomerIcons.home, color: "text-brand-pink-600", bg: "bg-brand-pink-50" },
              { tab: "store", sub: "", label: ar() ? "تصفح العضويات" : "Memberships", icon: CustomerIcons.offers, color: "text-indigo-600", bg: "bg-indigo-50" },
              { tab: "my-purchases", sub: "", label: ar() ? "حجوزاتي" : "Bookings", icon: CustomerIcons.wallet, color: "text-cyan-600", bg: "bg-cyan-50" },
              { tab: "wallet", sub: "", label: ar() ? "المحفظة" : "Wallet", icon: CustomerIcons.card, color: "text-purple-600", bg: "bg-purple-50" },
              { tab: "subscription", sub: "", label: ar() ? "الاشتراك" : "Subscription", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.4-6.3-4.8-6.3 4.8 2.3-7.4-6-4.6h7.6z"/></svg>, color: "text-amber-600", bg: "bg-gradient-to-br from-amber-100 to-amber-50" },
            ].map((item, idx) => {
              const isActive = activeTab === item.tab;
              return (
                <button
                  key={idx}
                  onClick={() => setActiveTab(item.tab)}
                  className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-2xl transition-all text-left ${isActive ? "bg-surface-50 shadow-sm ring-1 ring-surface-200" : "hover:bg-surface-50"}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className={`flex-1 font-bold ${isActive ? "text-surface-900" : "text-surface-600"}`}>
                    {item.label}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Menu Section */}
          <div className="mt-6">
            <div className="px-3 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-surface-400">{ar() ? "القائمة" : "Menu"}</span>
            </div>
            <nav className="space-y-1">
              {[
                { tab: "profile", sub: "settings", label: ar() ? "إعدادات الحساب" : "Profile Settings", icon: CustomerIcons.profile, color: "text-surface-600", bg: "bg-surface-100" },
                { tab: "profile", sub: "forms", label: ar() ? "نماذجي الطبية" : "Medical E-Forms", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>, color: "text-emerald-600", bg: "bg-emerald-50" },
                { tab: "profile", sub: "notifications", label: ar() ? "الإشعارات" : "Notifications", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>, color: "text-amber-600", bg: "bg-amber-50" },
                { tab: "profile", sub: "share", label: ar() ? "شارك واربح" : "Share & Earn", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>, color: "text-blue-600", bg: "bg-blue-50" },
                { tab: "profile", sub: "complaints", label: ar() ? "المساعدة والشكاوى" : "Help & Support", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>, color: "text-surface-600", bg: "bg-surface-100" },
              ].map((item, idx) => {
                const isActive = activeTab === item.tab && profileSubTab === item.sub;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveTab(item.tab);
                      if (item.sub && item.tab === "profile") setProfileSubTab(item.sub as any);
                    }}
                    className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-2xl transition-all text-left ${isActive ? "bg-surface-50 shadow-sm ring-1 ring-surface-200" : "hover:bg-surface-50"}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                      {item.icon}
                    </div>
                    <div className={`flex-1 font-bold ${isActive ? "text-surface-900" : "text-surface-600"}`}>
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
        <div className="mt-auto p-6 border-t border-surface-100">
          <button onClick={logout} className="flex items-center gap-3 text-red-500 font-medium px-4 py-2 hover:bg-red-50 rounded-xl w-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            {t("logout")}
          </button>
        </div>
      </aside>

      {/* Main App Content — min-w-0 prevents flex overflow; inner max-width keeps lines readable on ultrawide */}
      <main className="flex-1 min-w-0 w-full max-w-2xl mx-auto sm:max-w-3xl lg:max-w-none animate-fade-in relative">

        {/* ── Desktop unified hero header ── */}
        {(() => {
          const isLight = kycStatus !== "unverified" && kycStatus !== "pending";
          const titleCls = isLight ? "text-surface-900" : "text-white";
          const dateCls  = isLight ? "text-surface-500" : "text-white/60";
          const iconCls  = isLight ? "text-surface-500 group-hover:text-brand-pink-600" : "text-white/70 group-hover:text-white";
          const langCls  = isLight ? "text-surface-600 hover:text-brand-pink-600 hover:bg-white" : "text-white/70 hover:text-white hover:bg-white/10";
          const hoverBgCls = isLight ? "hover:bg-white" : "hover:bg-white/10";
          const avatarCls = isLight ? "bg-brand-pink-100 text-brand-pink-600 hover:bg-brand-pink-200" : "bg-white/20 backdrop-blur-sm border border-white/30 text-white hover:bg-white/30";
        return (
        <div className="hidden lg:block relative overflow-hidden">
          {/* gradient background that spans greeting + any status banner */}
          <div className={`relative ${kycStatus === "unverified" ? "bg-brand-gradient" : kycStatus === "pending" ? "bg-gradient-to-r from-blue-500 to-blue-400" : "bg-gradient-to-br from-brand-pink-50 via-white to-brand-sage-50"} px-4 sm:px-8 lg:px-10 pt-6 pb-0 border-b border-surface-100`}>
            {/* subtle bokeh blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className={`absolute -top-12 -right-12 w-64 h-64 rounded-full blur-3xl ${isLight ? "bg-brand-pink-200/40" : "bg-white/10"}`} />
              <div className={`absolute top-4 right-40 w-32 h-32 rounded-full blur-2xl ${isLight ? "bg-brand-sage-200/40" : "bg-white/5"}`} />
            </div>

            {/* top strip: greeting + action icons */}
            <div className="relative z-10 flex items-center justify-between mb-5">
              <div>
                <div className={`${dateCls} text-xs font-bold uppercase tracking-widest mb-0.5`}>
                  {fmtDate(new Date())}
                </div>
                <div className={`text-2xl font-black ${titleCls} leading-tight`}>
                  {ar() ? "مرحباً" : "Welcome back"}{displayName !== "—" ? `, ${displayName}` : ''} 👋
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => i18n.changeLanguage(ar() ? "en" : "ar")} className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-colors ${langCls}`}>
                  {ar() ? "EN" : "ع"}
                </button>
                <button onClick={() => { setChatConvId(undefined); setActiveTab("chat"); }} className={`relative p-2 rounded-xl transition-colors group ${hoverBgCls}`} title={ar() ? "محادثة مباشرة" : "Live Chat"}>
                  <svg className={`w-5 h-5 transition-colors ${iconCls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  {unreadChats > 0 && <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-brand-pink-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">{unreadChats > 9 ? '9+' : unreadChats}</span>}
                </button>
                <button onClick={() => { setActiveTab("profile"); setTimeout(() => { const el = document.getElementById("sec-notifications"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100); }} className={`relative p-2 rounded-xl transition-colors group ${hoverBgCls}`} title={ar() ? "الإشعارات" : "Notifications"}>
                  <svg className={`w-5 h-5 transition-colors ${iconCls}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                  {unreadNotifs > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />}
                </button>
                <button onClick={() => setActiveTab("profile")} className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ms-1 ${avatarCls}`}>
                  {(displayName !== "—" ? displayName : "?").charAt(0).toUpperCase()}
                </button>
              </div>
            </div>

            {/* status message row inside the gradient zone */}
            {(kycStatus === "unverified" || kycStatus === "rejected") && (
              <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 mb-0 border border-white/20">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm">{ar() ? "استكمال التوثيق مطلوب" : "Action Required: Complete Verification"}</div>
                    <div className="text-white/75 text-xs mt-0.5">{ar() ? "أكملي التوثيق لتفعيل الدفع وشراء الباقات والكاش باك." : "Complete verification to enable payments, packages, and cashback."}</div>
                  </div>
                </div>
                <button className="shrink-0 w-full sm:w-auto bg-white text-brand-pink-600 font-bold px-5 py-2.5 rounded-xl text-sm shadow-sm hover:scale-[1.02] transition-transform whitespace-nowrap text-center" onClick={() => setActiveTab("profile")}>
                  {ar() ? "تحديث الآن" : "Update Profile"}
                </button>
              </div>
            )}
            {kycStatus === "pending" && (
              <div className="relative z-10 flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 mb-0 border border-white/20">
                <svg className="w-5 h-5 text-white animate-spin shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                <div>
                  <div className="text-white font-bold text-sm">{ar() ? "التحقق قيد المراجعة" : "Verification Under Review"}</div>
                  <div className="text-white/75 text-xs mt-0.5">{ar() ? "يرجى الانتظار لحين اعتماد بياناتك." : "Please wait while management approves your submission."}</div>
                </div>
              </div>
            )}

            {/* curved bottom edge that blends into the page bg */}
            <div className="h-8 bg-surface-50 rounded-t-[2rem] mt-6 -mb-px" />
          </div>
        </div>
        ); })()}

        {/* Content based on tab */}
        <div className="px-3 py-3 sm:p-4 lg:px-8 lg:pb-8 bg-surface-50 min-h-[calc(100dvh-12rem)] lg:min-h-[calc(100vh-200px)]">
          
        {activeTab === "store" && <StoreTab s={s} />}

        {/* Horizontal tabs for Wallet */}
        {activeTab === "wallet" && (() => {
          const hasActiveMembership = offers.some(o => o.status === "active");
          const allItems = [
            { id: "cashback", label: ar() ? "محفظة الكاش باك" : "Cashback", icon: "💎" },
            { id: "history",  label: ar() ? "سجل المدفوعات"   : "History", icon: "🧾" },
            { id: "card",     label: ar() ? "بطاقتي الرقمية"  : "Digital Card", icon: "🪪" },
          ];
          const items = hasActiveMembership ? allItems : allItems.filter(i => i.id !== "card");
          return (
            <div className="mb-4 sm:mb-6 sticky top-[calc(env(safe-area-inset-top,0px)+3.25rem)] z-20 lg:static lg:z-auto pt-3 sm:pt-4 py-1.5 px-3 sm:px-0 bg-surface-50/95 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none transition-all">
              <div className="flex bg-surface-200/60 p-1.5 rounded-[16px] max-w-md mx-auto shadow-inner border border-surface-200/30">
                {items.map(it => {
                  const isActive = walletSubTab === it.id;
                  return (
                    <button
                      key={it.id}
                      onClick={() => setWalletSubTab(it.id as any)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-[12px] text-xs font-bold transition-all duration-300 relative ${isActive ? "text-surface-900 shadow-sm bg-white" : "text-surface-500 hover:text-surface-700 hover:bg-surface-200/50"}`}
                    >
                      <span aria-hidden="true" className="text-sm">{it.icon}</span>
                      <span className="truncate">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {activeTab === "overview" && <OverviewTab s={s} />}

          {activeTab === "my-purchases" && (() => {
            const purchaseTabs = [
              { id: "packages",     label: ar() ? "باقاتي وجلساتي"    : "Packages",   icon: "📦" },
              { id: "reservations", label: ar() ? "حجوزات العربون"   : "Reservations",  icon: "📌" },
            ] as const;
            return (
              <div className="mb-4 sm:mb-6 sticky top-[calc(env(safe-area-inset-top,0px)+2.75rem)] z-20 lg:static lg:z-auto pt-3 sm:pt-4 py-1.5 px-3 sm:px-0 bg-surface-50/95 backdrop-blur-xl lg:bg-transparent lg:backdrop-blur-none transition-all">
                <div className="flex bg-surface-200/60 p-1.5 rounded-[16px] max-w-md mx-auto shadow-inner border border-surface-200/30">
                  {purchaseTabs.map(pt => {
                    const isActive = purchasesSubTab === pt.id;
                    return (
                      <button
                        key={pt.id}
                        onClick={() => setPurchasesSubTab(pt.id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-[12px] text-xs font-bold transition-all duration-300 relative ${isActive ? "text-surface-900 shadow-sm bg-white" : "text-surface-500 hover:text-surface-700 hover:bg-surface-200/50"}`}
                      >
                        <span aria-hidden="true" className="text-sm">{pt.icon}</span>
                        <span className="truncate">{pt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {activeTab === "my-purchases" && purchasesSubTab === "packages" && <PurchasesPackagesTab s={s} />}

          {activeTab === "chat" && (
            <section id="sec-chat" className="space-y-4 animate-fade-in scroll-mt-24">
              <div>
                <h2 className="text-2xl font-bold text-surface-900">{ar() ? "المحادثات" : "Conversations"}</h2>
                <p className="text-sm text-surface-500 mt-1">
                  {ar() ? "تواصل مع العيادة وخدمة العملاء لتأكيد المواعيد." : "Coordinate with your clinic and customer relations to confirm appointments."}
                </p>
              </div>
              <ChatWidget conversationId={chatConvId} onRead={() => refetchChats()} mobileBottomPadding={true} />
            </section>
          )}

          {activeTab === "wallet" && walletSubTab === "cashback" && <WalletCashbackTab s={s} />}

          {activeTab === "wallet" && walletSubTab === "history" && <WalletHistoryTab s={s} />}

          {activeTab === "profile" && profileSubTab === "settings" && <ProfileSettingsTab s={s} />}

          {activeTab === "my-purchases" && purchasesSubTab === "reservations" && <PurchasesReservationsTab s={s} />}

          {activeTab === "wallet" && walletSubTab === "card" && offers.some(o => o.status === "active") && <WalletCardTab s={s} />}


          {activeTab === "profile" && profileSubTab === "forms" && (
            <section id="sec-forms" className="animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-2xl bg-violet-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "نماذجي الموقعة" : "My Signed Forms"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "وثائق ونماذج الموافقة الخاصة بك" : "Your consent documents and agreements"}</p>
                </div>
              </div>
              <MyFormsSection />
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "notifications" && (
            <section id="sec-notifications" className="space-y-4 animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-2xl bg-brand-pink-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "الإشعارات" : "Notifications"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "تحديثات وتنبيهات الحساب" : "Account updates and alerts"}</p>
                </div>
              </div>
              <div className="bg-white rounded-3xl border border-surface-200 overflow-hidden shadow-sm">
                {(notifData?.inbox || []).length === 0 ? (
                  <div className="py-14 px-6 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                    </div>
                    <p className="font-bold text-surface-700 mb-1">{ar() ? "لا توجد إشعارات حالياً" : "All caught up!"}</p>
                    <p className="text-sm text-surface-400">{ar() ? "ستصلك إشعاراتك هنا عند وجودها" : "Notifications will appear here when there's something new"}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-100">
                    {(notifData?.inbox || []).map((n: any) => (
                      <div key={n.id} className={`p-4 flex items-start gap-4 hover:bg-surface-50 transition-colors ${!n.read ? "bg-brand-pink-50/30" : ""}`}>
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${n.read ? "bg-surface-200" : "bg-brand-pink-500"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-surface-900 text-sm">{n.title || n.type}</div>
                          {n.body && <div className="text-xs text-surface-500 mt-0.5 leading-relaxed">{n.body}</div>}
                          <div className="text-[10px] text-surface-400 mt-1">{fmtDate(n.createdAt)}</div>
                          {n.type === "form_signature_required" && n.actionUrl && (
                            <button
                              className="mt-2 text-xs font-bold text-white bg-brand-pink-500 hover:bg-brand-pink-600 px-3 py-1.5 rounded-xl transition-colors"
                              onClick={() => navigate(n.actionUrl)}
                            >
                              {ar() ? "توقيع النموذج" : "Sign now"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "share" && (
            <section id="sec-share" className="animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "رابط الإحالة" : "Referral & Share Link"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "شاركي بيلاموندو واكسبي مكافآت" : "Share Belamonda and earn rewards"}</p>
                </div>
              </div>
              <ShareLinkPage hideHeader />
            </section>
          )}

          {activeTab === "profile" && profileSubTab === "complaints" && <ComplaintsTab s={s} />}

          {activeTab === "subscription" && <SubscriptionTab s={s} />}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-5 inset-x-4 bg-white/95 backdrop-blur-xl border border-surface-200/60 rounded-3xl p-1.5 flex justify-between items-center z-40 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
        {/* Left Side */}
        <div className="flex items-center flex-1 justify-around">
          <button onClick={() => setActiveTab("overview")} className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${activeTab === "overview" ? "text-brand-pink-500 font-bold" : "text-surface-400 hover:text-surface-600"}`}>
            <div className={`transition-transform duration-200 ${activeTab === "overview" ? "scale-110" : "scale-100"}`}>{CustomerIcons.home}</div>
            <span className="text-[10px] font-medium leading-none">{ar() ? "الرئيسية" : "Home"}</span>
          </button>
          <button onClick={() => setActiveTab("my-purchases")} className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${activeTab === "my-purchases" ? "text-brand-pink-500 font-bold" : "text-surface-400 hover:text-surface-600"}`}>
            <div className={`transition-transform duration-200 ${activeTab === "my-purchases" ? "scale-110" : "scale-100"}`}>{CustomerIcons.wallet}</div>
            <span className="text-[10px] font-medium leading-none">{ar() ? "حجوزاتي" : "Bookings"}</span>
          </button>
        </div>

        {/* Center PRO Button */}
        <div className="relative px-2 -mt-6">
          <button onClick={() => setActiveTab("subscription")} className="relative group w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-glow border-4 border-white/90 backdrop-blur-sm transition-transform duration-300 active:scale-90 hover:shadow-glow-lg animate-pulse-glow">
            <svg className="w-7 h-7 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.4-6.3-4.8-6.3 4.8 2.3-7.4-6-4.6h7.6z"/></svg>
            <span className="absolute -bottom-5 text-[9px] font-black tracking-wider text-brand-pink-600">PRO</span>
          </button>
        </div>

        {/* Right Side */}
        <div className="flex items-center flex-1 justify-around">
          <button onClick={() => setActiveTab("wallet")} className={`flex flex-col items-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 ${activeTab === "wallet" ? "text-brand-pink-500 font-bold" : "text-surface-400 hover:text-surface-600"}`}>
            <div className={`transition-transform duration-200 ${activeTab === "wallet" ? "scale-110" : "scale-100"}`}>{CustomerIcons.card}</div>
            <span className="text-[10px] font-medium leading-none">{ar() ? "المحفظة" : "Wallet"}</span>
          </button>
          <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1 flex-1 py-1 transition-all duration-200 active:scale-95 text-surface-400 hover:text-surface-600">
            <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
            <span className="text-[10px] font-medium leading-none">{ar() ? "القائمة" : "Menu"}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer Portal */}
      {isMobileMenuOpen && createPortal(
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative bg-white rounded-t-3xl w-full max-h-[85vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] animate-slide-up-sheet">
            <div className="flex justify-center pt-3 pb-2" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-12 h-1.5 bg-surface-200 rounded-full" />
            </div>
            <div className="px-6 py-2 border-b border-surface-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-surface-900 tracking-tight">Belamonda</h3>
                <p className="text-xs text-surface-500 font-medium">{(auth as any)?.displayName || "Guest"}</p>
              </div>
              <button className="icon-btn rounded-full" onClick={() => setIsMobileMenuOpen(false)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="overflow-y-auto px-4 py-4 space-y-2 pb-safe">
              {[
                { tab: "store", sub: "", label: ar() ? "تصفح العضويات" : "Memberships & Store", icon: CustomerIcons.offers, color: "text-indigo-600", bg: "bg-indigo-50" },
                { tab: "profile", sub: "settings", label: ar() ? "إعدادات الحساب" : "Profile Settings", icon: CustomerIcons.profile, color: "text-brand-pink-600", bg: "bg-brand-pink-50" },
                { tab: "profile", sub: "forms", label: ar() ? "نماذجي الطبية" : "Medical E-Forms", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>, color: "text-emerald-600", bg: "bg-emerald-50" },
                { tab: "profile", sub: "notifications", label: ar() ? "الإشعارات" : "Notifications", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>, color: "text-amber-600", bg: "bg-amber-50" },
                { tab: "profile", sub: "share", label: ar() ? "شارك واربح" : "Share & Earn", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>, color: "text-blue-600", bg: "bg-blue-50" },
                { tab: "profile", sub: "complaints", label: ar() ? "المساعدة والشكاوى" : "Help & Support", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>, color: "text-surface-600", bg: "bg-surface-100" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setActiveTab(item.tab);
                    if (item.sub && item.tab === "profile") setProfileSubTab(item.sub as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white hover:bg-surface-50 border border-transparent hover:border-surface-200 transition-all text-left active:scale-[0.98]"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.bg} ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 font-bold text-surface-900">{item.label}</div>
                  <svg className="w-5 h-5 text-surface-300 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
              <div className="h-px bg-surface-100 my-4" />
              <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-white hover:bg-red-50 group transition-all text-left active:scale-[0.98]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-50 text-red-600 group-hover:bg-red-100">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                <div className="flex-1 font-bold text-red-600">{t("logout")}</div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Package Checkout Modal */}
      {selectedPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-slide-up relative">
            <button className="absolute top-6 right-6 text-surface-400 hover:text-surface-900 transition-colors" onClick={() => setSelectedPkg(null)}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-black text-surface-900 mb-6">{ar() ? "تأكيد العضوية" : "Confirm Membership"}</h3>
            
            <div className="bg-white p-5 rounded-2xl border border-surface-200 mb-8 shadow-sm">
               <div className="font-bold text-surface-900 text-[15px]">{selectedPkg.title}</div>
               <div className="text-brand-pink-500 font-black text-xl mt-1.5">{selectedPkg.price}</div>
            </div>

            {selectedPkg.category === "laser" && (
               <div className="mb-6">
                  <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "اختر العيادة (مخصصة لهذا العرض)" : "Select Clinic (Restricted to this offer)"}</label>
                  <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedClinic} onChange={e => setSelectedClinic(e.target.value)}>
                     <option value="" disabled>{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                     {(clinicsPublic?.items || []).map(c => <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>)}
                  </select>
                  <p className="text-[10px] text-brand-pink-500 mt-2 font-medium">{ar() ? "ملاحظة: تغيير العيادة لاحقاً يتطلب دفع رسوم إدارية بقيمة 10 د.ك" : "Note: Changing the clinic later requires a 10 KD administrative fee."}</p>
                  
                  <label className="flex items-center gap-3 mt-4 p-3 bg-brand-pink-50 rounded-xl cursor-pointer">
                     <input type="checkbox" checked={bookFirstSession} onChange={e => setBookFirstSession(e.target.checked)} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300 rounded" />
                     <span className="font-bold text-surface-900 text-sm">{ar() ? "حجز الجلسة الأولى فوراً" : "Book first session immediately"}</span>
                  </label>
               </div>
            )}

            {selectedPkg.category !== "laser" && (
               <div className="mb-6 space-y-4">
                  <div>
                     <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "اختر الخدمة لحجز الموعد الأول (اختياري)" : "Select First Session (Optional)"}</label>
                     <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedFirstSession} onChange={e => setSelectedFirstSession(e.target.value)}>
                        <option value="">{ar() ? "-- حجز لاحقاً --" : "-- Book Later --"}</option>
                        {allTreatments.filter(t => t.category !== "laser" && t.category !== "dental").map(t => (
                           <option key={t.id} value={t.id}>{ar() ? t.nameAr : t.nameEn}</option>
                        ))}
                     </select>
                  </div>
                  {selectedFirstSession && (
                     <div className="animate-fade-in">
                        <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "العيادة المفضلة" : "Preferred Clinic"}</label>
                        <select className="select-field w-full bg-surface-50 border-surface-200" value={selectedFirstClinic} onChange={e => setSelectedFirstClinic(e.target.value)}>
                           <option value="" disabled>{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                           {(clinicsPublic?.items || []).filter(c => allTreatments.find(t => t.id === selectedFirstSession)?.clinicIds.includes(c.id) || allTreatments.find(t => t.id === selectedFirstSession)?.clinicIds.length === 0).map(c => (
                              <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
                           ))}
                        </select>
                     </div>
                  )}
               </div>
            )}

            <div className="space-y-3 mb-8 hidden">
               <label className="text-xs font-bold text-surface-900 block mb-3 uppercase tracking-wide">{ar() ? "خيارات الدفع" : "Payment Options"}</label>
               
               {selectedPkg.allowFullPayment && (
                  <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${paymentOption === "full" ? "border-brand-pink-200 bg-brand-pink-50/30" : "border-surface-200 hover:bg-surface-50"}`}>
                     <input type="radio" name="payOpt" checked={paymentOption === "full"} onChange={() => setPaymentOption("full")} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300" />
                     <span className="font-bold text-surface-900 text-sm">{ar() ? "دفع كامل" : "Full Payment"}</span>
                  </label>
               )}

               {selectedPkg.allowInstallments && (
                  <label className={`flex items-center justify-between p-4 border rounded-2xl cursor-pointer transition-colors ${paymentOption === "installments" ? "border-brand-pink-200 bg-brand-pink-50/30" : "border-surface-200 hover:bg-surface-50"}`}>
                     <div className="flex items-center gap-4">
                        <input type="radio" name="payOpt" checked={paymentOption === "installments"} onChange={() => setPaymentOption("installments")} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300" />
                        <span className="font-bold text-surface-900 text-sm">{ar() ? "دفع بالأقساط" : "Pay in Installments"}</span>
                     </div>
                     {paymentOption === "installments" && (
                        <select className="bg-white border border-brand-pink-300 text-surface-700 text-sm rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-pink-400/50 min-w-[110px]" value={installments} onChange={e => setInstallments(Number(e.target.value))}>
                           {[...Array((selectedPkg.maxInstallments || 2) - 1)].map((_, i) => (
                              <option key={i} value={i + 2}>{i + 2} {ar() ? "دفعات" : "Payments"}</option>
                           ))}
                        </select>
                     )}
                  </label>
               )}

               {selectedPkg.allowDeposit && (
                  <label className={`flex items-center gap-4 p-4 border rounded-2xl cursor-pointer transition-colors ${paymentOption === "deposit" ? "border-brand-pink-200 bg-brand-pink-50/30" : "border-surface-200 hover:bg-surface-50"}`}>
                     <input type="radio" name="payOpt" checked={paymentOption === "deposit"} onChange={() => setPaymentOption("deposit")} className="text-brand-pink-500 w-4 h-4 focus:ring-brand-pink-400 border-surface-300" />
                     <span className="font-bold text-surface-900 text-sm">{ar() ? `دفع عربون مقدم (${selectedPkg.depositAmount} KWD)` : `Pay Deposit Upfront (${selectedPkg.depositAmount} KWD)`}</span>
                  </label>
               )}
            </div>

            <button
              className="bg-brand-pink-400 hover:bg-brand-pink-500 text-white font-bold w-full rounded-2xl py-3.5 transition-colors shadow-sm"
              onClick={() => {
                if (!requireKyc()) {
                   return;
                }
                attemptCheckout(selectedPkg);
                setSelectedPkg(null);
              }}
            >
               {ar() ? "متابعة للدفع" : "Continue to Payment"}
            </button>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
            <button className="absolute top-4 right-4 text-surface-400 hover:text-surface-900" onClick={() => setShowBookingModal(null)}>
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "حجز جلستك" : "Book Your Session"}</h3>
            <p className="text-sm text-surface-500 mb-6">{ar() ? "راجع تفاصيل الحجز واختر العيادة المفضلة لتأكيد الموعد." : "Review your booking details and select your preferred clinic to confirm."}</p>
            
            <div className="bg-surface-50 border border-surface-200 rounded-xl p-4 mb-5 space-y-3">
               <div className="text-xs text-surface-500 mb-1">{ar() ? "الخدمة / الباقة المختارة" : "Selected Service / Package"}</div>
               <div className="font-bold text-surface-900">{showBookingModal.treatmentName || showBookingModal.offerName || showBookingModal.offerId || "Booking"}</div>
               {(() => {
                 const baseOffer = homeCatalogData?.items?.find((o: any) => o.id === showBookingModal.offerId) || showBookingModal;
                 const overrides = baseOffer?.branchSessionPrices || baseOffer?.clinicOverrides || [];
                 const currentClinicId = showBookingModal.clinicId;
                 const activeOverride = overrides.find((b: any) => b.clinicId === currentClinicId);
                 const effectiveBasePrice = activeOverride && parseFloat(activeOverride.sessionPriceKwd) > 0
                    ? parseFloat(activeOverride.sessionPriceKwd)
                    : parseFloat(showBookingModal.priceKwd) || 0;
                 const actualDiscountPct = showBookingModal.discountPct || 0;
                 const effectiveFinalPrice = +(effectiveBasePrice - (actualDiscountPct > 0 ? effectiveBasePrice * actualDiscountPct / 100 : 0)).toFixed(3);

                 const relatedOffer = showBookingModal.applicableCashbackOfferId ? offers.find(o => o.id === showBookingModal.applicableCashbackOfferId) : null;
                 
                 const basePrice = effectiveBasePrice;
                 const finalPrice = effectiveFinalPrice;
                 const discountAmt = Math.max(0, basePrice - finalPrice);
                 
                 // If paying with a package cashback wallet
                 if (relatedOffer && parseFloat(relatedOffer.cashbackBalanceKwd || '0') > 0) {
                    // Use the per-session cashback amount, NOT the entire wallet balance
                    const perSessionCashback = parseFloat(showBookingModal.cashbackKwd || '0');
                    const applied = Math.min(perSessionCashback, finalPrice);
                    const pay = Math.max(0, finalPrice - applied);
                    return finalPrice > 0 ? (
                      <div className="rounded-xl border border-surface-200 bg-white p-3 space-y-1.5 text-xs">
                        <div className="flex justify-between"><span className="text-surface-500">{ar() ? "سعر الجلسة" : "Session price"}</span><span className="font-bold">{finalPrice.toFixed(3)} KWD</span></div>
                        {applied > 0 && <div className="flex justify-between"><span className="text-surface-500">{ar() ? "خصم الكاش باك" : "Membership Cashback"}</span><span className="font-bold text-amber-700">− {applied.toFixed(3)} KWD</span></div>}
                        <div className="flex justify-between border-t border-surface-100 pt-1.5"><span className="font-semibold text-emerald-800">{ar() ? "تدفعين في العيادة" : "You pay at clinic"}</span><span className="font-black text-emerald-800">{pay.toFixed(3)} KWD</span></div>
                      </div>
                    ) : null;
                 }
                 
                 // Normal booking (with or without discount)
                 const earnedCb = parseFloat(showBookingModal.cashbackKwd || "0");
                 return basePrice > 0 ? (
                   <div className="rounded-xl border border-surface-200 bg-white p-3 space-y-1.5 text-xs">
                     <div className="flex justify-between"><span className="text-surface-500">{ar() ? "سعر الجلسة" : "Session price"}</span><span className="font-bold">{basePrice.toFixed(3)} KWD</span></div>
                     {discountAmt > 0 && <div className="flex justify-between"><span className="text-surface-500">{ar() ? "خصم الباقة" : "Membership Discount"}</span><span className="font-bold text-amber-700">− {discountAmt.toFixed(3)} KWD</span></div>}
                     <div className="flex justify-between border-t border-surface-100 pt-1.5"><span className="font-semibold text-emerald-800">{ar() ? "تدفعين في العيادة" : "You pay at clinic"}</span><span className="font-black text-emerald-800">{finalPrice.toFixed(3)} KWD</span></div>
                     {earnedCb > 0 && <div className="flex justify-between pt-1"><span className="text-surface-400">{ar() ? "كاش باك مكتسب" : "Cashback earned"}</span><span className="font-bold text-brand-pink-600">+{earnedCb.toFixed(3)} KWD</span></div>}
                   </div>
                 ) : null;
               })()}
               {showBookingModal.method === "Standalone" && (
                 <div className="text-xs text-brand-pink-500 font-bold mt-1">{ar() ? "جلسة مفردة — الدفع في العيادة" : "Single Session — Pay at Clinic"}</div>
               )}
            </div>

            <div className="space-y-4 mb-6">
               <div>
                  <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "العيادة المفضلة" : "Preferred Clinic"}</label>
                  {(() => {
                     const baseOffer = homeCatalogData?.items?.find((o: any) => o.id === showBookingModal.offerId) || showBookingModal;
                     const overrides = baseOffer?.branchSessionPrices || baseOffer?.clinicOverrides || [];
                     const renderClinicOptions = () => {
                        const allowed = showBookingModal.standaloneClinicIds;
                        let pool = (clinicsPublic?.items || []);
                        
                        if (overrides.length > 0) {
                           const overrideClinicIds = overrides.map((b: any) => b.clinicId);
                           pool = pool.filter((c: any) => overrideClinicIds.includes(c.id));
                        } else if (Array.isArray(allowed) && allowed.length > 0) {
                           pool = pool.filter((c: any) => allowed.includes(c.id));
                        }

                        const clinicOptionsPool = pool.length > 0 ? pool : (clinicsPublic?.items || []);
                        return clinicOptionsPool.map((c: any) => {
                           const override = overrides.find((b: any) => b.clinicId === c.id);
                           const feeText = override && parseFloat(override.sessionPriceKwd) > 0 
                              ? (ar() ? ` (${override.sessionPriceKwd} د.ك)` : ` (${override.sessionPriceKwd} KWD)`) 
                              : "";
                           return <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}{feeText}</option>;
                        });
                     };
                     
                     const isPreAssigned = !!showBookingModal.userOfferId && !!showBookingModal.clinicId;
                     const isLaser = showBookingModal.category === "laser" && !!showBookingModal.clinicId;
                     const shouldDisable = isPreAssigned || isLaser;

                     // Determine current price based on selected clinic
                     const currentClinicId = showBookingModal.clinicId;
                     const activeOverride = overrides.find((b: any) => b.clinicId === currentClinicId);
                     const effectiveBasePrice = activeOverride && parseFloat(activeOverride.sessionPriceKwd) > 0
                        ? parseFloat(activeOverride.sessionPriceKwd)
                        : parseFloat(showBookingModal.priceKwd) || 0;
                     const actualDiscountPct = showBookingModal.discountPct || 0;
                     const effectiveFinalPrice = +(effectiveBasePrice - (actualDiscountPct > 0 ? effectiveBasePrice * actualDiscountPct / 100 : 0)).toFixed(3);

                     return shouldDisable ? (
                        <select className="select-field w-full bg-surface-50 opacity-80 cursor-not-allowed" disabled value={showBookingModal.clinicId}>
                           {renderClinicOptions()}
                        </select>
                     ) : (
                        <select
                           className="select-field w-full bg-surface-50"
                           id="bookingClinicSelect"
                           value={showBookingModal.clinicId || ""}
                           onChange={(e) => {
                             const newClinicId = e.target.value;
                             const t = dynamicTreatments?.find((dt: any) => dt.id === showBookingModal.treatmentId);
                             const override = overrides.find((b: any) => b.clinicId === newClinicId);
                             
                             let newBasePrice;
                             if (override && parseFloat(override.sessionPriceKwd) > 0) {
                               newBasePrice = parseFloat(override.sessionPriceKwd);
                             } else if (t) {
                               const offeringsBy = (t.offeringsByClinic || {}) as Record<string, { priceKwd: number; cashbackKwd: number }>;
                               const clinicOffering = offeringsBy[newClinicId];
                               newBasePrice = clinicOffering?.priceKwd ?? t.priceKwd;
                             } else {
                               newBasePrice = parseFloat(showBookingModal.priceKwd) || 0;
                             }
                             
                             const discountAmt = actualDiscountPct > 0 ? +(newBasePrice * actualDiscountPct / 100).toFixed(3) : 0;
                             const newFinalPrice = +(newBasePrice - discountAmt).toFixed(3);
                             
                             setShowBookingModal({
                               ...showBookingModal,
                               clinicId: newClinicId,
                               priceKwd: newBasePrice,
                               finalPrice: newFinalPrice
                             });
                           }}
                        >
                           {renderClinicOptions()}
                        </select>
                     );
                  })()}
                  {(() => {
                    const isPreAssigned = !!showBookingModal.userOfferId && !!showBookingModal.clinicId;
                    const isLaser = showBookingModal.category === "laser" && !!showBookingModal.clinicId;
                    if (isLaser) {
                      return <p className="text-[10px] text-brand-pink-500 mt-1">{ar() ? "ملاحظة: هذا العرض مخصص لعيادة واحدة. لتغيير العيادة يجب دفع الرسوم." : "Note: This offer is restricted to the selected clinic. To change, you must pay the fee."}</p>;
                    } else if (isPreAssigned) {
                      return <p className="text-[10px] text-surface-500 mt-1">{ar() ? "العيادة محددة مسبقاً لهذا العرض." : "Clinic is pre-assigned for this offer."}</p>;
                    }
                    return null;
                  })()}
               </div>

               {(() => {
                  const baseOffer = homeCatalogData?.items?.find((o: any) => o.id === showBookingModal.offerId) || showBookingModal;
                  const overrides = baseOffer?.branchSessionPrices || baseOffer?.clinicOverrides || [];
                  const currentClinicId = showBookingModal.clinicId;
                  const activeOverride = overrides.find((b: any) => b.clinicId === currentClinicId);
                  const effectiveBasePrice = activeOverride && parseFloat(activeOverride.sessionPriceKwd) > 0
                     ? parseFloat(activeOverride.sessionPriceKwd)
                     : parseFloat(showBookingModal.priceKwd) || 0;
                  const actualDiscountPct = showBookingModal.discountPct || 0;
                  const effectiveFinalPrice = +(effectiveBasePrice - (actualDiscountPct > 0 ? effectiveBasePrice * actualDiscountPct / 100 : 0)).toFixed(3);

                  const relatedOffer = showBookingModal.applicableCashbackOfferId ? offers.find(o => o.id === showBookingModal.applicableCashbackOfferId) : null;
                  if (relatedOffer && parseFloat(relatedOffer.cashbackBalanceKwd || '0') > 0) {
                     const available = parseFloat(relatedOffer.cashbackBalanceKwd || '0');
                     const cost = effectiveFinalPrice;
                     const applied = Math.min(available, cost);
                     const remaining = cost - applied;
                     return (
                        <div className="bg-brand-pink-50 border border-brand-pink-200 rounded-2xl p-4 mt-4">
                           <div className="font-bold text-brand-pink-800 text-sm mb-1">{ar() ? "استخدام رصيد الباقة" : "Package Cashback Applied"}</div>
                           {available >= cost ? (
                              <p className="text-xs text-brand-pink-600 leading-relaxed font-medium">
                                 {ar() ? `رصيدك في العرض يغطي بالكامل قيمة هذه الجلسة (${cost} د.ك). لن يتم خصم أي مبالغ إضافية.` : `Your offer's cashback fully covers this session (${cost} KWD). You don't need to pay anything extra.`}
                              </p>
                           ) : (
                              <p className="text-xs text-brand-pink-600 leading-relaxed font-medium">
                                 {ar() ? `رصيدك في العرض يغطي جزءاً من الجلسة (${applied} د.ك). سيتوجب عليك دفع المبلغ المتبقي (${remaining} د.ك) في العيادة.` : `Your offer's cashback partially covers this session (${applied} KWD). You must pay the remaining ${remaining} KWD at the clinic.`}
                              </p>
                           )}
                        </div>
                     );
                  }

                  
                  const isMembershipBooking = !!showBookingModal.userOfferId;
                  if (isMembershipBooking) return null;
                  return wallet && parseFloat(wallet.unlockedBalance || "0") > 0 ? (
                     <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 mt-4">
                        <input type="checkbox" className="mt-1 w-4 h-4 text-emerald-500 rounded border-emerald-300 focus:ring-emerald-400" id="useCashbackModal" />
                        <div>
                           <label htmlFor="useCashbackModal" className="font-bold text-emerald-800 text-sm cursor-pointer">{ar() ? "استخدام الكاش باك المتاح من المحفظة العامة" : "Use Available General Cashback"}</label>
                           <p className="text-xs text-emerald-600 mt-0.5">{ar() ? `لديك ${parseFloat(wallet.unlockedBalance).toFixed(3)} د.ك متاحة كخصم` : `You have ${parseFloat(wallet.unlockedBalance).toFixed(3)} KWD available for discount`}</p>
                        </div>
                     </div>
                  ) : null;
               })()}
            </div>

            <button className="btn-primary w-full shadow-md disabled:opacity-50 disabled:cursor-not-allowed" disabled={isBookingSubmitting} onClick={async () => {
               if (isBookingSubmitting) return;
               setIsBookingSubmitting(true);
               const offer = showBookingModal;
               try {
                 // BUG FIX: Use the real MongoDB UserOffer _id (offer.userOfferId) for
                 // membership-based bookings. Only fall back to offer.id for true
                 // standalone bookings (temp_ prefix). Sending a temp_ id to the server
                 // resulted in USER_OFFER_NOT_FOUND (404).
                     const isStandaloneBooking = !offer.userOfferId && (offer.id?.startsWith("temp_") || offer.method === "Standalone");
                     const resolvedUserOfferId = offer.userOfferId || offer.id;

                     const baseOffer = homeCatalogData?.items?.find((o: any) => o.id === offer.offerId) || offer;
                     const overrides = baseOffer?.branchSessionPrices || baseOffer?.clinicOverrides || [];
                     const activeOverride = overrides.find((b: any) => b.clinicId === offer.clinicId);
                     const effectiveBasePrice = activeOverride && parseFloat(activeOverride.sessionPriceKwd) > 0
                        ? parseFloat(activeOverride.sessionPriceKwd)
                        : parseFloat(offer.priceKwd) || 0;
                     const actualDiscountPct = offer.discountPct || 0;
                     const effectiveFinalPrice = +(effectiveBasePrice - (actualDiscountPct > 0 ? effectiveBasePrice * actualDiscountPct / 100 : 0)).toFixed(3);

                 const selectedClinicId = (document.getElementById('bookingClinicSelect') as HTMLSelectElement)?.value 
                   || offer.clinicId 
                   || clinicsPublic?.items?.[0]?.id;

                 const normalizedTreatmentId = (() => {
                   if (offer.treatmentId) return String(offer.treatmentId);
                   if (typeof offer.id === "string" && offer.id.startsWith("temp_")) return offer.id.replace("temp_", "");
                   if (typeof offer.id === "string") return offer.id;
                   return "";
                 })();
                 const matchedStandalone = standaloneSessions.find(
                   (s: any) =>
                     (String(s.sessionTypeId || s.id) === normalizedTreatmentId) &&
                     String(s.clinicId) === String(selectedClinicId)
                 );
                 const resolvedSchedulingMode =
                   matchedStandalone?.bookingMode ||
                   (offer as any).bookingMode ||
                   "clinic_handles";
                 const standalonePriceKwd =
                   matchedStandalone?.priceKwd != null && matchedStandalone.priceKwd !== ""
                     ? String(matchedStandalone.priceKwd)
                     : Number.isFinite(Number(offer.priceKwd))
                       ? Number(offer.priceKwd).toFixed(3)
                       : String(offer.priceKwd ?? "0.000");

                 await apiFetch("/scheduling/me/request", {
                   method: "POST",
                   headers: getAuthHeader(),
                   body: JSON.stringify({ 
                      userOfferId: resolvedUserOfferId,
                      clinicId: selectedClinicId,
                      isStandalone: isStandaloneBooking,
                      schedulingMode: resolvedSchedulingMode,
                      standaloneName: offer.treatmentName || offer.offerName || offer.offerId || undefined,
                      standalonePrice: isStandaloneBooking ? standalonePriceKwd : undefined,
                      notes: offer.treatmentName || offer.offerName || undefined,
                      sessionGrossKwd: effectiveBasePrice > 0 ? effectiveBasePrice.toFixed(3) : undefined,
                      cashbackAppliedKwd: offer.cashbackKwd != null && Number(offer.cashbackKwd) > 0 ? Number(offer.cashbackKwd).toFixed(3) : undefined
                   })
                 });
                 await refetchMySessions();
                 await refetchMyRequests();
                 setShowBookingModal(null);
                 setSysAlert(ar() ? "✅ تم إرسال طلب الحجز! سيتم التواصل معك لتأكيد الوقت. المبلغ في العيادة يبقى قيد الانتظار حتى وصولك." : "✅ Booking request sent! We'll confirm the time. Payment at the clinic stays pending until you arrive.");
                 setTimeout(() => setSysAlert(null), 6000);
               } catch (e: any) {
                 const msg = e instanceof Error ? e.message : "Error";
                 const data = (e as any)?.data as { forms?: EFormPending[]; nextEligibleAt?: string } | undefined;
                 const nextDate = data?.nextEligibleAt ? fmtDate(data.nextEligibleAt) : "";
                 const friendly: Record<string, string> = {
                   INSTALLMENT_NOT_PAID_FOR_NEXT_SESSION: ar() ? "يجب دفع القسط التالي قبل حجز جلسة جديدة." : "Please pay your next installment before booking another session.",
                   INTERVAL_NOT_MET: ar() ? `يجب مرور الفترة المحددة بين الجلسات. يمكنك الحجز من ${nextDate}.` : `Sessions need a minimum gap. You can book again from ${nextDate}.`,
                   ALREADY_HAVE_OPEN_REQUEST: ar() ? "لديك طلب حجز قائم لهذه العضوية. انتظري تأكيده قبل طلب جلسة جديدة." : "You already have an open booking for this membership. Please wait for it to be confirmed.",
                   MAX_SESSIONS_REACHED: ar() ? "تم استخدام جميع جلسات هذه العضوية." : "All sessions in this membership have been used.",
                   MEMBERSHIP_EXPIRED: ar() ? "انتهت صلاحية هذه العضوية. يرجى التجديد لحجز جلسات جديدة." : "This membership has expired. Please renew to book new sessions.",
                   OFFER_NOT_ACTIVE: ar() ? "العضوية غير مفعّلة بعد." : "This membership isn't active yet.",
                   KYC_REQUIRED: ar() ? "يرجى إكمال التحقق من الهوية أولاً." : "Please complete identity verification first.",
                   TOO_MANY_REQUESTS: ar() ? "يتم معالجة طلبك، يرجى الانتظار لحظة." : "Your request is being processed — please wait a moment.",
                 };
                 if (msg === "EFORMS_REQUIRED" && data?.forms?.[0]) {
                   const first = data.forms[0];
                   const resolvedUserOfferId = offer.userOfferId || offer.id;
                   setShowBookingModal(null);
                   navigate(`/forms/fill/${first.id || first.formId}?userOfferId=${resolvedUserOfferId}&return=/dashboard`);
                 } else {
                   setSysAlert(friendly[msg] ?? msg);
                 }
                 setTimeout(() => setSysAlert(null), 6000);
               } finally {
                 setIsBookingSubmitting(false);
               }
            }}>
               {isBookingSubmitting ? (ar() ? "جاري الإرسال..." : "Submitting...") : (ar() ? "تأكيد الحجز" : "Confirm Booking")}
            </button>
          </div>
        </div>
      )}

      {/* Change Clinic Modal */}
      {showChangeClinicModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative">
             <button className="absolute top-4 right-4 text-surface-400 hover:text-surface-900" onClick={() => setShowChangeClinicModal(null)}>✕</button>
             <h3 className="text-xl font-bold text-surface-900 mb-2">{
                !showChangeClinicModal.clinicId 
                   ? (ar() ? "تحديد العيادة" : "Select Clinic")
                   : (ar() ? "تغيير العيادة" : "Change Clinic")
             }</h3>
             <p className="text-sm text-surface-500 mb-6">{
                !showChangeClinicModal.clinicId
                   ? (ar() ? "يرجى تحديد العيادة التي ترغب في تلقي الجلسات فيها. هذه الخدمة مجانية لأول مرة." : "Please select the clinic where you want to receive your sessions. This is free for the first time.")
                   : (ar() ? `تغيير العيادة لهذا العرض يتطلب دفع رسوم إدارية ${showChangeClinicModal.currentFee} د.ك.` : `Changing the clinic for this offer requires a ${showChangeClinicModal.currentFee} KD administrative fee.`)
             }</p>
             
             <div className="mb-6">
                <label className="text-sm font-bold text-surface-900 block mb-2">{
                   !showChangeClinicModal.clinicId
                      ? (ar() ? "اختر العيادة" : "Select Clinic")
                      : (ar() ? "اختر العيادة الجديدة" : "Select New Clinic")
                }</label>
                <select className="select-field w-full bg-surface-50" value={newClinicSelection} onChange={e => setNewClinicSelection(e.target.value)}>
                   {(() => {
                      const baseOffer = homeCatalogData?.items?.find((o: any) => o.id === showChangeClinicModal.offerId) || showChangeClinicModal;
                      const overrides = baseOffer?.branchSessionPrices || baseOffer?.clinicOverrides || [];
                      let pool = (clinicsPublic?.items || []);
                      if (overrides.length > 0) {
                         const overrideClinicIds = overrides.map((b: any) => b.clinicId);
                         pool = pool.filter((c: any) => overrideClinicIds.includes(c.id));
                      }
                      let clinicOptionsPool = pool.length > 0 ? pool : (clinicsPublic?.items || []);
                      // The membership's current clinic may not be in the offer's per-clinic price list
                      // (e.g. the offer's own clinic). Keep it in the list so the dropdown shows the
                      // same clinic as the card instead of silently displaying the first option.
                      const currentId = showChangeClinicModal.clinicId;
                      if (currentId && !clinicOptionsPool.some((c: any) => c.id === currentId)) {
                         const current = (clinicsPublic?.items || []).find((c: any) => c.id === currentId);
                         if (current) clinicOptionsPool = [current, ...clinicOptionsPool];
                      }
                      return clinicOptionsPool.map((c: any) => (
                         <option key={c.id} value={c.id}>
                            {ar() ? c.nameAr : c.nameEn}{c.id === currentId ? (ar() ? " (الحالية)" : " (current)") : ""}
                         </option>
                      ));
                   })()}
                </select>
             </div>

             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowChangeClinicModal(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
                <button className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold shadow-md hover:bg-brand-pink-600 transition-colors disabled:opacity-50" onClick={async () => {
                   if (!newClinicSelection || newClinicSelection === showChangeClinicModal.clinicId) {
                     setSysAlert(ar() ? "الرجاء اختيار عيادة مختلفة" : "Please select a different clinic.");
                     return;
                   }
                   try {
                     if (!showChangeClinicModal.clinicId || !showChangeClinicModal.clinicLocked) {
                       // Initial assignment OR non-locked standard clinic change
                       await apiFetch(`/commerce/me/user-offers/${showChangeClinicModal.id}/change-clinic`, {
                         method: "POST",
                         headers: getAuthHeader(),
                         body: JSON.stringify({ newClinicId: newClinicSelection, confirmPayTransferFee: true }),
                       });
                       refetchMyOffers();
                       setShowChangeClinicModal(null);
                       if (!showChangeClinicModal.clinicId) {
                         setSysAlert(ar() ? `تم تحديد العيادة بنجاح.` : `Clinic assigned successfully.`);
                       } else {
                         setSysAlert(ar() ? `تم تغيير العيادة بنجاح. الرسوم المخصومة: ${showChangeClinicModal.currentFee} د.ك` : `Clinic changed successfully. Fee charged: ${showChangeClinicModal.currentFee} KD`);
                       }
                       setTimeout(() => setSysAlert(null), 5000);
                     } else {
                       // Clinic is locked, must submit a request for CS review
                       await apiFetch(`/commerce/me/user-offers/${showChangeClinicModal.id}/clinic-change-request`, {
                         method: "POST",
                         headers: getAuthHeader(),
                         body: JSON.stringify({ toClinicId: newClinicSelection }),
                       });
                       invalidateCache("/commerce/me/clinic-change-requests");
                       refetchClinicChanges();
                       setShowChangeClinicModal(null);
                       setSysAlert(ar() ? `تم إرسال طلب تغيير العيادة بنجاح. الرسوم: ${showChangeClinicModal.currentFee} د.ك — سيتم مراجعة طلبك من فريق خدمة العملاء.` : `Clinic change request submitted. Fee: ${showChangeClinicModal.currentFee} KD — your request will be reviewed by our CS team.`);
                       setTimeout(() => setSysAlert(null), 7000);
                     }
                   } catch (e: any) {
                     const msg = e?.message || "Error";
                     if (msg.includes("ALREADY_PENDING")) {
                       setSysAlert(ar() ? "لديك طلب تغيير عيادة قيد المراجعة بالفعل." : "You already have a pending clinic change request.");
                     } else if (msg.includes("PAYMENT_FAILED") || msg.includes("INSUFFICIENT_FUNDS")) {
                       setSysAlert(ar() ? "فشلت عملية الدفع. يرجى التحقق من بطاقتك أو رصيدك." : "Payment failed. Please check your card or balance.");
                     } else {
                       setSysAlert(ar() ? `حدث خطأ: ${msg}` : `Error: ${msg}`);
                     }
                     setTimeout(() => setSysAlert(null), 5000);
                   }
                }}>
                   {!showChangeClinicModal.clinicId 
                      ? (ar() ? "تأكيد" : "Confirm") 
                      : (ar() ? `طلب التغيير (${showChangeClinicModal.currentFee} د.ك)` : `Request Change (${showChangeClinicModal.currentFee} KD)`)}
                </button>
             </div>
           </div>
         </div>
      )}

            {/* Clinic Handles Confirmation Prompt */}
      {showClinicHandlesPrompt && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative text-center">
             <div className="w-16 h-16 bg-surface-100 text-surface-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </div>
             <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "تأكيد طلب الموعد" : "Confirm Appointment Request"}</h3>
             <p className="text-sm text-surface-500 mb-6">{ar() ? "هل أنت متأكد من رغبتك في طلب هذا الموعد؟ ستقوم العيادة بالتواصل معك لتحديد الوقت المناسب." : "Are you sure you want to request this appointment? The clinic will contact you to schedule a suitable time."}</p>
             
             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowClinicHandlesPrompt(null)}>{ar() ? "إلغاء" : "Cancel"}</button>
                <button className="flex-1 px-4 py-2 bg-surface-900 text-white rounded-xl font-bold shadow-md hover:bg-surface-800 transition-colors" onClick={() => {
                   setShowClinicHandlesPrompt(null);
                   setSysAlert(ar() ? "✅ تم تسجيل طلبك! ستتواصل معك العيادة قريباً لتحديد موعد جلستك." : "✅ Request received! The clinic will contact you shortly to schedule your session.");
                   setTimeout(() => setSysAlert(null), 7000);
                }}>
                   {ar() ? "تأكيد الطلب" : "Confirm Request"}
                </button>
             </div>
           </div>
         </div>
      )}

      {/* Booking Prompt Modal */}
      {showBookingPromptModal && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative text-center">
             <div className="w-16 h-16 bg-brand-pink-100 text-brand-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
             </div>
             <h3 className="text-xl font-bold text-surface-900 mb-2">{ar() ? "حجز موعد جديد" : "Book an Appointment"}</h3>
             <p className="text-sm text-surface-500 mb-6">{ar() ? "هل ترغب في حجز موعد لهذه الخدمة الآن؟" : "Would you like to book an appointment for this service now?"}</p>
             
             <div className="flex gap-3">
                <button className="flex-1 px-4 py-2 bg-surface-100 text-surface-600 rounded-xl font-bold hover:bg-surface-200 transition-colors" onClick={() => setShowBookingPromptModal(null)}>{ar() ? "لاحقاً" : "Later"}</button>
                <button className="flex-1 px-4 py-2 bg-brand-pink-500 text-white rounded-xl font-bold shadow-md hover:bg-brand-pink-600 transition-colors" onClick={() => {
                   const offerToBook = showBookingPromptModal;
                   setShowBookingPromptModal(null);
                   setShowBookingModal(offerToBook);
                }}>
                   {ar() ? "نعم، احجز الآن" : "Yes, Book Now"}
                </button>
             </div>
           </div>
         </div>
      )}


      {/* ── Group Unlock Modal ── */}
      {groupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-fade-in" onClick={() => setGroupModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-br from-purple-600 to-purple-800 p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <button onClick={() => setGroupModal(null)} className="absolute top-0 right-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="text-3xl mb-2">🔓</div>
                <h3 className="text-xl font-black">{ar() ? "فتح العضوية" : "Unlock Membership"}</h3>
                <p className="text-white/80 text-sm mt-1">{ar() ? (groupModal.pkg.nameAr || groupModal.pkg.name) : groupModal.pkg.name}</p>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {groupModal.loading ? (
                <div className="flex flex-col items-center py-8">
                  <div className="w-10 h-10 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                  <p className="text-surface-500 text-sm font-medium">{ar() ? "جاري إنشاء المجموعة..." : "Creating your group..."}</p>
                </div>
              ) : groupModal.step === "confirm" ? (
                <div className="text-center py-6 animate-fade-in">
                  <div className="text-4xl mb-4">👥</div>
                  <h4 className="font-black text-purple-800 text-xl mb-2">{ar() ? "إنشاء مجموعة جديدة" : "Create a new group"}</h4>
                  <p className="text-surface-600 text-sm mb-8 leading-relaxed">
                    {ar() 
                      ? `تحتاج إلى دعوة ${groupModal.membersNeeded} أصدقاء لفتح هذه العضوية. هل أنت مستعد لإنشاء المجموعة الآن؟` 
                      : `You need to invite ${groupModal.membersNeeded} friends to unlock this membership. Are you ready to create the group now?`}
                  </p>
                  <button
                    className="btn-primary w-full py-3.5 shadow-glow"
                    onClick={() => {
                      setGroupModal(prev => prev ? { ...prev, step: "creating", loading: true } : null);
                      apiFetch("/commerce/me/offers/create-group", {
                        method: "POST",
                        headers: getAuthHeader(),
                        body: JSON.stringify({ offerId: groupModal.pkg.id || groupModal.pkg._id }),
                      })
                        .then((data: any) => {
                          invalidateCache("/commerce/me/offers");
                          refetchMyOffers(true).then(() => {
                            setActiveTab("my-purchases");
                            setPurchasesSubTab("packages");
                            setGroupModal(prev => prev ? {
                              ...prev,
                              step: "share",
                              userOfferId: data.userOfferId,
                              groupInviteCode: data.groupInviteCode,
                              membersJoined: (data.sharedWith || []).length,
                              membersNeeded: (data.groupSizeRequired || 2) - 1,
                              loading: false,
                            } : null);
                            setTimeout(() => {
                              const el = document.getElementById("sec-packages");
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }, 300);
                          });
                        })
                        .catch((e: any) => {
                          alert(e?.message || "Error creating group");
                          setGroupModal(null);
                        });
                    }}
                  >
                    {ar() ? "نعم، أنشئ المجموعة" : "Yes, Create Group"}
                  </button>
                  <button 
                    onClick={() => setGroupModal(null)}
                    className="w-full mt-3 py-3 rounded-2xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                  >
                    {ar() ? "إلغاء" : "Cancel"}
                  </button>
                </div>
              ) : groupModal.step === "share" ? (
                <>
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-surface-600 mb-2">
                      <span>{ar() ? "تقدم المجموعة" : "Group Progress"}</span>
                      <span className={groupModal.membersJoined >= groupModal.membersNeeded ? "text-emerald-600" : "text-purple-600"}>
                        {groupModal.membersJoined} / {groupModal.membersNeeded} {ar() ? "أشخاص" : "people"}
                      </span>
                    </div>
                    <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${groupModal.membersJoined >= groupModal.membersNeeded ? 'bg-emerald-500' : 'bg-purple-500'}`}
                        style={{ width: `${Math.min(100, (groupModal.membersJoined / groupModal.membersNeeded) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {groupModal.membersJoined >= groupModal.membersNeeded ? (
                    /* Unlocked! */
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                      <div className="text-3xl mb-2">🎉</div>
                      <h4 className="font-black text-emerald-800 text-lg">{ar() ? "تم فتح العضوية!" : "Membership Unlocked!"}</h4>
                      <p className="text-emerald-600 text-sm mt-1">{ar() ? "يمكنك الآن شراء العضوية بالسعر الكامل" : "You can now purchase the membership"}</p>
                      <div className="text-2xl font-black text-emerald-800 mt-2">{groupModal.pkg.subscriptionPriceKwd} KWD</div>
                      <button
                        className="btn-primary w-full py-3 mt-4 shadow-glow"
                        onClick={() => {
                          setGroupModal(null);
                          setCheckoutPkg({ ...groupModal.pkg, userOfferId: groupModal.userOfferId, groupInviteCode: groupModal.groupInviteCode });
                        }}
                      >
                        {ar() ? "اشترِ الآن" : "Purchase Now"}
                      </button>
                    </div>
                  ) : (
                    /* Share link */
                    <>
                      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                          <span className="text-xs font-bold text-purple-700 uppercase tracking-wide">{ar() ? "رابط الدعوة" : "Invite Link"}</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            readOnly
                            value={`${SITE_BASE_URL}/dashboard?inviteCode=${groupModal.groupInviteCode}`}
                            className="flex-1 text-xs font-mono bg-white border border-purple-200 rounded-xl px-3 py-2 text-surface-700 min-w-0 select-all"
                            dir="ltr"
                            onFocus={e => e.target.select()}
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`${SITE_BASE_URL}/dashboard?inviteCode=${groupModal.groupInviteCode}`).catch(() => {});
                              setCopiedCode(groupModal.groupInviteCode || null);
                              setTimeout(() => setCopiedCode(null), 2000);
                            }}
                            className={`shrink-0 text-xs font-bold px-4 py-2 rounded-xl transition-colors ${copiedCode === groupModal.groupInviteCode ? 'bg-emerald-500 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                          >
                            {copiedCode === groupModal.groupInviteCode ? (ar() ? "تم!" : "Copied!") : (ar() ? "نسخ" : "Copy")}
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-surface-500 text-center leading-relaxed">
                        {ar()
                          ? `شارك هذا الرابط مع ${groupModal.membersNeeded - groupModal.membersJoined} شخص آخر. بعد اكتمال المجموعة، ستتمكن من شراء العضوية.`
                          : `Share this link with ${groupModal.membersNeeded - groupModal.membersJoined} more ${groupModal.membersNeeded - groupModal.membersJoined === 1 ? 'person' : 'people'}. Once complete, you can purchase the membership.`}
                      </p>

                      {/* Refresh button */}
                      <button
                        className="w-full py-3 rounded-2xl text-sm font-bold border-2 border-purple-200 text-purple-700 bg-white hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                        onClick={() => {
                          if (!groupModal.userOfferId) return;
                          setGroupModal(prev => prev ? { ...prev, loading: true } : null);
                          apiFetch(`/commerce/me/offers/group-status/${groupModal.userOfferId}`, {
                            headers: getAuthHeader(),
                          })
                            .then((data: any) => {
                              setGroupModal(prev => prev ? {
                                ...prev,
                                membersJoined: data.membersJoined || 0,
                                membersNeeded: data.membersNeeded || 1,
                                step: data.isUnlocked ? "unlocked" : "share",
                                loading: false,
                              } : null);
                            })
                            .catch(() => {
                              setGroupModal(prev => prev ? { ...prev, loading: false } : null);
                            });
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        {ar() ? "تحديث الحالة" : "Refresh Status"}
                      </button>
                    </>
                  )}
                </>
              ) : groupModal.step === "unlocked" ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <h4 className="font-black text-emerald-800 text-lg">{ar() ? "تم فتح العضوية!" : "Membership Unlocked!"}</h4>
                  <p className="text-emerald-600 text-sm mt-1">{ar() ? "يمكنك الآن شراء العضوية" : "You can now purchase the membership"}</p>
                  <div className="text-2xl font-black text-emerald-800 mt-2">{groupModal.pkg.subscriptionPriceKwd} KWD</div>
                  <button
                    className="btn-primary w-full py-3 mt-4 shadow-glow"
                    onClick={() => {
                      setGroupModal(null);
                      setCheckoutPkg({ ...groupModal.pkg, userOfferId: groupModal.userOfferId, groupInviteCode: groupModal.groupInviteCode });
                    }}
                  >
                    {ar() ? "اشترِ الآن" : "Purchase Now"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* New Checkout Modal */}
      {checkoutPkg && (
        <CheckoutModal
          ar={ar()}
          offer={{
            id: checkoutPkg.id || checkoutPkg._id,
            userOfferId: checkoutPkg.userOfferId,
            name: checkoutPkg.name || checkoutPkg.title || "Offer",
            category: checkoutPkg.category,
            clinicId: checkoutPkg.clinicId,
            clinicIds: checkoutPkg.clinicIds,
            clinicLocked: checkoutPkg.clinicLocked,
            requireBranchSelection: checkoutPkg.requireBranchSelection,
            membershipType: checkoutPkg.membershipType,
            clinicTransferFeeKwd: checkoutPkg.clinicTransferFeeKwd,
            subscriptionPriceKwd: checkoutPkg.subscriptionPriceKwd || String(checkoutPkg.price || "0.000"),
            validityDays: checkoutPkg.validityDays || 240,
            allowFullPayment: checkoutPkg.allowFullPayment !== false,
            allowInstallments: !!checkoutPkg.allowInstallments,
            maxInstallments: checkoutPkg.maxInstallments || 1,
            allowDeposit: !!checkoutPkg.allowDeposit,
            depositAmountKwd: checkoutPkg.depositAmountKwd || checkoutPkg.depositAmount || "0.000",
            cashbackEligible: checkoutPkg.cashbackEligible !== false,
            maxCashbackPerPurchaseKwd: checkoutPkg.maxCashbackPerPurchaseKwd ?? null,
            branchSubscriptionPrices: checkoutPkg.branchSubscriptionPrices || [],
            clinicOverrides: checkoutPkg.clinicOverrides || []
          }}
          inviteCode={pendingInviteCode}
          onClose={() => { setCheckoutPkg(null); setPendingInviteCode(null); }}
          onComplete={async () => {
            setCheckoutPkg(null);
            setPendingInviteCode(null);
            invalidateCache("/commerce/me/offers");
            invalidateCache("/wallet");
            invalidateCache("/checkout");
            await refetchMyOffers(true);
            setActiveTab("my-purchases");
            setSysAlert(ar() ? "تم بنجاح! راجع اشتراكاتك." : "Done! Check 'My Memberships'.");
            setTimeout(() => setSysAlert(null), 5000);
          }}
        />
      )}

      {/* System Alerts */}
      {sysAlert && (() => {
         const isError = sysAlert.includes("يجب دفع") || sysAlert.includes("Please pay") || sysAlert.includes("خطأ") || sysAlert.includes("Error") || sysAlert.includes("❌") || sysAlert.includes("already") || sysAlert.includes("بالفعل");
         const bgColor = isError ? "bg-red-50 border-red-500 text-red-800" : "bg-emerald-50 border-emerald-500 text-emerald-800";
         const iconBg = isError ? "bg-red-500" : "bg-emerald-500";
         return (
           <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] border-2 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 animate-slide-down max-w-lg w-[calc(100%-2rem)] ${bgColor}`}>
              <div className={`text-white p-1 rounded-full shrink-0 ${iconBg}`}>
                 {isError ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                 ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                 )}
              </div>
              <span className="font-bold text-sm leading-relaxed">{sysAlert.replace(/^❌\s*/, '')}</span>
           </div>
         );
      })()}
    </div>
  );
}
