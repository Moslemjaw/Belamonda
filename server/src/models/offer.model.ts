import type { BookingMode, OfferCategory, OfferKind, OfferStatus, OfferType, OfferVisibility } from "@belamonda/shared";
import mongoose, { Schema } from "mongoose";

const OfferSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, trim: true },
    subtitle: { type: String, trim: true },

    // ─── Classification ──────────────────────────────────────────────────────
    /** Internal A/B code — kept for backward compat. Prefer offerKind. */
    type: { type: String, enum: ["A", "B"] satisfies OfferType[], required: true },
    /** Functional offer type (laser, treatment, membership, etc.). */
    offerKind: {
      type: String,
      enum: ["laser", "treatment", "membership", "cashback", "bundle", "subscription"] satisfies OfferKind[]
    },
    /**
     * Membership behavioural type — drives booking logic:
     *   cashback      → TYPE 1: per-session cashback deduction from user's balance
     *   free_sessions → TYPE 2: N free sessions, small per-clinic fee applies
     *   group         → TYPE 3: group invite mechanics (existing logic)
     */
    membershipType: {
      type: String,
      enum: ["cashback", "free_sessions", "group"]
    },
    /**
     * TYPE 1 (cashback) — which categories are eligible for cashback.
     * Empty array = all categories.
     */
    eligibleCategoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    /**
     * TYPE 1 (cashback) — specific treatments eligible (optional, overrides category).
     */
    eligibleTreatmentIds: [{ type: String }],
    /** @deprecated Prefer categoryIds; kept for API backward compatibility */
    category: {
      type: String,
      enum: ["all", "laser", "injectables", "skincare", "beauty", "body", "dental", "medical", "other"] satisfies OfferCategory[]
    },
    categoryIds: [{ type: Schema.Types.ObjectId, ref: "Category" }],

    // ─── Status & Visibility ─────────────────────────────────────────────────
    /** Lifecycle status — drives the derived active boolean. */
    status: {
      type: String,
      enum: ["active", "draft", "hidden", "expired"] satisfies OfferStatus[],
      default: "active"
    },
    /** Legacy boolean — always derived from status; kept for query compat. */
    active: { type: Boolean, default: true },
    /** Who can see/purchase this offer. */
    visibility: {
      type: String,
      enum: ["public", "members_only", "referral_only", "vip_only", "hidden_link"] satisfies OfferVisibility[],
      default: "public"
    },
    featured: { type: Boolean, default: false },
    /** Admin-controlled display order. Lower = first. */
    sortOrder: { type: Number, default: 0 },

    // ─── Clinic & Doctor assignment ──────────────────────────────────────────
    /** Primary clinic (backward compat). */
    clinicId: { type: Schema.Types.ObjectId, ref: "Clinic" },
    /** Multi-clinic assignment — offer available at all listed branches. */
    clinicIds: [{ type: Schema.Types.ObjectId, ref: "Clinic" }],
    /**
     * When true: the customer is locked to the offer's clinicId at purchase.
     * Changing clinic later requires a fee (10 KWD → 20 KWD → 30 KWD per request, escalating).
     * When false (default): customer picks any active clinic at checkout.
     */
    clinicLocked: { type: Boolean, default: false },
    /** When false, no branch picker is shown at checkout — the offer's primary clinicId is used automatically. */
    requireBranchSelection: { type: Boolean, default: true },
    /** One-time fee (KWD) to move an active membership to another allowed branch. */
    clinicTransferFeeKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    /** Assigned doctor IDs (free-text / external IDs for now). */
    doctorIds: { type: [String], default: [] },

    // ─── Pricing ─────────────────────────────────────────────────────────────
    subscriptionPriceKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ },
    perVisitPriceKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    originalClinicPriceKwd: { type: String, match: /^\d+(\.\d{3})$/ },

    // ─── Sessions & Booking ──────────────────────────────────────────────────
    validityDays: { type: Number, required: true, min: 1 },
    maxSessions: { type: Number, min: 1 },
    sessionIntervalDays: { type: Number, default: 0, min: 0 },
    /** Sessions expire N months after offer activation (0 = use validityDays). */
    sessionExpiryMonths: { type: Number, default: 0, min: 0 },
    /** Max bookings a single customer can make within any 7-day window. */
    maxBookingsPerWeek: { type: Number, min: 1 },
    /** Max sessions that can be in "scheduled" state simultaneously. */
    maxActiveSessions: { type: Number, min: 1 },
    /** How incoming bookings are processed. */
    bookingMode: {
      type: String,
      enum: ["instant", "review", "doctor_approval", "manual_confirmation"] satisfies BookingMode[],
      default: "instant"
    },

    // ─── Enrollment & Capacity ───────────────────────────────────────────────
    enrollmentCap: { type: Number, min: 1 },
    enrolledCount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    offerExpirationDate: { type: Date },

    // ─── Content ─────────────────────────────────────────────────────────────
    // ─── Group Offer Mechanics ───────────────────────────────────────────────
    isGroupOffer: { type: Boolean, default: false },
    groupSizeRequired: { type: Number, min: 2 },
    groupRewardType: { type: String, enum: ["free_session", "discount", "cashback_bonus", "split_bill", "unlock_membership"] },
    groupRewardValue: { type: String },
    description: { type: String },
    terms: { type: String },
    imageUrl: { type: String },
    bannerUrl: { type: String },
    tagsEn: { type: [String], default: [] },
    tagsAr: { type: [String], default: [] },

    // ─── Payment options (V2 Structured) ─────────────────────────────────────
    allowFullPayment: { type: Boolean, default: true },
    fullPaymentEFormId: { type: Schema.Types.ObjectId, ref: "EForm" },
    allowInstallments: { type: Boolean, default: false },
    maxInstallments: { type: Number, min: 1, default: 1 },
    installmentsEFormId: { type: Schema.Types.ObjectId, ref: "EForm" },
    allowDeposit: { type: Boolean, default: false },
    depositAmountKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    depositEFormId: { type: Schema.Types.ObjectId, ref: "EForm" },
    allowENet: { type: Boolean, default: false },
    enetEFormId: { type: Schema.Types.ObjectId, ref: "EForm" },

    // ─── Pay-per-session ─────────────────────────────────────────────────────
    /** When true, each session requires a separate payment before booking is confirmed. */
    payPerSession: { type: Boolean, default: false },
    /** Default amount charged per session when payPerSession is enabled (used when no branch override exists). */
    sessionPriceKwd: { type: String, match: /^\d+(\.\d{3})$/ },
    /** Per-branch session price overrides — when set, takes priority over sessionPriceKwd for that branch. */
    branchSessionPrices: {
      type: [
        {
          clinicId: { type: String, required: true },
          sessionPriceKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ }
        }
      ],
      default: []
    },
    /** Per-branch membership/subscription price overrides. */
    branchSubscriptionPrices: {
      type: [
        {
          clinicId: { type: String, required: true },
          priceKwd: { type: String, required: true, match: /^\d+(\.\d{3})$/ }
        }
      ],
      default: []
    },

    // ─── Cashback ────────────────────────────────────────────────────────────
    signupCashbackKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    cashbackActivationFeeKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    cashbackPerSessionKwd: { type: String, default: "0.000", match: /^\d+(\.\d{3})$/ },
    isCashbackOnly: { type: Boolean, default: false },
    cashbackEligible: { type: Boolean, default: true },
    maxCashbackPerPurchaseKwd: { type: String, match: /^\d+(\.\d{3})$/ },

    // ─── Presentation ────────────────────────────────────────────────────────
    featuresEn: { type: [String], default: [] },
    featuresAr: { type: [String], default: [] },
    durationEn: { type: String, trim: true },
    durationAr: { type: String, trim: true },
    theme: { type: String, trim: true },
    highlightEn: { type: String, trim: true },
    highlightAr: { type: String, trim: true },
    isPopular: { type: Boolean, default: false }
  },
  { timestamps: true }
);

OfferSchema.index({ status: 1, visibility: 1, sortOrder: 1, featured: -1, createdAt: -1 });
OfferSchema.index({ active: 1, featured: -1, createdAt: -1 });
OfferSchema.index({ clinicId: 1, status: 1 });
OfferSchema.index({ clinicIds: 1, status: 1 });
OfferSchema.index({ categoryIds: 1, status: 1 });

export type OfferDoc = mongoose.InferSchemaType<typeof OfferSchema> & { _id: mongoose.Types.ObjectId };
export const OfferModel = mongoose.models.Offer ?? mongoose.model("Offer", OfferSchema);
