import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../../app/AuthContext";
import { useApi, invalidateCache } from "../../../hooks/useApi";
import { apiFetch } from "../../../lib/api";
import { getCategoryIcon } from "../../../components/CategoryIcons";
import { getSubscriptions } from "../../../lib/offerSystem";
import DatePicker from "../../../components/DatePicker";
import { ar } from "./shared";

// ── Sub-pages ──
export function OffersManager() {
  const { getAuthHeader } = useAuth();
  const { data: clinicsData } = useApi<{ clinics: any[] }>("/clinics/admin");
  const { data: apiOffersData, loading: loadingOffers, refetch: refetchOffers } = useApi<{ items: any[] }>("/offers/admin");
  const { data: formsData } = useApi<{ items: any[] }>("/eforms/admin/forms");
  const { data: categoriesAdminData } = useApi<{ items: Array<{ id: string; slug: string; nameEn: string; nameAr: string }> }>("/categories/admin");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eforms = formsData?.items || [];

  const emptyForm = { nameEn: "", nameAr: "", clinicLocked: false, requireBranchSelection: true, clinicId: "", extraClinicIds: [] as string[], category: "laser", price: "99", validityDays: "365", maxSessions: "6", unlimitedSessions: false, sessionIntervalDays: "25", imageUrl: "", signupCashback: "0", perSessionCashback: "0", cashbackActivationFee: "0", clinicTransferFee: "0", allowFullPayment: true, allowInstallments: false, maxInstallments: "4", allowDeposit: false, depositAmount: "0", tagsEn: "", tagsAr: "", isCashbackOnly: false, offerExpirationDate: "", isGroupOffer: false, groupSizeRequired: "2", groupRewardType: "free_session", groupRewardValue: "", fullPaymentEFormId: "", installmentsEFormId: "", depositEFormId: "", allowENet: false, enetEFormId: "", clinicOverrides: [] as { clinicId: string, sessionPriceKwd: string }[], branchSubscriptionPrices: [] as { clinicId: string, priceKwd: string }[], allowExtraPaidSessions: false, extraSessionPriceKwd: "", branchExtraSessionPrices: [] as { clinicId: string, priceKwd: string }[], allowAppointmentBooking: true, bookingFlow: "admin_forward" as "admin_forward" | "direct_clinic" };
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

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
    setFormError(null);
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
      allowAppointmentBooking: o.allowAppointmentBooking ?? true,
      extraSessionPriceKwd: o.extraSessionPriceKwd ?? "",
      branchExtraSessionPrices: (o.branchExtraSessionPrices || []).map((x: any) => ({
        clinicId: x.clinicId || "",
        priceKwd: String(x.priceKwd ?? "0")
      })),
      bookingFlow: o.bookingFlow || "admin_forward"
    });
    setFormError(null);
    setEditingId(o.id || o._id); 
    setShowForm(true);
  };

  const validateForm = (): string | null => {
    if (!form.nameEn.trim()) return ar() ? "اسم العرض (EN) مطلوب." : "Offer name (EN) is required.";
    if (!(Number(form.price) >= 0) || form.price === "") return ar() ? "أدخل سعراً صحيحاً." : "Enter a valid price.";
    if (!(parseInt(form.validityDays) >= 1)) return ar() ? "المدة يجب أن تكون يوماً واحداً على الأقل." : "Validity must be at least 1 day.";
    if (!form.unlimitedSessions && !(parseInt(form.maxSessions) >= 1)) return ar() ? "أدخل عدد الجلسات (1 على الأقل) أو اختر غير محدود." : "Enter max sessions (at least 1) or choose Unlimited.";
    if (!(parseInt(form.sessionIntervalDays || "0") >= 0)) return ar() ? "الحد الأدنى للأيام لا يمكن أن يكون سالباً." : "Minimum days between sessions can't be negative.";
    if (!form.clinicId) return ar() ? "اختر العيادة الرئيسية." : "Select a primary clinic.";
    if (!form.allowFullPayment && !form.allowInstallments && !form.allowDeposit && !form.allowENet) return ar() ? "فعّل طريقة دفع واحدة على الأقل." : "Enable at least one payment option.";
    if (form.allowInstallments && !(parseInt(form.maxInstallments) >= 2)) return ar() ? "عدد الأقساط يجب أن يكون 2 على الأقل." : "Installments must allow at least 2 payments.";
    if (form.allowDeposit && !(Number(form.depositAmount) > 0)) return ar() ? "أدخل مبلغ العربون." : "Enter the deposit amount.";
    if (form.isGroupOffer && !(parseInt(form.groupSizeRequired) >= 2)) return ar() ? "حجم المجموعة يجب أن يكون 2 على الأقل." : "Group size must be at least 2.";
    return null;
  };

  const saveOffer = async () => {
    const problem = validateForm();
    setFormError(problem);
    if (problem) return;
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
          offerExpirationDate: form.offerExpirationDate ? new Date(form.offerExpirationDate).toISOString() : null,
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
          allowAppointmentBooking: !!form.allowAppointmentBooking,
          bookingFlow: form.bookingFlow || "admin_forward",
          extraSessionPriceKwd: form.allowExtraPaidSessions && form.extraSessionPriceKwd ? `${Number(form.extraSessionPriceKwd).toFixed(3)}` : undefined,
          branchExtraSessionPrices: form.allowExtraPaidSessions
            ? form.branchExtraSessionPrices
                .filter((o) => o.clinicId && o.priceKwd !== "" && !Number.isNaN(Number(o.priceKwd)))
                .map((o) => ({ clinicId: o.clinicId, priceKwd: `${Number(o.priceKwd).toFixed(3)}` }))
            : [],
          // Publishing state is managed from the offer list; editing must not re-publish
          // a draft/hidden offer or un-feature a featured one.
          ...(editingId ? {} : { status: "active", active: true, featured: false })
        })
      });
      invalidateCache("/offers");
      invalidateCache("/session-types");
      invalidateCache("/commerce");
      setShowForm(false);
      refresh();
    } catch (e: any) {
      setFormError(e.message || (ar() ? "تعذر حفظ العرض." : "Could not save the offer."));
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
        body: JSON.stringify({ active: !o.active, status: o.active ? "draft" : "active" })
      });
      refresh();
    } catch (e: any) { alert(e.message); }
  };
  const setOfferStatus = async (o: any, status: string) => {
    try {
      await apiFetch(`/offers/admin/${o.id || o._id}`, {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({ status })
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
                    ? (form.clinicLocked ? "مقيّد — العميل يختار مرة واحدة" : "مفتوح — يمكن للعميل تغيير العيادة")
                    : (form.clinicLocked ? "Locked — customer picks once, then locked" : "Open — customer can change clinic")}
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  {ar()
                    ? (form.clinicLocked
                        ? "العميل يختار عيادته عند الاشتراك ويُقيَّد بها. تغييرها لاحقاً يستلزم رسوم متصاعدة: 10 → 20 → 30 د.ك، وتحتاج موافقة خدمة العملاء."
                        : "العميل يختار أي عيادة نشطة عند الاشتراك. يُطبَّق رسوم نقل العضوية المحددة أدناه عند التغيير لاحقاً.")
                    : (form.clinicLocked
                        ? "Customer picks any active clinic at checkout and is locked to it. Changing later costs 10 → 20 → 30 KWD (escalating) and requires CS approval."
                        : "Customer picks any active clinic at checkout. Later changes are charged the Clinic Transfer Fee below.")}
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

          {/* ── Primary clinic & transfer fee ── */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {F(ar() ? "العيادة الرئيسية" : "Primary Clinic", <div>
              <select className="select-field w-full" value={form.clinicId} onChange={e => setForm({...form, clinicId: e.target.value})}>
                <option value="">{ar() ? "اختر العيادة..." : "Select Clinic..."}</option>
                {(clinicsData?.clinics || []).map((c: any) => <option key={c.id} value={c.id}>{ar() ? (c.nameAr || c.nameEn) : c.nameEn}</option>)}
              </select>
              <p className="text-[11px] text-surface-500 mt-1">{ar()
                ? (form.requireBranchSelection ? "تُستخدم كعيادة افتراضية للعرض." : "كل الاشتراكات ستُسجَّل في هذه العيادة.")
                : (form.requireBranchSelection ? "Used as the offer's default clinic." : "Every purchase is assigned to this clinic.")}</p>
            </div>)}
            {!form.clinicLocked && F(ar() ? "رسوم نقل العضوية لعيادة أخرى (KWD)" : "Clinic Transfer Fee (KWD)", <div>
              <input className="input-field" type="number" min={0} step="0.001" value={form.clinicTransferFee} onChange={e => setForm({...form, clinicTransferFee: e.target.value})} />
              <p className="text-[11px] text-surface-500 mt-1">{ar() ? "تُعرض للعميل عند الشراء وعند طلب تغيير العيادة. 0 = بدون رسوم." : "Shown to the customer at checkout and when changing clinic. 0 = free."}</p>
            </div>)}
          </div>

          {/* ── Booking Flow selector ── */}
          <div className={`mt-4 rounded-xl border p-4 transition-colors ${form.bookingFlow === "direct_clinic" ? "border-blue-300 bg-blue-50/40" : "border-surface-200 bg-surface-50"}`}>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              <div className="text-sm font-bold text-surface-900">{ar() ? "مسار طلب الحجز" : "Booking Request Flow"}</div>
            </div>
            <div className="space-y-2">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.bookingFlow === "admin_forward" ? "border-brand-pink-300 bg-brand-pink-50 shadow-sm" : "border-surface-200 bg-white hover:border-surface-300"}`}
                onClick={() => setForm((prev) => ({ ...prev, bookingFlow: "admin_forward" as const }))}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.bookingFlow === "admin_forward" ? "border-brand-pink-500" : "border-surface-300"}`}>
                  {form.bookingFlow === "admin_forward" && <div className="w-2 h-2 rounded-full bg-brand-pink-500" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-surface-900">{ar() ? "موافقة الإدارة / إعادة توجيه" : "Admin Approval / Forwarding"}</div>
                  <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العميل → الإدارة → العيادة (الافتراضي)" : "Customer → Admin → Clinic (Default)"}</div>
                </div>
                {form.bookingFlow === "admin_forward" && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-pink-100 text-brand-pink-700">{ar() ? "الافتراضي" : "Default"}</span>}
              </label>
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${form.bookingFlow === "direct_clinic" ? "border-blue-300 bg-blue-50 shadow-sm" : "border-surface-200 bg-white hover:border-surface-300"}`}
                onClick={() => setForm((prev) => ({ ...prev, bookingFlow: "direct_clinic" as const }))}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.bookingFlow === "direct_clinic" ? "border-blue-500" : "border-surface-300"}`}>
                  {form.bookingFlow === "direct_clinic" && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-surface-900">{ar() ? "مباشر إلى العيادة" : "Direct to Clinic"}</div>
                  <div className="text-xs text-surface-500 mt-0.5">{ar() ? "العميل → العيادة (بدون مرور على الإدارة)" : "Customer → Clinic (skips Admin)"}</div>
                </div>
                {form.bookingFlow === "direct_clinic" && <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{ar() ? "مباشر" : "Direct"}</span>}
              </label>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {F(ar() ? "السعر (KWD)" : "Price (KWD)", <input className="input-field" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />)}
            {F(ar() ? "المدة (أيام)" : "Validity (days)", <input className="input-field" type="number" value={form.validityDays} onChange={e => setForm({...form, validityDays: e.target.value})} />)}
            {F(ar() ? "تاريخ إنتهاء العرض" : "Offer Expiration Date", <DatePicker className="input-field w-full" value={form.offerExpirationDate} onChange={e => setForm({...form, offerExpirationDate: e.target.value})} />)}
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
              {F(ar() ? "الحد الأدنى للأيام بين الجلسات" : "Minimum Days Between Sessions", <div>
                <input className="input-field" type="number" min={0} value={form.sessionIntervalDays} onChange={e => setForm({...form, sessionIntervalDays: e.target.value})} />
                <p className="text-[11px] text-surface-500 mt-1">{ar()
                  ? "لا يمكن للعميل طلب جلسة جديدة قبل انقضاء هذه المدة من آخر جلسة مكتملة. يحصل الموظفون على تحذير (مع إمكانية التجاوز) عند الجدولة قبلها. 0 = بدون حد أدنى."
                  : "Customers can't request a new session until this many days after their last completed one, and staff get a warning (with override) when scheduling sooner. 0 = no minimum."}</p>
              </div>)}
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
                    {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}{ef.archived ? (ar() ? " (مؤرشف)" : " (Archived)") : ""}</option>)}
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
                      {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}{ef.archived ? (ar() ? " (مؤرشف)" : " (Archived)") : ""}</option>)}
                    </select>
                  </>
                )}
              </div>
              <div className={`p-3 rounded-xl border-2 ${form.allowENet ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200'}`}>
                <label className="flex items-center gap-3 cursor-pointer mb-2"><input type="checkbox" checked={form.allowENet} onChange={e => setForm({...form, allowENet: e.target.checked})} /><span className="font-bold text-sm text-surface-900">{ar() ? "الدفع الإلكتروني (أقساط eNet)" : "eNet (Pay in 4)"}</span></label>
                {form.allowENet && (
                  <select className="select-field w-full text-xs" value={form.enetEFormId} onChange={e => setForm({...form, enetEFormId: e.target.value})}>
                    <option value="">{ar() ? "بدون نموذج" : "No E-Form Required"}</option>
                    {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}{ef.archived ? (ar() ? " (مؤرشف)" : " (Archived)") : ""}</option>)}
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
                      {eforms.map(ef => <option key={ef.id || ef._id} value={ef.id || ef._id}>{ef.title}{ef.archived ? (ar() ? " (مؤرشف)" : " (Archived)") : ""}</option>)}
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
            <h5 className="flex items-center gap-2.5 text-sm font-bold text-surface-900 mb-4 pb-3 border-b border-surface-100 before:content-[''] before:h-4 before:w-1 before:rounded-full before:bg-gradient-to-b before:from-brand-pink-500 before:to-brand-sage-300 before:shrink-0">{ar() ? "خيارات العرض" : "Display Options"}</h5>
            <div className="mt-4">
              <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.allowAppointmentBooking ? 'border-brand-pink-500 bg-brand-pink-50/50' : 'border-surface-200 hover:border-surface-300'}`}>
                <input type="checkbox" checked={form.allowAppointmentBooking} onChange={e => setForm({...form, allowAppointmentBooking: e.target.checked})} className="accent-brand-pink-500 w-4 h-4" />
                <div>
                  <span className="font-bold text-sm text-surface-900">{ar() ? "إظهار زر حجز موعد" : "Show \"Book Appointment\" Button"}</span>
                  <p className="text-xs text-surface-500 mt-0.5">{ar() ? "فعّل هذا الخيار لإظهار زر حجز الموعد لهذه العضوية. إيقافه سيقوم بإخفاء الزر بالكامل." : "Enable this option to display a Book Appointment button for this membership. Disabling it will hide the button."}</p>
                </div>
              </label>
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
            {formError && <div role="alert" className="me-auto text-sm font-semibold text-red-600">{formError}</div>}
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null); setFormError(null); }}>{ar() ? "إلغاء" : "Cancel"}</button>
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
                    {o.imageUrl && <div className="h-64 w-full relative"><img src={o.imageUrl} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" /></div>}
                    <div className="p-3">
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
                        <button className="text-xs font-bold px-3 py-1.5 rounded-lg ml-auto" onClick={() => toggleActive(o)}>{(o.status === "active" || (!o.status && o.active)) ? <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">{ar() ? "إيقاف" : "Deactivate"}</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{ar() ? "تفعيل" : "Activate"}</span>}</button>

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
