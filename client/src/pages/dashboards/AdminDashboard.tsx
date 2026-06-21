import { useState, useEffect, useMemo, Fragment } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useApi, useKycQueue, usePendingPayments, useComplaints, useProducts, useFinanceSnapshot, useAdminReservations, useBookingRequests, type ReservationItem, invalidateCache } from "../../hooks/useApi";
import { apiFetch, API_BASE_URL, SITE_BASE_URL } from "../../lib/api";
import i18n from "../../app/i18n";
import { allTreatments } from "../../lib/treatments";
import { getCategoryIcon } from "../../components/CategoryIcons";
import { OfferTemplate, getOfferTemplates, saveOfferTemplates, upsertOfferTemplate, deleteOfferTemplate, seedDefaultOffers, getSubscriptions } from "../../lib/offerSystem";
import { sharedClinics } from "../../lib/clinics";
import { CategoriesAdminPanel } from "../../features/admin/CategoriesAdminPanel";
import { EFormsAdminPanel } from "../../features/admin/EFormsAdminPanel";
import { KycQueue, PaymentQueue, BookingRequestsQueue } from "./CsDashboard";
import { AdminSubscriptionsDashboard } from "./AdminSubscriptionsDashboard";
import { SessionTypesAdminPanel } from "../../features/admin/SessionTypesAdminPanel";
import { PromotionsManager } from "../../components/PromotionsManager";
import ChatWidget from "../../components/ChatWidget";
import AdminBookingsMonitor from "../../components/AdminBookingsMonitor";
import ShareLinkPage from "../../components/ShareLinkPage";
import { fmtDate } from "../../lib/dateFormat";
import NotificationSettingsPanel from "../../features/admin/NotificationSettingsPanel";
import QRCodeCanvas from "../../components/QRCodeCanvas";

const ar = () => i18n.language === "ar";

interface AdminCardData {
  card: {
    displayName: string;
    memberSince: string | null;
    kycVerified: boolean;
    activeOffers: Array<{ offerId: string; offerName: string | null; expiresAt: string | null; sessionsUsed: number }>;
    activeSessionCount: number;
    cashbackUnlockedKwd: string;
    publicToken: string | undefined;
  };
}

function AdminCustomerCard({ userId }: { userId: string }) {
  const { data, loading } = useApi<AdminCardData>(`/public/admin/customer/${userId}/card`, { deps: [userId] });
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-surface-900 hover:bg-surface-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c0 1.306.835 2.417 2 2.83M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
          {ar() ? "بطاقة العضوية الرقمية" : "Digital Membership Card"}
        </span>
        <svg className={`w-4 h-4 text-surface-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-surface-100">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-pink-200 border-t-brand-pink-500 rounded-full animate-spin" />
            </div>
          )}
          {!loading && data && (
            <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <div className="flex-1">
                <div className="bg-gradient-to-r from-brand-pink-500 to-brand-pink-700 rounded-2xl px-5 py-5 text-white mb-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-brand-pink-200 mb-1">{ar() ? "بطاقة العضوية" : "Membership Card"}</div>
                  <h3 className="text-lg font-black">{data.card.displayName}</h3>
                  {data.card.memberSince && (
                    <div className="text-xs text-brand-pink-200 mt-0.5">
                      {ar() ? "عضو منذ" : "Member since"} {new Date(data.card.memberSince).toLocaleDateString("en-KW", { month: "long", year: "numeric" })}
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-1.5">
                    {data.card.kycVerified ? (
                      <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        {ar() ? "هوية موثقة" : "Verified"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-black/20 text-brand-pink-100 text-[10px] font-bold px-2.5 py-1 rounded-full">
                        {ar() ? "غير موثق" : "Unverified"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-brand-pink-600">{data.card.activeOffers.length}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{ar() ? "عضويات" : "Offers"}</div>
                  </div>
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-emerald-600">{data.card.activeSessionCount}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{ar() ? "جلسات" : "Sessions"}</div>
                  </div>
                  <div className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-amber-500">{parseFloat(data.card.cashbackUnlockedKwd || "0").toFixed(3)}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5">{ar() ? "كاش" : "Cashback"}</div>
                  </div>
                </div>
              </div>

              {data.card.publicToken && (
                <div className="flex flex-col items-center gap-3 shrink-0">
                  <div className="text-xs font-bold text-surface-600">{ar() ? "رمز التحقق" : "Verify QR"}</div>
                  <QRCodeCanvas
                    value={`${SITE_BASE_URL}/verify/${data.card.publicToken}`}
                    size={140}
                    className="rounded-lg"
                  />
                  <a
                    href={`${SITE_BASE_URL}/verify/${data.card.publicToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-pink-500 font-medium hover:underline"
                  >
                    {ar() ? "فتح صفحة التحقق" : "Open verify page"} →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, icon, isHighlighted, trend, accent = "pink" }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; isHighlighted?: boolean; trend?: string; accent?: "pink" | "teal" | "amber" | "blue" | "violet" | "emerald" | "rose" | "red" | "indigo" }) {
  const accentMap: Record<string, { iconBg: string; iconText: string; blob: string }> = {
    pink:    { iconBg: "bg-brand-pink-100",  iconText: "text-brand-pink-600",  blob: "bg-brand-pink-50/60" },
    teal:    { iconBg: "bg-brand-sage-100",  iconText: "text-brand-sage-700",  blob: "bg-brand-sage-50/60" },
    amber:   { iconBg: "bg-amber-100",       iconText: "text-amber-600",       blob: "bg-amber-50/60" },
    blue:    { iconBg: "bg-blue-100",        iconText: "text-blue-600",        blob: "bg-blue-50/60" },
    violet:  { iconBg: "bg-violet-100",      iconText: "text-violet-600",      blob: "bg-violet-50/60" },
    emerald: { iconBg: "bg-emerald-100",     iconText: "text-emerald-600",     blob: "bg-emerald-50/60" },
    rose:    { iconBg: "bg-rose-100",        iconText: "text-rose-600",        blob: "bg-rose-50/60" },
    red:     { iconBg: "bg-red-100",         iconText: "text-red-600",         blob: "bg-red-50/60" },
    indigo:  { iconBg: "bg-indigo-100",      iconText: "text-indigo-600",      blob: "bg-indigo-50/60" },
  };

  const a = accentMap[accent] || accentMap.pink;

  return (
    <div className={`relative p-5 rounded-2xl border ${isHighlighted ? 'bg-gradient-to-br from-brand-pink-500 to-brand-pink-600 border-brand-pink-500 text-white shadow-xl shadow-brand-pink-500/20' : 'bg-white border-surface-200'} group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-10 transition-transform duration-500 group-hover:scale-110 ${isHighlighted ? 'bg-white/10' : a.blob}`} />
      <div className="flex justify-between items-start mb-6">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${isHighlighted ? 'bg-white/20 text-white backdrop-blur-md' : `${a.iconBg} ${a.iconText}`}`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg ${isHighlighted ? 'bg-white/20 text-white' : 'text-emerald-600 bg-emerald-50'}`}>
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
             {trend}
          </div>
        )}
      </div>
      <div>
        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isHighlighted ? 'text-brand-pink-100' : 'text-surface-500'}`}>{label}</div>
        <div className={`text-4xl font-black ${isHighlighted ? 'text-white' : 'text-surface-900'}`}>{value}</div>
        {sub && <div className={`text-sm font-medium mt-1 ${isHighlighted ? 'text-brand-pink-200' : 'text-surface-400'}`}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Sub-pages ──
function OffersManager() {
  const { getAuthHeader } = useAuth();
  const { data: clinicsData } = useApi<{ clinics: any[] }>("/clinics/admin");
  const { data: apiOffersData, loading: loadingOffers, refetch: refetchOffers } = useApi<{ items: any[] }>("/offers/admin");
  const { data: formsData } = useApi<{ items: any[] }>("/eforms/admin/forms");
  const { data: categoriesAdminData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories/admin");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eforms = formsData?.items || [];

  const emptyForm = { nameEn: "", nameAr: "", clinicLocked: false, requireBranchSelection: true, clinicId: "", extraClinicIds: [] as string[], category: "laser", price: "99", validityDays: "365", maxSessions: "6", unlimitedSessions: false, sessionIntervalDays: "25", imageUrl: "", signupCashback: "0", perSessionCashback: "0", cashbackActivationFee: "0", clinicTransferFee: "0", allowFullPayment: true, allowInstallments: false, maxInstallments: "4", allowDeposit: false, depositAmount: "0", tagsEn: "", tagsAr: "", isCashbackOnly: false, offerExpirationDate: "", isGroupOffer: false, groupSizeRequired: "2", groupRewardType: "free_session", groupRewardValue: "", fullPaymentEFormId: "", installmentsEFormId: "", depositEFormId: "", allowENet: false, enetEFormId: "", clinicOverrides: [] as { clinicId: string, sessionPriceKwd: string }[], branchSubscriptionPrices: [] as { clinicId: string, priceKwd: string }[], allowExtraPaidSessions: false, extraSessionPriceKwd: "", branchExtraSessionPrices: [] as { clinicId: string, priceKwd: string }[] };
  const [form, setForm] = useState(emptyForm);

  const offers = apiOffersData?.items || [];
  const [localOffers, setLocalOffers] = useState<any[]>([]);

  useEffect(() => {
    if (apiOffersData?.items) {
      setLocalOffers(apiOffersData.items);
    }
  }, [apiOffersData?.items]);

  const refresh = () => refetchOffers();

  const categoryIdToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categoriesAdminData?.items ?? []) m.set(c.id, c.slug);
    return m;
  }, [categoriesAdminData?.items]);

  const openCreate = () => {
    const firstClinic = clinicsData?.clinics?.[0]?.id ?? "";
    setForm({ ...emptyForm, clinicId: firstClinic, extraClinicIds: [] });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (o: any) => {
    const slugsFromIds = (o.categoryIds ?? []).map((id: string) => categoryIdToSlug.get(id)).filter(Boolean) as string[];
    const categoryVal =
      o.category === "all" ? "all" : slugsFromIds.length ? slugsFromIds.join(",") : (o.category || "laser");
    setForm({ 
      nameEn: o.name || o.nameEn, 
      nameAr: o.nameAr || "", 
      clinicLocked: o.clinicLocked ?? false,
      requireBranchSelection: o.requireBranchSelection ?? true,
      clinicId: o.clinicId || clinicsData?.clinics?.[0]?.id || "",
      extraClinicIds: (o.clinicIds || []).filter((id: string) => id && id !== (o.clinicId || "")),
      category: categoryVal, 
      price: String(o.subscriptionPriceKwd || o.price || "0"), 
      validityDays: String(o.validityDays), 
      maxSessions: o.maxSessions ? String(o.maxSessions) : "0", 
      unlimitedSessions: !o.maxSessions, 
      sessionIntervalDays: String(o.sessionIntervalDays), 
      imageUrl: o.imageUrl || "", 
      signupCashback: String(o.signupCashbackKwd || o.signupCashback || "0"), 
      perSessionCashback: String(o.cashbackPerSessionKwd || o.perSessionCashback || "0"), 
      cashbackActivationFee: String(o.cashbackActivationFeeKwd || o.cashbackActivationFee || "0"), 
      clinicTransferFee: String(o.clinicTransferFeeKwd || "0"),
      allowFullPayment: o.allowFullPayment ?? true, 
      allowInstallments: o.allowInstallments ?? false, 
      maxInstallments: String(o.maxInstallments || "1"), 
      allowDeposit: o.allowDeposit ?? false, 
      depositAmount: String(o.depositAmountKwd || o.depositAmount || "0"), 
      tagsEn: (o.tagsEn || []).join(", "), 
      tagsAr: (o.tagsAr || []).join(", "), 
      isCashbackOnly: o.isCashbackOnly || false,
      offerExpirationDate: o.offerExpirationDate ? new Date(o.offerExpirationDate).toISOString().split('T')[0] : "",
      isGroupOffer: o.isGroupOffer || false,
      groupSizeRequired: String(o.groupSizeRequired || "2"),
      groupRewardType: o.groupRewardType || "free_session",
      groupRewardValue: String(o.groupRewardValue || ""),
      fullPaymentEFormId: o.fullPaymentEFormId || "",
      installmentsEFormId: o.installmentsEFormId || "",
      depositEFormId: o.depositEFormId || "",
      allowENet: o.allowENet || false,
      enetEFormId: o.enetEFormId || "",
      clinicOverrides: (o.clinicOverrides || o.branchSessionPrices || []).map((x: any) => ({
        clinicId: x.clinicId || "",
        sessionPriceKwd: String(x.sessionPriceKwd ?? "0")
      })),
      branchSubscriptionPrices: (o.branchSubscriptionPrices || []).map((x: any) => ({
        clinicId: x.clinicId || "",
        priceKwd: String(x.priceKwd ?? "0")
      })),
      allowExtraPaidSessions: o.allowExtraPaidSessions ?? false,
      extraSessionPriceKwd: o.extraSessionPriceKwd ?? "",
      branchExtraSessionPrices: (o.branchExtraSessionPrices || []).map((x: any) => ({
        clinicId: x.clinicId || "",
        priceKwd: String(x.priceKwd ?? "0")
      }))
    });
    setEditingId(o.id || o._id); 
    setShowForm(true);
  };

  const saveOffer = async () => {
    if (!form.nameEn) return;
    const clinicId = form.clinicId || "";
    try {
      const url = editingId ? `/offers/admin/${editingId}` : "/offers/admin";
      const method = editingId ? "PATCH" : "POST";
      const branchSessionPrices = form.clinicOverrides
        .filter((o) => o.clinicId && o.sessionPriceKwd !== "" && !Number.isNaN(Number(o.sessionPriceKwd)))
        .map((o) => ({
          clinicId: o.clinicId,
          sessionPriceKwd: `${Number(o.sessionPriceKwd).toFixed(3)}`
        }));
      const branchSubscriptionPrices = form.branchSubscriptionPrices
        .filter((o) => o.clinicId && o.priceKwd !== "" && !Number.isNaN(Number(o.priceKwd)))
        .map((o) => ({
          clinicId: o.clinicId,
          priceKwd: `${Number(o.priceKwd).toFixed(3)}`
        }));
      const payPerSession = branchSessionPrices.length > 0;
      const categoryIds =
        form.category === "all" ? [] : form.category.split(",").map((s) => s.trim()).filter(Boolean);
      const categorySingle = form.category === "all" ? "all" : (categoryIds[0] || "other");
      const clinicIds = form.clinicLocked
        ? [...new Set(form.extraClinicIds.filter((id) => id && id !== clinicId))]
        : [];
      await apiFetch(url, {
        method,
        headers: getAuthHeader(),
        body: JSON.stringify({
          name: form.nameEn,
          nameAr: form.nameAr || undefined,
          type: "A",
          category: categorySingle,
          categoryIds,
          clinicLocked: form.clinicLocked,
          requireBranchSelection: !!form.requireBranchSelection,
          clinicId: clinicId,
          clinicIds,
          subscriptionPriceKwd: `${Number(form.price || "0").toFixed(3)}`,
          validityDays: parseInt(form.validityDays) || 365,
          cashbackPerSessionKwd: `${Number(form.perSessionCashback || "0").toFixed(3)}`,
          signupCashbackKwd: `${Number(form.signupCashback || "0").toFixed(3)}`,
          cashbackActivationFeeKwd: `${Number(form.cashbackActivationFee || "0").toFixed(3)}`,
          clinicTransferFeeKwd: `${Number(form.clinicTransferFee || "0").toFixed(3)}`,
          sessionIntervalDays: parseInt(form.sessionIntervalDays) || 0,
          maxSessions: form.unlimitedSessions ? null : (parseInt(form.maxSessions) || null),
          allowFullPayment: !!form.allowFullPayment,
          allowInstallments: !!form.allowInstallments,
          maxInstallments: parseInt(form.maxInstallments) || 1,
          allowDeposit: !!form.allowDeposit,
          depositAmountKwd: `${Number(form.depositAmount || "0").toFixed(3)}`,
          tagsEn: form.tagsEn.split(",").map((s: any) => s.trim()).filter(Boolean),
          tagsAr: form.tagsAr.split(",").map((s: any) => s.trim()).filter(Boolean),
          imageUrl: form.imageUrl || undefined,
          isCashbackOnly: !!form.isCashbackOnly,
          offerExpirationDate: form.offerExpirationDate ? new Date(form.offerExpirationDate).toISOString() : undefined,
          isGroupOffer: !!form.isGroupOffer,
          groupSizeRequired: parseInt(form.groupSizeRequired) || 2,
          groupRewardType: form.groupRewardType,
          groupRewardValue: form.groupRewardValue,
          fullPaymentEFormId: form.fullPaymentEFormId || undefined,
          installmentsEFormId: form.installmentsEFormId || undefined,
          depositEFormId: form.depositEFormId || undefined,
          allowENet: !!form.allowENet,
          enetEFormId: form.enetEFormId || undefined,
          payPerSession,
          branchSessionPrices,
          branchSubscriptionPrices,
          allowExtraPaidSessions: !!form.allowExtraPaidSessions,
          extraSessionPriceKwd: form.allowExtraPaidSessions && form.extraSessionPriceKwd ? `${Number(form.extraSessionPriceKwd).toFixed(3)}` : undefined,
          branchExtraSessionPrices: form.allowExtraPaidSessions
            ? form.branchExtraSessionPrices
                .filter((o) => o.clinicId && o.priceKwd !== "" && !Number.isNaN(Number(o.priceKwd)))
                .map((o) => ({ clinicId: o.clinicId, priceKwd: `${Number(o.priceKwd).toFixed(3)}` }))
            : [],
          status: "active",
          active: true,
          featured: false
        })
      });
      invalidateCache("/offers");
      invalidateCache("/session-types");
      invalidateCache("/commerce");
      setShowForm(false);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deleteOffer = async (id: string) => {
    if (!confirm(ar() ? "هل أنت متأكد من حذف هذا العرض؟" : "Are you sure you want to delete this offer?")) return;
    try {
      await apiFetch(`/offers/admin/${id}`, { method: "DELETE", headers: getAuthHeader() });
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const r = new FileReader(); r.onloadend = () => setForm({ ...form, imageUrl: r.result as string }); r.readAsDataURL(file); } };
  const toggleActive = async (o: any) => {
    try {
      await apiFetch(`/offers/admin/${o.id || o._id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ active: !o.active })
      });
      refresh();
    } catch (e: any) { alert(e.message); }
  };
  const subs = getSubscriptions();

  const F = (label: string, children: React.ReactNode, span?: string) => <div className={span || ""}><label className="text-xs font-medium text-surface-500 mb-1 block">{label}</label>{children}</div>;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العضويات" : "Membership Management"}</h3>
        <div className="flex gap-2">
           <button className="btn-secondary btn-sm" onClick={refresh}>↻ {ar() ? "تحديث" : "Refresh"}</button>
           <button className="btn-primary btn-sm" onClick={openCreate}>+ {ar() ? "إنشاء عضوية" : "Create Membership"}</button>
        </div>
      </div>

      {loadingOffers && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <div key={i} className="shimmer h-64 rounded-2xl" />)}</div>}

      {!loadingOffers && showForm && (
        <div className="rounded-3xl border border-surface-200 bg-white shadow-card overflow-hidden animate-slide-up max-h-[calc(100vh-8rem)] flex flex-col">
          <div className="bg-gradient-to-r from-brand-pink-50 via-white to-brand-sage-100/40 px-6 py-5 border-b border-surface-100 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-white shadow-sm border border-brand-pink-100 flex items-center justify-center text-brand-pink-600" aria-hidden="true">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <div>
                <h4 className="text-base font-bold text-surface-900 tracking-tight">{editingId ? (ar() ? "تعديل العرض" : "Edit Offer") : (ar() ? "إنشاء عرض جديد" : "Create New Offer")}</h4>
                <div className="text-xs text-surface-500 mt-0.5">{ar() ? "حدد التفاصيل والعيادات والدفع والكاش باك" : "Configure details, clinics, payments and cashback"}</div>
              </div>
            </div>
            <button type="button" onClick={() => setShowForm(false)} className="icon-btn" aria-label={ar() ? "إغلاق النموذج" : "Close form"} title={ar() ? "إغلاق" : "Close"}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
          {/* 1. Basic Info Section */}
          <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "المعلومات الأساسية" : "Basic Information"}</h5>
          <div className="grid gap-4 md:grid-cols-2">
            {F(ar() ? "اسم العرض (EN)" : "Offer Name (EN)", <input className="input-field" value={form.nameEn} onChange={e => setForm({...form, nameEn: e.target.value})} />)}
            {F(ar() ? "اسم العرض (AR)" : "Offer Name (AR)", <input className="input-field" dir="rtl" value={form.nameAr} onChange={e => setForm({...form, nameAr: e.target.value})} />)}
          </div>
          {/* ── Branch selection toggle ── */}
          <div className={`mt-4 rounded-xl border p-4 transition-colors ${form.requireBranchSelection ? "border-brand-pink-200 bg-brand-pink-50/40" : "border-surface-200 bg-surface-50"}`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setForm((prev) => ({ ...prev, requireBranchSelection: !prev.requireBranchSelection }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.requireBranchSelection ? "bg-brand-pink-500" : "bg-surface-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requireBranchSelection ? "translate-x-5" : ""}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-surface-900">
                  {ar()
                    ? (form.requireBranchSelection ? "اختيار الفرع مطلوب عند الاشتراك" : "لا يلزم اختيار فرع")
                    : (form.requireBranchSelection ? "Branch selection required at checkout" : "No branch selection at checkout")}
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  {ar()
                    ? (form.requireBranchSelection
                        ? "ستظهر للعميل قائمة لاختيار فرع أثناء الاشتراك."
                        : "لن يُطلب من العميل اختيار فرع — يستخدم النظام الفرع الرئيسي تلقائياً.")
                    : (form.requireBranchSelection
                        ? "Customer sees a branch picker during checkout."
                        : "Customer is not asked to pick a branch — the system uses the primary clinic automatically.")}
                </div>
              </div>
            </label>
          </div>

          {/* ── Clinic lock toggle ── */}
          <div className={`mt-4 rounded-xl border p-4 transition-colors ${form.clinicLocked ? "border-amber-300 bg-amber-50" : "border-surface-200 bg-surface-50"}`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setForm((prev) => ({
                  ...prev,
                  clinicLocked: !prev.clinicLocked,
                  clinicId: !prev.clinicLocked ? (prev.clinicId || clinicsData?.clinics?.[0]?.id || "") : prev.clinicId,
                }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${form.clinicLocked ? "bg-amber-500" : "bg-surface-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.clinicLocked ? "translate-x-5" : ""}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-surface-900">
                  {ar()
                    ? (form.clinicLocked ? "مقيّد — العميل يختار مرة واحدة" : "مفتوح — العميل يختار بحرية")
                    : (form.clinicLocked ? "Locked — customer picks once, then locked" : "Open — customer can switch clinic freely")}
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  {ar()
                    ? (form.clinicLocked
                        ? "العميل يختار عيادته عند الاشتراك ويُقيَّد بها. تغييرها لاحقاً يستلزم رسوم متصاعدة: 10 → 20 → 30 د.ك، وتحتاج موافقة خدمة العملاء."
                        : "العميل يختار أي عيادة نشطة عند الاشتراك ويمكنه التغيير لاحقاً دون رسوم.")
                    : (form.clinicLocked
                        ? "Customer picks any active clinic at checkout and is locked to it. Changing later costs 10 → 20 → 30 KWD (escalating) and requires CS approval."
                        : "Customer picks any active clinic at checkout and can switch later at no charge.")}
                </div>
              </div>
            </label>

            {form.clinicLocked && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800 mt-3">
                <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>
                  {ar()
                    ? "الرسوم متصاعدة: الطلب الأول 10 د.ك، الثاني 20 د.ك، الثالث 30 د.ك. تتم المراجعة والموافقة من خدمة العملاء."
                    : "Change fee escalates: 1st request = 10 KWD, 2nd = 20 KWD, 3rd = 30 KWD. Each request is reviewed and approved by CS."}
                </span>
              </div>
            )}
          </div>
          
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {F(ar() ? "السعر (KWD)" : "Price (KWD)", <input className="input-field" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />)}
            {F(ar() ? "المدة (أيام)" : "Validity (days)", <input className="input-field" type="number" value={form.validityDays} onChange={e => setForm({...form, validityDays: e.target.value})} />)}
            {F(ar() ? "تاريخ إنتهاء العرض" : "Offer Expiration Date", <input className="input-field" type="date" value={form.offerExpirationDate} onChange={e => setForm({...form, offerExpirationDate: e.target.value})} />)}
          </div>

          {/* 2. Included Categories */}
          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "الفئات المشمولة" : "Included Categories"}</h5>
            <div className="border border-surface-200 rounded-lg p-3 max-h-40 overflow-y-auto bg-surface-50 flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded-lg border border-surface-200 shadow-sm w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.5rem)]">
                <input type="checkbox" className="accent-brand-pink-500 w-4 h-4 rounded" checked={form.category === "all"} onChange={e => setForm({...form, category: e.target.checked ? "all" : ""})} />
                <span className="font-medium">{ar() ? "جميع الفئات" : "All Categories"}</span>
              </label>
              {(categoriesAdminData?.items || []).map(c => (
                <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded-lg border border-surface-200 shadow-sm w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.5rem)] ${form.category === "all" ? "opacity-50 pointer-events-none grayscale" : ""}`}>
                  <input type="checkbox" className="accent-brand-pink-500 w-4 h-4 rounded" 
                         checked={form.category !== "all" && form.category.split(',').includes(c.slug)}
                         onChange={e => {
                            if (form.category === "all") return;
                            let arr = form.category ? form.category.split(',').filter(Boolean) : [];
                            if (e.target.checked) arr.push(c.slug); else arr = arr.filter(x => x !== c.slug);
                            setForm({...form, category: arr.join(',')});
                         }} />
                  <span className="w-4 h-4 shrink-0">{getCategoryIcon(c.slug)}</span>
                  <span className="font-medium">{ar() ? c.nameAr : c.nameEn}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Session Rules */}
          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "قواعد الجلسات" : "Session Rules"}</h5>
            <div className="grid gap-4 md:grid-cols-2">
              {F(ar() ? "الجلسات" : "Max Sessions", <div className="flex items-center gap-2"><input className="input-field flex-1" type={form.unlimitedSessions ? "text" : "number"} value={form.unlimitedSessions ? "∞" : form.maxSessions} onChange={e => setForm({...form, maxSessions: e.target.value})} disabled={form.unlimitedSessions} /><label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={form.unlimitedSessions} onChange={e => setForm({...form, unlimitedSessions: e.target.checked})} className="accent-brand-pink-500 w-4 h-4 rounded" />{ar() ? "غير محدود" : "Unlimited"}</label></div>)}
              {F(ar() ? "رصيد الكاش باك المشمول (KWD)" : "Included Cashback Balance (KWD)", <input className="input-field" type="number" value={form.signupCashback} onChange={e => setForm({...form, signupCashback: e.target.value})} placeholder="0.000" />)}
              {F(ar() ? "فترة الانتظار بين الجلسات (أيام)" : "Session Interval Cooldown (days)", <input className="input-field" type="number" value={form.sessionIntervalDays} onChange={e => setForm({...form, sessionIntervalDays: e.target.value})} />)}
            </div>
          </div>

          {/* 3b. Extra Paid Sessions */}
          {!form.unlimitedSessions && (
          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-amber-400 before:to-orange-500 before:shrink-0">{ar() ? "جلسات إضافية مدفوعة" : "Extra Paid Sessions"}</h5>
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.allowExtraPaidSessions ? 'border-amber-500 bg-amber-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
              <input type="checkbox" checked={form.allowExtraPaidSessions} onChange={e => setForm({...form, allowExtraPaidSessions: e.target.checked})} className="accent-amber-500 w-4 h-4" />
              <div>
                <span className="font-bold text-sm text-surface-900">{ar() ? "السماح بجلسات إضافية مدفوعة" : "Allow Extra Paid Sessions"}</span>
                <p className="text-xs text-surface-500 mt-0.5">{ar() ? "بعد انتهاء الجلسات المجانية، يمكن للعضو حجز جلسات إضافية مدفوعة حتى انتهاء صلاحية العضوية." : "After free sessions are used up, members can book additional paid sessions until the membership expires."}</p>
              </div>
            </label>
            {form.allowExtraPaidSessions && (
              <div className="mt-4 space-y-4 pl-4 border-l-2 border-amber-200">
                <div className="grid gap-4 md:grid-cols-2">
                  {F(ar() ? "سعر الجلسة الإضافية (KWD)" : "Extra Session Price (KWD)", <input className="input-field" type="number" step="0.001" value={form.extraSessionPriceKwd} placeholder="10.000" onChange={e => setForm({...form, extraSessionPriceKwd: e.target.value})} />)}
                </div>
                <div>
                  <div className="text-xs font-semibold text-surface-600 mb-2">{ar() ? "أسعار الجلسات الإضافية حسب الفرع" : "Branch Extra Session Price Overrides"}</div>
                  <div className="space-y-3">
                    {form.branchExtraSessionPrices.map((bsp, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <select className="select-field flex-1" value={bsp.clinicId} onChange={e => {
                           const updated = [...form.branchExtraSessionPrices];
                           updated[index] = { ...updated[index], clinicId: e.target.value };
                           setForm({...form, branchExtraSessionPrices: updated});
                        }}>
                          <option value="">{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                          {(clinicsData?.clinics || []).map((c: any) => (
                             <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr : c.nameEn}</option>
                          ))}
                        </select>
                        <input className="input-field w-32" type="number" step="0.001" placeholder="Price KWD" value={bsp.priceKwd} onChange={e => {
                           const updated = [...form.branchExtraSessionPrices];
                           updated[index] = { ...updated[index], priceKwd: e.target.value };
                           setForm({...form, branchExtraSessionPrices: updated});
                        }} />
                        <button type="button" className="text-red-500 p-2 hover:bg-red-50 rounded-lg" onClick={() => {
                           const updated = [...form.branchExtraSessionPrices];
                           updated.splice(index, 1);
                           setForm({...form, branchExtraSessionPrices: updated});
                        }}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => {
                       setForm({...form, branchExtraSessionPrices: [...form.branchExtraSessionPrices, { clinicId: "", priceKwd: "" }]});
                    }}>+ {ar() ? "إضافة سعر لعيادة" : "Add Branch Override"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Clinic Session Fees (Overrides) */}
          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "رسوم الجلسات الخاصة بالعيادات" : "Clinic Session Fees"}</h5>
            <p className="text-xs text-surface-500 mb-4">{ar() ? "حدد رسوم رمزية يدفعها المشترك عند الحجز في عيادات معينة، حتى لو كانت الجلسات مجانية بالباقة." : "Set a small fee that subscribers must pay per session for specific clinics."}</p>
            
            <div className="space-y-3">
              {form.clinicOverrides.map((override, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select className="select-field flex-1" value={override.clinicId} onChange={e => {
                     const updated = [...form.clinicOverrides];
                     updated[index].clinicId = e.target.value;
                     setForm({...form, clinicOverrides: updated});
                  }}>
                    <option value="">{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                    {(clinicsData?.clinics || []).map((c: any) => (
                       <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr : c.nameEn}</option>
                    ))}
                  </select>
                  <input className="input-field w-32" type="number" placeholder="Fee KWD" value={override.sessionPriceKwd} onChange={e => {
                     const updated = [...form.clinicOverrides];
                     updated[index].sessionPriceKwd = e.target.value;
                     setForm({...form, clinicOverrides: updated});
                  }} />
                  <button type="button" className="text-red-500 p-2 hover:bg-red-50 rounded-lg" onClick={() => {
                     const updated = [...form.clinicOverrides];
                     updated.splice(index, 1);
                     setForm({...form, clinicOverrides: updated});
                  }}>✕</button>
                </div>
              ))}
              <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => {
                 setForm({...form, clinicOverrides: [...form.clinicOverrides, { clinicId: "", sessionPriceKwd: "0" }]});
              }}>+ {ar() ? "إضافة رسوم لعيادة" : "Add Clinic Fee"}</button>
            </div>
          </div>

          {/* Branch-Specific Membership Prices */}
          {form.requireBranchSelection && (
          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-amber-400 before:to-orange-500 before:shrink-0">{ar() ? "أسعار العضوية حسب الفرع" : "Clinic-Specific Membership Prices"}</h5>
            <p className="text-xs text-surface-500 mb-4">{ar() ? "حدد سعر اشتراك مخصص لكل فرع. إن لم يُحدد سعر خاص، سيُستخدم السعر الأساسي." : "Set a custom membership price for each branch. If no override is set, the base price is used."}</p>
            
            <div className="space-y-3">
              {form.branchSubscriptionPrices.map((bsp, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select className="select-field flex-1" value={bsp.clinicId} onChange={e => {
                     const updated = [...form.branchSubscriptionPrices];
                     updated[index] = { ...updated[index], clinicId: e.target.value };
                     setForm({...form, branchSubscriptionPrices: updated});
                  }}>
                    <option value="">{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                    {(clinicsData?.clinics || []).map((c: any) => (
                       <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr : c.nameEn}</option>
                    ))}
                  </select>
                  <input className="input-field w-32" type="number" step="0.001" placeholder="Price KWD" value={bsp.priceKwd} onChange={e => {
                     const updated = [...form.branchSubscriptionPrices];
                     updated[index] = { ...updated[index], priceKwd: e.target.value };
                     setForm({...form, branchSubscriptionPrices: updated});
                  }} />
                  <button type="button" className="text-red-500 p-2 hover:bg-red-50 rounded-lg" onClick={() => {
                     const updated = [...form.branchSubscriptionPrices];
                     updated.splice(index, 1);
                     setForm({...form, branchSubscriptionPrices: updated});
                  }}>✕</button>
                </div>
              ))}
              <button type="button" className="btn-secondary btn-sm text-xs" onClick={() => {
                 setForm({...form, branchSubscriptionPrices: [...form.branchSubscriptionPrices, { clinicId: "", priceKwd: form.price || "0" }]});
              }}>+ {ar() ? "إضافة سعر لعيادة" : "Add Clinic Price"}</button>
            </div>
          </div>
          )}

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "قواعد الكاش باك" : "Cashback Rules"}</h5>
            <div className="grid gap-4 md:grid-cols-3">
              {F(ar() ? "كاش باك عند الاشتراك (KWD)" : "Signup Cashback (KWD)", <input className="input-field" type="number" value={form.signupCashback} onChange={e => setForm({...form, signupCashback: e.target.value})} />)}
              {F(ar() ? "خصم كاش باك لكل جلسة (KWD)" : "Per-Session Cashback (KWD)", <input className="input-field" type="number" value={form.perSessionCashback} onChange={e => setForm({...form, perSessionCashback: e.target.value})} />)}
              {F(ar() ? "رسوم تفعيل الكاش باك (KWD)" : "Cashback Activation Fee (KWD)", <input className="input-field" type="number" value={form.cashbackActivationFee} onChange={e => setForm({...form, cashbackActivationFee: e.target.value})} />)}
            </div>
            <div className="mt-4">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.isCashbackOnly ? 'border-emerald-500 bg-emerald-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                <input type="checkbox" checked={form.isCashbackOnly} onChange={e => setForm({...form, isCashbackOnly: e.target.checked})} className="accent-emerald-500 w-4 h-4" />
                <div>
                  <span className="font-bold text-sm text-surface-900">{ar() ? "كاش باك فقط (بدون حجز مواعيد)" : "Cashback Only (No Appointment Booking)"}</span>
                  <p className="text-xs text-surface-500 mt-0.5">{ar() ? "هذا العرض للكاش باك فقط ولا يتطلب حجز جلسات أو مواعيد" : "This offer is for cashback only — no sessions or appointments needed"}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "ميكانيكية العروض الجماعية" : "Group Offer Mechanics"}</h5>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.isGroupOffer ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <input type="checkbox" checked={form.isGroupOffer} onChange={e => setForm({...form, isGroupOffer: e.target.checked})} className="accent-brand-pink-500 w-4 h-4" />
                <span className="font-bold text-sm">{ar() ? "تفعيل العرض الجماعي" : "Enable Group Offer"}</span>
              </label>
              {form.isGroupOffer && (
                <>
                  {F(
                    form.groupRewardType === "split_bill"
                      ? (ar() ? "عدد الأشخاص (للتقسيم)" : "Number of People (Split)")
                      : (ar() ? "حجم المجموعة المطلوب" : "Required Group Size"),
                    <input
                      className="input-field"
                      type="number"
                      min={form.groupRewardType === "split_bill" ? 2 : 1}
                      value={form.groupSizeRequired}
                      onChange={e => setForm({...form, groupSizeRequired: e.target.value})}
                    />
                  )}
                  {F(ar() ? "نوع المكافأة" : "Reward Type", (
                    <select className="select-field w-full" value={form.groupRewardType} onChange={e => setForm({...form, groupRewardType: e.target.value})}>
                      <option value="free_session">{ar() ? "جلسة مجانية" : "Free Session"}</option>
                      <option value="discount">{ar() ? "خصم إضافي" : "Extra Discount"}</option>
                      <option value="cashback_bonus">{ar() ? "كاش باك إضافي" : "Bonus Cashback"}</option>
                      <option value="split_bill">{ar() ? "تقسيم الفاتورة" : "Split Bill"}</option>
                      <option value="unlock_membership">{ar() ? "فتح العضوية (يحتاج أشخاص)" : "Unlock Membership (needs people)"}</option>
                    </select>
                  ))}
                  {form.groupRewardType === "split_bill" ? (
                    <div className="bg-brand-pink-50 border border-brand-pink-200 rounded-xl p-3 md:col-span-1">
                      <div className="text-xs font-bold text-brand-pink-700 mb-1">{ar() ? "معاينة التقسيم" : "Split Preview"}</div>
                      {(() => {
                        const price = parseFloat(form.price) || 0;
                        const count = parseInt(form.groupSizeRequired) || 0;
                        const perPerson = count > 0 ? (price / count).toFixed(3) : "—";
                        return (
                          <div className="text-sm text-brand-pink-800">
                            <span className="font-black">{perPerson} KWD</span>
                            {ar() ? ` لكل شخص (${count} أشخاص على الأقل)` : ` per person (minimum ${count} people)`}
                          </div>
                        );
                      })()}
                      <div className="text-[10px] text-brand-pink-500 mt-1">
                        {ar() ? `الفاتورة الكلية ${form.price || 0} KWD مقسّمة على ${form.groupSizeRequired} أشخاص. لن يُقبل أقل من العدد المطلوب.` : `Total bill ${form.price || 0} KWD divided by ${form.groupSizeRequired} people. No less than the required count will be accepted.`}
                      </div>
                    </div>
                  ) : form.groupRewardType === "unlock_membership" ? (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 md:col-span-1">
                      <div className="text-xs font-bold text-purple-700 mb-1">{ar() ? "آلية فتح العضوية" : "Unlock Mechanic"}</div>
                      <div className="text-sm text-purple-800">
                        {ar()
                          ? `السعر مخفي حتى ينضم ${parseInt(form.groupSizeRequired) - 1 || 1} شخص. بعد اكتمال المجموعة، يُفتح العرض ويظهر السعر ${form.price || 0} KWD.`
                          : `Price is hidden until ${parseInt(form.groupSizeRequired) - 1 || 1} people join. Once the group is complete, the offer unlocks and shows the price ${form.price || 0} KWD.`}
                      </div>
                      <div className="text-[10px] text-purple-500 mt-1">
                        {ar() ? "المستخدم ينشئ مجموعة ← يشارك الرابط ← تنضم المجموعة ← يُفتح الشراء" : "User creates a group → shares link → group joins → purchase unlocks"}
                      </div>
                    </div>
                  ) : (
                    F(ar() ? "قيمة المكافأة" : "Reward Value", <input className="input-field" type="text" placeholder="e.g. 10 KWD or 1 session" value={form.groupRewardValue} onChange={e => setForm({...form, groupRewardValue: e.target.value})} />)
                  )}
                </>
              )}
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "خيارات الدفع" : "Payment Options"}</h5>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className={`p-3 rounded-xl border-2 ${form.allowFullPayment ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2"><input type="checkbox" checked={form.allowFullPayment} onChange={e => setForm({...form, allowFullPayment: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "دفع كامل" : "Full Payment"}</span></label>
                {form.allowFullPayment && (
                  <select className="select-field w-full text-xs" value={form.fullPaymentEFormId} onChange={e => setForm({...form, fullPaymentEFormId: e.target.value})}>
                    <option value="">{ar() ? "بدون نموذج" : "No E-Form Required"}</option>
                    {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}</option>)}
                  </select>
                )}
              </div>
              <div className={`p-3 rounded-xl border-2 ${form.allowInstallments ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2"><input type="checkbox" checked={form.allowInstallments} onChange={e => setForm({...form, allowInstallments: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "أقساط عيادة" : "Clinic Installments"}</span></label>
                {form.allowInstallments && (
                  <>
                    <input className="input-field text-xs mb-2" type="number" placeholder="Max installments" value={form.maxInstallments} onChange={e => setForm({...form, maxInstallments: e.target.value})} />
                    <select className="select-field w-full text-xs" value={form.installmentsEFormId} onChange={e => setForm({...form, installmentsEFormId: e.target.value})}>
                      <option value="">{ar() ? "بدون نموذج" : "No E-Form Required"}</option>
                      {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}</option>)}
                    </select>
                  </>
                )}
              </div>
              <div className={`p-3 rounded-xl border-2 ${form.allowENet ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2"><input type="checkbox" checked={form.allowENet} onChange={e => setForm({...form, allowENet: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "الدفع الإلكتروني (أقساط eNet)" : "eNet (Pay in 4)"}</span></label>
                {form.allowENet && (
                  <select className="select-field w-full text-xs" value={form.enetEFormId} onChange={e => setForm({...form, enetEFormId: e.target.value})}>
                    <option value="">{ar() ? "بدون نموذج" : "No E-Form Required"}</option>
                    {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}</option>)}
                  </select>
                )}
              </div>
              <div className={`p-3 rounded-xl border-2 ${form.allowDeposit ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2"><input type="checkbox" checked={form.allowDeposit} onChange={e => setForm({...form, allowDeposit: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "عربون" : "Deposit"}</span></label>
                {form.allowDeposit && (
                  <>
                    <input className="input-field text-xs mb-2" type="number" placeholder="Deposit KWD" value={form.depositAmount} onChange={e => setForm({...form, depositAmount: e.target.value})} />
                    <select className="select-field w-full text-xs" value={form.depositEFormId} onChange={e => setForm({...form, depositEFormId: e.target.value})}>
                      <option value="">{ar() ? "بدون نموذج" : "No E-Form Required"}</option>
                      {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}</option>)}
                    </select>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "علامات العرض" : "Display Tags"}</h5>
            <div className="grid gap-4 md:grid-cols-2">
              {F("Tags (EN) — comma separated", <input className="input-field" value={form.tagsEn} onChange={e => setForm({...form, tagsEn: e.target.value})} placeholder="e.g. 1 Year, 500 KWD Cashback" />)}
              {F("Tags (AR) — comma separated", <input className="input-field" dir="rtl" value={form.tagsAr} onChange={e => setForm({...form, tagsAr: e.target.value})} placeholder="مثال: سنة واحدة, كاش باك 500 دك" />)}
            </div>
          </div>

          <div className="border-t border-surface-100 pt-4 mt-4">
            <label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "صورة العرض" : "Offer Image"}</label>
            <div className="border-2 border-dashed border-surface-200 rounded-xl p-4 flex items-center justify-center bg-surface-50 relative group hover:border-brand-pink-300 min-h-[100px]">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-24 rounded-lg object-cover" /> : <span className="text-sm text-surface-400">{ar() ? "اضغط لرفع صورة" : "Click to upload"}</span>}
            </div>
          </div>

          </div>
          <div className="px-6 py-4 bg-white/95 backdrop-blur-md border-t border-surface-200 flex items-center justify-end gap-2 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
            <button className="btn-primary" onClick={() => void saveOffer()}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              {editingId ? (ar() ? "حفظ التغييرات" : "Save Changes") : (ar() ? "إنشاء العرض" : "Create Offer")}
            </button>
          </div>
        </div>
      )}

      {/* Offer Cards — with reorder controls */}
      {(() => {
        const moveOffer = async (idx: number, dir: -1 | 1) => {
          const newIdx = idx + dir;
          if (newIdx < 0 || newIdx >= localOffers.length) return;
          
          // Optimistic update
          const newOffers = [...localOffers];
          const temp = newOffers[idx];
          newOffers[idx] = newOffers[newIdx];
          newOffers[newIdx] = temp;
          setLocalOffers(newOffers);

          // Swap sortOrder values based on the original list to save
          const items = localOffers.map((o: any, i: number) => ({
            id: o.id || o._id,
            sortOrder: i === idx ? newIdx : i === newIdx ? idx : i
          }));
          
          try {
            await apiFetch("/offers/admin/reorder", {
              method: "POST",
              headers: getAuthHeader(),
              body: JSON.stringify({ items })
            });
            // Background refresh to sync any external changes
            refresh();
          } catch { 
            // Revert on failure
            setLocalOffers(offers);
          }
        };

        return (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-surface-500">
                {ar() ? `${localOffers.length} عرض — اسحب لترتيب العرض` : `${localOffers.length} offers — use arrows to reorder`}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {localOffers.map((o: any, idx: number) => {
                const enrolled = (o.enrolledCount || 0);
                const isExpanded = expandedId === (o.id || o._id);
                const displayTitle = ar() ? (o.nameAr || o.name) : (o.name || o.nameEn);
                const cats = o.category ? o.category.split(',') : [];
                const categoryName = o.category === "all" ? (ar() ? "جميع الفئات" : "All Categories") : cats.map((c: string) => {
                  const cDef = (categoriesAdminData?.items || []).find(tc => tc.slug === c);
                  return cDef ? (ar() ? cDef.nameAr : cDef.nameEn) : c;
                }).join(' • ');

                return (
                  <div key={o.id || o._id} className={`card-elevated p-0 overflow-hidden ${!o.active ? 'opacity-60 grayscale' : ''}`}>
                    {o.imageUrl && <div className="h-32 w-full relative"><img src={o.imageUrl} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /></div>}
                    <div className="p-5">
                      {/* Sort order controls */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-surface-400 bg-surface-100 px-2 py-0.5 rounded">#{idx + 1}</span>
                        <div className="flex gap-1">
                          <button
                            disabled={idx === 0}
                            onClick={() => void moveOffer(idx, -1)}
                            className="w-7 h-7 rounded-lg bg-surface-100 hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-surface-600 transition-colors"
                            title={ar() ? "تحريك لأعلى" : "Move up"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button
                            disabled={idx === localOffers.length - 1}
                            onClick={() => void moveOffer(idx, 1)}
                            className="w-7 h-7 rounded-lg bg-surface-100 hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-surface-600 transition-colors"
                            title={ar() ? "تحريك لأسفل" : "Move down"}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 pr-4">
                          <h4 className="font-bold text-surface-900 truncate" title={displayTitle}>{displayTitle}</h4>
                          <div className="text-xs text-surface-500 mt-0.5 flex items-center gap-1.5 truncate" title={categoryName}>
                             <span className="w-3.5 h-3.5 shrink-0">{getCategoryIcon(cats[0] || o.category)}</span>
                             <span className="truncate">{categoryName} • {o.validityDays} {ar() ? "يوم" : "days"}</span>
                          </div>
                        </div>
                        <span className={o.active ? "badge-green shrink-0" : "badge-gray shrink-0"}>{o.active ? (ar() ? "نشط" : "Active") : (ar() ? "متوقف" : "Inactive")}</span>
                      </div>
                      <div className="text-2xl font-black text-brand-pink-600 mb-3">{o.subscriptionPriceKwd || o.price} <span className="text-sm text-surface-400 font-medium">KWD</span></div>

                      {/* Cashback summary */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {o.isCashbackOnly && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{ar() ? "💳 كاش باك فقط" : "💳 Cashback Only"}</span>}
                        {parseFloat(o.signupCashbackKwd || o.signupCashback || "0") > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">💰 {o.signupCashbackKwd || o.signupCashback} KWD {ar() ? "كاش باك" : "signup CB"}</span>}
                        {parseFloat(o.cashbackPerSessionKwd || o.perSessionCashback || "0") > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">🔄 {o.cashbackPerSessionKwd || o.perSessionCashback} KWD/{ar() ? "جلسة" : "session"}</span>}
                        {parseFloat(o.cashbackActivationFeeKwd || o.cashbackActivationFee || "0") > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700">🔑 +{o.cashbackActivationFeeKwd || o.cashbackActivationFee} KWD {ar() ? "تفعيل" : "activation"}</span>}
                      </div>

                      <div className="text-xs text-surface-500 mb-3">{enrolled} {ar() ? "مشترك" : "enrolled"} • {o.sessionIntervalDays}d {ar() ? "انتظار" : "interval"}</div>

                      {/* Expandable details */}
                      {isExpanded && (
                        <div className="border-t border-surface-100 pt-3 mt-2 space-y-2 text-xs animate-fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-surface-50 p-2 rounded-lg"><span className="text-surface-400">{ar() ? "دفع كامل" : "Full Pay"}</span><div className="font-bold">{o.allowFullPayment ? "✓" : "✗"}</div></div>
                            <div className="bg-surface-50 p-2 rounded-lg"><span className="text-surface-400">{ar() ? "أقساط" : "Installments"}</span><div className="font-bold">{o.allowInstallments ? `✓ (${o.maxInstallments})` : "✗"}</div></div>
                            <div className="bg-surface-50 p-2 rounded-lg"><span className="text-surface-400">{ar() ? "عربون" : "Deposit"}</span><div className="font-bold">{o.allowDeposit ? `✓ (${o.depositAmount} KWD)` : "✗"}</div></div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">{((ar() ? o.tagsAr : o.tagsEn) || []).map((t: string) => <span key={t} className="bg-surface-100 text-surface-600 text-[9px] uppercase font-bold px-2 py-0.5 rounded">{t}</span>)}</div>
                        </div>
                      )}

                      <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
                        <button className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 px-3 py-1.5 rounded-lg hover:bg-brand-pink-100" onClick={() => openEdit(o)}>{ar() ? "تعديل" : "Edit"}</button>
                        <button className="text-xs font-bold text-surface-500 bg-surface-100 px-3 py-1.5 rounded-lg hover:bg-surface-200" onClick={() => setExpandedId(isExpanded ? null : (o.id || o._id))}>{isExpanded ? (ar() ? "إخفاء" : "Less") : (ar() ? "تفاصيل" : "Details")}</button>
                        <button className="text-xs font-bold px-3 py-1.5 rounded-lg ml-auto" onClick={() => toggleActive(o)}>{o.active ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">{ar() ? "إيقاف" : "Deactivate"}</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{ar() ? "تفعيل" : "Activate"}</span>}</button>
                        <button className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100" onClick={() => deleteOffer(o.id || o._id)}>{ar() ? "حذف" : "Delete"}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {localOffers.length === 0 && <div className="md:col-span-3 text-center text-surface-400 py-12 card-elevated">{ar() ? "لا توجد عروض" : "No offers yet"}</div>}
            </div>
          </>
        );
      })()}
    </div>
  );
}

function SessionsManager() {
  const { getAuthHeader } = useAuth();
  const { data: offeringsData, refetch: refetchOfferings } = useApi<{ items: any[] }>("/session-types/offerings/admin");
  const sessions = offeringsData?.items || [];
  const [showCreate, setShowCreate] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [form, setForm] = useState({ categoryId: "laser", treatmentId: "", clinicId: "", price: "19", cashbackDeduction: "0", schedulingMode: "belamonda_cs" as "belamonda_cs" | "clinic_handles" });
  
  const { data: clinicsData } = useApi<{ clinics: any[] }>("/clinics/admin");
  const { data: categoriesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories/admin");
  const { data: sessionTypesData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string; categorySlug?: string }> }>("/session-types/admin");
  const categories = categoriesData?.items || [];
  const sessionTypes = (sessionTypesData?.items || []).filter(t => (t.categorySlug || "other") !== "all");
  const availableTreatments = sessionTypes.filter(t => (t.categorySlug || "other") === form.categoryId);

  /** Format number to KWD string "XX.000" */
  const toKwd = (v: string | number) => {
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!n || isNaN(n)) return "0.000";
    return n.toFixed(3);
  };

  const resolveClinicName = (clinicId: string | undefined) => {
    if (!clinicId) return "—";
    const id = String(clinicId);
    const apiHit = (clinicsData?.clinics || []).find((c: any) => String(c.id ?? c._id) === id);
    if (apiHit) {
      return ar() ? (apiHit.nameAr || apiHit.nameEn || id) : (apiHit.nameEn || apiHit.nameAr || id);
    }
    const sharedHit = sharedClinics.find((c) => c.id === id);
    if (sharedHit) {
      return ar() ? (sharedHit.nameAr || sharedHit.nameEn) : (sharedHit.nameEn || sharedHit.nameAr);
    }
    return id;
  };

  const saveSession = async () => {
     if (!form.clinicId || !form.treatmentId) return;
     try {
       // If editing and clinic/treatment changed, delete old offering first
       if (editingSessionId) {
         const oldSession = sessions.find((s: any) => s.id === editingSessionId);
         if (oldSession && (oldSession.clinicId !== form.clinicId || oldSession.sessionTypeId !== form.treatmentId)) {
           await apiFetch(`/session-types/clinic/${oldSession.clinicId}/admin/${editingSessionId}`, {
             method: "DELETE",
             headers: getAuthHeader()
           });
         }
       }
       await apiFetch(`/session-types/clinic/${form.clinicId}/admin`, {
         method: "POST",
         headers: getAuthHeader(),
         body: JSON.stringify({
           sessionTypeId: form.treatmentId,
           priceKwd: toKwd(form.price),
           cashbackDeductionKwd: toKwd(form.cashbackDeduction),
           bookingMode: form.schedulingMode,
           isActive: true
         })
       });
       await refetchOfferings();
       setShowCreate(false);
       setEditingSessionId(null);
     } catch (e: any) {
       alert(e?.message || "Error saving session");
     }
  };

  const deleteSession = async (id: string) => {
     const session = sessions.find((s: any) => s.id === id);
     if (!session) return;
     try {
       await apiFetch(`/session-types/clinic/${session.clinicId}/admin/${id}`, {
         method: "DELETE",
         headers: getAuthHeader()
       });
       await refetchOfferings();
     } catch (e: any) {
       alert(e?.message || "Error deleting session");
     }
  };
  
  const editSession = (session: any) => {
     setForm({
       categoryId: session.categorySlug || "injectables",
       treatmentId: session.sessionTypeId || "",
       clinicId: session.clinicId || "",
       price: String(parseFloat(session.priceKwd) || 0),
       cashbackDeduction: String(parseFloat(session.cashbackDeductionKwd) || 0),
       schedulingMode: session.bookingMode || "belamonda_cs"
     });
     setEditingSessionId(session.id);
     setShowCreate(true);
  };

  // Group sessions by sessionTypeId for display
  const grouped = sessions.reduce((acc: Record<string, any[]>, s: any) => {
    const tid = s.sessionTypeId || s.id;
    if (!acc[tid]) acc[tid] = [];
    acc[tid].push(s);
    return acc;
  }, {});

  const addClinicToTreatment = (treatmentId: string) => {
    const existing = sessions.find((s: any) => s.sessionTypeId === treatmentId);
    if (!existing) return;
    setForm({
      categoryId: existing.categorySlug || "injectables",
      treatmentId: existing.sessionTypeId,
      clinicId: "",
      price: String(parseFloat(existing.priceKwd) || 19),
      cashbackDeduction: String(parseFloat(existing.cashbackDeductionKwd) || 0),
      schedulingMode: existing.bookingMode || "belamonda_cs"
    });
    setEditingSessionId(null);
    setShowCreate(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة الجلسات المنفردة" : "Standalone Sessions"}</h3>
        <button className="btn-primary btn-sm" onClick={() => { 
            setShowCreate(!showCreate); 
            setEditingSessionId(null); 
            const defaultCategory = categories.find(c => c.slug !== "all")?.slug || "other";
            const firstTreatment = sessionTypes.find(t => (t.categorySlug || "other") === defaultCategory);
            setForm({ categoryId: defaultCategory, treatmentId: firstTreatment?.id || "", clinicId: "", price: "19", cashbackDeduction: "0", schedulingMode: "belamonda_cs" }); 
        }}>+ {ar() ? "إضافة جلسة جديدة" : "Add New Session"}</button>
      </div>

      {showCreate && (
         <div className="card-elevated p-5 animate-slide-up">
           <h4 className="text-sm font-bold text-surface-800 mb-3">{editingSessionId ? (ar() ? "تعديل بيانات العيادة" : "Edit Clinic Entry") : (ar() ? "إضافة جلسة / عيادة جديدة" : "Add New Session / Clinic")}</h4>
           <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "الفئة" : "Category"}</label>
                 <select className="select-field mt-1" value={form.categoryId} onChange={e => {
                    const catId = e.target.value;
                    const firstTreatment = sessionTypes.find(t => (t.categorySlug || "other") === catId);
                    setForm({ ...form, categoryId: catId, treatmentId: firstTreatment?.id || "" });
                 }}>
                    {categories.filter(c => c.slug !== "all").map(c => (
                      <option key={c.id} value={c.slug}>{ar() ? c.nameAr : c.nameEn}</option>
                    ))}
                    <option value="other">{ar() ? "أخرى" : "Other"}</option>
                 </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "نوع العلاج" : "Treatment Type"}</label>
                 <select className="select-field mt-1" value={form.treatmentId} onChange={e => setForm({ ...form, treatmentId: e.target.value })}>
                    <option value="" disabled>{ar() ? "اختر الجلسة" : "Select Treatment"}</option>
                    {availableTreatments.map(t => (
                      <option key={t.id} value={t.id}>{ar() ? t.nameAr : t.nameEn}</option>
                    ))}
                 </select>
              </div>
              <div className="lg:col-span-2">
                <label className="text-xs font-medium text-surface-500">{ar() ? "العيادة" : "Clinic"}</label>
                <select className="select-field mt-1" value={form.clinicId} onChange={e => setForm({ ...form, clinicId: e.target.value })}>
                  <option value="" disabled>{ar() ? "اختر العيادة" : "Select Clinic"}</option>
                  {sharedClinics.map(c => (
                    <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
                  ))}
                  {(clinicsData?.clinics || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.nameEn || c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "السعر الأصلي (KWD)" : "Original Price (KWD)"}</label>
                 <input className="input-field mt-1" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                 <label className="text-xs font-medium text-surface-500">{ar() ? "خصم الكاش باك (KWD)" : "Cashback Deduction (KWD)"}</label>
                 <input className="input-field mt-1" type="number" value={form.cashbackDeduction} onChange={e => setForm({ ...form, cashbackDeduction: e.target.value })} />
              </div>
           </div>
                       {/* Scheduling Mode */}
            <div className="mt-4">
               <label className="text-xs font-bold text-surface-700 block mb-2">{ar() ? "طريقة إدارة الحجز" : "Booking Handling Mode"}</label>
               <div className="grid grid-cols-2 gap-3">
                  <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.schedulingMode === 'belamonda_cs' ? 'border-brand-pink-500 bg-brand-pink-50' : 'border-surface-200 hover:border-surface-300'}`}>
                     <input type="radio" name="schedMode" value="belamonda_cs" checked={form.schedulingMode === 'belamonda_cs'} onChange={() => setForm({ ...form, schedulingMode: 'belamonda_cs' })} className="mt-1" />
                     <div>
                        <div className="font-bold text-surface-900 text-sm">🎧 {ar() ? "بيلاموندو (خدمة العملاء)" : "Belamonda CS"}</div>
                        <div className="text-xs text-surface-500 mt-0.5">{ar() ? "فريقنا يتولى تنسيق الموعد مع العميل" : "Our team coordinates the appointment"}</div>
                     </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.schedulingMode === 'clinic_handles' ? 'border-emerald-500 bg-emerald-50' : 'border-surface-200 hover:border-surface-300'}`}>
                     <input type="radio" name="schedMode" value="clinic_handles" checked={form.schedulingMode === 'clinic_handles'} onChange={() => setForm({ ...form, schedulingMode: 'clinic_handles' })} className="mt-1" />
                     <div>
                        <div className="font-bold text-surface-900 text-sm">🏥 {ar() ? "العيادة تتولى الجدولة" : "Clinic Handles Scheduling"}</div>
                        <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العيادة ستتواصل مع العميل لتحديد الموعد" : "The clinic contacts the client to schedule"}</div>
                     </div>
                  </label>
               </div>
            </div>
<div className="mt-4 flex gap-2">
             <button className="btn-primary btn-sm" onClick={() => void saveSession()}>{editingSessionId ? (ar() ? "حفظ التغييرات" : "Save Changes") : (ar() ? "حفظ" : "Save")}</button>
             <button className="btn-secondary btn-sm" onClick={() => { setShowCreate(false); setEditingSessionId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
           </div>
         </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        {[
          { id: "all", label: ar() ? "الكل" : "All" },
          ...categories.filter(c => c.slug !== "all").map(c => ({ id: c.slug, label: ar() ? c.nameAr : c.nameEn })),
          { id: "other", label: ar() ? "غير مصنف" : "Uncategorized" }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setSessionFilter(f.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all text-sm ${sessionFilter === f.id ? "bg-brand-pink-500 text-white shadow-md" : "bg-surface-50 text-surface-600 border border-surface-200 hover:bg-surface-100"}`}
          >
            <span className="w-4 h-4 shrink-0">{getCategoryIcon(f.id)}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).filter(([_, items]) => sessionFilter === "all" || items[0].categorySlug === sessionFilter).length === 0 && (
          <div className="card-elevated p-8 text-center text-surface-400">{ar() ? "لا توجد جلسات منفردة" : "No standalone sessions found"}</div>
        )}
        {Object.entries(grouped).filter(([_, items]) => sessionFilter === "all" || items[0].categorySlug === sessionFilter).map(([tid, items]: [string, any[]]) => {
          const first = items[0];
          const tDef = sessionTypes.find(t => t.id === tid);
          const cDef = categories.find(c => c.slug === first.categorySlug);
          const treatmentName = tDef ? (ar() ? tDef.nameAr : tDef.nameEn) : (first.nameEn || first.title);
          const categoryName = cDef ? (ar() ? cDef.nameAr : cDef.nameEn) : first.categorySlug;
          return (
            <div key={tid} className="card-elevated overflow-hidden">
              <div className="bg-surface-50 px-5 py-3 border-b border-surface-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-surface-900 flex items-center gap-2">
                    <span className="w-5 h-5">{getCategoryIcon(first.categorySlug)}</span> {treatmentName}
                  </div>
                  <div className="text-xs text-surface-500 mt-0.5">{categoryName} • {items.length} {ar() ? "عيادة" : items.length === 1 ? "clinic" : "clinics"}</div>
                </div>
                <button className="btn-sm bg-brand-pink-50 text-brand-pink-600 hover:bg-brand-pink-100 font-bold text-xs rounded-lg px-3 py-1.5" onClick={() => addClinicToTreatment(tid)}>
                  + {ar() ? "إضافة عيادة" : "Add Clinic"}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>{ar() ? "العيادة" : "Clinic"}</th><th>{ar() ? "السعر الأصلي" : "Original Price"}</th><th>{ar() ? "خصم الكاش باك" : "Cashback Deduction"}</th><th>{ar() ? "نمط الحجز" : "Booking Mode"}</th><th></th></tr></thead>
                  <tbody>
                    {items.map((s: any) => (
                      <tr key={s.id}>
                        <td className="text-surface-700 font-medium">
                          <span title={s.clinicId}>{resolveClinicName(s.clinicId)}</span>
                        </td>
                        <td className="text-brand-pink-600 font-bold">{s.priceKwd || "0.000"} KWD</td>
                        <td className="text-blue-600 font-bold">{s.cashbackDeductionKwd || "0.000"} KWD</td>
                        <td>
                          {s.bookingMode === 'clinic_handles'
                            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">🏥 {ar() ? "العيادة تجدول" : "Clinic Schedules"}</span>
                            : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-brand-pink-100 text-brand-pink-700">🎧 {ar() ? "بيلاموندو" : "Belamonda CS"}</span>
                          }
                        </td>
                        <td className="text-right flex gap-2 justify-end">
                          <button className="text-brand-pink-600 hover:text-brand-pink-800 text-sm font-bold bg-brand-pink-50 px-3 py-1 rounded-lg" onClick={() => editSession(s)}>{ar() ? "تعديل" : "Edit"}</button>
                          <button className="text-red-500 hover:text-red-700 text-sm font-bold bg-red-50 px-3 py-1 rounded-lg" onClick={() => void deleteSession(s.id)}>{ar() ? "حذف" : "Delete"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClinicsManager() {
  const { getAuthHeader, impersonateClinic, impersonateUser, login } = useAuth();
  const { data, refetch } = useApi<{ clinics: any[] }>("/clinics/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newClinicId, setNewClinicId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    nameEn: "", 
    nameAr: "",
    address: "", 
    account: "",
    password: "",
    phone: "",
    email: ""
  });

  const apiClinics = data?.clinics || [];
  const allClinics = [...apiClinics];
  sharedClinics.forEach(sc => {
      if (!allClinics.find(c => c.id === sc.id)) {
          allClinics.push({ ...sc, contactPhone: "+965 —", contactEmail: "No Email", account: sc.id });
      }
  });

  const saveClinic = async () => {
    const payload = {
      ...form,
      contactPhone: form.phone,
      contactEmail: form.email
    };
    try {
      if (editingId) {
        await apiFetch(`/clinics/admin/${editingId}`, { method: "PATCH", headers: getAuthHeader(), body: JSON.stringify(payload) });
        setShowCreate(false);
        setEditingId(null);
        refetch();
      } else {
        const res = await apiFetch("/clinics/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ ...payload, active: true }) }) as any;
        setNewClinicId(form.account || "clinic1");
        setShowCreate(false);
        refetch();
      }
    } catch (e: any) {
      alert(e?.message || e?.error || "Error saving clinic. Please check your inputs.");
      refetch();
    }
  };

  const deleteClinic = async (id: string) => {
    if (id.startsWith("clinic_")) {
      alert(ar() ? "هذه عيادة افتراضية (Hardcoded) ولا يمكن حذفها من خلال لوحة التحكم." : "This is a hardcoded demo clinic and cannot be deleted via the dashboard.");
      return;
    }
    if (!confirm(ar() ? "هل أنت متأكد من حذف هذه العيادة؟" : "Are you sure you want to delete this clinic?")) return;
    try {
      await apiFetch(`/clinics/admin/${id}`, { method: "DELETE", headers: getAuthHeader() });
      refetch();
    } catch (e) {
      alert(ar() ? "خطأ في حذف العيادة. ربما تكون مرتبطة ببيانات أخرى." : "Error deleting clinic. It might be linked to other data.");
    }
  };

  const openEdit = (c: any) => {
    setForm({
      nameEn: c.nameEn || "",
      nameAr: c.nameAr || "",
      address: c.address || "",
      account: c.account || "",
      password: "",
      phone: c.contactPhone || c.phone || "",
      email: c.contactEmail || ""
    });
    setEditingId(c.id);
    setShowCreate(true);
    setNewClinicId(null);
  };

  const closeSuccess = () => {
    setNewClinicId(null);
    setForm({ nameEn: "", nameAr: "", address: "", account: "", password: "", phone: "", email: "" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة العيادات" : "Clinic Management"}</h3>
        <button className="btn-primary btn-sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); setNewClinicId(null); setForm({ nameEn: "", nameAr: "", address: "", account: "", password: "", phone: "", email: "" }); }}>+ {ar() ? "إضافة عيادة جديدة" : "Create New Clinic"}</button>
      </div>

      {newClinicId && (
        <div className="card-elevated p-6 bg-emerald-50 border-emerald-200 animate-slide-up">
          <h4 className="font-bold text-emerald-800 flex items-center gap-2 text-lg">
             <span>✅</span> {ar() ? "تم إنشاء العيادة بنجاح!" : "Clinic Created Successfully!"}
          </h4>
          <p className="text-sm text-emerald-700 mt-2">{ar() ? "الرجاء تزويد العيادة ببيانات الدخول التالية لتمكينهم من إدارة حسابهم:" : "Please provide the clinic with the following login credentials so they can set up their profile:"}</p>
          <div className="mt-4 bg-white p-5 rounded-xl border border-emerald-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <div className="text-xs font-medium text-emerald-600 mb-1">{ar() ? "اسم الحساب (Account)" : "Account / Username"}</div>
                <div className="font-mono font-bold text-lg text-surface-900">{form.account}</div>
             </div>
             <div>
                <div className="text-xs font-medium text-emerald-600 mb-1">{ar() ? "كلمة المرور (Password)" : "Password"}</div>
                <div className="font-mono font-bold text-lg text-surface-900">{form.password}</div>
             </div>
          </div>
          <button className="btn-ghost btn-sm text-emerald-600 mt-4 hover:bg-emerald-100/50" onClick={closeSuccess}>{ar() ? "إغلاق" : "Dismiss"}</button>
        </div>
      )}

      {showCreate && (
        <div className="card-elevated p-6 animate-slide-up">
          <h4 className="font-bold text-surface-900 mb-4">{ar() ? "البيانات الأولية ومعرف الدخول" : "Initial Details & Credentials"}</h4>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم العيادة (EN)" : "Clinic Name (EN)"}</label><input className="input-field" placeholder="e.g. Derma Clinic" value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم العيادة (AR)" : "Clinic Name (AR)"}</label><input className="input-field" placeholder="مثال: عيادة ديرما" value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" /></div>
            <div className="md:col-span-2"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "الموقع / المنطقة" : "Location / Area"}</label><input className="input-field" placeholder="Kuwait City, Sharq..." value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "رقم الهاتف" : "Phone"}</label><input className="input-field" placeholder="+965 ..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="md:col-span-1"><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "البريد الإلكتروني" : "Email"}</label><input className="input-field" placeholder="clinic@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            
            {!editingId && (
              <>
                <div className="col-span-full mt-2 mb-1 border-t border-surface-100 pt-5"><h5 className="font-bold text-sm text-surface-800">{ar() ? "بيانات الدخول للعيادة" : "Clinic Login Credentials"}</h5></div>
                <div><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "اسم الحساب (للدخول)" : "Account Username"}</label><input className="input-field" placeholder="clinic_username" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} /></div>
                <div><label className="text-xs font-medium text-surface-500 mb-1.5 block">{ar() ? "كلمة المرور" : "Password"}</label><input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              </>
            )}
          </div>
          
          <div className="flex gap-3 mt-8">
            <button className="btn-primary" onClick={saveClinic} disabled={!form.nameEn || (!editingId && (!form.account || !form.password))}>{editingId ? (ar() ? "تعديل العيادة" : "Update Clinic") : (ar() ? "إنشاء العيادة" : "Create Clinic")}</button>
            <button className="btn-secondary" onClick={() => { setShowCreate(false); setEditingId(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
          </div>
        </div>
      )}
      
      {!showCreate && !newClinicId && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allClinics.map((c: any) => (
            <div key={c.id} className="card-elevated p-5 relative overflow-hidden group flex flex-col">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-pink-50 rounded-bl-[100px] -z-10 group-hover:scale-110 transition-transform" />
              <div className="text-base font-bold text-surface-900">{c.nameEn || "New Clinic"}</div>
              <div className="text-xs text-surface-500 mt-1">{c.nameAr || "عيادة جديدة"} • {c.address || "No Address"}</div>
              <div className="text-xs text-surface-600 mt-3 flex flex-col gap-1.5 bg-surface-50 p-2.5 rounded-lg border border-surface-100">
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> <span dir="ltr">{c.contactPhone || c.phone || "+965 —"}</span></div>
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {c.contactEmail || "No Email"}</div>
              </div>
              <div className="mt-4 pt-4 border-t border-surface-100 flex justify-between items-center mb-4">
                 <div className="text-xs text-surface-500 font-mono bg-surface-100 px-2 py-1 rounded">ID: {c.id}</div>
                 <span className="badge bg-emerald-50 text-emerald-600 border border-emerald-100">{ar() ? "نشط" : "Active"}</span>
              </div>
              
              <div className="mt-auto grid grid-cols-3 gap-2">
                 <button className="btn-primary py-2 text-xs w-full flex items-center justify-center gap-1.5 col-span-3" onClick={() => impersonateClinic(c.id).catch(() => login(c.account || c.id, "clinic"))}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                    {ar() ? "دخول بصلاحية العيادة" : "Login as Clinic"}
                 </button>
                 <button className="btn-secondary py-2 text-xs w-full bg-white hover:bg-surface-50 border-surface-200 col-span-2" onClick={() => openEdit(c)}>
                    {ar() ? "تعديل" : "Edit Details"}
                 </button>
                 <button className="btn-secondary py-2 text-xs w-full bg-red-50 text-red-600 hover:bg-red-100 border-red-200" onClick={() => deleteClinic(c.id)}>
                    {ar() ? "حذف" : "Delete"}
                 </button>
              </div>
            </div>
          ))}
          {allClinics.length === 0 && <div className="col-span-full card-elevated p-12 text-center border-dashed border-2 border-surface-200">
            <div className="text-4xl mb-3 opacity-50">🏥</div>
            <div className="text-base font-bold text-surface-900 mb-1">{ar() ? "لا توجد عيادات مسجلة" : "No clinics registered"}</div>
            <div className="text-sm text-surface-400">{ar() ? "قم بإنشاء أول عيادة في المنصة" : "Create the first clinic in the platform"}</div>
          </div>}
        </div>
      )}
    </div>
  );
}

const TASK_DEPT_CONFIG = {
  CS: { role: "cs", taskDept: "cs", labelEn: "Customer Service (CS)", labelAr: "خدمة العملاء (CS)" },
  Finance: { role: "finance", taskDept: "finance", labelEn: "Finance", labelAr: "المالية (Finance)" },
  Admin: { role: "admin", taskDept: "admin", labelEn: "Administration", labelAr: "الإدارة (Admin)" },
  Clinics: { role: "clinicStaff", taskDept: "clinic", labelEn: "Clinics Team", labelAr: "فريق العيادات (Clinics)" },
} as const;

type TaskUiDepartment = keyof typeof TASK_DEPT_CONFIG;

interface TaskStaffMember {
  id: string;
  name: string;
}

function TasksManager() {
  const { getAuthHeader } = useAuth();
  const { data, refetch } = useApi<{ items: any[] }>("/tasks/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [deptStaff, setDeptStaff] = useState<TaskStaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    priority: "yellow", 
    assignedDepartment: "CS" as TaskUiDepartment,
    assignedPeople: [] as string[],
    dueDate: new Date(Date.now() + 86400000).toISOString() 
  });

  useEffect(() => {
    const dept = TASK_DEPT_CONFIG[form.assignedDepartment];
    if (!dept) {
      setDeptStaff([]);
      return;
    }
    let cancelled = false;
    setLoadingStaff(true);
    apiFetch<{ items: Array<{ id: string; fullName?: string; username?: string; phone?: string; isActive?: boolean }> }>(
      `/users/admin?role=${dept.role}`,
      { headers: getAuthHeader() }
    )
      .then((res) => {
        if (cancelled) return;
        const items = (res.items || [])
          .filter((u) => u.isActive !== false)
          .map((u) => ({
            id: u.id,
            name: u.fullName || u.username || u.phone || "—",
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setDeptStaff(items);
      })
      .catch(() => {
        if (!cancelled) setDeptStaff([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStaff(false);
      });
    return () => { cancelled = true; };
  }, [form.assignedDepartment, getAuthHeader]);

  const staffNameById = useMemo(
    () => Object.fromEntries(deptStaff.map((s) => [s.id, s.name])),
    [deptStaff]
  );

  const togglePerson = (personId: string) => {
    setForm(prev => {
      const current = prev.assignedPeople;
      if (current.includes(personId)) return { ...prev, assignedPeople: current.filter(p => p !== personId) };
      return { ...prev, assignedPeople: [...current, personId] };
    });
  };

  const createTask = async () => {
    const dept = TASK_DEPT_CONFIG[form.assignedDepartment];
    const selectedNames = form.assignedPeople.map((id) => staffNameById[id]).filter(Boolean);
    let description = form.description.trim();
    if (selectedNames.length > 0) {
      const assigneeLine = ar()
        ? `المكلفون: ${selectedNames.join("، ")}`
        : `Assignees: ${selectedNames.join(", ")}`;
      description = description ? `${description}\n\n${assigneeLine}` : assigneeLine;
    }

    await apiFetch("/tasks/admin", {
      method: "POST",
      headers: getAuthHeader(),
      body: JSON.stringify({
        title: form.title,
        description: description || "—",
        priority: form.priority,
        assignedDepartments: [dept.taskDept],
        dueDate: form.dueDate,
      }),
    });
    setShowCreate(false);
    setForm({ title: "", description: "", priority: "yellow", assignedDepartment: "CS", assignedPeople: [], dueDate: new Date(Date.now() + 86400000).toISOString() });
    refetch();
  };

  const priorityColors: Record<string, string> = { red: "priority-red", yellow: "priority-yellow", green: "priority-green" };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة المهام والتكليفات" : "Task Management & Assignments"}</h3>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>+ {ar() ? "مهمة جديدة" : "New Task"}</button>
      </div>
      
      {showCreate && (
        <div className="card-elevated p-6 animate-slide-up bg-surface-50/50 border border-surface-200 mb-6">
          <h4 className="font-bold text-surface-900 mb-5">{ar() ? "تفاصيل المهمة" : "Task Details"}</h4>
          <div className="grid gap-5 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "عنوان المهمة" : "Task Title"}</label>
              <input className="input-field" placeholder={ar() ? "مثال: مراجعة العيادة الجديدة" : "e.g. Review new clinic application"} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الأولوية" : "Priority"}</label>
              <select className="select-field" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="red">🔴 High / عالي</option>
                <option value="yellow">🟡 Medium / متوسط</option>
                <option value="green">🟢 Low / منخفض</option>
              </select>
            </div>
            
            <div className="md:col-span-3 border-t border-surface-200 mt-2 pt-5">
              <h5 className="font-bold text-sm text-surface-800 mb-4">{ar() ? "تعيين المهمة (Assignment)" : "Task Assignment"}</h5>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "القسم الموجه له" : "Target Department"}</label>
                  <select className="select-field" value={form.assignedDepartment} onChange={e => setForm({ ...form, assignedDepartment: e.target.value as TaskUiDepartment, assignedPeople: [] })}>
                    {(Object.entries(TASK_DEPT_CONFIG) as [TaskUiDepartment, typeof TASK_DEPT_CONFIG[TaskUiDepartment]][]).map(([key, cfg]) => (
                      <option key={key} value={key}>{ar() ? cfg.labelAr : cfg.labelEn}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الموظف المختص (متعدد - اختياري)" : "Specific Person(s) (Optional)"}</label>
                  <div 
                    className="input-field flex items-center justify-between cursor-pointer min-h-[42px] bg-white"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {form.assignedPeople.length === 0 ? (
                        <span className="text-surface-400 text-sm px-1">{ar() ? "الكل في القسم" : "All in Department"}</span>
                      ) : (
                        form.assignedPeople.map(personId => (
                          <span key={personId} className="bg-brand-pink-50 text-brand-pink-700 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border border-brand-pink-100 shadow-sm">
                            {staffNameById[personId] || personId}
                            <button 
                              onClick={(e) => { e.stopPropagation(); togglePerson(personId); }}
                              className="hover:text-brand-pink-900 focus:outline-none w-3.5 h-3.5 bg-brand-pink-200/50 rounded-full flex items-center justify-center transition-colors"
                            >×</button>
                          </span>
                        ))
                      )}
                    </div>
                    <svg className={`w-4 h-4 text-surface-400 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                  
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-0" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute z-10 w-full mt-1 bg-white border border-surface-200 rounded-xl shadow-xl max-h-48 overflow-y-auto animate-fade-in py-1">
                        {loadingStaff ? (
                          <div className="px-4 py-3 text-sm text-surface-500 text-center">{ar() ? "جاري التحميل..." : "Loading..."}</div>
                        ) : deptStaff.length === 0 ? (
                           <div className="px-4 py-3 text-sm text-surface-500 text-center">{ar() ? "لا يوجد موظفين" : "No employees found"}</div>
                        ) : (
                          deptStaff.map(person => (
                            <label
                              key={person.id}
                              className="flex items-center px-4 py-2.5 hover:bg-surface-50 cursor-pointer transition-colors border-b border-surface-50 last:border-0 group"
                              onClick={(e) => { e.preventDefault(); togglePerson(person.id); }}
                            >
                              <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 transition-colors ${form.assignedPeople.includes(person.id) ? "bg-brand-pink-500 border-brand-pink-500" : "bg-white border border-surface-300 group-hover:border-brand-pink-300"}`}>
                                {form.assignedPeople.includes(person.id) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-[10px] font-bold text-surface-600 uppercase border border-surface-200 shadow-sm">{person.name.charAt(0)}</div>
                                <span className="text-sm font-medium text-surface-700">{person.name}</span>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="md:col-span-3 mt-2">
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الوصف أو الملاحظات" : "Description / Notes"}</label>
              <textarea className="input-field min-h-[80px] resize-y" placeholder={ar() ? "تفاصيل إضافية حول المطلوب..." : "Additional details about the task..."} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            
            <div className="md:col-span-3 flex gap-3 mt-4">
              <button className="btn-primary" onClick={createTask} disabled={!form.title}>{ar() ? "إنشاء وتعيين المهمة" : "Create & Assign Task"}</button>
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>{ar() ? "إلغاء" : "Cancel"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th></th><th>{ar() ? "العنوان" : "Title"}</th><th>{ar() ? "الجهة المكلفة" : "Assigned To"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "الموعد" : "Due"}</th></tr></thead>
            <tbody>
              {(data?.items || []).map((t: any) => (
                <tr key={t.id} className="hover:bg-surface-50 transition-colors">
                  <td className="w-8"><div className={priorityColors[t.priority] || "priority-green"} /></td>
                  <td className="font-bold text-surface-800">{t.title}</td>
                  <td>
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 text-surface-700 text-xs font-medium">
                       <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                       {(t.assignedDepartments || []).join(", ").toUpperCase()}
                     </div>
                  </td>
                  <td><span className={t.status === "completed" ? "badge-green" : t.status === "in_progress" ? "badge-yellow" : "badge-gray"}>{t.status}</span></td>
                  <td className="text-xs text-surface-500 font-medium">{fmtDate(t.dueDate)}</td>
                </tr>
              ))}
              {(data?.items || []).length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد مهام حالية" : "No active tasks"}</div><div className="empty-state-sub">{ar() ? "لا توجد مهام تتطلب اهتمامك الآن." : "All caught up — nothing to action right now."}</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const translateComplaintStatus = (status: string) => {
  if (!ar()) return status;
  switch (status) {
    case "open": return "مفتوح";
    case "in_progress": return "قيد المعالجة";
    case "escalated": return "تم التصعيد";
    case "resolved": return "محلول";
    case "closed": return "مغلق";
    default: return status;
  }
};

function ComplaintModal({ id, onClose, onUpdated }: { id: string, onClose: () => void, onUpdated: () => void }) {
  const { getAuthHeader } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch(`/complaints/${id}`, { headers: getAuthHeader() })
      .then(res => {
        setData((res as any).complaint);
        setStatus((res as any).complaint.status);
      })
      .finally(() => setLoading(false));
  }, [id, getAuthHeader]);

  const handleUpdate = async () => {
    if (!note && status === data?.status) return;
    setSaving(true);
    try {
      await apiFetch(`/complaints/${id}/update`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ status, note: note || "Status updated" })
      });
      onUpdated();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="w-10 h-10 border-4 border-brand-pink-500 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!data) return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center"><div className="bg-white p-6 rounded-2xl">Error loading complaint<button onClick={onClose} className="block mt-4 btn-secondary">Close</button></div></div>;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-up">
        <div className="p-6 border-b border-surface-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-lg font-bold text-surface-900">{ar() ? "تفاصيل الشكوى" : "Complaint Details"}</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors"><svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-surface-500 block text-xs">{ar() ? "المرسل" : "From"}</span><span className="font-bold">{data.userName || data.userId}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "التاريخ" : "Date"}</span><span className="font-bold">{new Date(data.createdAt).toLocaleString()}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "الفئة" : "Category"}</span><span className="badge-sage">{data.category}</span></div>
            <div><span className="text-surface-500 block text-xs">{ar() ? "الحالة الحالية" : "Current Status"}</span><span className="font-bold">{translateComplaintStatus(data.status)}</span></div>
          </div>
          <div>
            <span className="text-surface-500 block text-xs mb-1">{ar() ? "الموضوع" : "Subject"}</span>
            <div className="font-bold text-surface-900 text-lg">{data.subject}</div>
          </div>
          <div className="bg-surface-50 p-4 rounded-xl border border-surface-100">
            <span className="text-surface-500 block text-xs mb-2">{ar() ? "التفاصيل" : "Description"}</span>
            <div className="text-surface-800 whitespace-pre-wrap">{data.description || "—"}</div>
          </div>
          
          {data.updates?.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-surface-900">{ar() ? "سجل التحديثات" : "Update History"}</h4>
              <div className="space-y-2">
                {data.updates.map((u: any) => (
                  <div key={u.id} className="bg-surface-50 p-3 rounded-lg border border-surface-100 text-sm">
                    <div className="flex justify-between items-start mb-1 text-xs text-surface-500">
                      <span className="font-bold font-mono text-surface-700">{u.by}</span>
                      <span>{new Date(u.createdAt).toLocaleString()}</span>
                    </div>
                    <div><span className="font-bold mr-2">[{translateComplaintStatus(u.status)}]</span>{u.note}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-surface-100 pt-6 space-y-4">
            <h4 className="font-bold text-surface-900">{ar() ? "إضافة ملاحظة وتحديث" : "Add Note & Update"}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold block mb-1">{ar() ? "تغيير الحالة" : "Change Status"}</label>
                <select className="select-field w-full" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="open">{ar() ? "مفتوح" : "Open"}</option>
                  <option value="in_progress">{ar() ? "قيد المعالجة" : "In Progress"}</option>
                  <option value="escalated">{ar() ? "تم التصعيد" : "Escalated"}</option>
                  <option value="resolved">{ar() ? "محلول" : "Resolved"}</option>
                  <option value="closed">{ar() ? "مغلق" : "Closed"}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1">{ar() ? "ملاحظة (إلزامية عند التحديث)" : "Note (Required)"}</label>
              <textarea className="input-field w-full h-20 resize-none" placeholder="Enter resolution notes or updates..." value={note} onChange={e => setNote(e.target.value)}></textarea>
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={onClose}>{ar() ? "إلغاء" : "Cancel"}</button>
              <button className="btn-primary" disabled={saving || (!note.trim() && status === data.status)} onClick={handleUpdate}>{saving ? "..." : (ar() ? "تحديث" : "Update")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplaintsView() {
  const { data, refetch } = useComplaints();
  const [selectedId, setSelectedId] = useState<string|null>(null);
  
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const filteredItems = (data?.items || []).filter((c: any) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterCategory !== "all" && c.category !== filterCategory) return false;
    if (filterSearch.trim()) {
      const q = filterSearch.toLowerCase();
      const subject = c.subject || "";
      const userName = c.userName || c.userId || "";
      if (!subject.toLowerCase().includes(q) && !userName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "الشكاوى" : "Complaints"}</h3>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto bg-surface-50/50 p-2 rounded-2xl border border-surface-100">
          <div className="relative w-full sm:w-64">
            <svg className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder={ar() ? "بحث بالاسم أو الموضوع..." : "Search name or subject..."}
              className={`input-field text-sm py-1.5 w-full ${ar() ? 'pr-9' : 'pl-9'}`}
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="all">{ar() ? "جميع الحالات" : "All Statuses"}</option>
              <option value="open">{ar() ? "مفتوح" : "Open"}</option>
              <option value="in_progress">{ar() ? "قيد المعالجة" : "In Progress"}</option>
              <option value="escalated">{ar() ? "تم التصعيد" : "Escalated"}</option>
              <option value="resolved">{ar() ? "محلول" : "Resolved"}</option>
              <option value="closed">{ar() ? "مغلق" : "Closed"}</option>
            </select>
            <select 
              className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">{ar() ? "جميع الفئات" : "All Categories"}</option>
              <option value="clinic">{ar() ? "عيادة" : "Clinic"}</option>
              <option value="booking">{ar() ? "حجز" : "Booking"}</option>
              <option value="payment">{ar() ? "دفع" : "Payment"}</option>
              <option value="technical">{ar() ? "تقني" : "Technical"}</option>
              <option value="other">{ar() ? "أخرى" : "Other"}</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "المرسل" : "From"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
            <tbody>
              {filteredItems.map((c: any) => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="cursor-pointer hover:bg-surface-50 transition-colors">
                  <td className="font-medium">{c.subject}</td>
                  <td className="text-sm font-bold text-surface-700">{c.userName || c.userId}</td>
                  <td><span className="badge-sage">{c.category}</span></td>
                  <td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{translateComplaintStatus(c.status)}</span></td>
                  <td className="text-xs">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
              {filteredItems.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد شكاوى" : "No complaints"}</div><div className="empty-state-sub">{ar() ? "لم يتم العثور على نتائج للفلتر الحالي." : "No results found for the current filters."}</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {selectedId && <ComplaintModal id={selectedId} onClose={() => setSelectedId(null)} onUpdated={refetch} />}
    </div>
  );
}

function SettingsToggle({ checked, onChange, color = "brand-pink" }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  const bg = color === "red" ? "peer-checked:bg-red-500" : "peer-checked:bg-brand-pink-500";
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className={`w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${bg}`}></div>
    </label>
  );
}

function AdminSettings() {
  const { getAuthHeader } = useAuth();

  // ── Profile state ──────────────────────────────────────────────────────
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void (async () => {
      try {
        const d = (await apiFetch("/users/me", { headers: getAuthHeader() })) as {
          user?: { fullName?: string; email?: string; phone?: string; username?: string };
        };
        if (cancelled) return;
        if (d.user) {
          setFullName(d.user.fullName ?? "");
          setEmail(d.user.email ?? "");
          setPhone(d.user.phone ?? "");
          setUsername(d.user.username ?? "");
        }
      } catch (e) {
        if (!cancelled) {
          setProfileMsg({
            type: "err",
            text: e instanceof Error ? e.message : ar() ? "تعذر تحميل الملف" : "Could not load profile"
          });
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAuthHeader]);

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const body: Record<string, string> = { fullName, email, phone, username };
      if (newPassword.trim()) body.newPassword = newPassword.trim();
      await apiFetch("/users/me", {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      setNewPassword("");
      setProfileMsg({ type: "ok", text: ar() ? "تم حفظ الملف الشخصي" : "Profile saved successfully" });
    } catch (e: unknown) {
      setProfileMsg({ type: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── System settings state ──────────────────────────────────────────────
  const [sysLoading, setSysLoading] = useState(true);
  const [sysSaving, setSysSaving] = useState(false);
  const [sysMsg, setSysMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowNewSignups, setAllowNewSignups] = useState(true);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [requireInstallmentPayment, setRequireInstallmentPayment] = useState(false);
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState(24);
  const [force2FA, setForce2FA] = useState(false);
  const [maxCashbackCapacityKwd, setMaxCashbackCapacityKwd] = useState(10000);

  useEffect(() => {
    let cancelled = false;
    setSysLoading(true);
    void (async () => {
      try {
        const d = (await apiFetch("/settings/system", { headers: getAuthHeader() })) as {
          settings?: {
            maintenanceMode?: boolean;
            allowNewSignups?: boolean;
            defaultLanguage?: string;
            requireInstallmentPayment?: boolean;
            sessionTimeoutHours?: number;
            force2FAForAdmins?: boolean;
            maxCashbackCapacityKwd?: number;
          };
        };
        if (cancelled) return;
        if (d.settings) {
          const s = d.settings;
          setMaintenanceMode(!!s.maintenanceMode);
          setAllowNewSignups(s.allowNewSignups !== false);
          setDefaultLanguage(s.defaultLanguage ?? "en");
          setRequireInstallmentPayment(!!s.requireInstallmentPayment);
          setSessionTimeoutHours(Number(s.sessionTimeoutHours) || 24);
          setForce2FA(!!s.force2FAForAdmins);
          setMaxCashbackCapacityKwd(Number(s.maxCashbackCapacityKwd) || 10000);
        }
      } catch {
        /* keep defaults */
      } finally {
        if (!cancelled) setSysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAuthHeader]);

  const saveSettings = async () => {
    setSysSaving(true);
    setSysMsg(null);
    try {
      const body = {
        maintenanceMode,
        allowNewSignups,
        defaultLanguage,
        requireInstallmentPayment,
        sessionTimeoutHours,
        force2FAForAdmins: force2FA,
        maxCashbackCapacityKwd
      };
      await apiFetch("/settings/system", {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      // also persist installment flag locally for client-side guards
      localStorage.setItem("bel_require_installment_booking_v1", String(requireInstallmentPayment));
      setSysMsg({ type: "ok", text: ar() ? "تم حفظ الإعدادات" : "Settings saved successfully" });
    } catch (e: unknown) {
      setSysMsg({ type: "err", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setSysSaving(false);
    }
  };

  const initials = (fullName || username || "A").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Administrator Profile ── */}
      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <div className="flex items-center justify-between mb-5">
          <h4 className="font-bold text-surface-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {ar() ? "الملف الشخصي للمسؤول" : "Administrator Profile"}
          </h4>
          <button onClick={saveProfile} disabled={profileSaving || profileLoading} className="btn-primary btn-sm">
            {profileSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ الملف" : "Save Profile")}
          </button>
        </div>
        {profileMsg && (
          <div className={`text-xs mb-4 px-3 py-2 rounded-lg ${profileMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{profileMsg.text}</div>
        )}
        {profileLoading ? (
          <div className="h-24 flex items-center justify-center text-surface-400 text-sm">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="shrink-0 flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm">
                {initials}
              </div>
              <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Super Admin</div>
            </div>
            <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
                <input type="text" className="input-field bg-white" value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "اسم المستخدم" : "Username"}</label>
                <input type="text" className="input-field bg-white" value={username} onChange={e => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
                <input type="email" className="input-field bg-white" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
                <input type="text" className="input-field bg-white" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور الجديدة (اتركها فارغة للإبقاء على الحالية)" : "New Password (leave blank to keep current)"}</label>
                <input type="password" className="input-field bg-white" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── System Settings ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إعدادات النظام" : "System Settings"}</h3>
        <button onClick={saveSettings} disabled={sysSaving || sysLoading} className="btn-primary btn-sm">
          {sysSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ الإعدادات" : "Save Settings")}
        </button>
      </div>
      {sysMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg ${sysMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{sysMsg.text}</div>
      )}

      {sysLoading ? (
        <div className="h-24 flex items-center justify-center text-surface-400 text-sm">{ar() ? "جاري التحميل..." : "Loading settings..."}</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card-elevated p-6">
            <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {ar() ? "إعدادات عامة" : "General Configuration"}
            </h4>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700">{ar() ? "وضع الصيانة" : "Maintenance Mode"}</span>
                <SettingsToggle checked={maintenanceMode} onChange={setMaintenanceMode} color="red" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-surface-700">{ar() ? "السماح بالتسجيل الجديد" : "Allow New Signups"}</span>
                <SettingsToggle checked={allowNewSignups} onChange={setAllowNewSignups} />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
                <select className="select-field" value={defaultLanguage} onChange={e => setDefaultLanguage(e.target.value)}>
                  <option value="en">English (EN)</option>
                  <option value="ar">Arabic (AR)</option>
                </select>
              </div>
              <div className="flex items-start justify-between pt-4 border-t border-surface-100 gap-3">
                <div>
                  <span className="text-sm font-medium text-surface-700 block">{ar() ? "إلزام دفع القسط المستحق قبل حجز موعد" : "Require Installment Payment Before Booking"}</span>
                  <span className="text-[10px] text-surface-400">{ar() ? "يمنع المستخدم من حجز مواعيد إذا كان هناك أقساط غير مدفوعة للباقة" : "Prevents users from booking sessions if they have unpaid installments"}</span>
                </div>
                <SettingsToggle checked={requireInstallmentPayment} onChange={setRequireInstallmentPayment} />
              </div>
              <div className="pt-2 border-t border-surface-100">
                <label className="block text-xs font-medium text-surface-700 mb-1.5">{ar() ? "الحد الأقصى لسعة الكاش باك (د.ك)" : "Global Max Cashback Capacity (KWD)"}</label>
                <div className="text-[10px] text-surface-400 mb-2">{ar() ? "الحد الأقصى المطلق للكاش باك الذي يمكن لأي مستخدم امتلاكه (الرصيد المتاح والمقفل معاً)" : "The absolute global limit of cashback a user can have at any time (locked and unlocked combined)"}</div>
                <input type="number" min={0} className="input-field w-full sm:w-1/2" value={maxCashbackCapacityKwd} onChange={e => setMaxCashbackCapacityKwd(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="card-elevated p-6">
            <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              {ar() ? "الأمان والوصول" : "Security & Access"}
            </h4>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "صلاحية الجلسة (ساعات)" : "Session Timeout (Hours)"}</label>
                <input type="number" min={1} max={168} className="input-field" value={sessionTimeoutHours} onChange={e => setSessionTimeoutHours(Number(e.target.value))} />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية للمشرفين" : "Force 2FA for Admins"}</span>
                <SettingsToggle checked={force2FA} onChange={setForce2FA} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── User Profile Panel (tabbed) ──────────────────────────────────────────────
export type ProfileTab = "overview" | "memberships" | "cashback" | "sessions" | "payments" | "kyc" | "notes";

export function UserProfilePanel({
  user,
  onClose,
  onRoleChange,
  onStatusChange,
  onLoginAs,
}: {
  user: any;
  onClose: () => void;
  onRoleChange: (role: string) => void;
  onStatusChange: (active: boolean) => void;
  onLoginAs: () => void;
}) {
  const { auth, getAuthHeader } = useAuth();
  const myRole = auth?.role ?? "";
  const isAdmin = myRole === "admin";
  const isCS = myRole === "cs" || myRole === "cs_director" || myRole === "legal";
  const isFinance = myRole === "finance";
  
  const userIsActive = user.isActive ?? user.kyc;

  const [tab, setTab] = useState<ProfileTab>("overview");
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [pendingRole, setPendingRole] = useState<string>(user.role);
  const [roleChanging, setRoleChanging] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null);

  const [statusSaving, setStatusSaving] = useState(false);

  const [cashAmt, setCashAmt] = useState("");
  const [cashReason, setCashReason] = useState("");
  const [cashSaving, setCashSaving] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);
  const [sessionAdjustingId, setSessionAdjustingId] = useState<string | null>(null);
  const [sessionDateModal, setSessionDateModal] = useState<{ membershipId: string } | null>(null);
  const [sessionDateValue, setSessionDateValue] = useState(new Date().toISOString().split("T")[0]);
  const [installmentAdjustingId, setInstallmentAdjustingId] = useState<string | null>(null);

  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const defaultGrantEnrollment = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "bank_transfer", isVerified: true, installmentCount: 2, customInstallments: [], historicalSessions: [] };
  const [grantEnrollments, setGrantEnrollments] = useState<any[]>([{ ...defaultGrantEnrollment }]);
  const [grantSaving, setGrantSaving] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState(false);
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [allClinics, setAllClinics] = useState<any[]>([]);

  const addGrantEnrollmentRow = () => setGrantEnrollments(p => [...p, { ...defaultGrantEnrollment }]);
  const removeGrantEnrollmentRow = (idx: number) => setGrantEnrollments(p => p.filter((_, i) => i !== idx));
  const updateGrantEnrollment = (idx: number, updates: any) => setGrantEnrollments(p => p.map((x, i) => {
    if (i !== idx) return x;
    const next = { ...x, ...updates };
    // Auto-generate installments if mode switches to installments
    if (updates.purchaseMode === "installments" || (updates.installmentCount && next.purchaseMode === "installments")) {
      const count = next.installmentCount || 2;
      const arr = [];
      const now = new Date();
      for (let j = 0; j < count; j++) {
        const d = new Date(now.getTime() + j * 30 * 24 * 60 * 60 * 1000);
        arr.push({ dueDate: d.toISOString().split("T")[0], amountKwd: "", isPaid: false, method: "cash" });
      }
      next.customInstallments = arr;
    }
    return next;
  }));

  useEffect(() => {
    if (!isAdmin && !isCS) return;
    apiFetch("/offers/admin", { headers: getAuthHeader() })
      .then((d: any) => setAllOffers(d.items ?? []))
      .catch(() => {});
    apiFetch("/clinics", { headers: getAuthHeader() })
      .then((d: any) => setAllClinics(Array.isArray(d) ? d : (d.items ?? [])))
      .catch(() => {});
  }, [isAdmin, isCS]);

  const handleGrantMembership = async () => {
    if (grantEnrollments.some(e => !e.offerId)) { setGrantError(ar() ? "الرجاء اختيار العرض" : "Select an offer for all rows"); return; }
    setGrantSaving(true);
    setGrantError(null);
    setGrantSuccess(false);
    try {
      await apiFetch("/users/admin/manual-enroll", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ 
          phone: user.phone || user.username || `phone_${user.id}`, 
          fullName: user.fullName || "Customer", 
          email: user.email,
          enrollments: grantEnrollments 
        }),
      });
      setGrantSuccess(true);
      setGrantEnrollments([{ ...defaultGrantEnrollment }]);
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      setGrantError(e.message);
    } finally {
      setGrantSaving(false);
    }
  };

  useEffect(() => {
    setProfileLoading(true);
    setProfileError(null);
    apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() })
      .then((d: any) => setProfile(d))
      .catch((e: any) => setProfileError(e.message))
      .finally(() => setProfileLoading(false));
  }, [user.id]);

  const handleUnverify = async () => {
    if (!confirm(ar() ? "هل أنت متأكد من رغبتك في إلغاء توثيق هذا الحساب؟" : "Are you sure you want to unverify this account?")) return;
    try {
      await apiFetch(`/kyc/admin/${user.id}/unverify`, { method: "POST", headers: getAuthHeader() });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRoleSave = async () => {
    if (!(isAdmin || isCS) || !pendingRole || pendingRole === user.role) return;
    setRoleChanging(true);
    setRoleSaveError(null);
    try {
      await apiFetch(`/users/admin/${user.id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ role: pendingRole })
      });
      onRoleChange(pendingRole);
    } catch (e: any) {
      setRoleSaveError(e.message);
    } finally {
      setRoleChanging(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!(isAdmin || isCS)) return;
    const newActive = !userIsActive;
    setStatusSaving(true);
    try {
      await apiFetch(`/users/admin/${user.id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ isActive: newActive })
      });
      onStatusChange(newActive);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setStatusSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setNoteSaving(true);
    try {
      const res = await apiFetch(`/users/admin/${user._id || user.id}/notes`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ text: newNote }),
      }) as any;
      setNewNote("");
      if (res.note) {
        setProfile((prev: any) => ({
          ...prev,
          user: {
            ...prev.user,
            staffNotes: [...(prev.user.staffNotes || []), res.note]
          }
        }));
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleCashbackAdjust = async (sign: 1 | -1) => {
    const amt = parseFloat(cashAmt);
    if (!amt || amt <= 0) { setCashError(ar() ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    if ((isAdmin || isCS) && !cashReason.trim()) { setCashError(ar() ? "السبب مطلوب" : "Reason is required"); return; }
    setCashSaving(true);
    setCashError(null);
    try {
      const kwd = `${Math.floor(amt)}.${String(Math.round((amt % 1) * 1000)).padStart(3, "0")}`;
      const signedKwd = sign === -1 ? `-${kwd}` : kwd;
      if (isAdmin || isCS) {
        await apiFetch("/wallet/admin/adjust", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify({ userId: user.id, amountKwd: signedKwd, reason: cashReason })
        });
      }
      setCashAmt("");
      setCashReason("");
      // Refresh profile
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      setCashError(e.message);
    } finally {
      setCashSaving(false);
    }
  };

  const handleAdjustSessions = async (membershipId: string, delta: number) => {
    if (delta > 0) {
      setSessionDateModal({ membershipId });
      setSessionDateValue(new Date().toISOString().split("T")[0]);
      return;
    }

    setSessionAdjustingId(membershipId + "_dec");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, date: null }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const submitSessionDate = async () => {
    if (!sessionDateModal) return;
    const membershipId = sessionDateModal.membershipId;
    setSessionDateModal(null);
    setSessionAdjustingId(membershipId + "_inc");
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta: 1, date: sessionDateValue }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
    }
  };

  const [installMethodModal, setInstallMethodModal] = useState<{ membershipId: string } | null>(null);
  const [installMethodValue, setInstallMethodValue] = useState("cash");

  const handleAdjustInstallments = async (membershipId: string, delta: number, method?: string) => {
    if (delta > 0 && !method) {
      // Open the method picker modal
      setInstallMethodModal({ membershipId });
      setInstallMethodValue("cash");
      return;
    }
    setInstallmentAdjustingId(membershipId + (delta > 0 ? "_inc" : "_dec"));
    try {
      await apiFetch(`/commerce/admin/user-offers/${membershipId}/adjust-installments`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta, method }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setInstallmentAdjustingId(null);
    }
  };

  const downloadExcel = async (url: string, filename: string) => {
    const headers = getAuthHeader() as Record<string, string> | undefined;
    const fullUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `${API_BASE_URL}${url}`;
    const res = await fetch(fullUrl, { headers });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { key: ProfileTab; label: string; labelAr: string }[] = [
    { key: "overview", label: "Overview", labelAr: "نظرة عامة" },
    { key: "memberships", label: "Memberships", labelAr: "العضويات" },
    { key: "cashback", label: "Cashback", labelAr: "الكاش باك" },
    { key: "sessions", label: "Sessions", labelAr: "الجلسات" },
    { key: "payments", label: "Payments", labelAr: "الدفعات" },
    { key: "kyc", label: "KYC / Civil ID", labelAr: "الهوية" },
    { key: "notes", label: "Notes", labelAr: "الملاحظات" },
  ];

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      active: "bg-emerald-50 text-emerald-700",
      pending_payment: "bg-amber-50 text-amber-700",
      expired: "bg-surface-100 text-surface-500",
      cancelled: "bg-red-50 text-red-600",
      reserved: "bg-blue-50 text-blue-700",
      enet_pending: "bg-purple-50 text-purple-700",
      enet_rejected: "bg-red-50 text-red-600",
    };
    return map[s] ?? "bg-surface-100 text-surface-600";
  };

  const payStatusBadge = (s: string) => {
    if (s === "completed") return "bg-emerald-50 text-emerald-700";
    if (s === "pending") return "bg-amber-50 text-amber-700";
    if (s === "failed") return "bg-red-50 text-red-600";
    return "bg-surface-100 text-surface-600";
  };

  const fmt = (d?: string) => fmtDate(d);

  return (
    <div className="card-elevated animate-slide-up relative bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-white border-b border-surface-100 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-xl shrink-0">
          {(user.name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-surface-900">{user.fullName || user.username || user.phone || "—"}</h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] ?? "bg-surface-100 text-surface-600"}`}>{user.role}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${userIsActive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {userIsActive ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {user.fullName && user.username && (
              <span className="text-xs text-surface-400">@{user.username}</span>
            )}
            {user.phone && user.phone !== "—" && (
              <span className="text-xs text-surface-400">{user.phone}</span>
            )}
            <span className="text-xs text-surface-300 font-mono">{user.id}</span>
          </div>
          {user.referredByUsername && (
            <div className="text-xs text-brand-pink-500 mt-1">↩ {ar() ? "أُحيل بواسطة" : "Referred by"} @{user.referredByUsername}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(isAdmin || isFinance || isCS) && (
            <button
              className="btn-secondary btn-sm flex items-center gap-1.5 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
              onClick={() => void downloadExcel(`/users/admin/${user.id}/export`, `user_${user.name}_report.xlsx`)}
              title={ar() ? "تصدير إكسل" : "Export Excel"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Excel
            </button>
          )}
          <button
            className="text-surface-400 hover:text-surface-900 bg-white hover:bg-surface-100 border border-surface-200 p-1.5 rounded-full"
            onClick={onClose}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-surface-100 bg-white px-4 gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? "border-brand-pink-500 text-brand-pink-600" : "border-transparent text-surface-500 hover:text-surface-900"}`}
          >
            {ar() ? t.labelAr : t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5 max-h-[60vh] overflow-y-auto">
        {profileLoading && (
          <div className="py-10 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-brand-pink-200 border-t-brand-pink-500 animate-spin" /></div>
        )}
        {profileError && (
          <div className="py-6 text-center text-red-600 text-sm">{profileError}</div>
        )}

        {!profileLoading && profile && (
          <>
            {/* ── OVERVIEW ── */}
            {tab === "overview" && (
              <div className="space-y-4">
                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                    <div className="text-2xl font-black text-brand-pink-600">{profile.memberships?.length ?? 0}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5 uppercase font-bold">{ar() ? "عضويات" : "Memberships"}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                    <div className="text-2xl font-black text-emerald-600">{profile.sessions?.length ?? 0}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5 uppercase font-bold">{ar() ? "جلسات" : "Sessions"}</div>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                    <div className="text-2xl font-black text-amber-500">{parseFloat(profile.wallet?.unlockedKwd ?? "0").toFixed(3)}</div>
                    <div className="text-[10px] text-surface-500 mt-0.5 uppercase font-bold">{ar() ? "كاش باك" : "Cashback KWD"}</div>
                  </div>
                </div>
                {/* Membership card */}
                {user.role === "customer" && <AdminCustomerCard userId={user.id} />}
                {/* Role change (admin or CS) */}
                {(isAdmin || isCS) && (
                  <div className="bg-white rounded-xl p-4 border border-surface-200">
                    <div className="text-xs font-bold text-surface-500 uppercase mb-2">{ar() ? "تغيير الدور" : "Change Role"}</div>
                    <div className="flex gap-2 flex-wrap">
                      <select className="input-field flex-1 min-w-[140px]" value={pendingRole} onChange={e => setPendingRole(e.target.value)}>
                        {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button className="btn-primary px-4 disabled:opacity-50" disabled={roleChanging || pendingRole === user.role} onClick={() => void handleRoleSave()}>
                        {roleChanging ? "…" : (ar() ? "حفظ" : "Save")}
                      </button>
                    </div>
                    {roleSaveError && <div className="text-xs text-red-600 mt-1">{roleSaveError}</div>}
                  </div>
                )}
                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap pt-2">
                  {(isAdmin || isCS) && (
                    <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={onLoginAs}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                      {ar() ? "دخول كـ مستخدم" : "Login As User"}
                    </button>
                  )}
                  {(isAdmin || isCS) && (
                    <button
                      className={`btn-secondary btn-sm disabled:opacity-50 ${userIsActive ? "text-red-500 hover:bg-red-50 hover:border-red-200" : "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"}`}
                      disabled={statusSaving}
                      onClick={() => void handleStatusToggle()}
                    >
                      {statusSaving ? "…" : userIsActive ? (ar() ? "تعطيل" : "Disable") : (ar() ? "تفعيل" : "Enable")}
                    </button>
                  )}
                  {(isAdmin || isCS) && user.role === "customer" && (
                    <button
                      className="btn-secondary btn-sm disabled:opacity-50 text-red-600 hover:bg-red-50 hover:border-red-200"
                      onClick={async () => {
                        if (!window.confirm(ar() ? "هل أنت متأكد أنك تريد حذف هذا العميل وجميع بياناته بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to permanently delete this customer and all their associated data? This action cannot be undone.")) return;
                        try {
                          await apiFetch(`/users/${user.id}/all-data`, { method: "DELETE", headers: getAuthHeader() });
                          alert(ar() ? "تم الحذف بنجاح" : "Customer and data deleted successfully.");
                          window.location.reload();
                        } catch (err: any) {
                          alert(err.message || "Failed to delete user data");
                        }
                      }}
                    >
                      {ar() ? "حذف العميل والبيانات" : "Delete Customer & All Data"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── MEMBERSHIPS ── */}
            {tab === "memberships" && (
              <div className="space-y-3">
                {/* Grant Membership (admin or CS) */}
                {(isAdmin || isCS) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs font-bold text-emerald-800 uppercase">{ar() ? "منح عضوية" : "Grant Membership"}</div>
                      <button type="button" onClick={addGrantEnrollmentRow} className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        {ar() ? "إضافة باقة أخرى" : "Add Another"}
                      </button>
                    </div>

                    <div className="space-y-4">
                      {grantEnrollments.map((en, idx) => (
                        <div key={idx} className="relative bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden p-4">
                          {grantEnrollments.length > 1 && (
                            <button type="button" onClick={() => removeGrantEnrollmentRow(idx)} className="absolute top-3 rtl:left-3 ltr:right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors z-10" title={ar() ? "إزالة" : "Remove"}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "اختيار باقة/جلسة" : "Select Offer/Session"}</label>
                              <select className="select-field w-full bg-surface-50" value={en.offerId} onChange={e => updateGrantEnrollment(idx, { offerId: e.target.value })}>
                                <option value="">{ar() ? "-- بدون اشتراك --" : "-- No Membership --"}</option>
                                {allOffers.map((o: any) => <option key={o.id || o._id} value={o.id || o._id}>{ar() ? o.nameAr || o.name : o.name}</option>)}
                              </select>
                            </div>
                            {en.offerId && (
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العيادة (إن وجدت)" : "Clinic (if applicable)"}</label>
                                <select className="select-field w-full bg-surface-50" value={en.clinicId} onChange={e => updateGrantEnrollment(idx, { clinicId: e.target.value })}>
                                  <option value="">{ar() ? "غير محدد" : "None"}</option>
                                  {allClinics.map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          
                          {en.offerId && (
                            <div className="pt-4 mt-4 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "نوع الدفع" : "Purchase Mode"}</label>
                                <select className="select-field w-full" value={en.purchaseMode} onChange={e => updateGrantEnrollment(idx, { purchaseMode: e.target.value })}>
                                  <option value="full">{ar() ? "دفع كامل" : "Full Payment"}</option>
                                  <option value="installments">{ar() ? "أقساط" : "Installments"}</option>
                                  <option value="deposit">{ar() ? "عربون" : "Deposit"}</option>
                                  <option value="free">{ar() ? "عضوية مجانية" : "Free Membership"}</option>
                                  <option value="discount">{ar() ? "خصم خاص" : "Discount"}</option>
                                </select>
                              </div>
                              {en.purchaseMode === "installments" && (
                                <div>
                                  <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "عدد الأقساط" : "Installment Count"}</label>
                                  <select className="select-field w-full" value={en.installmentCount} onChange={e => updateGrantEnrollment(idx, { installmentCount: Number(e.target.value) })}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </div>
                              )}
                              {en.purchaseMode !== "installments" ? (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "المبلغ المدفوع (KWD)" : "Amount Paid (KWD)"}</label>
                                    <input 
                                      type="number" step="0.001" min="0"
                                      className="input-field w-full font-mono text-emerald-700 font-bold"
                                      value={en.amountPaidKwd}
                                      onChange={e => updateGrantEnrollment(idx, { amountPaidKwd: e.target.value })}
                                      disabled={en.purchaseMode === "free"}
                                      placeholder="0.000" 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"}</label>
                                    <select className="select-field w-full" value={en.method} onChange={e => updateGrantEnrollment(idx, { method: e.target.value })}>
                                      <option value="cash">{ar() ? "الدفع في العيادة" : "Paid in Clinic"}</option>
                                      <option value="pos">POS</option>
                                      <option value="bank_transfer">{ar() ? "رابط دفع خارجي" : "External Payment Link"}</option>
                                      <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
                                      <option value="enet">ENET</option>
                                      <option value="wallet">{ar() ? "محفظة كاش باك" : "Cashback Wallet"}</option>
                                      <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                    </select>
                                  </div>
                                </>
                              ) : (
                                <div className="sm:col-span-2 mt-2 space-y-3">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جدول الأقساط" : "Installment Schedule"}</label>
                                  <div className="bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                      <thead className="bg-surface-50 border-b border-surface-200 text-xs text-surface-500 uppercase">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold">#</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "المبلغ" : "Amount (KWD)"}</th>
                                          <th className="px-3 py-2 font-semibold text-center">{ar() ? "مدفوع؟" : "Paid?"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "الطريقة" : "Method"}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-surface-100">
                                        {(en.customInstallments || []).map((inst: any, iIdx: number) => (
                                          <tr key={iIdx}>
                                            <td className="px-3 py-2 font-bold text-surface-500">{iIdx + 1}</td>
                                            <td className="px-3 py-2">
                                              <input type="date" className="input-field text-xs py-1 px-2 w-full min-w-[110px]" value={inst.dueDate} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].dueDate = e.target.value;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <input type="number" step="0.001" className="input-field text-xs py-1 px-2 w-full min-w-[80px]" value={inst.amountKwd} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].amountKwd = e.target.value;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <input type="checkbox" className="w-4 h-4 text-emerald-600 rounded" checked={inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].isPaid = e.target.checked;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <select className="select-field text-xs py-1 px-2 w-full min-w-[100px]" value={inst.method} disabled={!inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].method = e.target.value;
                                                updateGrantEnrollment(idx, { customInstallments: newInsts });
                                              }}>
                                                <option value="cash">{ar() ? "في العيادة" : "In Clinic"}</option>
                                                <option value="pos">POS</option>
                                                <option value="bank_transfer">{ar() ? "رابط دفع" : "Pay Link"}</option>
                                                <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
                                              </select>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              
                              <div className="sm:col-span-2 mt-4 pt-4 border-t border-surface-100">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جلسات سابقة (تاريخية)" : "Historical Sessions"}</label>
                                  <button type="button" onClick={() => {
                                    const newEn = [...grantEnrollments];
                                    if (!newEn[idx].historicalSessions) newEn[idx].historicalSessions = [];
                                    newEn[idx].historicalSessions.push({ date: new Date().toISOString().split('T')[0] });
                                    setGrantEnrollments(newEn);
                                  }} className="text-xs font-bold text-brand-pink-600 hover:underline">
                                    + {ar() ? "إضافة جلسة سابقة" : "Add Past Session"}
                                  </button>
                                </div>
                                <p className="text-[10px] text-surface-500 mb-3 leading-relaxed">{ar() ? "استخدم هذا الخيار لتسجيل الجلسات التي تمت بالفعل في النظام القديم، سيتم خصمها من الباقة واحتساب فترة التبريد (التأخير بين الجلسات) بناءً عليها حتى يتم قفل الحجز لحين انتهاء المدة." : "Log sessions that were already done in a previous system. This will deduct from the package quota and trigger the cooling interval to lock future bookings until the time elapses."}</p>
                                
                                {en.historicalSessions && en.historicalSessions.length > 0 && (
                                  <div className="space-y-2">
                                    {en.historicalSessions.map((hs: any, hsIdx: number) => (
                                      <div key={hsIdx} className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-surface-400 w-6">{hsIdx + 1}.</div>
                                        <input type="date" className="input-field text-xs py-1" value={hs.date} onChange={e => {
                                          const newEn = [...grantEnrollments];
                                          newEn[idx].historicalSessions[hsIdx].date = e.target.value;
                                          setGrantEnrollments(newEn);
                                        }} />
                                        <button type="button" onClick={() => {
                                          const newEn = [...grantEnrollments];
                                          newEn[idx].historicalSessions.splice(hsIdx, 1);
                                          setGrantEnrollments(newEn);
                                        }} className="text-red-500 hover:text-red-700 p-1">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                      <button
                        className="btn-primary"
                        disabled={grantSaving}
                        onClick={() => void handleGrantMembership()}
                      >
                        {grantSaving ? "…" : (ar() ? "حفظ باقات العضوية" : "Grant Memberships")}
                      </button>
                      {grantError && <div className="text-xs text-red-600">{grantError}</div>}
                      {grantSuccess && <div className="text-xs text-emerald-700 font-medium">✓ {ar() ? "تم منح العضوية بنجاح" : "Membership granted successfully"}</div>}
                    </div>
                  </div>
                )}

                {profile.memberships?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد عضويات" : "No memberships"}</div>}
                {profile.memberships?.map((m: any) => {
                  const sessionsLeft = m.maxSessions != null ? m.maxSessions - m.sessionsUsed : null;
                  return (
                    <div key={m.id} className="bg-white rounded-xl border border-surface-100 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-bold text-surface-900 text-sm">{ar() && m.offerNameAr ? m.offerNameAr : m.offerName}</div>
                          <div className="text-xs text-surface-400 font-mono mt-0.5">{m.id}</div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadge(m.status)}`}>{m.status}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-3">
                        <div><span className="text-surface-400">{ar() ? "نوع الشراء" : "Mode"}</span><div className="font-bold mt-0.5">{m.purchaseMode ?? "—"}</div></div>
                        <div>
                          <span className="text-surface-400">{ar() ? "جلسات مستخدمة" : "Sessions Used"}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <button
                              className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-red-100 hover:text-red-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                              disabled={sessionAdjustingId !== null || m.sessionsUsed <= 0}
                              onClick={() => handleAdjustSessions(m.id, -1)}
                              title={ar() ? "تقليل" : "Decrement"}
                            >−</button>
                            <span className="font-bold">{m.sessionsUsed}</span>
                            <button
                              className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-emerald-100 hover:text-emerald-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                              disabled={sessionAdjustingId !== null}
                              onClick={() => handleAdjustSessions(m.id, +1)}
                              title={ar() ? "زيادة" : "Increment"}
                            >+</button>
                          </div>
                        </div>
                        {m.maxSessions != null && (
                          <div>
                            <span className="text-surface-400">{ar() ? "جلسات متبقية" : "Sessions Left"}</span>
                            <div className={`font-bold mt-0.5 ${sessionsLeft != null && sessionsLeft <= 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {sessionsLeft != null ? sessionsLeft : "—"} / {m.maxSessions}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-surface-400">{ar() ? "الأقساط المدفوعة" : "Installments Paid"}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <button
                              className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-red-100 hover:text-red-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                              disabled={installmentAdjustingId !== null || (m.installmentsPaid ?? 0) <= 0}
                              onClick={() => handleAdjustInstallments(m.id, -1)}
                              title={ar() ? "تقليل" : "Decrement"}
                            >−</button>
                            <span className="font-bold">{m.installmentsPaid}</span>
                            <button
                              className="w-5 h-5 rounded flex items-center justify-center bg-surface-100 hover:bg-emerald-100 hover:text-emerald-600 text-surface-500 transition-colors disabled:opacity-40 text-sm font-bold"
                              disabled={installmentAdjustingId !== null}
                              onClick={() => handleAdjustInstallments(m.id, +1)}
                              title={ar() ? "زيادة" : "Increment"}
                            >+</button>
                            <span className="text-surface-400 text-sm">/ {m.installmentCount ?? "—"}</span>
                          </div>
                        </div>
                        <div><span className="text-surface-400">{ar() ? "المبلغ (د.ك)" : "Amount (KWD)"}</span><div className="font-bold mt-0.5">{m.paymentAmountKwd ?? "—"}</div></div>
                        <div><span className="text-surface-400">{ar() ? "التفعيل" : "Activated"}</span><div className="font-bold mt-0.5">{fmt(m.activatedAt)}</div></div>
                        <div><span className="text-surface-400">{ar() ? "الانتهاء" : "Expires"}</span><div className="font-bold mt-0.5">{fmt(m.expiresAt)}</div></div>
                        <div><span className="text-surface-400">{ar() ? "تاريخ الإنشاء" : "Created"}</span><div className="font-bold mt-0.5">{fmt(m.createdAt)}</div></div>
                        {m.purchaseMode === "installments" && m.installmentSchedule && m.installmentSchedule.some((i: any) => !i.paid) && (
                          <div className="sm:col-span-4 mt-2 p-3 bg-amber-50 rounded-xl border border-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-amber-700 font-bold">{ar() ? "المبلغ المتبقي (غير مدفوع)" : "Unpaid Amount Left"}</span>
                              <div className="text-lg font-black text-amber-600">
                                {m.installmentSchedule.filter((i: any) => !i.paid).reduce((sum: number, i: any) => sum + parseFloat(i.amountKwd || "0"), 0).toFixed(3)} KWD
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-amber-700 font-bold">{ar() ? "تواريخ الاستحقاق القادمة" : "Upcoming Due Dates"}</span>
                              <div className="text-xs font-bold text-amber-600 mt-0.5">
                                {m.installmentSchedule.filter((i: any) => !i.paid).map((i: any) => fmt(i.dueDate)).join(" • ")}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-surface-100 flex justify-end">
                        <button
                          onClick={async () => {
                            const confirmCancel = window.confirm(
                              ar()
                                ? "هل أنت متأكد من حذف هذه العضوية؟"
                                : "Are you sure you want to delete this membership?"
                            );
                            if (!confirmCancel) return;
                            try {
                              await apiFetch(`/commerce/admin/user-offers/${m.id}`, {
                                method: "DELETE",
                                headers: getAuthHeader()
                              });
                              const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
                              setProfile(d);
                            } catch (e: any) {
                              alert(e.message || "Failed to cancel membership");
                            }
                          }}
                          className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          {ar() ? "حذف العضوية" : "Delete Membership"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── CASHBACK ── */}
            {tab === "cashback" && (
              <div className="space-y-4">
                {/* Balance summary */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: ar() ? "الرصيد المتاح" : "Unlocked", val: profile.wallet?.unlockedKwd ?? "—", cls: "text-emerald-600" },
                    { label: ar() ? "الرصيد المقفل" : "Locked", val: profile.wallet?.lockedKwd ?? "—", cls: "text-amber-600" },
                    { label: ar() ? "الحد الأقصى" : "Ceiling", val: profile.wallet?.ceilingKwd ?? "—", cls: "text-surface-700" },
                  ].map((item) => (
                    <div key={item.label} className="bg-white rounded-xl border border-surface-100 p-4 text-center">
                      <div className={`text-xl font-black ${item.cls}`}>{item.val}</div>
                      <div className="text-[10px] text-surface-500 uppercase font-bold mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>

                {/* Add / Remove cashback (admin or CS) */}
                {(isAdmin || isCS) && (
                  <div className="bg-white rounded-xl border border-surface-200 p-4">
                    <div className="text-xs font-bold text-surface-700 uppercase mb-3">{ar() ? "تعديل الكاش باك" : "Adjust Cashback"}</div>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder={ar() ? "المبلغ (د.ك)" : "Amount KWD"}
                        className="input-field flex-1 min-w-[120px]"
                        value={cashAmt}
                        onChange={e => setCashAmt(e.target.value)}
                      />
                      {(isAdmin || isCS) && (
                        <input
                          type="text"
                          placeholder={ar() ? "السبب (مطلوب)" : "Reason (required)"}
                          className="input-field flex-1 min-w-[160px]"
                          value={cashReason}
                          onChange={e => setCashReason(e.target.value)}
                        />
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {(isAdmin || isCS) && (
                        <button className="btn-primary btn-sm flex-1 disabled:opacity-50" disabled={cashSaving} onClick={() => void handleCashbackAdjust(1)}>
                          {cashSaving ? "…" : (ar() ? "+ إضافة" : "+ Add")}
                        </button>
                      )}
                      <button className="btn-secondary btn-sm flex-1 text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50" disabled={cashSaving} onClick={() => void handleCashbackAdjust(-1)}>
                        {cashSaving ? "…" : (ar() ? "- خصم" : "- Deduct")}
                      </button>
                    </div>
                    {cashError && <div className="text-xs text-red-600 mt-2">{cashError}</div>}
                  </div>
                )}

                {/* Transaction history */}
                <div className="bg-white rounded-xl border border-surface-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-100 text-xs font-bold text-surface-700 uppercase">{ar() ? "سجل المعاملات" : "Transaction History"}</div>
                  {!profile.wallet?.txns?.length && <div className="p-6 text-center text-sm text-surface-400">{ar() ? "لا توجد معاملات" : "No transactions"}</div>}
                  {profile.wallet?.txns?.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between px-4 py-2.5 border-b border-surface-50 last:border-0">
                      <div>
                        <div className="text-xs font-bold text-surface-900">{t.type}</div>
                        <div className="text-[10px] text-surface-400">{t.reason ?? "—"} · {fmt(t.createdAt)}</div>
                      </div>
                      <div className={`text-sm font-black tabular-nums ${(t.amountKwd ?? "").startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>
                        {(t.amountKwd ?? "").startsWith("-") ? "" : "+"}{t.amountKwd} KWD
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SESSIONS ── */}
            {tab === "sessions" && (
              <div className="space-y-2">
                {profile.sessions?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد جلسات" : "No sessions"}</div>}
                {profile.sessions?.map((s: any) => (
                  <div key={s.id} className="bg-white rounded-xl border border-surface-100 px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-surface-900">{ar() ? (s.offerNameAr || s.offerName) : s.offerName}</div>
                      <div className="text-xs font-mono text-surface-400 mt-0.5" title="Session ID">{s.id}</div>
                      <div className="text-xs text-surface-500 mt-0.5">{ar() ? "طلب بتاريخ" : "Requested"}: {fmt(s.requestedAt)}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${statusBadge(s.status)}`}>{s.status}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── PAYMENTS ── */}
            {tab === "payments" && (
              <div className="space-y-2">
                {profile.payments?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد دفعات" : "No payments"}</div>}
                {profile.payments?.map((p: any) => (
                  <div key={p.id} className="bg-white rounded-xl border border-surface-100 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-bold text-sm text-surface-900">{p.offerName}</div>
                        <div className="text-[10px] text-surface-400 font-mono">{p.id}</div>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${payStatusBadge(p.status)}`}>{p.status}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div><span className="text-surface-400">{ar() ? "المبلغ" : "Amount"}</span><div className="font-black text-brand-pink-600 mt-0.5">{p.amountKwd} KWD</div></div>
                      <div><span className="text-surface-400">{ar() ? "الطريقة" : "Method"}</span><div className="font-bold mt-0.5">{p.method}</div></div>
                      <div><span className="text-surface-400">{ar() ? "الغرض" : "Purpose"}</span><div className="font-bold mt-0.5">{p.purpose}</div></div>
                      <div><span className="text-surface-400">{ar() ? "القسط" : "Installment"}</span><div className="font-bold mt-0.5">{p.installmentNumber ?? "—"}</div></div>
                      <div><span className="text-surface-400">{ar() ? "كاش باك مطبق" : "Cashback Applied"}</span><div className="font-bold mt-0.5">{p.cashbackAppliedKwd ?? "0.000"} KWD</div></div>
                      <div><span className="text-surface-400">{ar() ? "تأكيد" : "Confirmed"}</span><div className="font-bold mt-0.5">{fmt(p.confirmedAt)}</div></div>
                      <div><span className="text-surface-400">{ar() ? "تاريخ الإنشاء" : "Created"}</span><div className="font-bold mt-0.5">{fmt(p.createdAt)}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── KYC ── */}
            {tab === "kyc" && (
              <div className="space-y-4">
                {!profile.kyc && (
                  <div className="text-center py-8 text-surface-400 text-sm">
                    <svg className="w-10 h-10 mx-auto mb-2 text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" /></svg>
                    {ar() ? "لم يتم تقديم طلب KYC بعد" : "No KYC submission yet"}
                  </div>
                )}
                {profile.kyc && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-surface-200 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-surface-900">{ar() ? "بيانات الهوية" : "Identity Details"}</h4>
                        <div className="flex items-center gap-2">
                          {profile.kyc.status === "approved" && (
                            <button onClick={handleUnverify} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                              {ar() ? "إلغاء التوثيق" : "Unverify Account"}
                            </button>
                          )}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.kyc.status === "approved" ? "bg-emerald-50 text-emerald-700" : profile.kyc.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                            {profile.kyc.status}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-surface-500">{ar() ? "رقم الهوية المدنية (مخفي)" : "Civil ID (masked)"}</div>
                          <div className="mt-1 font-black text-surface-900 tracking-widest text-lg font-mono">{profile.kyc.civilIdNumberMasked}</div>
                        </div>
                        <div>
                          <div className="text-xs text-surface-500">{ar() ? "تاريخ التقديم" : "Submitted"}</div>
                          <div className="mt-1 font-bold text-surface-900">{fmt(profile.kyc.createdAt)}</div>
                        </div>
                        {profile.kyc.reviewedAt && (
                          <div>
                            <div className="text-xs text-surface-500">{ar() ? "تاريخ المراجعة" : "Reviewed"}</div>
                            <div className="mt-1 font-bold text-surface-900">{fmt(profile.kyc.reviewedAt)}</div>
                          </div>
                        )}
                        {profile.kyc.rejectionReason && (
                          <div className="sm:col-span-2">
                            <div className="text-xs text-surface-500">{ar() ? "سبب الرفض" : "Rejection Reason"}</div>
                            <div className="mt-1 text-sm text-red-600 font-medium">{profile.kyc.rejectionReason}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: ar() ? "صورة الهوية (الأمامية)" : "Civil ID — Front", ref: profile.kyc.civilIdFrontRef },
                        { label: ar() ? "صورة الهوية (الخلفية)" : "Civil ID — Back", ref: profile.kyc.civilIdBackRef },
                        { label: ar() ? "التوقيع" : "Signature", ref: profile.kyc.signatureRef },
                      ].filter(d => d.ref).map((doc) => (
                        <div key={doc.label} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                          <div className="px-3 py-2 border-b border-surface-100 text-xs font-bold text-surface-600">{doc.label}</div>
                          <div className="p-3">
                            <a href={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} target="_blank" rel="noreferrer" className="block w-full">
                              <img
                                src={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`}
                                alt={doc.label}
                                className="w-full h-36 object-contain rounded-lg bg-surface-50 hover:opacity-90 transition-opacity"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </a>
                            <a href={doc.ref.startsWith('http') ? doc.ref : `/uploads/${doc.ref}`} target="_blank" rel="noreferrer" className="text-[10px] text-surface-400 mt-1 truncate font-mono block hover:text-brand-pink-500 hover:underline">
                              {doc.ref}
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── NOTES ── */}
            {tab === "notes" && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                  <h4 className="font-bold text-surface-900 mb-4">{ar() ? "إضافة ملاحظة" : "Add Note"}</h4>
                  <textarea
                    className="input-field w-full h-24 p-3 mb-3 resize-none"
                    placeholder={ar() ? "اكتب ملاحظتك هنا..." : "Type your note here..."}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <button
                      className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all disabled:opacity-50"
                      onClick={handleAddNote}
                      disabled={noteSaving || !newNote.trim()}
                    >
                      {noteSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ الملاحظة" : "Save Note")}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {profile.user.staffNotes?.length > 0 ? (
                    profile.user.staffNotes.slice().reverse().map((note: any, idx: number) => (
                      <div key={note.id || idx} className="bg-surface-50 rounded-xl p-4 border border-surface-100">
                        <div className="text-surface-800 text-sm whitespace-pre-wrap leading-relaxed">{note.text}</div>
                        <div className="flex items-center gap-2 mt-3 text-xs text-surface-400">
                          <span className="font-bold text-surface-500">{note.authorName}</span>
                          <span>•</span>
                          <span>{fmt(note.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-surface-400 text-sm">
                      <svg className="w-10 h-10 mx-auto mb-2 text-surface-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      {ar() ? "لا توجد ملاحظات بعد" : "No notes yet"}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Payment Method Modal for Installment Increment */}
      {installMethodModal && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4" onClick={() => setInstallMethodModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-900 mb-4">{ar() ? "طريقة الدفع" : "Payment Method"}</h3>
            <select
              className="select-field w-full mb-4"
              value={installMethodValue}
              onChange={e => setInstallMethodValue(e.target.value)}
            >
              <option value="cash">{ar() ? "نقد" : "Cash"}</option>
              <option value="knet">{ar() ? "كي نت" : "KNET"}</option>
              <option value="bank_transfer">{ar() ? "تحويل بنكي" : "Bank Transfer"}</option>
              <option value="free_package">{ar() ? "باقة مجانية" : "Free Package"}</option>
              <option value="card">{ar() ? "بطاقة ائتمان" : "Credit Card"}</option>
              <option value="link">{ar() ? "رابط دفع" : "Payment Link"}</option>
              <option value="other">{ar() ? "أخرى" : "Other"}</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                onClick={() => setInstallMethodModal(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all"
                onClick={() => {
                  const mid = installMethodModal.membershipId;
                  setInstallMethodModal(null);
                  handleAdjustInstallments(mid, +1, installMethodValue);
                }}
              >
                {ar() ? "تأكيد الدفع" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionDateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-slide-up relative">
            <h3 className="text-lg font-bold text-surface-900 mb-2">{ar() ? "تاريخ الجلسة" : "Session Date"}</h3>
            <p className="text-sm text-surface-500 mb-4">{ar() ? "الرجاء إدخال تاريخ الجلسة" : "Please enter the session date"}</p>
            <input
              type="date"
              className="input-field w-full mb-4"
              value={sessionDateValue}
              onChange={(e) => setSessionDateValue(e.target.value)}
            />
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-xl text-sm font-bold text-surface-500 hover:bg-surface-100 transition-colors"
                onClick={() => setSessionDateModal(null)}
              >
                {ar() ? "إلغاء" : "Cancel"}
              </button>
              <button
                className="btn-primary px-5 py-2 text-sm rounded-xl font-bold transition-all"
                onClick={submitSessionDate}
                disabled={!sessionDateValue}
              >
                {ar() ? "تأكيد" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ALL_ROLES = ["customer", "admin", "cs", "finance", "clinicStaff", "legal", "cs_director", "user"] as const;
const ROLE_COLORS: Record<string, string> = {
  customer: "bg-blue-50 text-blue-700",
  admin: "bg-purple-50 text-purple-700",
  cs: "bg-amber-50 text-amber-700",
  legal: "bg-indigo-50 text-indigo-700",
  cs_director: "bg-purple-50 text-purple-700",
  finance: "bg-emerald-50 text-emerald-700",
  clinicStaff: "bg-pink-50 text-pink-700",
  user: "bg-surface-100 text-surface-600",
};

export function UsersManager({ from, to }: { from?: string; to?: string }) {
  const { auth, login, getAuthHeader, impersonateUser } = useAuth();
  const canExport = auth?.role === "admin" || auth?.role === "finance";
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [users, setUsers] = useState<any[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  
  type CustomInstallment = { dueDate: string; amountKwd: string; isPaid: boolean; method: string; };
  type EnrollmentRow = { 
    offerId: string; 
    clinicId: string; 
    purchaseMode: string; 
    amountPaidKwd: string; 
    method: string; 
    isVerified: boolean; 
    installmentCount: number;
    customInstallments?: CustomInstallment[];
    historicalSessions?: { date: string }[];
  };
  
  const emptyRow: EnrollmentRow = { offerId: "", clinicId: "", purchaseMode: "full", amountPaidKwd: "", method: "cash", isVerified: true, installmentCount: 2, historicalSessions: [] };
  
  const [addForm, setAddForm] = useState({
    phone: "", fullName: "", email: "", password: "",
    enrollments: [{ ...emptyRow }] as EnrollmentRow[],
  });
  
  const { data: offersData } = useApi<{ items: any[] }>("/offers/admin");
  const offers = offersData?.items || [];
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const clinics = clinicsData?.items || [];
  const [addingUser, setAddingUser] = useState(false);

  const generateInstallments = (count: number, offerId: string): CustomInstallment[] => {
    const offer = offersData?.items?.find((o: any) => o.id === offerId || o._id === offerId);
    const total = offer ? parseFloat(offer.subscriptionPriceKwd || "0") : 0;
    const baseEach = Math.floor((total * 1000) / count) / 1000;
    const remainder = total - (baseEach * count);
    
    const arr: CustomInstallment[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + (i * 30));
      const amt = baseEach + (i === 0 ? remainder : 0);
      arr.push({
        dueDate: d.toISOString().split("T")[0],
        amountKwd: amt.toFixed(3),
        isPaid: i === 0,
        method: "cash"
      });
    }
    return arr;
  };

  const updateEnrollment = (idx: number, patch: Partial<EnrollmentRow>) => {
    setAddForm(p => {
      const newList = [...p.enrollments];
      const current = newList[idx];
      
      if (patch.purchaseMode === "installments" || (patch.installmentCount && current.purchaseMode === "installments")) {
        const count = patch.installmentCount || current.installmentCount || 2;
        patch.customInstallments = generateInstallments(count, patch.offerId || current.offerId);
      }
      
      newList[idx] = { ...current, ...patch };
      return { ...p, enrollments: newList };
    });
  };
  const addEnrollmentRow = () => {
    setAddForm(p => ({ ...p, enrollments: [...p.enrollments, { ...emptyRow }] }));
  };
  const removeEnrollmentRow = (idx: number) => {
    setAddForm(p => ({ ...p, enrollments: p.enrollments.filter((_, i) => i !== idx) }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const body: any = {
        phone: addForm.phone, fullName: addForm.fullName, email: addForm.email, password: addForm.password,
        enrollments: addForm.enrollments.filter(en => en.offerId),
      };
      await apiFetch("/users/admin/manual-enroll", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setShowAddModal(false);
      loadUsers();
      setAddForm({ phone: "", fullName: "", email: "", password: "", enrollments: [{ ...emptyRow }] });
    } catch (err: any) {
      alert(ar() ? "حدث خطأ: " + err.message : "An error occurred: " + err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const loadUsers = () => {
    interface AdminUserItem {
      id: string;
      username?: string;
      fullName?: string;
      phone?: string;
      role: string;
      isActive: boolean;
      isConfirmationCallDone?: boolean;
      referredByUsername?: string | null;
    }
    interface AdminUsersResponse { items: AdminUserItem[]; }
    let url = "/users/admin?";
    if (from) url += `from=${from}&`;
    if (to) url += `to=${to}`;
    apiFetch(url, { headers: getAuthHeader() })
      .then((d) => {
        setUsers(((d as AdminUsersResponse).items || []).map((u) => ({
          id: u.id,
          fullName: u.fullName,
          username: u.username,
          name: u.fullName || u.username || u.phone || "—",
          phone: u.phone || "—",
          role: u.role,
          status: u.isActive ? "Active" : "Disabled",
          kyc: u.isActive,
          isConfirmationCallDone: u.isConfirmationCallDone ?? false,
          referredByUsername: u.referredByUsername ?? null
        })));
      })
      .catch((err: unknown) => {
        console.error("[UsersManager] Failed to load users:", err);
      });
  };

  useEffect(() => { loadUsers(); }, [from, to]);

  const filtered = users.filter(u => {
    const matchSearch = (u.name ?? "").toLowerCase().includes(search.toLowerCase()) || (u.phone ?? "").includes(search);
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? u.kyc : !u.kyc);
    return matchSearch && matchRole && matchStatus;
  });

  const openUser = (u: any) => { setSelectedUser(u); };

  const toggleConfirmationCall = async (id: string, currentVal: boolean) => {
    try {
      await apiFetch(`/users/admin/${id}`, {
        method: "PATCH",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isConfirmationCallDone: !currentVal }),
      });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, isConfirmationCallDone: !currentVal } : u));
    } catch (e: any) {
      alert(ar() ? "فشل التحديث: " + e.message : "Update failed: " + e.message);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إدارة المستخدمين" : "User Management"}</h3>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canExport && (
            <button
              className="btn-secondary btn-sm flex items-center justify-center gap-1.5 text-emerald-700 hover:bg-emerald-50 border-emerald-200 flex-1 sm:flex-none"
              onClick={async () => {
                const headers = getAuthHeader() as Record<string, string> | undefined;
                const res = await fetch(`${API_BASE_URL}/users/admin/export/all`, { headers });
                const blob = await res.blob();
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "belamonda_all_users_report.xlsx";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {ar() ? "تصدير الكل" : "Export All"}
            </button>
          )}
          <button
            className="btn-primary btn-sm flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            onClick={() => setShowAddModal(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            {ar() ? "إضافة مستخدم" : "Add User"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="relative">
          <input
            className="input-field w-full pl-9 h-10"
            placeholder={ar() ? "بحث بالاسم أو الهاتف..." : "Search name or phone..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <svg className="w-4 h-4 absolute left-3 top-3 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select
          className="select-field w-full h-10"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="all">{ar() ? "كل الأدوار" : "All roles"}</option>
          <option value="customer">{ar() ? "عميل" : "Customer"}</option>
          <option value="admin">{ar() ? "مدير" : "Admin"}</option>
          <option value="cs">{ar() ? "خدمة عملاء" : "CS"}</option>
          <option value="finance">{ar() ? "مالية" : "Finance"}</option>
          <option value="clinicStaff">{ar() ? "موظف عيادة" : "Clinic Staff"}</option>
          <option value="legal">{ar() ? "قانوني" : "Legal"}</option>
          <option value="cs_director">{ar() ? "مدير خدمة العملاء" : "CS Director"}</option>
          <option value="user">{ar() ? "مستخدم" : "User"}</option>
        </select>
        <select
          className="select-field w-full h-10"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">{ar() ? "كل الحالات" : "All statuses"}</option>
          <option value="active">{ar() ? "نشط" : "Active"}</option>
          <option value="disabled">{ar() ? "معطّل" : "Disabled"}</option>
        </select>
      </div>

      {selectedUser ? (
        <UserProfilePanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onRoleChange={(role) => {
            const updated = { ...selectedUser, role };
            setSelectedUser(updated);
            setUsers(users.map(u => u.id === updated.id ? updated : u));
          }}
          onStatusChange={(active) => {
            const updated = { ...selectedUser, kyc: active, status: active ? "Active" : "Disabled" };
            setSelectedUser(updated);
            setUsers(users.map(u => u.id === updated.id ? updated : u));
          }}
          onLoginAs={() => void impersonateUser(selectedUser.id).catch(e => alert(e.message))}
        />
      ) : (
        <div className="card-elevated overflow-hidden bg-white">
          {/* Mobile view (Cards) */}
          <div className="md:hidden divide-y divide-surface-100">
            {filtered.map((u: any) => (
              <div key={u.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-pink-50 flex items-center justify-center text-sm font-bold text-brand-pink-600 flex-shrink-0">
                      {(u.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-surface-900">{u.fullName || u.username || u.phone}</div>
                      <div className="text-xs text-surface-500">{u.phone}</div>
                    </div>
                  </div>
                  <button
                    className="text-brand-pink-600 font-bold text-xs px-3 py-1.5 bg-brand-pink-50 rounded-lg shrink-0"
                    onClick={() => openUser(u)}
                  >
                    {ar() ? "إدارة" : "Manage"}
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-surface-100 text-surface-600"}`}>{u.role}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.kyc ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{u.kyc ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}</span>
                  {u.id && parseInt(u.id.slice(-1), 16) > 12 && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200">🔥 High</span>}
                  {u.id && parseInt(u.id.slice(-2,-1), 16) < 3 && <span className="bg-surface-100 text-surface-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-surface-200">💤</span>}
                  {u.referredByUsername && <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200">🔗</span>}
                  <div className="flex items-center gap-1 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-surface-600 cursor-pointer" onClick={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)}>
                    <input type="checkbox" checked={u.isConfirmationCallDone} readOnly className="w-3 h-3 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                    <span>{ar() ? "اتصال التأكيد" : "Confirmed"}</span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-surface-500 text-sm">{ar() ? "لا يوجد مستخدمين" : "No users found"}</div>
            )}
          </div>

          {/* Desktop view (Table) */}
          <div className="overflow-x-auto hidden md:block">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{ar() ? "الاسم" : "Name"}</th>
                  <th>{ar() ? "الرقم" : "Phone/Contact"}</th>
                  <th>{ar() ? "الصلاحية" : "Role"}</th>
                  <th>{ar() ? "الحالة" : "Status"}</th>
                  <th>{ar() ? "مؤشرات" : "Flags"}</th>
                  <th>{ar() ? "تأكيد الاتصال" : "Confirmation"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u: any) => (
                  <tr key={u.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-pink-50 flex items-center justify-center text-xs font-bold text-brand-pink-600">
                          {(u.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div>{u.fullName || u.username || u.phone}</div>
                          {u.fullName && u.username && (
                            <div className="text-[11px] text-surface-400">@{u.username}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{u.phone}</td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? "bg-surface-100 text-surface-600"}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.kyc ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {u.kyc ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 flex-wrap">
                        {u.id && parseInt(u.id.slice(-1), 16) > 12 && (
                           <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-200" title="High Usage">🔥 {ar() ? "استخدام عالي" : "High Usage"}</span>
                        )}
                        {u.id && parseInt(u.id.slice(-2,-1), 16) < 3 && (
                           <span className="bg-surface-100 text-surface-500 text-[10px] font-bold px-1.5 py-0.5 rounded border border-surface-200" title="Dormant">💤 {ar() ? "خامل" : "Dormant"}</span>
                        )}
                        {u.referredByUsername && (
                           <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-200" title="Referred">🔗 {ar() ? "إحالة" : "Referred"}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <label className="flex items-center gap-1.5 bg-surface-50 border border-surface-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-surface-600 cursor-pointer hover:bg-surface-100 transition-colors w-max" title={ar() ? "تم الاتصال لتأكيد العميل" : "Customer confirmation call done"}>
                        <input type="checkbox" checked={u.isConfirmationCallDone} onChange={() => toggleConfirmationCall(u.id, u.isConfirmationCallDone)} className="w-3 h-3 text-brand-pink-600 focus:ring-brand-pink-500 border-surface-300 rounded cursor-pointer" />
                        <span>{ar() ? "تأكيد اتصال" : "Confirmed"}</span>
                      </label>
                    </td>
                    <td className="text-right">
                      <button
                        className="text-brand-pink-600 hover:text-brand-pink-800 font-medium text-sm px-4 py-1.5 bg-brand-pink-50 rounded-lg transition-colors hover:bg-brand-pink-100"
                        onClick={() => openUser(u)}
                      >
                        {ar() ? "إدارة" : "Manage"}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
                          </svg>
                        </div>
                        <div className="empty-state-title">{ar() ? "لا يوجد مستخدمين" : "No users found"}</div>
                        <div className="empty-state-sub">{ar() ? "جربي تعديل الفلاتر أو البحث." : "Try adjusting your filters or search."}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-surface-100 text-xs text-surface-400">
            {filtered.length} {ar() ? "مستخدم" : "user(s)"}{filterRole !== "all" || filterStatus !== "all" || search ? ` ${ar() ? "من" : "of"} ${users.length}` : ""}
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-surface-50">
              <h3 className="font-bold text-surface-900">{ar() ? "إضافة مستخدم جديد وتسجيل باقات" : "Add User & Enroll Memberships"}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-surface-400 hover:text-surface-600 transition-colors p-1"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form id="addUserForm" onSubmit={handleAddSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"} *</label>
                    <input required type="text" className="input-field" value={addForm.fullName} onChange={e => setAddForm(p => ({ ...p, fullName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone"} *</label>
                    <input required type="text" className="input-field" value={addForm.phone} onChange={e => setAddForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 965..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني (اختياري)" : "Email (Optional)"}</label>
                    <input type="email" className="input-field" value={addForm.email} onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور" : "Password"}</label>
                    <input type="text" className="input-field" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} placeholder={ar() ? "اتركه فارغ = رقم الهاتف" : "Leave empty = phone number"} />
                  </div>
                </div>

                <div className="border-t border-surface-200 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-surface-900">{ar() ? "الاشتراكات والدفع" : "Memberships & Payment"}</h4>
                    <button type="button" onClick={addEnrollmentRow} className="text-xs font-bold text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      {ar() ? "إضافة باقة" : "Add Membership"}
                    </button>
                  </div>
                  <div className="space-y-4">
                    {addForm.enrollments.map((en, idx) => (
                      <div key={idx} className="relative bg-white rounded-xl border border-surface-200 shadow-sm overflow-hidden transition-all hover:border-brand-pink-200">
                        {addForm.enrollments.length > 1 && (
                          <button type="button" onClick={() => removeEnrollmentRow(idx)} className="absolute top-3 rtl:left-3 ltr:right-3 w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors z-10" title={ar() ? "إزالة" : "Remove"}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                        <div className="px-5 py-3 border-b border-surface-100 bg-surface-50 flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-pink-100 text-brand-pink-700 text-xs font-black">{idx + 1}</span>
                          <span className="text-xs font-bold uppercase tracking-wider text-surface-600">{ar() ? "تفاصيل الباقة" : "Membership Details"}</span>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "اختيار باقة/جلسة" : "Select Offer/Session"}</label>
                              <select className="select-field w-full bg-surface-50" value={en.offerId} onChange={e => updateEnrollment(idx, { offerId: e.target.value })}>
                                <option value="">{ar() ? "-- بدون اشتراك --" : "-- No Membership --"}</option>
                                {offers.map((o: any) => <option key={o.id || o._id} value={o.id || o._id}>{ar() ? o.nameAr || o.name : o.name}</option>)}
                              </select>
                            </div>
                            {en.offerId && (
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "العيادة (إن وجدت)" : "Clinic (if applicable)"}</label>
                                <select className="select-field w-full bg-surface-50" value={en.clinicId} onChange={e => updateEnrollment(idx, { clinicId: e.target.value })}>
                                  <option value="">{ar() ? "غير محدد" : "None"}</option>
                                  {clinics.map((c: any) => <option key={c.id || c._id} value={c.id || c._id}>{ar() ? c.nameAr || c.nameEn : c.nameEn}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          
                          {en.offerId && (
                            <div className="pt-4 border-t border-surface-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "نوع الدفع" : "Purchase Mode"}</label>
                                <select className="select-field w-full" value={en.purchaseMode} onChange={e => updateEnrollment(idx, { purchaseMode: e.target.value })}>
                                  <option value="full">{ar() ? "دفع كامل" : "Full Payment"}</option>
                                  <option value="installments">{ar() ? "أقساط" : "Installments"}</option>
                                  <option value="deposit">{ar() ? "عربون" : "Deposit"}</option>
                                  <option value="free">{ar() ? "عضوية مجانية" : "Free Membership"}</option>
                                  <option value="discount">{ar() ? "خصم خاص" : "Discount"}</option>
                                </select>
                              </div>
                              {en.purchaseMode === "installments" && (
                                <div>
                                  <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "عدد الأقساط" : "Installment Count"}</label>
                                  <select className="select-field w-full" value={en.installmentCount} onChange={e => updateEnrollment(idx, { installmentCount: Number(e.target.value) })}>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                  </select>
                                </div>
                              )}
                              {en.purchaseMode !== "installments" ? (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "المبلغ المدفوع اليوم (KWD)" : "Amount Paid Today (KWD)"}</label>
                                    <input type="number" step="0.001" className="input-field w-full font-mono text-brand-pink-700 font-bold" value={en.amountPaidKwd} onChange={e => updateEnrollment(idx, { amountPaidKwd: e.target.value })} placeholder="0.000" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "طريقة الدفع" : "Payment Method"}</label>
                                    <select className="select-field w-full" value={en.method} onChange={e => updateEnrollment(idx, { method: e.target.value })}>
                                      <option value="cash">{ar() ? "الدفع في العيادة" : "Paid in Clinic"}</option>
                                      <option value="pos">POS</option>
                                      <option value="bank_transfer">{ar() ? "رابط دفع خارجي" : "External Payment Link"}</option>
                                      <option value="enet">ENET</option>
                                      <option value="wallet">{ar() ? "محفظة كاش باك" : "Cashback Wallet"}</option>
                                      <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                    </select>
                                  </div>
                                </>
                              ) : (
                                <div className="sm:col-span-2 mt-2 space-y-3">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جدول الأقساط" : "Installment Schedule"}</label>
                                  <div className="bg-white border border-surface-200 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                      <thead className="bg-surface-50 border-b border-surface-200 text-xs text-surface-500 uppercase">
                                        <tr>
                                          <th className="px-3 py-2 font-semibold">#</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "تاريخ الاستحقاق" : "Due Date"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "المبلغ" : "Amount (KWD)"}</th>
                                          <th className="px-3 py-2 font-semibold text-center">{ar() ? "مدفوع؟" : "Paid?"}</th>
                                          <th className="px-3 py-2 font-semibold">{ar() ? "الطريقة" : "Method"}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-surface-100">
                                        {(en.customInstallments || []).map((inst, iIdx) => (
                                          <tr key={iIdx}>
                                            <td className="px-3 py-2 font-bold text-surface-500">{iIdx + 1}</td>
                                            <td className="px-3 py-2">
                                              <input type="date" className="input-field text-xs py-1 px-2 w-full min-w-[110px]" value={inst.dueDate} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].dueDate = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <input type="number" step="0.001" className="input-field text-xs py-1 px-2 w-full min-w-[80px]" value={inst.amountKwd} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].amountKwd = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                              <input type="checkbox" className="w-4 h-4 text-brand-pink-600 rounded" checked={inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].isPaid = e.target.checked;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }} />
                                            </td>
                                            <td className="px-3 py-2">
                                              <select className="select-field text-xs py-1 px-2 w-full min-w-[100px]" value={inst.method} disabled={!inst.isPaid} onChange={e => {
                                                const newInsts = [...(en.customInstallments || [])];
                                                newInsts[iIdx].method = e.target.value;
                                                updateEnrollment(idx, { customInstallments: newInsts });
                                              }}>
                                                <option value="cash">{ar() ? "في العيادة" : "In Clinic"}</option>
                                                <option value="pos">POS</option>
                                                <option value="bank_transfer">{ar() ? "رابط دفع" : "Pay Link"}</option>
                                                <option value="enet">ENET</option>
                                                <option value="other">{ar() ? "أخرى" : "Other"}</option>
                                              </select>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <div className="px-4 py-2 bg-surface-50 border-t border-surface-200 flex justify-between text-xs font-bold text-surface-600">
                                      <span>{ar() ? "المتبقي:" : "Amount Left:"}</span>
                                      <span>
                                        {Math.max(0, (offers.find((o: any) => o.id === en.offerId || o._id === en.offerId)?.subscriptionPriceKwd || 0) - (en.customInstallments || []).reduce((sum, inst) => sum + (parseFloat(inst.amountKwd) || 0), 0)).toFixed(3)} KWD
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="sm:col-span-2 mt-4 pt-4 border-t border-surface-100">
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-xs font-bold text-surface-700">{ar() ? "جلسات سابقة (تاريخية)" : "Historical Sessions"}</label>
                                  <button type="button" onClick={() => {
                                    const newEn = [...addForm.enrollments];
                                    if (!newEn[idx].historicalSessions) newEn[idx].historicalSessions = [];
                                    newEn[idx].historicalSessions!.push({ date: new Date().toISOString().split('T')[0] });
                                    setAddForm({ ...addForm, enrollments: newEn });
                                  }} className="text-xs font-bold text-brand-pink-600 hover:underline">
                                    + {ar() ? "إضافة جلسة سابقة" : "Add Past Session"}
                                  </button>
                                </div>
                                <p className="text-[10px] text-surface-500 mb-3 leading-relaxed">{ar() ? "استخدم هذا الخيار لتسجيل الجلسات التي تمت بالفعل في النظام القديم، سيتم خصمها من الباقة واحتساب فترة التبريد (التأخير بين الجلسات) بناءً عليها حتى يتم قفل الحجز لحين انتهاء المدة." : "Log sessions that were already done in a previous system. This will deduct from the package quota and trigger the cooling interval to lock future bookings until the time elapses."}</p>
                                
                                {en.historicalSessions && en.historicalSessions.length > 0 && (
                                  <div className="space-y-2">
                                    {en.historicalSessions.map((hs: any, hsIdx: number) => (
                                      <div key={hsIdx} className="flex items-center gap-2">
                                        <div className="text-xs font-bold text-surface-400 w-6">{hsIdx + 1}.</div>
                                        <input type="date" className="input-field text-xs py-1" value={hs.date} onChange={e => {
                                          const newEn = [...addForm.enrollments];
                                          newEn[idx].historicalSessions![hsIdx].date = e.target.value;
                                          setAddForm({ ...addForm, enrollments: newEn });
                                        }} />
                                        <button type="button" onClick={() => {
                                          const newEn = [...addForm.enrollments];
                                          newEn[idx].historicalSessions!.splice(hsIdx, 1);
                                          setAddForm({ ...addForm, enrollments: newEn });
                                        }} className="text-red-500 hover:text-red-700 p-1">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="sm:col-span-2 mt-4 bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-start gap-3">
                                <div className="flex items-center h-5">
                                  <input type="checkbox" id={`verifyPay-${idx}`} checked={en.isVerified} onChange={e => updateEnrollment(idx, { isVerified: e.target.checked })} className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-emerald-300" />
                                </div>
                                <div>
                                  <label htmlFor={`verifyPay-${idx}`} className="text-sm text-emerald-800 font-bold cursor-pointer block leading-none">{ar() ? "الدفع مؤكد وموثق؟ (تفعيل فوري)" : "Payment is verified? (Instant Activation)"}</label>
                                  <p className="text-xs text-emerald-600 mt-1">{ar() ? "عند التفعيل سيتم إرسال إشعار للمستخدم وإتاحة الباقة في حسابه." : "When checked, the membership will be instantly available to the user."}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>
            <div className="px-6 py-4 border-t border-surface-100 bg-surface-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">{ar() ? "إلغاء" : "Cancel"}</button>
              <button type="submit" form="addUserForm" disabled={addingUser} className="btn-primary">
                {addingUser ? (ar() ? "جاري الإضافة..." : "Adding...") : (ar() ? "إضافة وحفظ" : "Add & Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reservations Panel ──
function AdminReservationsPanel() {
  const { data, loading } = useAdminReservations();
  const items: ReservationItem[] = data?.items ?? [];

  const statusLabel = (r: ReservationItem) => {
    if (r.status === "reserved") return { en: "Reserved", ar: "محجوز", cls: "bg-blue-50 text-blue-700" };
    if (r.status === "active") return { en: "Converted", ar: "تحويل", cls: "bg-emerald-50 text-emerald-700" };
    if (r.status === "expired") return { en: "Expired", ar: "منتهي", cls: "bg-surface-100 text-surface-600" };
    if (r.status === "cancelled") return { en: "Cancelled", ar: "ملغي", cls: "bg-red-50 text-red-600" };
    return { en: r.status, ar: r.status, cls: "bg-surface-100 text-surface-600" };
  };

  const planLabel = (plan?: string) => {
    if (!plan) return "—";
    const map: Record<string, string> = { full: "Full", installments_2: "2×", installments_3: "3×", installments_4_enet: "4× ENET" };
    return map[plan] ?? plan;
  };

  const reserved = items.filter((r) => r.status === "reserved");
  const converted = items.filter((r) => r.status === "active");
  const expired = items.filter((r) => r.status === "expired" || r.status === "cancelled");
  const depositTotal = items.reduce((s, r) => s + parseFloat(r.depositAmountKwd ?? "0"), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "حجوزات العربون" : "Deposit Reservations"}</h2>
        <p className="text-sm text-surface-500 mt-1">
          {ar() ? "جميع عمليات الحجز عبر دفع العربون وحالة التحويل." : "All deposit-based reservations and their conversion status."}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-elevated p-4 bg-white border-l-4 border-l-blue-400">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "حجوزات نشطة" : "Active"}</div>
          <div className="text-3xl font-black text-blue-600 mt-1">{reserved.length}</div>
        </div>
        <div className="card-elevated p-4 bg-white border-l-4 border-l-emerald-400">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "تم التحويل" : "Converted"}</div>
          <div className="text-3xl font-black text-emerald-600 mt-1">{converted.length}</div>
        </div>
        <div className="card-elevated p-4 bg-white border-l-4 border-l-surface-300">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "منتهية/ملغية" : "Expired / Cancelled"}</div>
          <div className="text-3xl font-black text-surface-500 mt-1">{expired.length}</div>
        </div>
        <div className="card-elevated p-4 bg-white border-l-4 border-l-brand-pink-400">
          <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{ar() ? "إجمالي العربون" : "Total Deposits"}</div>
          <div className="text-3xl font-black text-brand-pink-600 mt-1">{depositTotal.toFixed(3)} <span className="text-sm font-medium text-surface-400">KWD</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-surface-400">{ar() ? "جاري التحميل…" : "Loading…"}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-surface-400">{ar() ? "لا توجد حجوزات عربون بعد" : "No deposit reservations yet"}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "العرض" : "Offer"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "المستخدم" : "User"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "العربون" : "Deposit"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "الخطة المفضّلة" : "Pref. Plan"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "انتهاء الحجز" : "Expiry"}</th>
                  <th className="px-4 py-3 text-left font-bold text-surface-600">{ar() ? "تاريخ الإنشاء" : "Created"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {items.map((r) => {
                  const sl = statusLabel(r);
                  return (
                    <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-surface-900">{r.offerName || r.offerId}</td>
                      <td className="px-4 py-3 text-surface-600 font-mono text-xs">{r.userId.slice(-8)}</td>
                      <td className="px-4 py-3 font-bold text-brand-pink-600">{r.depositAmountKwd ?? "—"} KWD</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-md ${sl.cls}`}>{ar() ? sl.ar : sl.en}</span>
                      </td>
                      <td className="px-4 py-3 text-surface-600">{planLabel(r.reservationPreferredPlan)}</td>
                      <td className="px-4 py-3 text-surface-600 text-xs">
                        {r.reservationExpiresAt
                          ? fmtDate(r.reservationExpiresAt)
                          : r.status === "active" ? <span className="text-emerald-600 font-medium">{ar() ? "تم التحويل" : "Converted"}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">{fmtDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ──
const AUDIT_ROLE_COLORS: Record<string, string> = {
  admin:       "bg-red-50 text-red-700",
  cs:          "bg-blue-50 text-blue-700",
  finance:     "bg-purple-50 text-purple-700",
  clinicStaff: "bg-orange-50 text-orange-700",
  customer:    "bg-emerald-50 text-emerald-700",
  system:      "bg-surface-200 text-surface-600",
};

const ACTION_LABELS: Record<string, string> = {
  create_offer:      "Create Offer",
  update_offer:      "Update Offer",
  delete_offer:      "Delete Offer",
  freeze_user:       "Freeze User",
  unfreeze_user:     "Unfreeze User",
  change_user_role:  "Change Role",
  update_user:       "Update User",
  approve_kyc:       "Approve KYC",
  reject_kyc:        "Reject KYC",
  confirm_payment:   "Confirm Payment",
  checkout_complete: "Checkout",
};

function AuditLogViewer() {
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = new URLSearchParams({ page: page.toString(), limit: "25" });
  if (filterType)   query.set("actionType", filterType);
  if (filterRole)   query.set("actorRole", filterRole);
  if (filterEntity) query.set("targetEntityType", filterEntity);
  if (startDate)    query.set("startDate", startDate);
  if (endDate)      query.set("endDate", endDate);

  const { data, loading, error } = useApi<{ items: any[]; total: number; page: number; pages: number }>(`/audit?${query.toString()}`);

  const resetFilters = () => {
    setFilterType(""); setFilterRole(""); setFilterEntity("");
    setStartDate(""); setEndDate(""); setPage(1);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "سجل التدقيق" : "Audit Logs"}</h2>
        <p className="text-sm text-surface-500 mt-1">{ar() ? "تتبع كل الإجراءات المهمة في النظام." : "Track every significant action across the system."}</p>
      </div>

      {/* Filters */}
      <div className="card-elevated border border-surface-200 rounded-xl p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <select className="select-field text-sm" value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
            <option value="">{ar() ? "جميع الأدوار" : "All Roles"}</option>
            <option value="admin">Admin</option>
            <option value="cs">CS</option>
            <option value="finance">Finance</option>
            <option value="clinicStaff">Clinic Staff</option>
            <option value="legal">Legal</option>
            <option value="cs_director">CS Director</option>
            <option value="customer">Customer</option>
            <option value="system">System</option>
          </select>
          <select className="select-field text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
            <option value="">{ar() ? "جميع الإجراءات" : "All Actions"}</option>
            <option value="create_offer">Create Offer</option>
            <option value="update_offer">Update Offer</option>
            <option value="delete_offer">Delete Offer</option>
            <option value="freeze_user">Freeze User</option>
            <option value="unfreeze_user">Unfreeze User</option>
            <option value="change_user_role">Change Role</option>
            <option value="approve_kyc">Approve KYC</option>
            <option value="reject_kyc">Reject KYC</option>
            <option value="confirm_payment">Confirm Payment</option>
            <option value="checkout_complete">Checkout</option>
          </select>
          <select className="select-field text-sm" value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }}>
            <option value="">{ar() ? "جميع الكيانات" : "All Entities"}</option>
            <option value="User">User</option>
            <option value="Offer">Offer</option>
            <option value="KycSubmission">KYC Submission</option>
            <option value="Payment">Payment</option>
            <option value="UserOffer">User Offer</option>
          </select>
          <input type="date" className="input-field text-sm" value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            placeholder="Start date" />
          <input type="date" className="input-field text-sm" value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            placeholder="End date" />
        </div>
        {(filterRole || filterType || filterEntity || startDate || endDate) && (
          <button onClick={resetFilters} className="mt-3 text-xs font-bold text-brand-pink-600 hover:text-brand-pink-800 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            {ar() ? "مسح الفلاتر" : "Clear filters"}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card-elevated border border-surface-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-surface-50 border-b border-surface-100 flex items-center justify-between">
          <span className="text-sm font-bold text-surface-700">
            {loading ? "..." : `${total.toLocaleString()} ${ar() ? "سجل" : "records"}`}
          </span>
          <span className="text-xs text-surface-400">
            {ar() ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}`}
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-surface-400 animate-pulse">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table text-sm w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th className="w-36">{ar() ? "الوقت" : "Timestamp"}</th>
                  <th>{ar() ? "المستخدم" : "User"}</th>
                  <th>{ar() ? "الإجراء" : "Action"}</th>
                  <th>{ar() ? "الكيان" : "Target"}</th>
                  <th>{ar() ? "ملاحظات" : "Notes"}</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {items.map((log: any) => (
                  <Fragment key={log.id}>
                    <tr className={`hover:bg-surface-50/50 transition-colors ${expandedId === log.id ? "bg-surface-50" : ""}`}>
                      <td className="text-xs text-surface-500 whitespace-nowrap">
                        <div>{fmtDate(log.createdAt)}</div>
                        <div className="text-[10px] text-surface-400">{new Date(log.createdAt).toLocaleTimeString()}</div>
                      </td>
                      <td>
                        <div className="font-bold text-surface-900 mb-0.5 text-xs">{log.actorName}</div>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${AUDIT_ROLE_COLORS[log.actorRole] ?? "bg-surface-100 text-surface-600"}`}>
                          {log.actorRole}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-surface-900 text-xs">
                          {ACTION_LABELS[log.actionType] ?? log.actionType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="text-xs">
                        <span className="font-medium text-surface-700">{log.targetEntityType}</span>
                        {log.targetEntityName ? (
                          <div className="text-[11px] font-bold text-surface-900 truncate max-w-[150px] mt-0.5" title={log.targetEntityName}>{log.targetEntityName}</div>
                        ) : (
                          <div className="font-mono text-[10px] text-surface-400 truncate max-w-[120px]">{log.targetEntityId}</div>
                        )}
                      </td>
                      <td className="text-xs text-surface-500 max-w-[160px]">
                        {log.metadata?.username && <span className="font-medium text-surface-700">@{log.metadata.username}</span>}
                        {log.metadata?.reason && <span className="italic"> — {log.metadata.reason}</span>}
                        {log.metadata?.note && <span>{log.metadata.note}</span>}
                      </td>
                      <td>
                        {(log.beforeState || log.afterState) && (
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="w-6 h-6 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-500 flex items-center justify-center transition-colors"
                            title="Show changes"
                          >
                            <svg className={`w-3 h-3 transition-transform ${expandedId === log.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (log.beforeState || log.afterState) && (
                      <tr key={`${log.id}-expanded`} className="bg-surface-50">
                        <td colSpan={6} className="px-5 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {log.beforeState && (
                              <div>
                                <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">{ar() ? "قبل" : "Before"}</div>
                                <pre className="bg-white border border-surface-200 rounded-lg p-2.5 font-mono text-[10px] text-surface-700 overflow-auto max-h-32">
                                  {JSON.stringify(log.beforeState, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.afterState && (
                              <div>
                                <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">{ar() ? "بعد" : "After"}</div>
                                <pre className="bg-white border border-surface-200 rounded-lg p-2.5 font-mono text-[10px] text-surface-700 overflow-auto max-h-32">
                                  {JSON.stringify(log.afterState, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </div>
                        <div className="empty-state-title">{ar() ? "لا توجد سجلات" : "No logs found"}</div>
                        <div className="empty-state-sub">{ar() ? "لا توجد سجلات تطابق الفلاتر الحالية." : "No logs match the current filters."}</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-4 border-t border-surface-100 bg-surface-50 flex items-center justify-between">
          <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {ar() ? "السابق" : "Previous"}
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > pages) return null;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? "bg-brand-pink-500 text-white" : "bg-white border border-surface-200 text-surface-600 hover:bg-surface-50"}`}>
                  {p}
                </button>
              );
            })}
          </div>
          <button className="btn-secondary btn-sm" disabled={page >= pages || items.length === 0} onClick={() => setPage(p => p + 1)}>
            {ar() ? "التالي" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}


// ===========================================================================
// CLINIC NOTICES ADMIN PANEL
// ===========================================================================

type NoticeItem = {
  _id: string;
  message: string;
  messageAr?: string;
  isActive: boolean;
  clinicId?: { _id: string; nameEn: string; nameAr: string } | null;
  createdAt: string;
};

function NoticesAdminPanel() {
  const { getAuthHeader } = useAuth();
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ message: "", messageAr: "", isActive: false, clinicId: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics/admin");
  const clinics = clinicsData?.items ?? [];

  const load = () => {
    setLoading(true);
    apiFetch("/notices/admin", { headers: getAuthHeader() })
      .then((res: any) => setItems(res.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startEdit = (n: NoticeItem) => {
    setEditId(n._id);
    setForm({
      message: n.message,
      messageAr: n.messageAr ?? "",
      isActive: n.isActive,
      clinicId: n.clinicId?._id ?? "",
    });
  };

  const cancelEdit = () => { setEditId(null); setForm({ message: "", messageAr: "", isActive: false, clinicId: "" }); };

  const save = async () => {
    if (!form.message.trim()) return;
    setSaving(true);
    try {
      const payload = {
        message: form.message,
        messageAr: form.messageAr,
        isActive: form.isActive,
        clinicId: form.clinicId || null,
      };
      if (editId) {
        await apiFetch(`/notices/admin/${editId}`, {
          method: "PUT", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/notices/admin", {
          method: "POST", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      cancelEdit();
      load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await apiFetch(`/notices/admin/${id}`, {
        method: "PUT", headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const remove = async (id: string) => {
    if (!confirm(ar() ? "حذف هذا الإشعار؟" : "Delete this notice?")) return;
    try {
      await apiFetch(`/notices/admin/${id}`, { method: "DELETE", headers: getAuthHeader() });
      load();
    } catch (e: any) { alert(e.message); }
  };

  const activeNotice = items.find(n => n.isActive);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "إشعارات العيادات" : "Clinic Notices"}</h2>
        <p className="text-sm text-surface-500 mt-1">
          {ar()
            ? "أنشئ إشعاراً يظهر كشريط متحرك في أعلى شاشة لوحة العيادة. يمكنك توجيهه لعيادة محددة أو لجميع العيادات."
            : "Create a notice that displays as a scrolling banner at the top of the clinic dashboard. Target a specific clinic or send it to all."}
        </p>
      </div>

      {/* Live preview */}
      {activeNotice && (
        <div className="rounded-xl overflow-hidden border border-brand-pink-200 shadow-sm">
          <div className="px-4 py-2 bg-brand-pink-50 border-b border-brand-pink-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-pink-500 animate-pulse" />
              <span className="text-xs font-bold text-brand-pink-700">{ar() ? "معاينة الشريط المباشر" : "Live Banner Preview"}</span>
            </div>
            {activeNotice.clinicId ? (
              <span className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-2 py-0.5 rounded-full">
                {activeNotice.clinicId.nameEn}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full">
                {ar() ? "جميع العيادات" : "All Clinics"}
              </span>
            )}
          </div>
          <div className="bg-gradient-to-r from-brand-pink-600 via-brand-pink-500 to-brand-pink-600 text-white overflow-hidden" style={{ minHeight: "36px" }}>
            <div className="flex items-center h-9 overflow-hidden">
              <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-wide"
                style={{ animation: `marquee ${Math.max(18, activeNotice.message.length * 0.28)}s linear infinite`, paddingLeft: "100%" }}>
                <span className="inline-flex items-center gap-1.5 mr-6">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" /></svg>
                  {ar() ? "إشعار" : "Notice"}
                </span>
                {activeNotice.message}
                <span className="mx-16 opacity-40">✦</span>
                {activeNotice.message}
                <span className="mx-16 opacity-40">✦</span>
                {activeNotice.message}
              </div>
            </div>
            <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-66.67%); } }`}</style>
          </div>
        </div>
      )}

      {/* Create / Edit form */}
      <div className="card-elevated border border-surface-200 shadow-sm rounded-xl p-6 space-y-4">
        <h3 className="text-base font-bold text-surface-900">
          {editId ? (ar() ? "تعديل الإشعار" : "Edit Notice") : (ar() ? "إنشاء إشعار جديد" : "Create New Notice")}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "النص (إنجليزي)" : "Message (English)"} <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="e.g. Belamondo clinic portal will be under maintenance on Friday from 10 PM – 12 AM."
              className="input-field w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-surface-700 mb-1.5">{ar() ? "النص (عربي — اختياري)" : "Message (Arabic — optional)"}</label>
            <input
              type="text"
              value={form.messageAr}
              onChange={e => setForm(f => ({ ...f, messageAr: e.target.value }))}
              placeholder="مثال: سيتوقف نظام العيادات للصيانة يوم الجمعة من ١٠ م حتى ١٢ ص."
              className="input-field w-full text-sm text-right"
              dir="rtl"
            />
          </div>
          {/* Clinic selector */}
          <div>
            <label className="block text-xs font-bold text-surface-700 mb-1.5">
              {ar() ? "استهداف العيادة" : "Target Clinic"}
            </label>
            <select
              value={form.clinicId}
              onChange={e => setForm(f => ({ ...f, clinicId: e.target.value }))}
              className="select-field w-full text-sm"
            >
              <option value="">{ar() ? "جميع العيادات (بث عام)" : "All Clinics (broadcast)"}</option>
              {clinics.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nameEn}{c.nameAr ? ` — ${c.nameAr}` : ""}</option>
              ))}
            </select>
            <p className="text-[11px] text-surface-400 mt-1">
              {ar()
                ? "اختر عيادة محددة لعرض الإشعار لها فقط، أو اتركه فارغاً لإرساله لجميع العيادات."
                : "Pick a specific clinic to show only them this notice, or leave blank to broadcast to all clinics."}
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? "bg-brand-pink-500" : "bg-surface-200"}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-4" : ""}`} />
            </div>
            <span className="text-sm font-medium text-surface-800">
              {ar() ? "تفعيل الآن (سيُلغي تفعيل أي إشعار آخر في نفس النطاق)" : "Activate now (will deactivate any other active notice in the same scope)"}
            </span>
          </label>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving || !form.message.trim()}
            className="px-5 py-2.5 rounded-xl bg-brand-pink-500 text-white text-sm font-bold hover:bg-brand-pink-600 disabled:opacity-50 transition-colors shadow-sm">
            {saving ? "..." : editId ? (ar() ? "حفظ التعديلات" : "Save Changes") : (ar() ? "إنشاء الإشعار" : "Create Notice")}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="px-4 py-2.5 rounded-xl text-sm font-bold text-surface-600 hover:bg-surface-100 transition-colors">
              {ar() ? "إلغاء" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {/* Notices list */}
      <div className="card-elevated border border-surface-200 shadow-sm rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-100 bg-surface-50 flex items-center justify-between">
          <h3 className="text-sm font-bold text-surface-900">{ar() ? "جميع الإشعارات" : "All Notices"} <span className="text-surface-400 font-medium text-xs">({items.length})</span></h3>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-surface-400">{ar() ? "جاري التحميل..." : "Loading..."}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
            </div>
            <p className="text-sm text-surface-500">{ar() ? "لا توجد إشعارات بعد" : "No notices yet"}</p>
            <p className="text-xs text-surface-400 mt-1">{ar() ? "أنشئ إشعاراً أعلاه لعرضه للعيادات" : "Create a notice above to display to clinics"}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {items.map(n => (
              <div key={n._id} className={`flex items-start gap-4 px-6 py-5 transition-colors ${n.isActive ? "bg-brand-pink-50/30" : ""}`}>
                {/* Status toggle */}
                <button
                  onClick={() => toggleActive(n._id, n.isActive)}
                  title={n.isActive ? (ar() ? "إيقاف التفعيل" : "Deactivate") : (ar() ? "تفعيل" : "Activate")}
                  className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors border ${n.isActive ? "bg-brand-pink-500 border-brand-pink-500 text-white shadow-sm" : "bg-white border-surface-200 text-surface-400 hover:border-brand-pink-400 hover:text-brand-pink-500"}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {n.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-pink-100 text-brand-pink-700 text-[10px] font-bold uppercase tracking-wide">
                        <span className="w-1.5 h-1.5 rounded-full bg-brand-pink-500 animate-pulse" />
                        {ar() ? "نشط" : "Active"}
                      </span>
                    )}
                    {n.clinicId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        {n.clinicId.nameEn}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 text-surface-500 text-[10px] font-bold">
                        {ar() ? "جميع العيادات" : "All Clinics"}
                      </span>
                    )}
                    <span className="text-[10px] text-surface-400">{fmtDate(n.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-surface-900 leading-snug">{n.message}</p>
                  {n.messageAr && <p className="text-sm text-surface-500 mt-0.5 text-right" dir="rtl">{n.messageAr}</p>}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => startEdit(n)}
                    className="w-8 h-8 rounded-lg bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => remove(n._id)}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KYC Review Card (expandable with docs) ──
function KycReviewCard({ items }: { items: any[] }) {
  const { getAuthHeader } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/kyc/cs/${id}/approve`, { method: "POST", headers: getAuthHeader() });
      window.location.reload();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); }
  };

  const reject = async (id: string) => {
    if (!rejectReason.trim()) { alert(ar() ? "أدخل سبب الرفض" : "Enter a reason"); return; }
    setBusy(id);
    try {
      await apiFetch(`/kyc/cs/${id}/reject`, { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ reason: rejectReason }) });
      window.location.reload();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(null); setRejectId(null); setRejectReason(""); }
  };

  return (
    <div className="card-elevated bg-white rounded-xl overflow-hidden">
      <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm font-bold text-amber-800">{ar() ? "تحققات KYC معلقة" : "Pending KYC"}</span>
        </div>
        <span className="text-xs font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="divide-y divide-surface-100">
        {items.length === 0 && (
          <div className="px-5 py-6 text-center text-xs text-surface-400">{ar() ? "لا توجد تحققات معلقة" : "No pending KYC submissions"}</div>
        )}
        {items.map((k: any) => (
          <div key={k.id}>
            <button onClick={() => setExpandedId(expandedId === k.id ? null : k.id)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors">
              <div className="text-left">
                <div className="text-xs font-bold text-surface-900">{k.userName || k.userId?.slice(0, 12)}</div>
                <div className="text-[10px] text-surface-500 mt-0.5 font-mono">
                  {k.civilIdNumberMasked || k.civilIdNumber || "—"} {k.userPhone ? `· ${k.userPhone}` : ""}
                </div>
                <div className="text-[10px] text-surface-400 mt-0.5">{fmtDate(k.createdAt)}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">Pending</span>
                <svg className={`w-4 h-4 text-surface-400 transition-transform ${expandedId === k.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </button>
            {expandedId === k.id && (
              <div className="px-5 pb-4 space-y-3 animate-fade-in">
                {/* Documents */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: ar() ? "أمامية" : "Front", ref: k.civilIdFrontRef },
                    { label: ar() ? "خلفية" : "Back", ref: k.civilIdBackRef },
                    { label: ar() ? "توقيع" : "Signature", ref: k.signatureRef },
                  ].filter(d => d.ref).map(doc => (
                    <div key={doc.label} className="rounded-lg border border-surface-200 overflow-hidden">
                      <div className="text-[10px] font-bold text-surface-500 px-2 py-1 bg-surface-50 border-b border-surface-100">{doc.label}</div>
                      <img src={doc.ref.startsWith('http') || doc.ref.startsWith('data:') ? doc.ref : `/uploads/${doc.ref}`} alt={doc.label} className="w-full h-24 object-contain bg-white p-1" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  ))}
                </div>
                {/* Checkboxes */}
                {k.checkboxes && (
                  <div className="text-[10px] text-surface-500 flex flex-wrap gap-2">
                    {Object.entries(k.checkboxes).map(([key, val]) => (
                      <span key={key} className={`px-2 py-0.5 rounded-full font-bold ${val ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                        {val ? "✓" : "✗"} {key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                    ))}
                  </div>
                )}
                {/* Actions */}
                {rejectId === k.id ? (
                  <div className="space-y-2">
                    <textarea className="input-field text-xs w-full" rows={2} placeholder={ar() ? "سبب الرفض..." : "Rejection reason..."} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex gap-2">
                      <button disabled={busy === k.id} onClick={() => reject(k.id)} className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-50">{busy === k.id ? "…" : (ar() ? "تأكيد الرفض" : "Confirm Reject")}</button>
                      <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="text-xs font-bold text-surface-500 px-3 py-2">{ar() ? "إلغاء" : "Cancel"}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={busy === k.id} onClick={() => approve(k.id)} className="text-xs font-bold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      {busy === k.id ? "…" : (ar() ? "✓ موافقة" : "✓ Approve")}
                    </button>
                    <button onClick={() => setRejectId(k.id)} className="text-xs font-bold bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">
                      {ar() ? "✗ رفض" : "✗ Reject"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue({ lazy: activeNav !== "home" });
  const { data: paymentsData } = usePendingPayments({ lazy: activeNav !== "home" });
  const { data: productsData } = useProducts({ lazy: activeNav !== "home" });
  const { data: offersData } = useApi<{ items: any[] }>("/offers/admin", { lazy: activeNav !== "home" });
  const { data: financeData } = useFinanceSnapshot({}, { lazy: activeNav !== "home" });
  const { data: complaintsData } = useComplaints({ lazy: activeNav !== "home" });
  const { data: reservationsData } = useAdminReservations({ lazy: activeNav !== "home" });
  const { data: bookingRequests } = useBookingRequests("pending");
  const { data: recentAuditData } = useApi<{ items: any[] }>("/audit?limit=6&page=1", { lazy: activeNav !== "home" });
  const fs = financeData?.snapshot;

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "offers", icon: Icons.offers, label: ar() ? "العضويات" : "Memberships" },
    { key: "subscriptions", icon: Icons.cash, label: ar() ? "الاشتراكات" : "Subscriptions" },
    { key: "promotions", icon: Icons.offers, label: ar() ? "عروض الشركات" : "Promotions" },
    { key: "categories", icon: Icons.clipboard, label: ar() ? "الفئات" : "Categories" },
    { key: "treatments", icon: Icons.calendar, label: ar() ? "العلاجات" : "Treatments" },
    { key: "standalone", icon: Icons.calendar, label: ar() ? "الجلسات" : "Sessions" },
    { key: "users", icon: Icons.users, label: t("users") },
    { key: "clinics", icon: Icons.clinic, label: t("clinics") },
    { key: "tasks", icon: Icons.clipboard, label: t("tasks") },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "eforms", icon: Icons.report, label: ar() ? "النماذج" : "E-Forms" },
    { key: "bookings", icon: Icons.calendar, label: ar() ? "الحجوزات والمحادثات" : "Bookings & Chats" },
    { key: "reservations", icon: Icons.cash, label: ar() ? "حجوزات العربون" : "Reservations" },
    { key: "share", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>, label: ar() ? "رابط الإحالة" : "Share Link" },
    { key: "notices", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>, label: ar() ? "إشعارات العيادات" : "Clinic Notices" },
    { key: "notifications_settings", icon: Icons.bell, label: ar() ? "إعدادات الإشعارات" : "Notifications" },
    { key: "audit", icon: Icons.clipboard, label: ar() ? "سجل التدقيق" : "Audit Logs" },
    { key: "settings", icon: Icons.settings, label: t("settings") },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة المدير" : "Admin Dashboard"} subtitle={ar() ? "نظرة عامة كاملة" : "Full system overview"}>
      <div className="space-y-8 animate-fade-in">
        {activeNav === "home" && (
          <div className="space-y-8 animate-fade-in">

            {/* ── KPI Cards: Row 1 ── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-6 mb-5">
              <KpiCard icon={Icons.chart} label={ar() ? "الإيرادات المتوقعة" : "Expected Revenue"} value={fs?.expectedTotalRevenueKwd || "0.000"} sub="KWD" isHighlighted />
              <KpiCard accent="emerald" icon={Icons.chart} label={ar() ? "إجمالي الإيرادات" : "Total Revenue"} value={fs?.paidTowardMembershipsKwd || "0.000"} sub="KWD" />
              <KpiCard accent="red" icon={Icons.cash} label={ar() ? "أقساط غير مدفوعة" : "Unpaid Installment"} value={fs?.unpaidInstallmentsKwd || "0.000"} sub="KWD" />
              <KpiCard accent="blue" icon={Icons.cash} label={ar() ? "مدفوعات معلقة" : "Pending Payments"} value={(paymentsData?.items || []).length} sub={`${fs?.pendingPaymentsKwd || "0.000"} KWD`} />
              <KpiCard accent="indigo" icon={Icons.calendar} label={ar() ? "حجوزات معلقة" : "Pending Bookings"} value={(bookingRequests?.items || []).length} sub={ar() ? "بانتظار التأكيد" : "awaiting confirmation"} />
              <KpiCard accent="amber" icon={Icons.shield} label={ar() ? "تحققات KYC" : "Pending KYC"} value={(kycData?.items || []).length} sub={ar() ? "بانتظار المراجعة" : "awaiting review"} />
            </div>

            {/* ── KPI Cards: Row 2 ── */}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-3">
              <KpiCard accent="rose" icon={Icons.complaint} label={ar() ? "شكاوى مفتوحة" : "Open Complaints"} value={(complaintsData?.items || []).filter((c: any) => c.status === "open").length} sub={ar() ? "تتطلب متابعة" : "require follow-up"} />
              <KpiCard accent="teal" icon={Icons.clinic} label={ar() ? "العروض النشطة" : "Active Offers"} value={(offersData?.items || []).filter((o: any) => o.isActive !== false).length} sub={ar() ? "في الكتالوج" : "in catalog"} />
              <KpiCard accent="violet" icon={Icons.calendar} label={ar() ? "حجوزات العربون" : "Reservations"} value={(reservationsData?.items || []).length} sub={ar() ? "نشطة" : "active"} />
            </div>

            {/* ── Financial Snapshot ── */}
            <div>
              <h3 className="text-base font-bold text-surface-900 mb-4 mt-6">{ar() ? "النظرة المالية" : "Financial Snapshot"}</h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  { label: ar() ? "الإيرادات" : "Revenue", value: fs?.totalRevenue || "0.000", color: "text-surface-900", border: "border-l-surface-400" },
                  { label: ar() ? "معلقة" : "Pending", value: fs?.pendingPaymentsKwd || "0.000", color: "text-blue-600", border: "border-l-blue-400" },
                  { label: ar() ? "كاش باك مقفل" : "CB Locked", value: fs?.totalCashbackLocked || "0.000", color: "text-amber-600", border: "border-l-amber-400" },
                  { label: ar() ? "كاش باك متاح" : "CB Unlocked", value: fs?.totalCashbackUnlocked || "0.000", color: "text-brand-pink-600", border: "border-l-brand-pink-400" },
                  { label: ar() ? "كاش باك مُستخدم" : "CB Utilized", value: fs?.totalCashbackUtilized || "0.000", color: "text-emerald-600", border: "border-l-emerald-400" },
                  { label: ar() ? "جلسات اليوم" : "Sessions Today", value: fs?.sessionsToday ?? 0, color: "text-violet-600", border: "border-l-violet-400" },
                ].map(({ label, value, color, border }) => (
                  <div key={label} className={`card-elevated bg-white p-4 border-l-4 ${border} flex flex-col gap-1`}>
                    <div className="text-xs font-bold text-surface-500 uppercase tracking-wide">{label}</div>
                    <div className={`text-2xl font-black ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Needs Attention ── */}
            {/* ── Needs Attention ── */}
            <div>
              <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "يحتاج إلى اهتمام" : "Needs Attention"}</h3>
              <div className="grid gap-6 lg:grid-cols-3 items-start">
                <KycQueue />
                <PaymentQueue />
                <BookingRequestsQueue />
              </div>
            </div>

            {/* ── Quick Navigation ── */}
            <div>
              <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "اختصارات التنقل" : "Quick Navigation"}</h3>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
                {([
                  { key: "offers",     icon: Icons.offers,    label: ar() ? "العضويات"  : "Memberships",  color: "text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100" },
                  { key: "promotions", icon: Icons.offers,    label: ar() ? "عروض الشركات" : "Promotions",   color: "text-rose-600 bg-rose-50 hover:bg-rose-100" },
                  { key: "users",      icon: Icons.users,     label: ar() ? "المستخدمون" : "Users",         color: "text-blue-600 bg-blue-50 hover:bg-blue-100" },
                  { key: "clinics",    icon: Icons.clinic,    label: ar() ? "العيادات"   : "Clinics",       color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" },
                  { key: "complaints", icon: Icons.complaint, label: ar() ? "الشكاوى"    : "Complaints",    color: "text-rose-600 bg-rose-50 hover:bg-rose-100" },
                  { key: "bookings",   icon: Icons.calendar,  label: ar() ? "الحجوزات"   : "Bookings",      color: "text-violet-600 bg-violet-50 hover:bg-violet-100" },
                  { key: "eforms",     icon: Icons.report,    label: ar() ? "النماذج"    : "E-Forms",       color: "text-amber-600 bg-amber-50 hover:bg-amber-100" },
                  { key: "notices",    icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>, label: ar() ? "إشعارات" : "Notices", color: "text-teal-600 bg-teal-50 hover:bg-teal-100" },
                  { key: "audit",      icon: Icons.clipboard, label: ar() ? "التدقيق"   : "Audit Logs",    color: "text-surface-600 bg-surface-100 hover:bg-surface-200" },
                ] as Array<{ key: string; icon: React.ReactNode; label: string; color: string }>).map(({ key, icon, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setActiveNav(key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-transparent transition-all duration-150 font-semibold text-xs ${color}`}
                  >
                    <span className="h-6 w-6">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Recent Activity (Audit Log) ── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-surface-900">{ar() ? "النشاط الأخير" : "Recent Activity"}</h3>
                <button onClick={() => setActiveNav("audit")} className="text-xs font-bold text-brand-pink-600 hover:text-brand-pink-800">
                  {ar() ? "عرض الكل ←" : "View all →"}
                </button>
              </div>
              <div className="card-elevated bg-white rounded-xl overflow-hidden divide-y divide-surface-100">
                {(recentAuditData?.items || []).length === 0 && (
                  <div className="py-8 text-center text-sm text-surface-400">{ar() ? "لا توجد أنشطة مسجلة بعد." : "No activity recorded yet."}</div>
                )}
                {(recentAuditData?.items || []).map((log: any) => (
                  <div key={log.id} className="px-5 py-3.5 flex items-center gap-4">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black uppercase ${AUDIT_ROLE_COLORS[log.actorRole] ?? "bg-surface-100 text-surface-500"}`}>
                      {log.actorRole?.slice(0, 2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-900">{ACTION_LABELS[log.actionType] ?? log.actionType.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-surface-400">{log.targetEntityType}</span>
                      </div>
                      {log.metadata?.username && <div className="text-[10px] text-surface-500 mt-0.5">@{log.metadata.username}</div>}
                    </div>
                    <div className="text-[10px] text-surface-400 whitespace-nowrap shrink-0">{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
        { activeNav === "offers" && <OffersManager /> }
        { activeNav === "promotions" && <PromotionsManager /> }
        { activeNav === "categories" && <CategoriesAdminPanel /> }
        {activeNav === "treatments" && <SessionTypesAdminPanel />}
        {activeNav === "standalone" && <SessionsManager />}
        {activeNav === "clinics" && <ClinicsManager />}
        {activeNav === "tasks" && <TasksManager />}
        {activeNav === "complaints" && <ComplaintsView />}
        {activeNav === "eforms" && <EFormsAdminPanel />}
        {activeNav === "users" && <UsersManager />}
        {activeNav === "bookings" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "الحجوزات والمحادثات" : "Bookings & Conversations"}</h2>
              <p className="text-sm text-surface-500 mt-1">
                {ar() ? "عرض جميع المحادثات وحالات طلبات الحجز (للقراءة فقط)." : "Read-only view of all booking conversations and their state."}
              </p>
            </div>
            <AdminBookingsMonitor />
          </div>
        )}
        {activeNav === "reservations" && <AdminReservationsPanel />}
        {activeNav === "share" && <ShareLinkPage />}
        {activeNav === "notices" && <NoticesAdminPanel />}
        {activeNav === "notifications_settings" && <NotificationSettingsPanel />}
        {activeNav === "subscriptions" && <AdminSubscriptionsDashboard />}
        {activeNav === "audit" && <AuditLogViewer />}
        {activeNav === "settings" && <AdminSettings />}
      </div>
    </DashboardShell>
  );
}
