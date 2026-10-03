// Helpers, constants and small components shared by the AdminDashboard tabs.
import i18n from "../../../app/i18n";

export const ar = () => i18n.language === "ar";

export interface AdminCardData {
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

export const TASK_DEPT_CONFIG = {
  CS: { role: "cs", taskDept: "cs", labelEn: "Customer Service (CS)", labelAr: "خدمة العملاء (CS)" },
  Finance: { role: "finance", taskDept: "finance", labelEn: "Finance", labelAr: "المالية (Finance)" },
  Admin: { role: "admin", taskDept: "admin", labelEn: "Administration", labelAr: "الإدارة (Admin)" },
  Clinics: { role: "clinicStaff", taskDept: "clinic", labelEn: "Clinics Team", labelAr: "فريق العيادات (Clinics)" },
} as const;

export type TaskUiDepartment = keyof typeof TASK_DEPT_CONFIG;

export interface TaskStaffMember {
  id: string;
  name: string;
}

export const translateComplaintStatus = (status: string) => {
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

export function SettingsToggle({ checked, onChange, color = "brand-pink" }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  const bg = color === "red" ? "peer-checked:bg-red-500" : "peer-checked:bg-brand-pink-500";
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className={`w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${bg}`}></div>
    </label>
  );
}

// ── User Profile Panel (tabbed) ──────────────────────────────────────────────
export type ProfileTab = "overview" | "memberships" | "cashback" | "booking_button" | "requests" | "sessions" | "payments" | "kyc" | "notes" | "recovery";

export const ALL_ROLES = ["customer", "admin", "cs", "finance", "clinicStaff", "legal", "cs_director", "user"] as const;

export const ROLE_COLORS: Record<string, string> = {
  customer: "bg-blue-50 text-blue-700",
  admin: "bg-purple-50 text-purple-700",
  cs: "bg-amber-50 text-amber-700",
  legal: "bg-indigo-50 text-indigo-700",
  cs_director: "bg-purple-50 text-purple-700",
  finance: "bg-emerald-50 text-emerald-700",
  clinicStaff: "bg-pink-50 text-pink-700",
  user: "bg-surface-100 text-surface-600",
};

// ── Main Dashboard ──
export const AUDIT_ROLE_COLORS: Record<string, string> = {
  admin:       "bg-red-50 text-red-700",
  cs:          "bg-blue-50 text-blue-700",
  finance:     "bg-purple-50 text-purple-700",
  clinicStaff: "bg-orange-50 text-orange-700",
  customer:    "bg-emerald-50 text-emerald-700",
  system:      "bg-surface-200 text-surface-600",
};

export const ACTION_LABELS: Record<string, string> = {
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

export type NoticeItem = {
  _id: string;
  message: string;
  messageAr?: string;
  isActive: boolean;
  clinicId?: { _id: string; nameEn: string; nameAr: string } | null;
  createdAt: string;
};
