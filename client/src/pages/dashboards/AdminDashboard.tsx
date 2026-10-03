import { useState } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useApi, useKycQueue, usePendingPayments, useComplaints, useProducts, useFinanceSnapshot, useAdminReservations, useBookingRequests } from "../../hooks/useApi";
import { CategoriesAdminPanel } from "../../features/admin/CategoriesAdminPanel";
import { EFormsAdminPanel } from "../../features/admin/EFormsAdminPanel";
import { KycQueue } from "./cs/KycQueue";
import { PaymentQueue } from "./cs/PaymentQueue";
import { BookingRequestsQueue } from "./cs/BookingRequestsQueue";
import { AdminSubscriptionsDashboard } from "./AdminSubscriptionsDashboard";
import { SessionTypesAdminPanel } from "../../features/admin/SessionTypesAdminPanel";
import { PromotionsManager } from "../../components/PromotionsManager";
import AdminBookingsMonitor from "../../components/AdminBookingsMonitor";
import ShareLinkPage from "../../components/ShareLinkPage";
import { fmtDateTime } from "../../lib/dateFormat";
import NotificationSettingsPanel from "../../features/admin/NotificationSettingsPanel";
import { KpiCard } from "../../components/KpiCard";
import AdminSessionsLogTab from "./AdminSessionsLogTab";
import AdminRequestHistoryTab from "./AdminRequestHistoryTab";
import AdminScanHistoryTab from "./AdminScanHistoryTab";
import AdminCustomerSessionStatusTab from "./AdminCustomerSessionStatusTab";
import { ClinicChangeRequestsQueue } from "./cs/ClinicChangeRequestsQueue";
import ClinicChangeModal from "../../components/ClinicChangeModal";
import { ar, AUDIT_ROLE_COLORS, ACTION_LABELS } from "./admin/shared";
import { OffersManager } from "./admin/OffersManager";
import { SessionsManager } from "./admin/SessionsManager";
import { ClinicsManager } from "./admin/ClinicsManager";
import { TasksManager } from "./admin/TasksManager";
import { ComplaintsView } from "./admin/ComplaintsView";
import { AdminSettings } from "./admin/AdminSettings";
import { UsersManager } from "./admin/UsersManager";
import { AdminReservationsPanel } from "./admin/AdminReservationsPanel";
import { AuditLogViewer } from "./admin/AuditLogViewer";
import { NoticesAdminPanel } from "./admin/NoticesAdminPanel";

// Re-exported for existing importers.
export { UserProfilePanel } from "./admin/UserProfilePanel";
export { UsersManager } from "./admin/UsersManager";
export type { ProfileTab } from "./admin/shared";

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [activeNav, setActiveNav] = useState("home");
  const [clinicChangeModal, setClinicChangeModal] = useState<{ type: "membership" | "session" | "request"; id: string; currentClinicId: string; defaultFee: string } | null>(null);
  const { data: kycData } = useKycQueue({ lazy: activeNav !== "home" });
  const { data: paymentsData } = usePendingPayments({ lazy: activeNav !== "home" });
  const { data: productsData } = useProducts({ lazy: activeNav !== "home" });
  const { data: offersData } = useApi<{ items: any[] }>("/offers/admin", { lazy: activeNav !== "home" });
  const { data: financeData } = useFinanceSnapshot({}, { lazy: activeNav !== "home" });
  const { data: complaintsData } = useComplaints({ lazy: activeNav !== "home" });
  const { data: reservationsData } = useAdminReservations({ lazy: activeNav !== "home" });
  const { data: bookingRequests } = useBookingRequests("pending");
  const { data: recentAuditData } = useApi<{ items: any[] }>("/audit?limit=6&page=1", { lazy: activeNav !== "home" });
  const { data: usersData } = useApi<{ items: any[] }>("/users/admin", { lazy: activeNav !== "home" });
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
    { key: "sessions_log", icon: Icons.calendar, label: ar() ? "سجل الجلسات" : "Sessions Log" },
    { key: "session_status", icon: Icons.chart, label: ar() ? "حالة الجلسات (360°)" : "Session Status" },
    { key: "clinic_changes", icon: Icons.clinic, label: ar() ? "تغيير العيادات" : "Clinic Changes" },
    { key: "request_history", icon: Icons.history, label: ar() ? "سجل طلبات الحجز" : "Request History" },
    { key: "scan_history", icon: Icons.history, label: ar() ? "سجل المسح" : "Scan History" },
    { key: "bookings", icon: Icons.calendar, label: ar() ? "الحجوزات والمحادثات" : "Bookings & Chats" },
    { key: "tasks", icon: Icons.clipboard, label: t("tasks") },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "eforms", icon: Icons.report, label: ar() ? "النماذج" : "E-Forms" },
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
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-4">
              <KpiCard accent="indigo" icon={Icons.users} label={ar() ? "العملاء" : "Total Customers"} value={(usersData as any)?.totalCustomers ?? (usersData?.items || []).filter((u: any) => u.role === "customer").length} sub={ar() ? "مسجل" : "registered"} />
              <KpiCard accent="rose" icon={Icons.complaint} label={ar() ? "شكاوى مفتوحة" : "Open Complaints"} value={(complaintsData?.items || []).filter((c: any) => c.status === "open").length} sub={ar() ? "تتطلب متابعة" : "require follow-up"} />
              <KpiCard accent="teal" icon={Icons.clinic} label={ar() ? "العروض النشطة" : "Active Offers"} value={(offersData?.items || []).filter((o: any) => o.isActive !== false).length} sub={ar() ? "في الكتالوج" : "in catalog"} />
              <KpiCard accent="violet" icon={Icons.calendar} label={ar() ? "حجوزات العربون" : "Reservations"} value={(reservationsData?.items || []).length} sub={ar() ? "نشطة" : "active"} />
            </div>

            {/* ── Financial Snapshot ── */}
            <div className="card-elevated bg-white rounded-2xl border border-surface-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-surface-50 to-white border-b border-surface-100 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-sm font-bold text-surface-900">{ar() ? "النظرة المالية" : "Financial Snapshot"}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 divide-x divide-surface-100">
                {[
                  { label: ar() ? "الإيرادات" : "Revenue", value: fs?.totalRevenue || "0.000", color: "text-surface-900" },
                  { label: ar() ? "معلقة" : "Pending", value: fs?.pendingPaymentsKwd || "0.000", color: "text-blue-600" },
                  { label: ar() ? "كاش باك مقفل" : "CB Locked", value: fs?.totalCashbackLocked || "0.000", color: "text-amber-600" },
                  { label: ar() ? "كاش باك متاح" : "CB Unlocked", value: fs?.totalCashbackUnlocked || "0.000", color: "text-brand-pink-600" },
                  { label: ar() ? "كاش باك مُستخدم" : "CB Utilized", value: fs?.totalCashbackUtilized || "0.000", color: "text-emerald-600" },
                  { label: ar() ? "جلسات اليوم" : "Sessions Today", value: fs?.sessionsToday ?? 0, color: "text-violet-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="px-4 py-4 flex flex-col items-center text-center">
                    <div className="text-[10px] font-bold text-surface-400 uppercase tracking-wider mb-1">{label}</div>
                    <div className={`text-xl font-black ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Needs Attention ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <h3 className="text-base font-bold text-surface-900">{ar() ? "يحتاج إلى اهتمام" : "Needs Attention"}</h3>
              </div>
              <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3 items-start">
                <KycQueue />
                <PaymentQueue />
                <BookingRequestsQueue onTransfer={(id, clinicId) => {
                  setClinicChangeModal({ type: 'request', id, currentClinicId: clinicId, defaultFee: '5.000' });
                }} />
              </div>
            </div>

            {/* ── Quick Navigation ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </div>
                <h3 className="text-base font-bold text-surface-900">{ar() ? "اختصارات التنقل" : "Quick Navigation"}</h3>
              </div>
              <div className="grid gap-2.5 grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
                {([
                  { key: "offers",     icon: Icons.offers,    label: ar() ? "العضويات"  : "Memberships",  color: "text-brand-pink-600 bg-brand-pink-50 hover:bg-brand-pink-100 border-brand-pink-100" },
                  { key: "promotions", icon: Icons.offers,    label: ar() ? "عروض الشركات" : "Promotions",   color: "text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-100" },
                  { key: "users",      icon: Icons.users,     label: ar() ? "المستخدمون" : "Users",         color: "text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100" },
                  { key: "clinics",    icon: Icons.clinic,    label: ar() ? "العيادات"   : "Clinics",       color: "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100" },
                  { key: "complaints", icon: Icons.complaint, label: ar() ? "الشكاوى"    : "Complaints",    color: "text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-100" },
                  { key: "bookings",   icon: Icons.calendar,  label: ar() ? "الحجوزات"   : "Bookings",      color: "text-violet-600 bg-violet-50 hover:bg-violet-100 border-violet-100" },
                  { key: "eforms",     icon: Icons.report,    label: ar() ? "النماذج"    : "E-Forms",       color: "text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-100" },
                  { key: "notices",    icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>, label: ar() ? "إشعارات" : "Notices", color: "text-teal-600 bg-teal-50 hover:bg-teal-100 border-teal-100" },
                  { key: "audit",      icon: Icons.clipboard, label: ar() ? "التدقيق"   : "Audit Logs",    color: "text-surface-600 bg-surface-50 hover:bg-surface-100 border-surface-200" },
                ] as Array<{ key: string; icon: React.ReactNode; label: string; color: string }>).map(({ key, icon, label, color }) => (
                  <button
                    key={key}
                    onClick={() => setActiveNav(key)}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all duration-200 font-semibold text-xs hover:shadow-md hover:-translate-y-0.5 ${color}`}
                  >
                    <span className="h-5 w-5">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Recent Activity (Audit Log) ── */}
            <div className="card-elevated bg-white rounded-2xl border border-surface-200 overflow-hidden">
              <div className="px-5 py-3.5 bg-gradient-to-r from-surface-50 to-white border-b border-surface-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-sm font-bold text-surface-900">{ar() ? "النشاط الأخير" : "Recent Activity"}</h3>
                </div>
                <button onClick={() => setActiveNav("audit")} className="text-xs font-bold text-brand-pink-600 hover:text-brand-pink-800 flex items-center gap-1 transition-colors">
                  {ar() ? "عرض الكل" : "View all"}
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="divide-y divide-surface-100">
                {(recentAuditData?.items || []).length === 0 && (
                  <div className="py-10 text-center">
                    <div className="w-10 h-10 mx-auto rounded-xl bg-surface-100 flex items-center justify-center text-surface-400 mb-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div className="text-sm text-surface-400">{ar() ? "لا توجد أنشطة مسجلة بعد." : "No activity recorded yet."}</div>
                  </div>
                )}
                {(recentAuditData?.items || []).map((log: any) => (
                  <div key={log.id} className="px-5 py-3 flex items-center gap-3.5 hover:bg-surface-50/50 transition-colors">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black uppercase ${AUDIT_ROLE_COLORS[log.actorRole] ?? "bg-surface-100 text-surface-500"}`}>
                      {log.actorRole?.slice(0, 2)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-surface-900">{ACTION_LABELS[log.actionType] ?? (log.actionType ? log.actionType.replace(/_/g, " ") : "—")}</span>
                        <span className="text-[10px] text-surface-400 bg-surface-50 px-1.5 py-0.5 rounded font-medium">{log.targetEntityType}</span>
                      </div>
                      {log.metadata?.username && <div className="text-[10px] text-surface-500 mt-0.5">@{log.metadata.username}</div>}
                    </div>
                    <div className="text-[10px] text-surface-400 whitespace-nowrap shrink-0">{fmtDateTime(log.createdAt)}</div>
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
        {activeNav === "clinic_changes" && <ClinicChangeRequestsQueue />}
        {activeNav === "sessions_log" && <AdminSessionsLogTab />}
        {activeNav === "session_status" && <AdminCustomerSessionStatusTab />}
        {activeNav === "request_history" && <AdminRequestHistoryTab />}
        {activeNav === "scan_history" && <AdminScanHistoryTab />}
        {activeNav === "reservations" && <AdminReservationsPanel />}
        {activeNav === "share" && <ShareLinkPage />}
        {activeNav === "notices" && <NoticesAdminPanel />}
        {activeNav === "notifications_settings" && <NotificationSettingsPanel />}
        {activeNav === "subscriptions" && <AdminSubscriptionsDashboard />}
        {activeNav === "audit" && <AuditLogViewer />}
        {activeNav === "settings" && <AdminSettings />}
      </div>

      {clinicChangeModal && (
        <ClinicChangeModal
          modal={clinicChangeModal}
          onClose={() => setClinicChangeModal(null)}
        />
      )}
    </DashboardShell>
  );
}
