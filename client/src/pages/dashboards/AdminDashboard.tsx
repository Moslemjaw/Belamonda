import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useApi, useKycQueue, usePendingPayments, useComplaints, useProducts, useFinanceSnapshot, useAdminReservations, type ReservationItem } from "../../hooks/useApi";
import { apiFetch, API_BASE_URL, SITE_BASE_URL } from "../../lib/api";
import i18n from "../../app/i18n";
import { allTreatments, treatmentCategories } from "../../lib/treatments";
import { getCategoryIcon } from "../../components/CategoryIcons";
import { OfferTemplate, getOfferTemplates, saveOfferTemplates, upsertOfferTemplate, deleteOfferTemplate, seedDefaultOffers, getSubscriptions } from "../../lib/offerSystem";
import { sharedClinics } from "../../lib/clinics";
import { CategoriesAdminPanel } from "../../features/admin/CategoriesAdminPanel";
import { EFormsAdminPanel } from "../../features/admin/EFormsAdminPanel";
import { SessionTypesAdminPanel } from "../../features/admin/SessionTypesAdminPanel";
import ChatWidget from "../../components/ChatWidget";
import AdminBookingsMonitor from "../../components/AdminBookingsMonitor";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReferralLeaderboardWidget } from "../../components/ReferralActivityWidget";
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

function KpiCard({ label, value, sub, icon, isHighlighted, trend, accent = "pink" }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; isHighlighted?: boolean; trend?: string; accent?: "pink" | "teal" | "amber" | "blue" | "violet" | "emerald" | "rose" }) {
  const accentMap: Record<string, { iconBg: string; iconText: string; blob: string }> = {
    pink:    { iconBg: "bg-brand-pink-100",  iconText: "text-brand-pink-600",  blob: "bg-brand-pink-50/60" },
    teal:    { iconBg: "bg-brand-sage-100",  iconText: "text-brand-sage-700",  blob: "bg-brand-sage-50/60" },
    amber:   { iconBg: "bg-amber-100",       iconText: "text-amber-600",       blob: "bg-amber-50/60" },
    blue:    { iconBg: "bg-blue-100",        iconText: "text-blue-600",        blob: "bg-blue-50/60" },
    violet:  { iconBg: "bg-violet-100",      iconText: "text-violet-600",      blob: "bg-violet-50/60" },
    emerald: { iconBg: "bg-emerald-100",     iconText: "text-emerald-600",     blob: "bg-emerald-50/60" },
    rose:    { iconBg: "bg-rose-100",        iconText: "text-rose-600",        blob: "bg-rose-50/60" },
  };
  const a = accentMap[accent];
  return (
    <div className={`card-elevated p-6 flex flex-col justify-between relative overflow-hidden group ${isHighlighted ? 'bg-gradient-to-br from-brand-pink-500 to-brand-pink-700 text-white border-none shadow-brand-pink-500/30 shadow-lg' : 'bg-white'}`}>
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
  const { data: categoriesAdminData } = useApi<{ items: Array<{ id: string; slug: string }> }>("/categories/admin");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eforms = formsData?.items || [];

  const emptyForm = { nameEn: "", nameAr: "", clinicLocked: false, requireBranchSelection: true, clinicId: "", extraClinicIds: [] as string[], category: "laser", price: "99", validityDays: "365", maxSessions: "6", unlimitedSessions: false, sessionIntervalDays: "25", imageUrl: "", signupCashback: "0", perSessionCashback: "0", cashbackActivationFee: "0", clinicTransferFee: "0", allowFullPayment: true, allowInstallments: false, maxInstallments: "4", allowDeposit: false, depositAmount: "0", tagsEn: "", tagsAr: "", isCashbackOnly: false, offerExpirationDate: "", isGroupOffer: false, groupSizeRequired: "2", groupRewardType: "free_session", groupRewardValue: "", fullPaymentEFormId: "", installmentsEFormId: "", depositEFormId: "", allowENet: false, enetEFormId: "", clinicOverrides: [] as { clinicId: string, sessionPriceKwd: string }[] };
  const [form, setForm] = useState(emptyForm);

  const offers = apiOffersData?.items || [];
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
          maxSessions: form.unlimitedSessions ? undefined : (parseInt(form.maxSessions) || undefined),
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
          status: "active",
          active: true,
          featured: false
        })
      });
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
              {treatmentCategories.map(c => (
                <label key={c.id} className={`flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded-lg border border-surface-200 shadow-sm w-[calc(50%-0.25rem)] lg:w-[calc(25%-0.5rem)] ${form.category === "all" ? "opacity-50 pointer-events-none grayscale" : ""}`}>
                  <input type="checkbox" className="accent-brand-pink-500 w-4 h-4 rounded" 
                         checked={form.category !== "all" && form.category.split(',').includes(c.id)}
                         onChange={e => {
                            if (form.category === "all") return;
                            let arr = form.category ? form.category.split(',').filter(Boolean) : [];
                            if (e.target.checked) arr.push(c.id); else arr = arr.filter(x => x !== c.id);
                            setForm({...form, category: arr.join(',')});
                         }} />
                  <span className="w-4 h-4 shrink-0">{getCategoryIcon(c.id)}</span>
                  <span className="font-medium">{ar() ? c.nameAr : c.nameEn}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Session Rules */}
          <div className="border-t border-surface-100 pt-4 mt-4">
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "قواعد الجلسات" : "Session Rules"}</h5>
            <div className="grid gap-4 md:grid-cols-2">
              {F(ar() ? "الجلسات" : "Max Sessions", <div className="flex items-center gap-2"><input className="input-field flex-1" type="number" value={form.maxSessions} onChange={e => setForm({...form, maxSessions: e.target.value})} disabled={form.unlimitedSessions} /><label className="flex items-center gap-1 text-xs whitespace-nowrap"><input type="checkbox" checked={form.unlimitedSessions} onChange={e => setForm({...form, unlimitedSessions: e.target.checked})} className="accent-brand-pink-500 w-4 h-4 rounded" />{ar() ? "غير محدود" : "Unlimited"}</label></div>)}
              {F(ar() ? "فترة الانتظار بين الجلسات (أيام)" : "Session Interval Cooldown (days)", <input className="input-field" type="number" value={form.sessionIntervalDays} onChange={e => setForm({...form, sessionIntervalDays: e.target.value})} />)}
            </div>
          </div>

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
                  {F(ar() ? "حجم المجموعة المطلوب" : "Required Group Size", <input className="input-field" type="number" value={form.groupSizeRequired} onChange={e => setForm({...form, groupSizeRequired: e.target.value})} />)}
                  {F(ar() ? "نوع المكافأة" : "Reward Type", (
                    <select className="select-field w-full" value={form.groupRewardType} onChange={e => setForm({...form, groupRewardType: e.target.value})}>
                      <option value="free_session">{ar() ? "جلسة مجانية" : "Free Session"}</option>
                      <option value="discount">{ar() ? "خصم إضافي" : "Extra Discount"}</option>
                      <option value="cashback_bonus">{ar() ? "كاش باك إضافي" : "Bonus Cashback"}</option>
                    </select>
                  ))}
                  {F(ar() ? "قيمة المكافأة" : "Reward Value", <input className="input-field" type="text" placeholder="e.g. 10 KWD or 1 session" value={form.groupRewardValue} onChange={e => setForm({...form, groupRewardValue: e.target.value})} />)}
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

      {/* Offer Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map(o => {
          const enrolled = (o.enrolledCount || 0);
          const isExpanded = expandedId === (o.id || o._id);
          const displayTitle = ar() ? (o.nameAr || o.name) : (o.name || o.nameEn);
          const cats = o.category ? o.category.split(',') : [];
          const categoryName = o.category === "all" ? (ar() ? "جميع الفئات" : "All Categories") : cats.map((c: string) => {
            const cDef = treatmentCategories.find(tc => tc.id === c);
            return cDef ? (ar() ? cDef.nameAr : cDef.nameEn) : c;
          }).join(' • ');
          
          return (
            <div key={o.id || o._id} className={`card-elevated p-0 overflow-hidden ${!o.active ? 'opacity-60 grayscale' : ''}`}>
              {o.imageUrl && <div className="h-32 w-full relative"><img src={o.imageUrl} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /></div>}
              <div className="p-5">
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
        {offers.length === 0 && <div className="md:col-span-3 text-center text-surface-400 py-12 card-elevated">{ar() ? "لا توجد عروض" : "No offers yet"}</div>}
      </div>
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
              <table className="data-table">
                <thead><tr><th>{ar() ? "العيادة" : "Clinic"}</th><th>{ar() ? "السعر الأصلي" : "Original Price"}</th><th>{ar() ? "خصم الكاش باك" : "Cashback Deduction"}</th><th>{ar() ? "نمط الحجز" : "Booking Mode"}</th><th></th></tr></thead>
                <tbody>
                  {items.map((s: any) => (
                    <tr key={s.id}>
                      <td className="text-surface-700 font-medium">{s.clinicId}</td>
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
          );
        })}
      </div>
    </div>
  );
}

function ClinicsManager() {
  const { getAuthHeader, impersonateClinic, login } = useAuth();
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
    try {
      if (editingId) {
        await apiFetch(`/clinics/admin/${editingId}`, { method: "PATCH", headers: getAuthHeader(), body: JSON.stringify({ ...form }) });
        setShowCreate(false);
        setEditingId(null);
        refetch();
      } else {
        const res = await apiFetch("/clinics/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({ ...form, active: true }) }) as any;
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
                 <div className="flex items-center gap-2"><svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> <span dir="ltr">{c.contactPhone || "+965 —"}</span></div>
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

function TasksManager() {
  const { getAuthHeader } = useAuth();
  const { data, refetch } = useApi<{ items: any[] }>("/tasks/admin");
  const [showCreate, setShowCreate] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const EMPLOYEES_BY_DEPT: Record<string, string[]> = {
    "CS": ["Sarah", "Ahmed", "Noura"],
    "Finance": ["Omar", "Fatima"],
    "Admin": ["Ali", "Laila", "Mubarak"],
    "Clinics": ["Mona", "Khaled", "Zainab"]
  };

  const [form, setForm] = useState({ 
    title: "", 
    description: "", 
    priority: "yellow", 
    assignedDepartment: "CS",
    assignedPeople: [] as string[],
    dueDate: new Date(Date.now() + 86400000).toISOString() 
  });

  const togglePerson = (person: string) => {
    setForm(prev => {
      const current = prev.assignedPeople;
      if (current.includes(person)) return { ...prev, assignedPeople: current.filter(p => p !== person) };
      return { ...prev, assignedPeople: [...current, person] };
    });
  };

  const createTask = async () => {
    // Construct assigned text for display
    const assigned = form.assignedPeople.length > 0 
      ? `${form.assignedDepartment} - ${form.assignedPeople.join(", ")}` 
      : form.assignedDepartment;
    
    await apiFetch("/tasks/admin", { method: "POST", headers: getAuthHeader(), body: JSON.stringify({...form, assignedDepartments: [assigned]}) });
    setShowCreate(false);
    // reset form
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
                  <select className="select-field" value={form.assignedDepartment} onChange={e => setForm({ ...form, assignedDepartment: e.target.value, assignedPeople: [] })}>
                    <option value="CS">{ar() ? "خدمة العملاء (CS)" : "Customer Service (CS)"}</option>
                    <option value="Finance">{ar() ? "المالية (Finance)" : "Finance"}</option>
                    <option value="Admin">{ar() ? "الإدارة (Admin)" : "Administration"}</option>
                    <option value="Clinics">{ar() ? "فريق العيادات (Clinics)" : "Clinics Team"}</option>
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
                        form.assignedPeople.map(person => (
                          <span key={person} className="bg-brand-pink-50 text-brand-pink-700 px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 border border-brand-pink-100 shadow-sm">
                            {person}
                            <button 
                              onClick={(e) => { e.stopPropagation(); togglePerson(person); }}
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
                        {(EMPLOYEES_BY_DEPT[form.assignedDepartment] || []).length === 0 ? (
                           <div className="px-4 py-3 text-sm text-surface-500 text-center">{ar() ? "لا يوجد موظفين" : "No employees found"}</div>
                        ) : (
                          (EMPLOYEES_BY_DEPT[form.assignedDepartment] || []).map(person => (
                            <label key={person} className="flex items-center px-4 py-2.5 hover:bg-surface-50 cursor-pointer transition-colors border-b border-surface-50 last:border-0 group">
                              <div className={`w-4 h-4 rounded flex items-center justify-center mr-3 transition-colors ${form.assignedPeople.includes(person) ? "bg-brand-pink-500 border-brand-pink-500" : "bg-white border border-surface-300 group-hover:border-brand-pink-300"}`}>
                                {form.assignedPeople.includes(person) && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center text-[10px] font-bold text-surface-600 uppercase border border-surface-200 shadow-sm">{person.charAt(0)}</div>
                                <span className="text-sm font-medium text-surface-700">{person}</span>
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
                <td className="text-xs text-surface-500 font-medium">{new Date(t.dueDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {(data?.items || []).length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد مهام حالية" : "No active tasks"}</div><div className="empty-state-sub">{ar() ? "لا توجد مهام تتطلب اهتمامك الآن." : "All caught up — nothing to action right now."}</div></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplaintsView() {
  const { data } = useComplaints();
  return (
    <div>
      <h3 className="text-base font-bold text-surface-900 mb-4">{ar() ? "الشكاوى" : "Complaints"}</h3>
      <div className="card-elevated overflow-hidden">
        <table className="data-table">
          <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
          <tbody>
            {(data?.items || []).map((c: any) => (
              <tr key={c.id}><td className="font-medium">{c.subject}</td><td><span className="badge-sage">{c.category}</span></td><td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{c.status}</span></td><td className="text-xs">{new Date(c.createdAt).toLocaleDateString()}</td></tr>
            ))}
            {(data?.items || []).length === 0 && <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div className="empty-state-title">{ar() ? "لا توجد شكاوى" : "No complaints"}</div><div className="empty-state-sub">{ar() ? "كل شيء على ما يرام." : "Everything looks healthy right now."}</div></div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [requireInstallmentPayment, setRequireInstallmentPayment] = useState(() => {
    try { return localStorage.getItem('bel_require_installment_booking_v1') === 'true'; } catch { return false; }
  });

  const save = () => {
    setLoading(true);
    localStorage.setItem('bel_require_installment_booking_v1', String(requireInstallmentPayment));
    setTimeout(() => setLoading(false), 800);
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-surface-900">{ar() ? "إعدادات النظام" : "System Settings"}</h3>
        <button onClick={save} className="btn-primary btn-sm">{loading ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التغييرات" : "Save Changes")}</button>
      </div>

      <div className="card-elevated p-6 bg-gradient-to-r from-brand-pink-50 to-white">
        <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {ar() ? "الملف الشخصي للمسؤول" : "Administrator Profile"}
        </h4>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="shrink-0 flex flex-col items-center gap-3">
             <div className="w-24 h-24 rounded-full bg-brand-pink-100 flex items-center justify-center text-3xl font-black text-brand-pink-600 border-4 border-white shadow-sm relative group">
                A
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                   <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
             </div>
             <div className="text-[10px] font-bold text-brand-pink-600 bg-brand-pink-100 px-3 py-1 rounded-full uppercase tracking-wide">Super Admin</div>
          </div>
          <div className="flex-1 grid gap-4 md:grid-cols-2 w-full">
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "الاسم الكامل" : "Full Name"}</label>
              <input type="text" className="input-field bg-white" defaultValue="admin1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
              <input type="email" className="input-field bg-white" defaultValue="admin@belamonda.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
              <input type="text" className="input-field bg-white" defaultValue="+965 12345678" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "كلمة المرور الجديدة" : "New Password"}</label>
              <input type="password" className="input-field bg-white" placeholder="********" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card-elevated p-6">
          <h4 className="font-bold text-surface-900 mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {ar() ? "إعدادات عامة" : "General Configuration"}
          </h4>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-surface-700">{ar() ? "وضع الصيانة" : "Maintenance Mode"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-surface-700">{ar() ? "السماح بالتسجيل الجديد" : "Allow New Signups"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1.5">{ar() ? "لغة النظام الافتراضية" : "Default System Language"}</label>
              <select className="select-field"><option>English (EN)</option><option>Arabic (AR)</option></select>
            </div>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-surface-100">
              <div>
                <span className="text-sm font-medium text-surface-700 block">{ar() ? "إلزام دفع القسط المستحق قبل حجز موعد" : "Require Installment Payment Before Booking"}</span>
                <span className="text-[10px] text-surface-400">{ar() ? "يمنع المستخدم من حجز مواعيد إذا كان هناك أقساط غير مدفوعة للباقة" : "Prevents users from booking sessions if they have unpaid installments"}</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={requireInstallmentPayment} onChange={e => setRequireInstallmentPayment(e.target.checked)} />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
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
              <input type="number" className="input-field" defaultValue={24} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-surface-700">{ar() ? "المصادقة الثنائية للمشرفين" : "Force 2FA for Admins"}</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-pink-500"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Profile Panel (tabbed) ──────────────────────────────────────────────
type ProfileTab = "overview" | "memberships" | "cashback" | "sessions" | "payments" | "kyc";

function UserProfilePanel({
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
  const isCS = myRole === "cs";
  const isFinance = myRole === "finance";

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

  useEffect(() => {
    setProfileLoading(true);
    setProfileError(null);
    apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() })
      .then((d: any) => setProfile(d))
      .catch((e: any) => setProfileError(e.message))
      .finally(() => setProfileLoading(false));
  }, [user.id]);

  const handleRoleSave = async () => {
    if (!isAdmin || !pendingRole || pendingRole === user.role) return;
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
    if (!isAdmin) return;
    const newActive = !user.kyc;
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

  const handleCashbackAdjust = async (sign: 1 | -1) => {
    const amt = parseFloat(cashAmt);
    if (!amt || amt <= 0) { setCashError(ar() ? "أدخل مبلغاً صحيحاً" : "Enter a valid amount"); return; }
    if (isAdmin && !cashReason.trim()) { setCashError(ar() ? "السبب مطلوب" : "Reason is required"); return; }
    setCashSaving(true);
    setCashError(null);
    try {
      const kwd = `${Math.floor(amt)}.${String(Math.round((amt % 1) * 1000)).padStart(3, "0")}`;
      const signedKwd = sign === -1 ? `-${kwd}` : kwd;
      if (isAdmin) {
        await apiFetch("/wallet/admin/adjust", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify({ userId: user.id, amountKwd: signedKwd, reason: cashReason })
        });
      } else if (isCS && sign === -1) {
        await apiFetch("/wallet/cs/deduct", {
          method: "POST",
          headers: getAuthHeader(),
          body: JSON.stringify({ userId: user.id, amountKwd: kwd, reference: { kind: "userOffer", id: "cs_manual" } })
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
    setSessionAdjustingId(membershipId + (delta > 0 ? "_inc" : "_dec"));
    try {
      await apiFetch(`/scheduling/admin/user-offers/${membershipId}/adjust-sessions`, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({ delta }),
      });
      const d = await apiFetch(`/users/admin/${user.id}/profile`, { headers: getAuthHeader() });
      setProfile(d);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSessionAdjustingId(null);
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

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString("en-KW") : "—";

  return (
    <div className="card-elevated animate-slide-up relative bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-white border-b border-surface-100 flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-pink-100 flex items-center justify-center text-brand-pink-600 font-bold text-xl shrink-0">
          {(user.name ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-surface-900">{user.name}</h2>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] ?? "bg-surface-100 text-surface-600"}`}>{user.role}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${user.kyc ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {user.kyc ? (ar() ? "نشط" : "Active") : (ar() ? "معطّل" : "Disabled")}
            </span>
          </div>
          <div className="text-xs text-surface-400 mt-0.5 font-mono">{user.id} • {user.phone}</div>
          {user.referredByUsername && (
            <div className="text-xs text-brand-pink-500 mt-1">↩ {ar() ? "أُحيل بواسطة" : "Referred by"} @{user.referredByUsername}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(isAdmin || isFinance) && (
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
                {/* Role change (admin only) */}
                {isAdmin && (
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
                  {isAdmin && (
                    <button className="btn-primary btn-sm flex items-center gap-1.5" onClick={onLoginAs}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
                      {ar() ? "دخول كـ مستخدم" : "Login As User"}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className={`btn-secondary btn-sm disabled:opacity-50 ${user.kyc ? "text-red-500 hover:bg-red-50 hover:border-red-200" : "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"}`}
                      disabled={statusSaving}
                      onClick={() => void handleStatusToggle()}
                    >
                      {statusSaving ? "…" : user.kyc ? (ar() ? "تعطيل" : "Disable") : (ar() ? "تفعيل" : "Enable")}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── MEMBERSHIPS ── */}
            {tab === "memberships" && (
              <div className="space-y-3">
                {profile.memberships?.length === 0 && <div className="text-sm text-surface-400 text-center py-8">{ar() ? "لا توجد عضويات" : "No memberships"}</div>}
                {profile.memberships?.map((m: any) => (
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
                      <div><span className="text-surface-400">{ar() ? "الأقساط المدفوعة" : "Installments Paid"}</span><div className="font-bold mt-0.5">{m.installmentsPaid}/{m.installmentCount ?? "—"}</div></div>
                      <div><span className="text-surface-400">{ar() ? "المبلغ (د.ك)" : "Amount (KWD)"}</span><div className="font-bold mt-0.5">{m.paymentAmountKwd ?? "—"}</div></div>
                      <div><span className="text-surface-400">{ar() ? "التفعيل" : "Activated"}</span><div className="font-bold mt-0.5">{fmt(m.activatedAt)}</div></div>
                      <div><span className="text-surface-400">{ar() ? "الانتهاء" : "Expires"}</span><div className="font-bold mt-0.5">{fmt(m.expiresAt)}</div></div>
                      <div><span className="text-surface-400">{ar() ? "تاريخ الإنشاء" : "Created"}</span><div className="font-bold mt-0.5">{fmt(m.createdAt)}</div></div>
                    </div>
                  </div>
                ))}
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
                      {isAdmin && (
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
                      {isAdmin && (
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
                      <div className="text-xs font-mono text-surface-400">{s.id}</div>
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
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.kyc.status === "approved" ? "bg-emerald-50 text-emerald-700" : profile.kyc.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-700"}`}>
                          {profile.kyc.status}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
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
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { label: ar() ? "صورة الهوية (الأمامية)" : "Civil ID — Front", ref: profile.kyc.civilIdFrontRef },
                        { label: ar() ? "صورة الهوية (الخلفية)" : "Civil ID — Back", ref: profile.kyc.civilIdBackRef },
                        { label: ar() ? "التوقيع" : "Signature", ref: profile.kyc.signatureRef },
                      ].filter(d => d.ref).map((doc) => (
                        <div key={doc.label} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                          <div className="px-3 py-2 border-b border-surface-100 text-xs font-bold text-surface-600">{doc.label}</div>
                          <div className="p-3">
                            <img
                              src={`/uploads/${doc.ref}`}
                              alt={doc.label}
                              className="w-full h-36 object-contain rounded-lg bg-surface-50"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                            <div className="text-[10px] text-surface-400 mt-1 truncate font-mono">{doc.ref}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const ALL_ROLES = ["customer", "admin", "cs", "finance", "clinicStaff", "user"] as const;
const ROLE_COLORS: Record<string, string> = {
  customer: "bg-blue-50 text-blue-700",
  admin: "bg-purple-50 text-purple-700",
  cs: "bg-amber-50 text-amber-700",
  finance: "bg-emerald-50 text-emerald-700",
  clinicStaff: "bg-pink-50 text-pink-700",
  user: "bg-surface-100 text-surface-600",
};

function UsersManager() {
  const { auth, login, getAuthHeader } = useAuth();
  const canExport = auth?.role === "admin" || auth?.role === "finance";
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [users, setUsers] = useState<any[]>([]);

  const loadUsers = () => {
    interface AdminUserItem {
      id: string;
      username: string;
      phone?: string;
      role: string;
      isActive: boolean;
      referredByUsername?: string | null;
    }
    interface AdminUsersResponse { items: AdminUserItem[]; }
    apiFetch("/users/admin", { headers: getAuthHeader() })
      .then((d) => {
        setUsers(((d as AdminUsersResponse).items || []).map((u) => ({
          id: u.id,
          name: u.username,
          phone: u.phone || "—",
          role: u.role,
          status: u.isActive ? "Active" : "Disabled",
          kyc: u.isActive,
          referredByUsername: u.referredByUsername ?? null
        })));
      })
      .catch((err: unknown) => {
        console.error("[UsersManager] Failed to load users:", err);
      });
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u => {
    const matchSearch = (u.name ?? "").toLowerCase().includes(search.toLowerCase()) || (u.phone ?? "").includes(search);
    const matchRole = filterRole === "all" || u.role === filterRole;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? u.kyc : !u.kyc);
    return matchSearch && matchRole && matchStatus;
  });

  const openUser = (u: any) => { setSelectedUser(u); };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h3 className="text-base font-bold text-surface-900 mr-auto">{ar() ? "إدارة المستخدمين" : "User Management"}</h3>
        {canExport && (
          <button
            className="btn-secondary btn-sm flex items-center gap-1.5 text-emerald-700 hover:bg-emerald-50 border-emerald-200"
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
        {/* Filters */}
        <input
          className="input-field w-52"
          placeholder={ar() ? "بحث بالاسم أو الهاتف..." : "Search name or phone..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input-field w-36"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
        >
          <option value="all">{ar() ? "كل الأدوار" : "All roles"}</option>
          <option value="customer">{ar() ? "عميل" : "Customer"}</option>
          <option value="admin">{ar() ? "مدير" : "Admin"}</option>
          <option value="cs">{ar() ? "خدمة عملاء" : "CS"}</option>
          <option value="finance">{ar() ? "مالية" : "Finance"}</option>
          <option value="clinicStaff">{ar() ? "موظف عيادة" : "Clinic Staff"}</option>
          <option value="user">{ar() ? "مستخدم" : "User"}</option>
        </select>
        <select
          className="input-field w-36"
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
          onLoginAs={() => login(selectedUser.id, "customer")}
        />
      ) : (
        <div className="card-elevated overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{ar() ? "الاسم" : "Name"}</th>
                <th>{ar() ? "الرقم" : "Phone/Contact"}</th>
                <th>{ar() ? "الصلاحية" : "Role"}</th>
                <th>{ar() ? "الحالة" : "Status"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => (
                <tr key={u.id}>
                  <td className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-pink-50 flex items-center justify-center text-xs font-bold text-brand-pink-600">
                        {(u.name ?? u.username ?? "?").charAt(0).toUpperCase()}
                      </div>
                      {u.name ?? u.username}
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
                  <td colSpan={5}>
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
          <div className="px-4 py-2 border-t border-surface-100 text-xs text-surface-400">
            {filtered.length} {ar() ? "مستخدم" : "user(s)"}{filterRole !== "all" || filterStatus !== "all" || search ? ` ${ar() ? "من" : "of"} ${users.length}` : ""}
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
                          ? new Date(r.reservationExpiresAt).toLocaleDateString()
                          : r.status === "active" ? <span className="text-emerald-600 font-medium">{ar() ? "تم التحويل" : "Converted"}</span> : "—"}
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs">{new Date(r.createdAt ?? "").toLocaleDateString()}</td>
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
function AuditLogViewer() {
  const { getAuthHeader } = useAuth();
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("");
  const [filterRole, setFilterRole] = useState("");
  
  const query = new URLSearchParams({ page: page.toString(), limit: "20" });
  if (filterType) query.set("actionType", filterType);
  if (filterRole) query.set("actorRole", filterRole);

  const { data, loading, error } = useFetch(`/audit?${query.toString()}`);

  return (
    <div className="space-y-6">
      <div className="card-elevated p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-lg font-bold text-surface-900">{ar() ? "سجل المراجعة والتدقيق" : "System Audit Logs"}</h3>
          <div className="flex gap-2">
            <select className="select-field text-sm" value={filterRole} onChange={e => { setFilterRole(e.target.value); setPage(1); }}>
              <option value="">{ar() ? "جميع الأدوار" : "All Roles"}</option>
              <option value="admin">Admin</option>
              <option value="finance">Finance</option>
              <option value="cs">CS</option>
              <option value="customer">Customer</option>
              <option value="system">System</option>
            </select>
            <select className="select-field text-sm" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
              <option value="">{ar() ? "جميع الإجراءات" : "All Actions"}</option>
              <option value="create_offer">Create Offer</option>
              <option value="update_offer">Update Offer</option>
              <option value="checkout_complete">Checkout</option>
              <option value="approve_booking">Approve Booking</option>
              <option value="submit_form">Submit Form</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-surface-500">Loading...</div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">{error}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-200">
            <table className="data-table text-sm w-full">
              <thead className="bg-surface-50">
                <tr>
                  <th>{ar() ? "الوقت" : "Timestamp"}</th>
                  <th>{ar() ? "المستخدم" : "Actor"}</th>
                  <th>{ar() ? "الدور" : "Role"}</th>
                  <th>{ar() ? "الإجراء" : "Action"}</th>
                  <th>{ar() ? "الكيان" : "Target"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {(data?.items || []).map((log: any) => (
                  <tr key={log.id} className="hover:bg-surface-50/50">
                    <td className="text-xs text-surface-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="font-mono text-xs">{log.actorId}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide
                        ${log.actorRole === 'admin' ? 'bg-red-50 text-red-700' :
                          log.actorRole === 'system' ? 'bg-surface-200 text-surface-700' :
                          'bg-emerald-50 text-emerald-700'}`}>
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="font-semibold text-surface-900">{log.actionType}</td>
                    <td className="text-xs">
                      <span className="text-surface-500">{log.targetEntityType}</span>
                      <div className="font-mono mt-0.5 text-[10px] text-surface-400">{log.targetEntityId}</div>
                    </td>
                  </tr>
                ))}
                {(data?.items || []).length === 0 && (
                  <tr>
                    <td colSpan={5}>
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
        
        <div className="flex justify-between items-center mt-6">
          <button 
            className="btn-secondary btn-sm" 
            disabled={page === 1} 
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            {ar() ? "السابق" : "Previous"}
          </button>
          <span className="text-sm font-medium text-surface-500">
            {ar() ? `صفحة ${page}` : `Page ${page}`}
          </span>
          <button 
            className="btn-secondary btn-sm" 
            disabled={(data?.items || []).length < 20}
            onClick={() => setPage(p => p + 1)}
          >
            {ar() ? "التالي" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AdminDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue();
  const { data: paymentsData } = usePendingPayments();
  const { data: productsData } = useProducts();
  const { data: offersData } = useApi<{ items: any[] }>("/offers/admin");
  const { data: financeData } = useFinanceSnapshot();
  const fs = financeData?.snapshot;

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "offers", icon: Icons.offers, label: ar() ? "العضويات" : "Memberships" },
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
    { key: "notifications_settings", icon: Icons.bell, label: ar() ? "إعدادات الإشعارات" : "Notifications" },
    { key: "audit", icon: Icons.clipboard, label: ar() ? "سجل التدقيق" : "Audit Logs" },
    { key: "settings", icon: Icons.settings, label: t("settings") },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة المدير" : "Admin Dashboard"} subtitle={ar() ? "نظرة عامة كاملة" : "Full system overview"}>
      <div className="space-y-8 animate-fade-in">
        {activeNav === "home" && (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <KpiCard icon={Icons.chart} label={ar() ? "إيرادات الشهر" : "Monthly Revenue"} value={fs?.totalRevenue || "0"} sub="KWD" isHighlighted trend="+12.5%" />
              <KpiCard accent="amber" icon={Icons.shield} label={ar() ? "تحققات معلقة" : "Pending KYC"} value={(kycData?.items || []).length} sub={ar() ? "تتطلب مراجعة" : "requires review"} />
              <KpiCard accent="blue" icon={Icons.cash} label={ar() ? "مدفوعات معلقة" : "Pending Payments"} value={(paymentsData?.items || []).length} sub={ar() ? "بانتظار التسوية" : "awaiting settlement"} />
              <KpiCard accent="violet" icon={Icons.offers} label={ar() ? "المنتجات" : "Products"} value={(productsData?.products || []).length} sub={ar() ? "في الكتالوج" : "active in catalog"} />
            </div>

            {/* Financial Overview Bento */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-surface-900 mb-5">{ar() ? "نظرة مالية شاملة" : "Financial Overview"}</h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="card-elevated p-6 bg-white flex flex-col justify-center border-l-4 border-l-surface-300">
                   <div className="text-sm font-bold text-surface-500 mb-1">{ar() ? "إجمالي الكاش باك المقفل" : "Total Cashback Locked"}</div>
                   <div className="text-3xl font-black text-surface-900">{fs?.totalCashbackLocked || "0"} <span className="text-lg text-surface-400 font-medium">KWD</span></div>
                   <div className="mt-4 w-full bg-surface-100 rounded-full h-2 overflow-hidden"><div className="bg-surface-400 h-full rounded-full w-[75%]"></div></div>
                </div>
                <div className="card-elevated p-6 bg-white flex flex-col justify-center border-l-4 border-l-brand-pink-400 shadow-md">
                   <div className="text-sm font-bold text-brand-pink-500 mb-1">{ar() ? "الكاش باك المتاح للمستخدمين" : "Total Cashback Unlocked"}</div>
                   <div className="text-3xl font-black text-brand-pink-600">{fs?.totalCashbackUnlocked || "0"} <span className="text-lg text-brand-pink-400 font-medium">KWD</span></div>
                   <div className="mt-4 w-full bg-brand-pink-50 rounded-full h-2 overflow-hidden"><div className="bg-brand-pink-500 h-full rounded-full w-[50%]"></div></div>
                </div>
                <div className="card-elevated p-6 bg-white flex flex-col justify-center border-l-4 border-l-emerald-400">
                   <div className="text-sm font-bold text-surface-500 mb-1">{ar() ? "إجمالي الكاش باك المستخدم" : "Total Cashback Utilized"}</div>
                   <div className="text-3xl font-black text-emerald-600">{fs?.totalCashbackUtilized || "0"} <span className="text-lg text-emerald-400 font-medium">KWD</span></div>
                   <div className="mt-4 w-full bg-emerald-50 rounded-full h-2 overflow-hidden"><div className="bg-emerald-500 h-full rounded-full w-[25%]"></div></div>
                </div>
              </div>
            </div>

            <ReferralLeaderboardWidget />

            {/* Products catalog */}
            <div>
              <h3 className="text-lg font-bold text-surface-900 mb-5">{ar() ? "كتالوج المنتجات" : "Product Catalog"}</h3>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {(productsData?.products || []).map((p: any) => (
                  <div key={p.code} className="card-elevated p-4">
                    <div className="text-sm font-bold text-surface-900">{ar() ? p.nameAr : p.nameEn}</div>
                    <div className="text-xs text-surface-400 mt-1">{p.durationMonths} {ar() ? "شهر" : "months"} • {p.cashbackModel}</div>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {parseFloat(p.fixedCashbackKwd) > 0 && <span className="badge-pink">{p.fixedCashbackKwd} CB</span>}
                      {parseFloat(p.perSessionCashbackKwd) > 0 && <span className="badge-sage">{p.perSessionCashbackKwd}/s</span>}
                      {parseFloat(p.perSessionPriceKwd) > 0 && <span className="badge-blue">{p.perSessionPriceKwd}/use</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        {activeNav === "offers" && <OffersManager />}
        {activeNav === "categories" && <CategoriesAdminPanel />}
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
        {activeNav === "notifications_settings" && <NotificationSettingsPanel />}
        {activeNav === "settings" && <AdminSettings />}
      </div>
    </DashboardShell>
  );
}
