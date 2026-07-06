// ─── Roles ──────────────────────────────────────────
export type Role = "customer" | "admin" | "cs" | "finance" | "clinicStaff" | "legal" | "cs_director";

// ─── KYC ────────────────────────────────────────────
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";

// ─── Offers (SRS §4.2) ─────────────────────────────
export type OfferType = "A" | "B";
export type OfferCategory =
  | "all"
  | "laser"
  | "injectables"
  | "skincare"
  | "beauty"
  | "body"
  | "dental"
  | "medical"
  | "other";

/** Offer lifecycle status — replaces the simple active boolean. */
export type OfferStatus = "active" | "draft" | "hidden" | "expired";

/** Functional type of offer — drives conditional UI/logic. */
export type OfferKind =
  | "laser"
  | "treatment"
  | "membership"
  | "cashback"
  | "bundle"
  | "subscription";

/** Who can see/purchase the offer. */
export type OfferVisibility =
  | "public"
  | "members_only"
  | "referral_only"
  | "vip_only"
  | "hidden_link";

/** How new bookings under this offer are processed. */
export type BookingMode =
  | "instant"
  | "review"
  | "doctor_approval"
  | "manual_confirmation";

// ─── Products — 7 Belamonda Models ──────────────────
export type ProductCode =
  | "jamali"          // جمالي — 1yr, 1500 KWD cashback + 100 KWD free
  | "mini_jamali"     // ميني جمالي — 6mo, 500 KWD + 100 KWD free
  | "nuomi_classic"   // نعومي كلاسيك — 6 sessions / 8mo, no cashback
  | "nuomi_plus"      // نعومي بلس — unlimited sessions / 1yr, 20 KWD/session
  | "sabaya"          // صبايا — 1yr membership, 79 KWD, pay-per-use 9.9/session
  | "single_session"  // جلسة واحدة — 19 KWD, optional 30 KWD cashback (+5 KWD)
  | "three_sessions"; // 3 جلسات — 49 KWD / 5mo, optional 100 KWD cashback (+9 KWD)

export type CashbackModelType =
  | "fixed_membership"     // Fixed cashback with membership (1500 / 500 / 300)
  | "per_session"          // Generated from sessions (20 KWD/session)
  | "optional_activation"  // Activated for an additional fee
  | "none";                // No cashback

export interface ProductDefinition {
  code: ProductCode;
  nameEn: string;
  nameAr: string;
  durationMonths: number;
  priceKwd: string;         // "0.000" format
  maxSessions: number | null; // null = unlimited
  cashbackModel: CashbackModelType;
  fixedCashbackKwd: string;  // Total fixed cashback (e.g. "1500.000")
  perSessionCashbackKwd: string; // Per session cashback (e.g. "20.000")
  freeServicesKwd: string;   // Free services allocation (e.g. "100.000")
  freeServicesCondition: "same_clinic" | "any_clinic" | "none";
  cashbackUsage: "same_clinic" | "cross_clinic" | "none";
  attendanceFeeKwd: string;  // Per-session attendance fee (e.g. "2.000")
  perSessionPriceKwd: string; // Pay-per-use price (e.g. "9.900")
  maxSharedMembers: number;   // For Sabaya: up to 3 members
  optionalCashbackKwd: string; // Optional cashback amount
  optionalCashbackFeeKwd: string; // Fee to activate optional cashback
  linkedProductCode: ProductCode | null; // e.g. Sabaya links to Jamali for 300 KWD cashback
}

// ─── User Offers ────────────────────────────────────
export type UserOfferStatus =
  | "pending_payment"
  | "active"
  | "expired"
  | "cancelled"
  | "reserved"
  | "enet_pending"
  | "enet_rejected";

export type OrderStatus = "pending" | "confirmed" | "active" | "completed" | "cancelled";

// ─── Appointments (replaces Sessions & BookingRequests) ─
export type AppointmentStatus =
  | "request_received"
  | "slot_assigned"
  | "scheduled"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";

// ─── Payments ───────────────────────────────────────
export type PaymentStatus = "payment_pending" | "paid" | "refunded" | "failed";

// ─── Wallet & Cashback ──────────────────────────────
export type WalletTransactionType =
  | "unlock"          // Cashback unlocked from locked balance
  | "deduction"       // Cashback used for payment
  | "adjustment"      // Admin manual adjustment
  | "fixed_credit"    // Fixed cashback credited at activation
  | "per_session"     // Per-session cashback credited
  | "optional_activation" // Optional cashback activated
  | "free_service"    // Free service used
  | "attendance_fee"; // Attendance fee charged

export interface WalletBalance {
  lockedKwd: string;
  unlockedKwd: string;
  freeServicesKwd: string;
  totalCashbackEarned: string;
  totalCashbackUsed: string;
}

// ─── Tasks ──────────────────────────────────────────
export type TaskPriority = "red" | "yellow" | "green";
export type TaskStatus = "todo" | "in_progress" | "completed" | "archived";

// ─── Complaints ─────────────────────────────────────
export type ComplaintStatus = "open" | "in_progress" | "escalated" | "resolved" | "closed";
export type ComplaintCategory = "service_quality" | "billing" | "scheduling" | "cashback" | "clinic" | "other" | "system";

// ─── Financial ──────────────────────────────────────
export type PayableStatus = "pending" | "approved" | "paid";

export interface ClinicPayable {
  clinicId: string;
  sessionId: string;
  amountKwd: string;
  status: PayableStatus;
  createdAt: string;
}

export interface RevenueEntry {
  orderId: string;
  productCode: ProductCode;
  amountKwd: string;
  source: "subscription" | "per_session" | "activation_fee" | "attendance_fee";
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────
export const KWD_DECIMALS = 3 as const;
export const KUWAIT_TZ = "Asia/Kuwait" as const;
export const DEFAULT_WALLET_CEILING_KWD = "500.000" as const;

// ─── Product Catalog (Static definitions) ───────────
export const PRODUCT_CATALOG: ProductDefinition[] = [
  {
    code: "jamali",
    nameEn: "Jamali Beauty Program",
    nameAr: "برنامج جمالي",
    durationMonths: 12,
    priceKwd: "0.000", // Varies per offer
    maxSessions: null,
    cashbackModel: "fixed_membership",
    fixedCashbackKwd: "1500.000",
    perSessionCashbackKwd: "0.000",
    freeServicesKwd: "100.000",
    freeServicesCondition: "same_clinic",
    cashbackUsage: "cross_clinic",
    attendanceFeeKwd: "0.000",
    perSessionPriceKwd: "0.000",
    maxSharedMembers: 1,
    optionalCashbackKwd: "0.000",
    optionalCashbackFeeKwd: "0.000",
    linkedProductCode: null,
  },
  {
    code: "mini_jamali",
    nameEn: "Mini Jamali",
    nameAr: "ميني جمالي",
    durationMonths: 6,
    priceKwd: "0.000",
    maxSessions: null,
    cashbackModel: "fixed_membership",
    fixedCashbackKwd: "500.000",
    perSessionCashbackKwd: "0.000",
    freeServicesKwd: "100.000",
    freeServicesCondition: "same_clinic",
    cashbackUsage: "cross_clinic",
    attendanceFeeKwd: "0.000",
    perSessionPriceKwd: "0.000",
    maxSharedMembers: 1,
    optionalCashbackKwd: "0.000",
    optionalCashbackFeeKwd: "0.000",
    linkedProductCode: null,
  },
  {
    code: "nuomi_classic",
    nameEn: "Nuomi Classic",
    nameAr: "نعومي كلاسيك",
    durationMonths: 8,
    priceKwd: "0.000",
    maxSessions: 6,
    cashbackModel: "none",
    fixedCashbackKwd: "0.000",
    perSessionCashbackKwd: "0.000",
    freeServicesKwd: "0.000",
    freeServicesCondition: "none",
    cashbackUsage: "none",
    attendanceFeeKwd: "0.000",
    perSessionPriceKwd: "0.000",
    maxSharedMembers: 1,
    optionalCashbackKwd: "0.000",
    optionalCashbackFeeKwd: "0.000",
    linkedProductCode: null,
  },
  {
    code: "nuomi_plus",
    nameEn: "Nuomi Plus",
    nameAr: "نعومي بلس",
    durationMonths: 12,
    priceKwd: "0.000",
    maxSessions: null,
    cashbackModel: "per_session",
    fixedCashbackKwd: "0.000",
    perSessionCashbackKwd: "20.000",
    freeServicesKwd: "0.000",
    freeServicesCondition: "none",
    cashbackUsage: "cross_clinic",
    attendanceFeeKwd: "2.000",
    perSessionPriceKwd: "0.000",
    maxSharedMembers: 1,
    optionalCashbackKwd: "0.000",
    optionalCashbackFeeKwd: "0.000",
    linkedProductCode: null,
  },
  {
    code: "sabaya",
    nameEn: "Sabaya Membership",
    nameAr: "صبايا",
    durationMonths: 12,
    priceKwd: "79.000",
    maxSessions: null,
    cashbackModel: "fixed_membership",
    fixedCashbackKwd: "300.000",
    perSessionCashbackKwd: "0.000",
    freeServicesKwd: "0.000",
    freeServicesCondition: "none",
    cashbackUsage: "cross_clinic",
    attendanceFeeKwd: "0.000",
    perSessionPriceKwd: "9.900",
    maxSharedMembers: 3,
    optionalCashbackKwd: "0.000",
    optionalCashbackFeeKwd: "0.000",
    linkedProductCode: "jamali",
  },
  {
    code: "single_session",
    nameEn: "Single Session",
    nameAr: "جلسة واحدة",
    durationMonths: 0,
    priceKwd: "19.000",
    maxSessions: 1,
    cashbackModel: "optional_activation",
    fixedCashbackKwd: "0.000",
    perSessionCashbackKwd: "0.000",
    freeServicesKwd: "0.000",
    freeServicesCondition: "none",
    cashbackUsage: "cross_clinic",
    attendanceFeeKwd: "0.000",
    perSessionPriceKwd: "0.000",
    maxSharedMembers: 1,
    optionalCashbackKwd: "30.000",
    optionalCashbackFeeKwd: "5.000",
    linkedProductCode: null,
  },
  {
    code: "three_sessions",
    nameEn: "3 Sessions Package",
    nameAr: "3 جلسات",
    durationMonths: 5,
    priceKwd: "49.000",
    maxSessions: 3,
    cashbackModel: "optional_activation",
    fixedCashbackKwd: "0.000",
    perSessionCashbackKwd: "0.000",
    freeServicesKwd: "0.000",
    freeServicesCondition: "none",
    cashbackUsage: "cross_clinic",
    attendanceFeeKwd: "0.000",
    perSessionPriceKwd: "0.000",
    maxSharedMembers: 1,
    optionalCashbackKwd: "100.000",
    optionalCashbackFeeKwd: "9.000",
    linkedProductCode: null,
  },
];
