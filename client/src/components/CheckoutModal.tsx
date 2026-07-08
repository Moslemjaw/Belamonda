import { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "./DatePicker";
import { apiFetch, API_BASE_URL } from "../lib/api";
import { useAuth } from "../app/AuthContext";
import { FormRenderer, FormDefinition } from "./FormRenderer";

type Offer = {
  id: string;
  name: string;
  category?: string;
  clinicId?: string;
  userOfferId?: string;
  /** Additional branches where this package can be redeemed (customer picks one at checkout). */
  clinicIds?: string[];
  /**
   * When false: customer picks any active clinic at checkout.
   * When true (or undefined): customer is locked to clinicId / clinicIds.
   */
  clinicLocked?: boolean;
  requireBranchSelection?: boolean;
  membershipType?: string;
  clinicTransferFeeKwd?: string;
  subscriptionPriceKwd: string;
  validityDays: number;
  isGroupOffer?: boolean;
  groupSizeRequired?: number;
  groupRewardType?: string;
  allowFullPayment: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  allowENet?: boolean;
  allowDeposit: boolean;
  depositAmountKwd: string;
  cashbackEligible?: boolean;
  maxCashbackPerPurchaseKwd?: string;
  branchSubscriptionPrices?: { clinicId: string; priceKwd: string }[];
  clinicOverrides?: { clinicId: string; sessionPriceKwd: string }[];
};

type Wallet = {
  wallet: { lockedBalance: string; unlockedBalance: string; ceiling: string } | null;
};

type PayMode = "full" | "installments" | "deposit" | "enet";

type UserOfferLite = { id: string; status: string; offerId?: string };
type CheckoutApiResult = {
  userOffer: UserOfferLite;
  enet?: { approved: boolean; reason?: string };
};
type CheckoutBody = {
  offerId: string;
  userOfferId?: string;
  applyCashbackKwd?: string;
  count?: number;
  expectedCompletionDate?: string;
  preferredPlan?: "full" | "installments_2" | "installments_3" | "installments_4_enet";
};

export type CheckoutResult = { ok: true; userOffer: UserOfferLite } | { ok: false; error: string };

function parseKwd(s: string | null | undefined): number {
  if (!s) return 0;
  const trimmed = String(s).trim();
  if (!/^\d*(\.\d{0,3})?$/.test(trimmed)) return 0;
  const [a = "0", b = "000"] = trimmed.split(".");
  const intPart = a === "" ? 0 : parseInt(a, 10);
  const fracStr = (b || "").padEnd(3, "0").slice(0, 3);
  const fracPart = fracStr === "" ? 0 : parseInt(fracStr, 10);
  if (Number.isNaN(intPart) || Number.isNaN(fracPart)) return 0;
  return intPart * 1000 + fracPart;
}
function fmtKwd(mils: number): string {
  return `${Math.floor(mils / 1000)}.${String(mils % 1000).padStart(3, "0")}`;
}

function friendlyCheckoutError(raw: string, isAr: boolean): string {
  const code = raw.split("|")[0];
  const map: Record<string, [string, string]> = {
    ALREADY_ENROLLED: [
      "You already have an active or pending membership for this package. Please check your dashboard.",
      "لديك عضوية فعّالة أو قيد الانتظار لهذه الباقة. يرجى مراجعة لوحة التحكم."
    ],
    ENROLLMENT_CAP_REACHED: [
      "This package has reached its enrollment limit.",
      "وصلت هذه الباقة إلى الحد الأقصى للتسجيل."
    ],
    KYC_REQUIRED: [
      "Please complete your identity verification before purchasing.",
      "يرجى إكمال التحقق من الهوية قبل الشراء."
    ],
    OFFER_INACTIVE: [
      "This offer is no longer available.",
      "هذا العرض لم يعد متاحاً."
    ],
    OFFER_OUTSIDE_WINDOW: [
      "This offer is outside its availability window.",
      "هذا العرض خارج فترة التوفر."
    ],
    CLINIC_CHOICE_REQUIRED: [
      "Please select a clinic to continue.",
      "يرجى اختيار عيادة للمتابعة."
    ],
    NO_WALLET: [
      "Wallet not found. Please contact support.",
      "المحفظة غير موجودة. يرجى التواصل مع الدعم."
    ],
    CASHBACK_NOT_ELIGIBLE: [
      "Cashback cannot be applied to this offer.",
      "لا يمكن تطبيق الكاشباك على هذا العرض."
    ],
  };
  const pair = map[code];
  if (pair) return isAr ? pair[1] : pair[0];
  return raw;
}

export default function CheckoutModal({
  offer,
  onClose,
  onComplete,
  ar = false,
  inviteCode
}: {
  offer: Offer;
  onClose: () => void;
  onComplete: (result: CheckoutResult) => void;
  ar?: boolean;
  inviteCode?: string | null;
}) {
  const { getAuthHeader } = useAuth();
  const [step, setStep] = useState<"choose" | "details" | "processing" | "eform" | "result">("choose");
  const [mode, setMode] = useState<PayMode | null>(null);
  const [installments, setInstallments] = useState<number>(2);
  const [useCashback, setUseCashback] = useState(false);
  const [cashbackKwd, setCashbackKwd] = useState("0.000");
  const [completionDate, setCompletionDate] = useState<string>("");
  const [preferredPlan, setPreferredPlan] = useState<"full" | "installments_2" | "installments_3" | "installments_4_enet">("full");
  const [wallet, setWallet] = useState<Wallet["wallet"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enetResult, setEnetResult] = useState<{ approved: boolean; reason?: string } | null>(null);
  const [clinic, setClinic] = useState<{ id: string; nameEn: string; nameAr: string; address: string } | null>(null);
  const [allowedClinics, setAllowedClinics] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>("");
  const [branchConfirmed, setBranchConfirmed] = useState(false);
  const [branchLoadError, setBranchLoadError] = useState<string | null>(null);
  const [forcePicker, setForcePicker] = useState(false);

  // --- inline e-form state ---
  const [pendingFormId, setPendingFormId] = useState<string | null>(null);
  const [eformDef, setEformDef] = useState<FormDefinition | null>(null);
  const [eformValues, setEformValues] = useState<Record<string, any>>({});
  const [eformSignature, setEformSignature] = useState<string | null>(null);
  const [eformFiles, setEformFiles] = useState<string[]>([]);
  const [eformInnerStep, setEformInnerStep] = useState<"fill" | "review">("fill");
  const [eformSubmitting, setEformSubmitting] = useState(false);
  const [eformError, setEformError] = useState<string | null>(null);
  const submitRef = useRef<() => Promise<void>>();
  const successResultRef = useRef<CheckoutResult | null>(null);

  const t = (en: string, arT: string) => (ar ? arT : en);

  useEffect(() => {
    apiFetch("/wallet/me", { headers: getAuthHeader() })
      .then((d) => setWallet((d as { wallet: Wallet["wallet"] }).wallet))
      .catch(() => {});
  }, [getAuthHeader]);

  // Load e-form definition when one is required
  useEffect(() => {
    if (!pendingFormId) return;
    setEformDef(null);
    setEformValues({});
    setEformSignature(null);
    setEformFiles([]);
    setEformInnerStep("fill");
    setEformError(null);
    apiFetch(`/eforms/forms/${pendingFormId}`, { headers: getAuthHeader() })
      .then((d: any) => setEformDef(d.form))
      .catch((e: any) => setEformError(e.message));
  }, [pendingFormId]);

  const validateEForm = (): string | null => {
    if (!eformDef) return null;
    for (const f of eformDef.fields) {
      if (!f.required) continue;
      if (f.type === "signature") {
        if (!eformSignature) return ar ? `${f.labelEn} مطلوب` : `${f.labelEn} is required`;
        continue;
      }
      if (f.type === "file_upload") {
        if (eformFiles.length === 0) return ar ? `${f.labelEn} مطلوب` : `${f.labelEn} is required`;
        continue;
      }
      const v = eformValues[f.key];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
        return ar ? `${f.labelEn} مطلوب` : `${f.labelEn} is required`;
      }
    }
    return null;
  };

  const handleEFormFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const token = (getAuthHeader() as any)?.Authorization?.replace("Bearer ", "");
    try {
      const r = await fetch(`${API_BASE_URL}/eforms/uploads`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setEformFiles((s) => [...s, data.ref]);
    } catch (err: any) {
      setEformError(err.message);
    } finally {
      e.target.value = "";
    }
  };

  const submitEForm = async () => {
    if (!eformDef || !pendingFormId) return;
    setEformSubmitting(true);
    setEformError(null);
    try {
      const answers = eformDef.fields
        .filter((f) => f.type !== "signature" && f.type !== "file_upload")
        .map((f) => ({ key: f.key, value: eformValues[f.key] ?? null }));
      await apiFetch("/eforms/submit", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          formId: eformDef.id,
          targetKind: "offer",
          targetRefId: offer.id,
          answers,
          signatureDataUrl: eformSignature || undefined,
          uploadedFileRefs: eformFiles
        })
      });
      // Form signed — retry the checkout
      setPendingFormId(null);
      if (submitRef.current) await submitRef.current();
    } catch (err: any) {
      setEformError(err.message);
    } finally {
      setEformSubmitting(false);
    }
  };

  // New-style offers (clinicLocked defined): customer always picks their own clinic at checkout.
  // clinicLocked === true  → picked clinic is locked; changing later costs escalating fees.
  // clinicLocked === false → picked clinic can be changed freely.
  // clinicLocked undefined → legacy: customer picks from the offer's pre-assigned allowed list.
  const isNewStyle = offer.clinicLocked !== undefined;

  const allowedBranchIds = useMemo(() => {
    if (isNewStyle) return []; // all active clinics — fetched async below
    const s = new Set<string>();
    if (offer.clinicId) s.add(String(offer.clinicId));
    for (const id of offer.clinicIds ?? []) {
      if (id) s.add(String(id));
    }
    const sessionOverrideIds = (offer.clinicOverrides || []).map((o) => o.clinicId).filter(Boolean);
    const subOverrideIds = (offer.branchSubscriptionPrices || []).map((o) => o.clinicId).filter(Boolean);
    sessionOverrideIds.forEach((id) => s.add(id));
    subOverrideIds.forEach((id) => s.add(id));
    return [...s];
  }, [isNewStyle, offer.clinicId, offer.clinicIds, offer.clinicOverrides, offer.branchSubscriptionPrices]);

  const showBranchSection = offer.requireBranchSelection !== false;
  const needsBranchPicker = showBranchSection && (isNewStyle || allowedBranchIds.length > 1 || forcePicker);

  useEffect(() => {
    setBranchLoadError(null);
    setClinic(null);
    setAllowedClinics([]);

    let cancelled = false;
    (async () => {
      try {
        const listRaw = await apiFetch("/clinics");
        const items = (listRaw as { items?: any[] }).items || [];

        if (isNewStyle) {
          // If clinicOverrides (branchSessionPrices) or branchSubscriptionPrices exist, only show those clinics
          const sessionOverrideIds = (offer.clinicOverrides || []).map((o) => o.clinicId).filter(Boolean);
          const subOverrideIds = (offer.branchSubscriptionPrices || []).map((o) => o.clinicId).filter(Boolean);
          const overrideIds = Array.from(new Set([...sessionOverrideIds, ...subOverrideIds]));
          
          let active;
          if (overrideIds.length > 0) {
            active = items.filter((c: any) => overrideIds.includes(String(c.id)));
          } else {
            active = items.filter((c: any) => c.active !== false && c.status !== "inactive");
          }
          if (cancelled) return;
          if (active.length) setAllowedClinics(active);
          else setBranchLoadError(ar ? "لا توجد عيادات متاحة حالياً." : "No clinics available right now.");
          return;
        }

        // Legacy: filter to the offer's allowed list.
        if (!allowedBranchIds.length) {
          setBranchLoadError(
            ar ? "هذا العرض غير مرتبط بعيادة. تواصلي مع الدعم." : "This offer is missing a clinic. Contact support."
          );
          return;
        }

        const pick = items.filter((c: any) => allowedBranchIds.some((aid) => String(c.id) === String(aid)));
        if (cancelled) return;
        // Use a local picker flag (never include forcePicker here — that would create an infinite loop).
        const localNeedsPicker = allowedBranchIds.length > 1;
        if (localNeedsPicker) {
          setAllowedClinics(pick);
          if (!pick.length) {
            setBranchLoadError(ar ? "تعذر تحميل قائمة الفروع." : "Could not load branch list.");
          }
        } else {
          const id = allowedBranchIds[0];
          let row = pick[0];
          if (!row) {
            try {
              const one = await apiFetch(`/clinics/${encodeURIComponent(id)}`);
              row = (one as { clinic?: any }).clinic;
            } catch {
              row = items.find((c: any) => String(c.id) === String(id));
            }
          }
          if (row && !cancelled) {
            setClinic(row);
          } else if (!cancelled) {
            // Clinic ID didn't match any active clinic — fall back to letting the
            // customer pick from the full active-clinic list instead of showing an error.
            const active = items.filter((c: any) => c.active !== false && c.status !== "inactive");
            if (active.length) {
              setAllowedClinics(active);
              setForcePicker(true);
            } else {
              setBranchLoadError(ar ? "تعذر تحميل بيانات الفرع." : "Could not load this branch.");
            }
          }
        }
      } catch {
        if (!cancelled) setBranchLoadError(ar ? "تعذر تحميل الفروع." : "Could not load branches.");
      }
    })();
    return () => { cancelled = true; };
  }, [isNewStyle, allowedBranchIds.join(","), ar]);

  useEffect(() => {
    setBranchConfirmed(false);
    setSelectedClinicId("");
    setForcePicker(false);
  }, [offer.id, isNewStyle, allowedBranchIds.join(",")]);

  // Resolve the effective subscription price — use branch override if available.
  const effectiveSubscriptionPriceKwd = useMemo(() => {
    const chosenId = needsBranchPicker ? selectedClinicId : (clinic?.id || allowedBranchIds[0] || "");
    let priceKwd = offer.subscriptionPriceKwd;
    if (chosenId && offer.branchSubscriptionPrices?.length) {
      const match = offer.branchSubscriptionPrices.find((b) => b.clinicId === chosenId);
      if (match) priceKwd = match.priceKwd;
    }
    const isGroup = offer.isGroupOffer || offer.membershipType === "group";
    if (isGroup && offer.groupRewardType === "split_bill" && offer.groupSizeRequired && offer.groupSizeRequired > 1) {
      const totalMils = parseKwd(priceKwd);
      const splitMils = Math.floor(totalMils / offer.groupSizeRequired);
      priceKwd = fmtKwd(splitMils);
    }
    return priceKwd;
  }, [selectedClinicId, clinic, needsBranchPicker, allowedBranchIds, offer.branchSubscriptionPrices, offer.subscriptionPriceKwd, offer.isGroupOffer, offer.membershipType, offer.groupRewardType, offer.groupSizeRequired]);

  const grossKwd = mode === "deposit" ? offer.depositAmountKwd : effectiveSubscriptionPriceKwd;
  const grossMils = parseKwd(grossKwd);
  const cashbackEligible = offer.cashbackEligible !== false;
  const offerCapMils = offer.maxCashbackPerPurchaseKwd ? parseKwd(offer.maxCashbackPerPurchaseKwd) : Infinity;
  const availableCashbackMils = wallet && cashbackEligible ? parseKwd(wallet.unlockedBalance) : 0;
  const maxApplyMils = Math.min(availableCashbackMils, grossMils, offerCapMils);
  const appliedMils = useCashback ? Math.min(parseKwd(cashbackKwd), maxApplyMils) : 0;
  const cashbackCapped = useCashback && parseKwd(cashbackKwd) > maxApplyMils;
  const netMils = Math.max(0, grossMils - appliedMils);
  const netKwd = fmtKwd(netMils);

  const installmentPreview = useMemo(() => {
    if (mode !== "installments") return null;
    const each = Math.floor(netMils / installments);
    const rem = netMils - each * installments;
    return Array.from({ length: installments }).map((_, i) => fmtKwd(each + (i === 0 ? rem : 0)));
  }, [mode, installments, netMils]);

  async function submit() {
    setStep("processing");
    setError(null);
    try {
      const body: CheckoutBody & { clinicId?: string; groupInviteCode?: string } = { 
        offerId: offer.id,
        userOfferId: offer.userOfferId
      };
      let chosenClinicId: string;
      if (!showBranchSection) {
        chosenClinicId = offer.clinicId ?? "";
      } else {
        chosenClinicId = needsBranchPicker ? selectedClinicId : allowedBranchIds[0];
      }
      if (!chosenClinicId) {
        throw new Error(t("Please select a clinic to continue.", "الرجاء اختيار عيادة للمتابعة."));
      }
      body.clinicId = chosenClinicId;
      if (inviteCode) body.groupInviteCode = inviteCode;
      if (useCashback && appliedMils > 0) body.applyCashbackKwd = fmtKwd(appliedMils);
      let url = "/checkout/full";
      if (mode === "full") url = "/checkout/full";
      else if (mode === "installments") {
        url = "/checkout/installments";
        body.count = installments;
      } else if (mode === "enet") {
        url = "/checkout/enet4";
      } else if (mode === "deposit") {
        url = "/checkout/deposit";
        if (completionDate) body.expectedCompletionDate = new Date(completionDate).toISOString();
        body.preferredPlan = preferredPlan;
      }
      const raw = await apiFetch(url, {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(body)
      });
      const result = raw as CheckoutApiResult;
      if (mode === "enet" && result.enet) {
        setEnetResult({ approved: !!result.enet.approved, reason: result.enet.reason });
      }
      setStep("result");
      if (mode === "enet" && result.enet && !result.enet.approved) {
        return;
      }
      // Store success result — onComplete will be called when user clicks "Done"
      successResultRef.current = { ok: true, userOffer: result.userOffer };
    } catch (e) {
      const rawMsg = e instanceof Error ? e.message : "Payment failed";
      const data = (e as any)?.data as { forms?: Array<{ id?: string; formId?: string; title: string }> } | undefined;
      if (rawMsg === "EFORMS_REQUIRED" && data?.forms?.[0]) {
        const first = data.forms[0];
        const resolvedFormId = first.id ?? first.formId ?? null;
        if (!resolvedFormId) { setError(rawMsg); setStep("result"); return; }
        // Save a ref to submit so the eform step can retry after signing
        submitRef.current = submit;
        setPendingFormId(resolvedFormId);
        setStep("eform");
        return;
      }
      setError(friendlyCheckoutError(rawMsg, ar));
      setStep("result");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-surface-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-pink-500">{t("Checkout", "إتمام الشراء")}</div>
            <h3 className="text-lg font-bold text-surface-900 mt-0.5">{offer.name}</h3>
          </div>
          <button className="text-surface-400 hover:text-surface-900 text-xl leading-none" onClick={onClose}>✕</button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {step === "choose" && (
            <>
              <div className="text-sm text-surface-600">
                {t("Choose how you'd like to pay.", "اختاري طريقة الدفع.")}
              </div>
              {offer.allowFullPayment && (
                <ChoiceCard
                  active={mode === "full"}
                  onClick={() => setMode("full")}
                  title={t("Full payment", "دفع كامل")}
                  desc={t("Pay the full amount today.", "دفع المبلغ كاملاً الآن.")}
                  amount={`${effectiveSubscriptionPriceKwd} KWD`}
                />
              )}
              {offer.allowInstallments && offer.maxInstallments >= 2 && (
                <ChoiceCard
                  active={mode === "installments"}
                  onClick={() => { setMode("installments"); setInstallments(2); }}
                  title={t("Installments", "أقساط")}
                  desc={t("Split into flexible in-house payments.", "قسّمي على دفعات.")}
                  amount={t("Flexible", "مرن")}
                />
              )}
              {offer.allowENet && (
                <ChoiceCard
                  active={mode === "enet"}
                  onClick={() => setMode("enet")}
                  title={t("4 installments via ENET", "٤ أقساط عبر ENET")}
                  desc={t("Subject to ENET approval.", "بحسب موافقة ENET.")}
                  amount="ENET"
                />
              )}
              {offer.allowDeposit && parseKwd(offer.depositAmountKwd) > 0 && (
                <ChoiceCard
                  active={mode === "deposit"}
                  onClick={() => setMode("deposit")}
                  title={t("Reserve with deposit", "احجزي بدفع عربون")}
                  desc={t("Pay deposit now, complete the rest later.", "ادفعي العربون الآن وأكملي لاحقاً.")}
                  amount={`${offer.depositAmountKwd} KWD`}
                />
              )}
              <button
                disabled={!mode}
                onClick={() => setStep("details")}
                className="w-full mt-3 bg-brand-pink-500 text-white font-bold py-3 rounded-2xl disabled:opacity-50"
              >
                {t("Continue", "متابعة")}
              </button>
            </>
          )}

          {step === "details" && mode && (
            <>
              {showBranchSection && (
                <div className="rounded-2xl border border-brand-pink-200 bg-brand-pink-50/40 p-4">
                  <div className="text-[11px] uppercase font-bold text-brand-pink-700 tracking-wide mb-2">
                    {t("Branch", "الفرع")}
                  </div>
                  {branchLoadError && (
                    <div className="text-sm text-red-600 font-medium">{branchLoadError}</div>
                  )}
                  {!branchLoadError && needsBranchPicker && (
                    <div className="mb-2">
                      <label className="block text-xs font-bold text-surface-900 mb-1">
                        {offer.clinicLocked === true
                          ? t("Choose your clinic — you'll be locked to it after subscribing", "اختري عيادتك — ستُقيَّدين بها بعد الاشتراك")
                          : t("Choose your clinic", "اختري عيادتك")}
                      </label>
                      <select
                        className="w-full rounded-xl border border-surface-300 p-2 text-sm bg-white"
                        value={selectedClinicId}
                        onChange={(e) => setSelectedClinicId(e.target.value)}
                      >
                        <option value="">{t("-- Select a clinic --", "-- اختر عيادة --")}</option>
                        {allowedClinics.map((c) => {
                          const override = (offer.clinicOverrides || []).find((o) => o.clinicId === c.id);
                          const feeText = override && parseFloat(override.sessionPriceKwd) > 0
                            ? (ar ? ` (${override.sessionPriceKwd} KWD/${ar ? "جلسة" : "session"})` : ` (${override.sessionPriceKwd} KWD/session)`)
                            : "";
                          return (
                            <option key={c.id} value={c.id}>
                              {ar ? c.nameAr : c.nameEn}{feeText}
                            </option>
                          );
                        })}
                      </select>
                      <div className="text-[10px] text-surface-600 mt-1">
                        {offer.clinicLocked === true
                          ? t(
                              "Clinic change requests: 1st = 10 KWD, 2nd = 20 KWD, 3rd = 30 KWD (escalates). Subject to CS approval.",
                              "رسوم تغيير العيادة: الطلب الأول 10 د.ك، الثاني 20 د.ك، الثالث 30 د.ك (متصاعدة). تخضع لموافقة خدمة العملاء."
                            )
                          : offer.clinicLocked === false
                          ? t("You can switch clinics later at no extra charge.", "يمكنك التغيير لاحقاً دون رسوم.")
                          : parseFloat(offer.clinicTransferFeeKwd || "0") > 0
                          ? t(
                              `Later transfers to another listed branch cost ${offer.clinicTransferFeeKwd} KWD.`,
                              `نقل الاشتراك لفرع آخر من الفروع المعتمدة لاحقاً يكلف ${offer.clinicTransferFeeKwd} د.ك.`
                            )
                          : t(
                              "You can move to another listed branch later if the offer allows it.",
                              "يمكنك الانتقال لفرع آخر من الفروع المعتمدة لاحقاً إن كان العرض يسمح بذلك."
                            )}
                      </div>
                    </div>
                  )}
                  {!branchLoadError && !needsBranchPicker && (
                    <>
                      <div className="mt-1 text-sm font-bold text-surface-900">
                        {clinic ? (ar ? clinic.nameAr : clinic.nameEn) : t("Loading branch…", "جارِ تحميل الفرع…")}
                      </div>
                      {clinic?.address && <div className="text-xs text-surface-500 mt-0.5">{clinic.address}</div>}
                      {parseFloat(offer.clinicTransferFeeKwd || "0") > 0 && (
                        <div className="text-[10px] text-surface-600 mt-2">
                          {t(
                            `Switching to another branch later: ${offer.clinicTransferFeeKwd} KWD fee (if allowed).`,
                            `تغيير الفرع لاحقاً: رسوم ${offer.clinicTransferFeeKwd} د.ك (إن وُجدت فروع أخرى).`
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {!branchLoadError && (needsBranchPicker ? !!selectedClinicId : !!clinic) && (
                    <label className="flex items-start gap-2 mt-3 text-xs text-surface-700">
                      <input
                        type="checkbox"
                        checked={branchConfirmed}
                        onChange={(e) => setBranchConfirmed(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>{t("I confirm I want to attend this branch.", "أؤكد رغبتي في حضور هذا الفرع.")}</span>
                    </label>
                  )}
                </div>
              )}

              <div className="rounded-2xl bg-surface-50 border border-surface-100 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-500">{t("Subtotal", "الإجمالي")}</span>
                  <span className="font-bold text-surface-900">{grossKwd} KWD</span>
                </div>
                <div className="mt-3 border-t border-surface-200 pt-3 space-y-1">
                  {mode === "installments" && installmentPreview ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-surface-900">{t("Due now (installment 1)", "المطلوب الآن (القسط ١)")}</span>
                        <span className="text-lg font-black text-brand-pink-600">{installmentPreview[0]} KWD</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-surface-500">
                        <span>{t("Total", "الإجمالي")}</span>
                        <span className="font-mono">{netKwd} KWD</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-surface-900">{t("To pay now", "المطلوب الآن")}</span>
                      <span className="text-lg font-black text-brand-pink-600">{netKwd} KWD</span>
                    </div>
                  )}
                </div>
              </div>

              {mode === "installments" && (
                <div className="rounded-2xl border border-surface-200 p-4">
                  <div className="text-sm font-bold text-surface-900 mb-2">{t("How many installments?", "كم قسط؟")}</div>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {Array.from({ length: Math.max(0, (offer.maxInstallments ?? 1) - 1) }, (_, i) => i + 2).map((n) => (
                      <button
                        key={n}
                        onClick={() => setInstallments(n)}
                        className={`flex-1 min-w-fit px-2 py-2 rounded-xl border text-sm font-bold ${installments === n ? "bg-brand-pink-50 border-brand-pink-300 text-brand-pink-700" : "border-surface-200 text-surface-600"}`}
                      >
                        {n} {t("payments", "دفعات")}
                      </button>
                    ))}
                  </div>
                  {installmentPreview && (
                    <div className="mt-3 text-xs text-surface-500">
                      {installmentPreview.map((amt, i) => (
                        <div key={i} className="flex justify-between py-0.5">
                          <span>{t(`Installment ${i + 1}`, `القسط ${i + 1}`)}</span>
                          <span className="font-mono font-bold text-surface-700">{amt} KWD</span>
                        </div>
                      ))}
                      <div className="text-[10px] text-surface-400 mt-1">
                        {t("First installment is charged today; rest are paid from your dashboard.", "يُخصم القسط الأول الآن وتُدفع البقية من لوحة التحكم.")}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mode === "enet" && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  {t(
                    "Your 4-installment plan will be sent to ENET for approval. You'll see the result on the next screen.",
                    "سيتم إرسال طلب التقسيط لـ ENET للموافقة وستظهر النتيجة في الشاشة التالية."
                  )}
                </div>
              )}

              {mode === "deposit" && (
                <div className="rounded-2xl border border-surface-200 p-4 space-y-3">
                  <div>
                    <label className="text-xs font-bold text-surface-700">{t("When do you plan to complete payment?", "متى تخططين لإكمال الدفع؟")}</label>
                    <DatePicker
                      value={completionDate}
                      onChange={(e) => setCompletionDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-surface-700">{t("Preferred plan when completing", "الخطة المفضّلة عند الإكمال")}</label>
                    <select
                      value={preferredPlan}
                      onChange={(e) => setPreferredPlan(e.target.value as NonNullable<CheckoutBody["preferredPlan"]>)}
                      className="mt-1 w-full rounded-lg border border-surface-300 px-3 py-2 text-sm"
                    >
                      <option value="full">{t("Full payment", "دفع كامل")}</option>
                      <option value="installments_2">{t("Installments × 2", "قسطين")}</option>
                      <option value="installments_4_enet">{t("4 installments via ENET", "٤ أقساط ENET")}</option>
                    </select>
                  </div>
                  <div className="text-[11px] text-surface-500">
                    {t("Your spot is held for 14 days from today.", "يتم حجز مكانك لمدة 14 يوماً من اليوم.")}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-surface-400 text-center">
                {t("Mock checkout — no real charge will be made.", "بيع تجريبي — لن يتم خصم أي مبالغ حقيقية.")}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep("choose")} className="flex-1 py-3 rounded-2xl bg-surface-100 text-surface-700 font-bold">
                  {t("Back", "رجوع")}
                </button>
                <button
                  onClick={submit}
                  disabled={showBranchSection && !branchConfirmed}
                  className="flex-1 py-3 rounded-2xl bg-brand-pink-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                  title={showBranchSection && !branchConfirmed ? t("Confirm branch to continue", "أكدي الفرع للمتابعة") : undefined}
                >
                  {(() => {
                    const dueNow = mode === "installments" && installmentPreview ? installmentPreview[0] : netKwd;
                    return t(`Pay ${dueNow} KWD`, `ادفع ${dueNow} د.ك`);
                  })()}
                </button>
              </div>
            </>
          )}

          {step === "eform" && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-brand-pink-100 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4 text-brand-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-brand-pink-600 uppercase tracking-wide">{t("Required before booking", "مطلوب قبل الحجز")}</div>
                  <div className="text-sm font-bold text-surface-900">{eformDef ? (ar && (eformDef as any).titleAr ? (eformDef as any).titleAr : eformDef.title) : t("Loading form…", "جاري التحميل…")}</div>
                </div>
              </div>

              {eformError && (
                <div className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-3">{eformError}</div>
              )}

              {!eformDef && !eformError && (
                <div className="py-8 text-center text-surface-400 text-sm">{t("Loading…", "جاري التحميل…")}</div>
              )}

              {eformDef && eformInnerStep === "fill" && (
                <>
                  <FormRenderer
                    form={eformDef}
                    values={eformValues}
                    signature={eformSignature}
                    files={eformFiles}
                    onValueChange={(key, val) => setEformValues((s) => ({ ...s, [key]: val }))}
                    onSignatureChange={setEformSignature}
                    onFileUpload={handleEFormFileUpload}
                  />
                  <button
                    type="button"
                    className="btn-primary w-full mt-4"
                    onClick={() => {
                      const err = validateEForm();
                      if (err) { setEformError(err); return; }
                      setEformError(null);
                      setEformInnerStep("review");
                    }}
                  >
                    {t("Review & sign", "مراجعة وتوقيع")}
                  </button>
                </>
              )}

              {eformDef && eformInnerStep === "review" && (
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-surface-900">{t("Confirm your answers", "تأكيد الإجابات")}</h4>
                  <div className="rounded-2xl border border-surface-100 p-4 space-y-3">
                    {eformDef.fields.map((f) => {
                      const label = ar && f.labelAr ? f.labelAr : f.labelEn;
                      let display: string = "—";
                      if (f.type === "signature") display = eformSignature ? (ar ? "✓ تم التوقيع" : "✓ Signed") : "—";
                      else if (f.type === "file_upload") display = eformFiles.length ? `${eformFiles.length} ${ar ? "ملف" : "file(s)"}` : "—";
                      else {
                        const v = eformValues[f.key];
                        if (Array.isArray(v)) display = v.join(", ");
                        else if (v !== undefined && v !== null && v !== "") display = String(v);
                      }
                      return (
                        <div key={f.key} className="border-b border-surface-100 last:border-0 pb-2 last:pb-0">
                          <div className="text-xs font-bold text-surface-500">{label}</div>
                          <div className="text-sm text-surface-900">{display}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 py-2.5 rounded-xl bg-surface-100 font-bold text-sm"
                      onClick={() => setEformInnerStep("fill")}
                    >
                      {t("Edit", "تعديل")}
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-2.5 rounded-xl bg-brand-pink-500 text-white font-bold text-sm disabled:opacity-50"
                      disabled={eformSubmitting}
                      onClick={() => void submitEForm()}
                    >
                      {eformSubmitting ? t("Submitting…", "جاري الإرسال…") : t("Sign & complete booking", "توقيع وإتمام الحجز")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="py-12 text-center">
              <div className="inline-block w-12 h-12 rounded-full border-4 border-brand-pink-200 border-t-brand-pink-500 animate-spin" />
              <div className="mt-4 text-sm font-bold text-surface-700">{t("Processing payment…", "جاري معالجة الدفع…")}</div>
            </div>
          )}

          {step === "result" && (
            <div className="py-6 text-center space-y-4">
              {error ? (
                <>
                  <div className="text-5xl">❌</div>
                  <div className="text-lg font-bold text-red-600">{t("Payment failed", "فشل الدفع")}</div>
                  <div className="text-sm text-surface-600">{error}</div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setStep("details")} className="flex-1 py-2.5 rounded-xl bg-surface-100 font-bold">
                      {t("Try again", "حاولي مرة أخرى")}
                    </button>
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface-900 text-white font-bold">
                      {t("Close", "إغلاق")}
                    </button>
                  </div>
                </>
              ) : enetResult && !enetResult.approved ? (
                <>
                  <div className="text-5xl">⚠️</div>
                  <div className="text-lg font-bold text-amber-700">{t("ENET declined", "رفض ENET")}</div>
                  <div className="text-sm text-surface-600">
                    {t(
                      "Your 4-installment plan wasn't approved. You can try a 2 or 3-installment plan or pay in full.",
                      "لم يتم الموافقة على ٤ أقساط. يمكنك تجربة قسطين/ثلاثة أو الدفع كاملاً."
                    )}
                  </div>
                  <button onClick={() => { setEnetResult(null); setMode(null); setStep("choose"); }} className="w-full py-3 rounded-2xl bg-brand-pink-500 text-white font-bold">
                    {t("Choose another plan", "اختر خطة أخرى")}
                  </button>
                </>
              ) : (
                <>
                  <div className="text-5xl">✅</div>
                  <div className="text-lg font-bold text-emerald-700">
                    {mode === "deposit" ? t("Deposit request sent", "تم إرسال طلب دفع العربون") : t("Request sent for approval", "تم إرسال الطلب للموافقة")}
                  </div>
                  <div className="text-sm text-surface-600">
                    {t(
                      "Your request is pending. Our team will verify the payment and activate it shortly.",
                      "طلبك قيد المراجعة. سيقوم فريقنا بالتحقق من الدفع وتفعيله قريباً."
                    )}
                  </div>
                  <button onClick={() => {
                    if (successResultRef.current) onComplete(successResultRef.current);
                    else onClose();
                  }} className="w-full py-3 rounded-2xl bg-brand-pink-500 text-white font-bold">
                    {t("Done", "تم")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ active, onClick, title, desc, amount }: { active: boolean; onClick: () => void; title: string; desc: string; amount: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-start rounded-2xl border p-4 flex items-center justify-between transition-colors ${active ? "border-brand-pink-400 bg-brand-pink-50/40 ring-2 ring-brand-pink-200" : "border-surface-200 hover:border-brand-pink-200"}`}
    >
      <div>
        <div className="font-bold text-surface-900 text-sm">{title}</div>
        <div className="text-xs text-surface-500 mt-0.5">{desc}</div>
      </div>
      <div className="text-sm font-bold text-brand-pink-600 shrink-0 ms-3">{amount}</div>
    </button>
  );
}
