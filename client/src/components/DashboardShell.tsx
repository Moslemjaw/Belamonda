import { fmtDate } from "../lib/dateFormat";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../app/AuthContext";
import { BelamondaLogo } from "./BelamondaLogo";
import { apiFetch } from "../lib/api";
import { useApi } from "../hooks/useApi";
import i18n from "../app/i18n";

interface NavItem {
  key: string;
  icon: ReactNode;
  label: string;
}

interface DashboardShellProps {
  navItems: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  banner?: ReactNode;
}

type NotifRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// SVG Icons as tiny components
const Icons = {
  dashboard: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  wallet: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>,
  offers: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>,
  calendar: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  bell: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  settings: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  users: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
  chart: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  clinic: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>,
  clipboard: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
  shield: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
  cash: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  complaint: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>,
  report: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  search: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>,
  profile: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>,
  share: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>,
};

export { Icons };

function NotificationPanel({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  notifications: NotifRecord[];
  unreadCount: number;
  onMarkAllRead: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isAr = i18n.language === "ar";

  return (
    <div
      ref={panelRef}
      className="absolute top-14 right-0 rtl:right-auto rtl:left-0 z-50 w-80 max-h-[480px] bg-white rounded-2xl shadow-xl border border-surface-200 flex flex-col overflow-hidden animate-slide-up"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-surface-900">
            {isAr ? "الإشعارات" : "Notifications"}
          </span>
          {unreadCount > 0 && (
            <span className="text-xs font-bold bg-brand-pink-500 text-white px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs text-brand-pink-500 hover:text-brand-pink-700 font-medium"
          >
            {isAr ? "تعيين الكل كمقروء" : "Mark all read"}
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-surface-50">
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-surface-400">
            {isAr ? "لا توجد إشعارات" : "No notifications yet"}
          </div>
        ) : (
          notifications.slice(0, 30).map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 transition-colors ${n.read ? "bg-white" : "bg-brand-pink-50/30"}`}
            >
              <div className="flex items-start gap-2">
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-pink-500" />
                )}
                {n.read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-surface-800 truncate">{n.title}</div>
                  <div className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-surface-400 mt-1">{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const getGroupForNavItem = (key: string, role: string, isAr: boolean): { name: string; order: number } => {
  if (role === "admin") {
    if (key === "home") return { name: isAr ? "نظرة عامة" : "Overview", order: 1 };
    if (["offers", "subscriptions", "promotions", "categories", "treatments", "standalone"].includes(key)) {
      return { name: isAr ? "إدارة الكتالوج" : "Catalog Management", order: 2 };
    }
    if (["users", "clinics", "sessions_log", "clinic_changes", "bookings", "reservations"].includes(key)) {
      return { name: isAr ? "العمليات والحجوزات" : "Operations & Bookings", order: 3 };
    }
    if (["eforms", "notices", "complaints", "share", "tasks", "audit"].includes(key)) {
      return { name: isAr ? "الأدوات والتدقيق" : "Tools & Audits", order: 4 };
    }
    if (["settings", "notifications_settings"].includes(key)) {
      return { name: isAr ? "التفضيلات" : "Preferences", order: 5 };
    }
  }

  if (role === "cs" || role === "legal" || role === "cs_director") {
    if (key === "home") return { name: isAr ? "نظرة عامة" : "Overview", order: 1 };
    if (key === "share_link_performance") return { name: isAr ? "التقارير" : "Reports", order: 1.5 };
    if (["customers", "memberships", "clinic_changes", "scheduling", "chat"].includes(key)) {
      return { name: isAr ? "خدمات العملاء" : "Customer Services", order: 2 };
    }
    if (["payments", "invoice_reviews", "sub_requests"].includes(key)) {
      return { name: isAr ? "المالية" : "Financials", order: 3 };
    }
    if (["kyc", "eforms"].includes(key)) {
      return { name: isAr ? "القانونية والتحقق" : "Legal & KYC", order: 4 };
    }
    if (["complaints", "profile"].includes(key)) {
      return { name: isAr ? "الحساب" : "Account", order: 5 };
    }
  }

  if (role === "clinicStaff" || role === "clinic") {
    if (key === "home") return { name: isAr ? "نظرة عامة" : "Overview", order: 1 };
    if (["scanner", "requests", "booking_requests", "schedule", "chat", "missed_sessions"].includes(key)) {
      return { name: isAr ? "الخدمات" : "Services", order: 2 };
    }
    if (["invoices", "reports", "performance"].includes(key)) {
      return { name: isAr ? "المالية والتقارير" : "Financials & Reports", order: 3 };
    }
    if (["profile", "complaints"].includes(key)) {
      return { name: isAr ? "الحساب" : "Account", order: 4 };
    }
  }

  if (role === "finance") {
    if (key === "home") return { name: isAr ? "نظرة عامة" : "Overview", order: 1 };
    if (["payments", "invoices", "credit", "installments", "sub_requests", "relief", "manual"].includes(key)) {
      return { name: isAr ? "المالية" : "Financials", order: 2 };
    }
    if (["clinics", "users", "customers", "eforms", "analytics", "reports"].includes(key)) {
      return { name: isAr ? "النظام والتقارير" : "System & Reports", order: 3 };
    }
    if (["profile", "complaints"].includes(key)) {
      return { name: isAr ? "الحساب" : "Account", order: 4 };
    }
  }

  // Fallback for customer dashboard or other roles
  if (key === "home") return { name: isAr ? "نظرة عامة" : "Overview", order: 1 };
  if (["wallet", "appointments", "sessions"].includes(key)) {
    return { name: isAr ? "الخدمات" : "Services", order: 2 };
  }
  if (["profile", "complaints"].includes(key)) {
    return { name: isAr ? "الحساب" : "Account", order: 3 };
  }
  return { name: isAr ? "أخرى" : "General", order: 99 };
};

export default function DashboardShell({
  navItems,
  activeKey,
  onNavigate,
  title,
  subtitle,
  children,
  headerActions,
  banner,
}: DashboardShellProps) {
  const { t } = useTranslation();
  const { auth, logout, getAuthHeader } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isAr = i18n.language === "ar";

  const { data: myProfile } = useApi<{ user: { username?: string; fullName?: string } }>("/users/me");
  let displayName = myProfile?.user?.fullName || myProfile?.user?.username || auth?.userId || "—";
  if (displayName.startsWith("impersonated_")) {
    displayName = isAr ? "مدير النظام (مُحاكاة)" : "Admin (Impersonating)";
  }

  const fetchNotifications = () => {
    if (!auth) return;
    apiFetch("/notifications/me", { headers: getAuthHeader() })
      .then((data: any) => {
        setNotifications(data?.inbox ?? []);
        setUnreadCount(data?.unreadCount ?? 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [auth?.userId]);

  const handleBellClick = () => {
    setNotifOpen((prev) => !prev);
  };

  const markAllRead = () => {
    if (!auth) return;
    apiFetch("/notifications/me/mark-all-read", { method: "POST", headers: getAuthHeader() })
      .then((data: any) => {
        setNotifications(data?.inbox ?? notifications.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      })
      .catch(() => {});
  };

  const roleLabel: Record<string, string> = {
    customer: isAr ? "عميلة" : "Customer",
    admin: isAr ? "مدير النظام" : "Admin",
    cs: isAr ? "خدمة العملاء" : "Customer Service",
    finance: isAr ? "المالية" : "Finance",
    clinicStaff: isAr ? "العيادة" : "Clinic Staff",
  };

  // Grouping logic for navigation
  const userRole = auth?.role || "";
  const groupedItems: Record<string, { order: number; items: typeof navItems }> = {};
  
  navItems.forEach((item) => {
    const groupInfo = getGroupForNavItem(item.key, userRole, isAr);
    if (!groupedItems[groupInfo.name]) {
      groupedItems[groupInfo.name] = { order: groupInfo.order, items: [] };
    }
    groupedItems[groupInfo.name].items.push(item);
  });

  const sortedGroupNames = Object.keys(groupedItems).sort(
    (a, b) => groupedItems[a].order - groupedItems[b].order
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden bg-surface-50 text-[15px] lg:text-base">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 rtl:right-0 rtl:left-auto z-[70] flex w-64 flex-col bg-white border-e border-surface-200
          transition-transform duration-300 lg:static lg:!transform-none
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"}
        `}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-surface-100 px-5">
          <BelamondaLogo size={40} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {sortedGroupNames.map((groupName) => (
            <div key={groupName} className="space-y-1.5">
              <h3 className="px-3 text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                {groupName}
              </h3>
              <div className="space-y-0.5">
                {groupedItems[groupName].items.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      onNavigate(item.key);
                      setSidebarOpen(false);
                    }}
                    className={`group flex items-center gap-3 w-full px-3 py-2.5 rounded-[14px] transition-all duration-300 ${
                      activeKey === item.key 
                        ? "bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-surface-100" 
                        : "hover:bg-surface-100/50"
                    }`}
                  >
                    <div className={`flex items-center justify-center p-2 rounded-xl transition-all duration-300 ${
                      activeKey === item.key 
                        ? "bg-brand-pink-50 text-brand-pink-600 scale-110 shadow-sm" 
                        : "bg-transparent text-surface-400 group-hover:bg-white group-hover:scale-105 group-hover:text-brand-pink-400 group-hover:shadow-sm"
                    }`}>
                      {item.icon}
                    </div>
                    <span className={`text-sm transition-all duration-300 ${
                      activeKey === item.key ? "text-brand-pink-600 font-bold" : "text-surface-500 font-medium group-hover:text-surface-800"
                    }`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-surface-100 p-4 pb-[calc(env(safe-area-inset-bottom,1rem)+1rem)] space-y-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="avatar avatar-sm">
              {displayName.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-800 truncate">
                {displayName}
              </div>
              <div className="text-xs text-surface-400">
                {roleLabel[auth?.role || ""] || auth?.role}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 py-2.5 text-sm font-bold transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {isAr ? "تسجيل خروج" : "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — light brand hero header */}
        <header className="relative pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-4 px-4 sm:px-6 lg:px-8 lg:py-5 bg-gradient-to-br from-brand-pink-50 via-white to-brand-sage-50 border-b border-surface-100">
          {/* subtle bokeh blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-brand-pink-200/30 rounded-full blur-3xl" />
            <div className="absolute top-2 right-40 w-32 h-32 bg-brand-sage-200/30 rounded-full blur-2xl" />
          </div>

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Mobile menu button */}
              <button
                className="rounded-xl p-2 text-surface-600 hover:bg-white hover:shadow-sm transition-all lg:hidden shrink-0"
                onClick={() => setSidebarOpen(true)}
                aria-label={isAr ? "القائمة" : "Menu"}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="min-w-0">
                <div className="hidden lg:block text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-0.5">
                  {fmtDate(new Date())}
                </div>
                <h1 className="text-base sm:text-lg lg:text-xl font-black text-surface-900 leading-tight truncate">{title}</h1>
                {subtitle && (
                  <p className="hidden lg:block text-xs text-surface-500 mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerActions}

              {/* Language toggle */}
              <button
                onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")}
                className="rounded-xl bg-white/70 backdrop-blur-sm border border-white px-3 py-1.5 text-xs font-bold text-surface-700 hover:bg-white hover:text-brand-pink-600 hover:shadow-sm transition-all"
                aria-label={isAr ? "تغيير اللغة" : "Change language"}
              >
                {isAr ? "EN" : "ع"}
              </button>

              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={handleBellClick}
                  className="relative rounded-xl bg-white/70 backdrop-blur-sm border border-white p-2 text-surface-600 hover:bg-white hover:text-brand-pink-600 hover:shadow-sm transition-all"
                  aria-label="Notifications"
                >
                  {Icons.bell}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-pink-500 text-[9px] font-bold text-white shadow-sm">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                <NotificationPanel
                  open={notifOpen}
                  onClose={() => setNotifOpen(false)}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  onMarkAllRead={markAllRead}
                />
              </div>

              {/* Avatar pill */}
              <div className="hidden lg:flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-white rounded-full ps-1 pe-3 py-1 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-brand-pink-100 text-brand-pink-700 font-bold text-xs flex items-center justify-center">
                  {displayName.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="text-xs font-bold text-surface-800 truncate max-w-[150px]">{displayName}</div>
              </div>

              {/* Mobile logo */}
              <div className="lg:hidden">
                <BelamondaLogo size={32} />
              </div>
            </div>
          </div>
        </header>

        {/* Mobile quick navigation (Bottom App Bar) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-xl border-t border-surface-200 shadow-[0_-8px_30px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom,0px)]">
          <div className="flex justify-around items-center px-2 pt-2 pb-1">
            {navItems.slice(0, 5).map((item) => (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`flex flex-col items-center justify-center w-16 gap-1 transition-all ${
                  activeKey === item.key 
                    ? "text-brand-pink-600 scale-105" 
                    : "text-surface-400 hover:text-surface-600"
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${activeKey === item.key ? 'bg-brand-pink-50' : ''}`}>
                  {item.icon}
                </div>
                <span className="text-[9px] font-bold truncate w-full text-center">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Sticky notice banner (optional) */}
        {banner && <div className="flex-shrink-0">{banner}</div>}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overscroll-y-contain px-3 py-3 sm:p-4 lg:p-8 bg-surface-50 pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] lg:pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </main>
      </div>
    </div>
  );
}
