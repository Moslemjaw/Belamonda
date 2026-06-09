// ═══════════════════════════════════════════════════════
// Belamonda Offer & Cashback System — Shared Data Layer
// ═══════════════════════════════════════════════════════

// ── Types ──

export interface OfferTemplate {
  id: string;
  nameEn: string;
  nameAr: string;
  category: string;
  price: number;
  validityDays: number;
  maxSessions: number | null;       // null = unlimited
  sessionIntervalDays: number;
  imageUrl: string;
  isCashbackOnly?: boolean;

  // Cashback
  signupCashback: number;           // Credited after first payment
  perSessionCashback: number;       // Deducted from cashback balance per session
  cashbackActivationFee: number;    // Optional fee to activate cashback

  // Payment options
  allowFullPayment: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  allowDeposit: boolean;
  depositAmount: number;

  // Display
  tagsEn: string[];
  tagsAr: string[];

  active: boolean;
  createdAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  offerId: string;
  clinicId: string;
  status: "awaiting_payment" | "active" | "expired" | "cancelled";

  method: "Full Payment" | "Installments" | "Deposit" | null;
  totalPaid: number;
  totalInstallments: number;
  paidInstallments: number;

  sessionsUsed: number;
  lastAppointmentDate: string | null;

  cashbackBalance: number;
  cashbackUsed: number;
  signupCashbackCredited: boolean;

  createdAt: string;
  expiresAt: string;
}

export interface CashbackEntry {
  id: string;
  userId: string;
  subscriptionId: string;
  type: "signup_credit" | "session_deduction" | "activation_credit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface FinancialEntry {
  id: string;
  userId: string;
  type: "offer_purchase" | "installment" | "deposit" | "session_payment" | "cashback_usage" | "clinic_change_fee" | "cashback_activation";
  amount: number;
  description: string;
  relatedId: string;
  createdAt: string;
}

export interface ClinicChangeRequest {
  id: string;
  userId: string;
  subscriptionId: string;
  fromClinicId: string;
  toClinicId: string;
  fee: number;
  feePaid: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// ── Storage Keys ──
const KEYS = {
  offers: "bel_offers_catalog_v1",
  subscriptions: "bel_user_subscriptions_v1",
  cashback: "bel_cashback_ledger_v1",
  financial: "bel_financial_ledger_v1",
  clinicChanges: "bel_clinic_change_requests_v1",
};

// ── Generic Helpers ──
function readStore<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function writeStore<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Offer Templates (Admin) ──
export function getOfferTemplates(): OfferTemplate[] { return readStore(KEYS.offers); }
export function saveOfferTemplates(items: OfferTemplate[]) { writeStore(KEYS.offers, items); }
export function upsertOfferTemplate(offer: OfferTemplate) {
  const all = getOfferTemplates();
  const idx = all.findIndex(o => o.id === offer.id);
  if (idx >= 0) all[idx] = offer; else all.push(offer);
  saveOfferTemplates(all);
}
export function deleteOfferTemplate(id: string) {
  saveOfferTemplates(getOfferTemplates().filter(o => o.id !== id));
}

// ── User Subscriptions ──
export function getSubscriptions(): UserSubscription[] { return readStore(KEYS.subscriptions); }
export function saveSubscriptions(items: UserSubscription[]) { writeStore(KEYS.subscriptions, items); }
export function getUserSubscriptions(userId: string): UserSubscription[] {
  return getSubscriptions().filter(s => s.userId === userId);
}
export function upsertSubscription(sub: UserSubscription) {
  const all = getSubscriptions();
  const idx = all.findIndex(s => s.id === sub.id);
  if (idx >= 0) all[idx] = sub; else all.push(sub);
  saveSubscriptions(all);
}

// ── Cashback Ledger ──
export function getCashbackLedger(): CashbackEntry[] { return readStore(KEYS.cashback); }
export function addCashbackEntry(entry: CashbackEntry) {
  const all = getCashbackLedger();
  all.push(entry);
  writeStore(KEYS.cashback, all);
}

// ── Financial Ledger ──
export function getFinancialLedger(): FinancialEntry[] { return readStore(KEYS.financial); }
export function addFinancialEntry(entry: FinancialEntry) {
  const all = getFinancialLedger();
  all.push(entry);
  writeStore(KEYS.financial, all);
}

// ── Clinic Change Requests ──
export function getClinicChangeRequests(): ClinicChangeRequest[] { return readStore(KEYS.clinicChanges); }
export function saveClinicChangeRequests(items: ClinicChangeRequest[]) { writeStore(KEYS.clinicChanges, items); }
export function addClinicChangeRequest(req: ClinicChangeRequest) {
  const all = getClinicChangeRequests();
  all.push(req);
  saveClinicChangeRequests(all);
}

// ── Business Logic ──

/** Credit signup cashback after first payment */
export function creditSignupCashback(sub: UserSubscription, offer: OfferTemplate): UserSubscription {
  if (sub.signupCashbackCredited || offer.signupCashback <= 0) return sub;

  const updated = {
    ...sub,
    cashbackBalance: sub.cashbackBalance + offer.signupCashback,
    signupCashbackCredited: true,
  };

  addCashbackEntry({
    id: `cb_${Date.now()}`,
    userId: sub.userId,
    subscriptionId: sub.id,
    type: "signup_credit",
    amount: offer.signupCashback,
    balanceBefore: sub.cashbackBalance,
    balanceAfter: updated.cashbackBalance,
    description: `Signup cashback for ${offer.nameEn}`,
    createdAt: new Date().toISOString(),
  });

  upsertSubscription(updated);
  return updated;
}

/** Compute session price after cashback deduction */
export function computeSessionPrice(
  originalPrice: number,
  sub: UserSubscription | null,
  offer: OfferTemplate | null
): { finalPrice: number; cashbackDeduction: number } {
  if (!sub || !offer || offer.perSessionCashback <= 0 || sub.cashbackBalance <= 0) {
    return { finalPrice: originalPrice, cashbackDeduction: 0 };
  }
  const deduction = Math.min(offer.perSessionCashback, sub.cashbackBalance, originalPrice);
  return { finalPrice: originalPrice - deduction, cashbackDeduction: deduction };
}

/** Deduct cashback on session booking */
export function deductSessionCashback(sub: UserSubscription, deduction: number): UserSubscription {
  if (deduction <= 0) return sub;

  const updated = {
    ...sub,
    cashbackBalance: sub.cashbackBalance - deduction,
    cashbackUsed: sub.cashbackUsed + deduction,
  };

  addCashbackEntry({
    id: `cb_${Date.now()}`,
    userId: sub.userId,
    subscriptionId: sub.id,
    type: "session_deduction",
    amount: -deduction,
    balanceBefore: sub.cashbackBalance,
    balanceAfter: updated.cashbackBalance,
    description: `Session cashback deduction (${deduction} KWD)`,
    createdAt: new Date().toISOString(),
  });

  upsertSubscription(updated);
  return updated;
}

/** Seed default offers if none exist */
export function seedDefaultOffers() {
  if (getOfferTemplates().length > 0) return;
  
  const defaults: OfferTemplate[] = [
    {
      id: "offer_minijamali", nameEn: "Mini Jamali Card Offer", nameAr: "ميني جمالي - بيلاموندو",
      category: "beauty", price: 39, validityDays: 180, maxSessions: null, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1616394584738-fc6e612e71c9?auto=format&fit=crop&q=80&w=800",
      signupCashback: 500, perSessionCashback: 0, cashbackActivationFee: 0,
      allowFullPayment: true, allowInstallments: false, maxInstallments: 1, allowDeposit: false, depositAmount: 0,
      tagsEn: ["600 KWD Cashback", "6 Months", "All Beauty Services"], tagsAr: ["كاش باك 600 دك", "6 أشهر", "جميع خدمات التجميل"],
      isCashbackOnly: true, active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_jamali", nameEn: "Jamali Beauty Program", nameAr: "برنامج جمالي الشامل",
      category: "beauty", price: 1500, validityDays: 365, maxSessions: null, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800",
      signupCashback: 1500, perSessionCashback: 0, cashbackActivationFee: 0,
      allowFullPayment: true, allowInstallments: true, maxInstallments: 4, allowDeposit: false, depositAmount: 0,
      tagsEn: ["1500 KWD Cashback", "1 Year", "100 KWD Free Services"], tagsAr: ["كاش باك 1500 دك", "سنة واحدة", "100 دك أعمال مجانية"],
      isCashbackOnly: true, active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_painrelief", nameEn: "Pain Relief Package (6 Sessions)", nameAr: "باقة العلاج الطبيعي (6 جلسات)",
      category: "medical", price: 146, validityDays: 180, maxSessions: 6, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1576091160550-2173ff9e5ee5?auto=format&fit=crop&q=80&w=800",
      signupCashback: 34, perSessionCashback: 0, cashbackActivationFee: 0,
      allowFullPayment: true, allowInstallments: true, maxInstallments: 3, allowDeposit: false, depositAmount: 0,
      tagsEn: ["34 KWD Cashback", "Joint Pain Relief"], tagsAr: ["كاش باك 34 دك", "تخفيف آلام المفاصل"],
      active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_laser3", nameEn: "Laser Offer (Stomach + Back)", nameAr: "عرض ليزر (بطن وظهر) - 3 جلسات",
      category: "laser", price: 49, validityDays: 150, maxSessions: 3, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=800",
      signupCashback: 0, perSessionCashback: 0, cashbackActivationFee: 9,
      allowFullPayment: true, allowInstallments: false, maxInstallments: 1, allowDeposit: true, depositAmount: 9,
      tagsEn: ["5 Months", "100 KWD Cashback (+9 KWD)"], tagsAr: ["5 أشهر", "كاش باك 100 دك (+9 دك)"],
      active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_laser_single", nameEn: "Full Body Laser (Single Session)", nameAr: "ليزر جسم كامل (جلسة واحدة)",
      category: "laser", price: 19, validityDays: 30, maxSessions: 1, sessionIntervalDays: 0, imageUrl: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&q=80&w=800",
      signupCashback: 0, perSessionCashback: 0, cashbackActivationFee: 5,
      allowFullPayment: true, allowInstallments: false, maxInstallments: 1, allowDeposit: true, depositAmount: 5,
      tagsEn: ["Optional 30 KWD Cashback (+5 KWD)"], tagsAr: ["تفعيل كاش باك 30 دك (+5 دك)"],
      active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_sabaya", nameEn: "Annual Membership (Sabaya)", nameAr: "عضوية صبايا السنوية",
      category: "laser", price: 79, validityDays: 365, maxSessions: null, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800",
      signupCashback: 300, perSessionCashback: 0, cashbackActivationFee: 0,
      allowFullPayment: true, allowInstallments: false, maxInstallments: 1, allowDeposit: false, depositAmount: 0,
      tagsEn: ["1 Year", "Up to 3 Members", "300 KWD Cashback", "Sessions at 9.9 KWD"], tagsAr: ["سنة واحدة", "حتى 3 مشتركات", "كاش باك 300 دك", "الجلسة بـ 9.9 دك"],
      active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_naomi_plus", nameEn: "Unlimited Laser Membership (Naomi Plus)", nameAr: "عضوية الليزر المفتوحة (نعومي بلس)",
      category: "laser", price: 99, validityDays: 365, maxSessions: null, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=800",
      signupCashback: 0, perSessionCashback: 20, cashbackActivationFee: 0,
      allowFullPayment: true, allowInstallments: true, maxInstallments: 3, allowDeposit: false, depositAmount: 0,
      tagsEn: ["1 Year", "Unlimited Sessions", "20 KWD Cashback/Session"], tagsAr: ["سنة واحدة", "جلسات غير محدودة", "كاش باك 20 دك لكل جلسة"],
      active: true, createdAt: new Date().toISOString()
    },
    {
      id: "offer_naomi_classic", nameEn: "6 Full Body Laser Sessions (Naomi Classic)", nameAr: "6 جلسات ليزر جسم كامل (نعومي كلاسيك)",
      category: "laser", price: 89, validityDays: 240, maxSessions: 6, sessionIntervalDays: 25, imageUrl: "https://images.unsplash.com/photo-1560750588-73207b1ef5b8?auto=format&fit=crop&q=80&w=800",
      signupCashback: 0, perSessionCashback: 0, cashbackActivationFee: 0,
      allowFullPayment: true, allowInstallments: true, maxInstallments: 2, allowDeposit: false, depositAmount: 0,
      tagsEn: ["8 Months", "No Hidden Fees"], tagsAr: ["8 أشهر", "بدون رسوم خفية"],
      active: true, createdAt: new Date().toISOString()
    },
  ];
  
  saveOfferTemplates(defaults);
}
