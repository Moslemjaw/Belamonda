import { useState } from "react";
import { fmtDate } from "../../lib/dateFormat";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useKycQueue, usePendingPayments, useComplaints, useApi, useBookingRequests } from "../../hooks/useApi";
import ClinicChangeModal from "../../components/ClinicChangeModal";
import { KpiCard } from "../../components/KpiCard";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import { ReferralActivityWidget, ReferralLeaderboardWidget } from "../../components/ReferralActivityWidget";
import { EFormsAdminPanel } from "../../features/admin/EFormsAdminPanel";
import { ar, translateComplaintStatus } from "./cs/shared";
import { KycQueue } from "./cs/KycQueue";
import { PaymentQueue } from "./cs/PaymentQueue";
import { PaymentsManager } from "./cs/PaymentsManager";
import { BookingRequestsQueue } from "./cs/BookingRequestsQueue";
import { CustomerMemberships } from "./cs/CustomerMemberships";
import { SchedulingTool } from "./cs/SchedulingTool";
import { CustomersManager } from "./cs/CustomersManager";
import { CsSettings } from "./cs/CsSettings";
import { ClinicChangeRequestsQueue } from "./cs/ClinicChangeRequestsQueue";
import { InvoiceReviews } from "./cs/InvoiceReviews";
import { SubscriptionRequests } from "./cs/SubscriptionRequests";
import { ComplaintModal } from "./cs/ComplaintModal";

// Re-exported for existing importers.
export { KycQueue } from "./cs/KycQueue";
export { PaymentQueue } from "./cs/PaymentQueue";
export { BookingRequestsQueue } from "./cs/BookingRequestsQueue";
export { ClinicChangeRequestsQueue } from "./cs/ClinicChangeRequestsQueue";

export default function CsDashboard() {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const isLegalOrAdmin = auth?.role === "legal" || auth?.role === "admin" || auth?.role === "cs_director";
  const isCsDirector = auth?.role === "cs_director";
  const isElevated = isLegalOrAdmin || isCsDirector;
  const [activeNav, setActiveNav] = useState("home");
  const { data: kycData } = useKycQueue({ lazy: !isLegalOrAdmin });
  const { data: paymentsData } = usePendingPayments();
  const { data: complaintsData, refetch: refetchComplaints } = useComplaints();
  const { data: bookingRequestsData } = useBookingRequests("pending");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string|null>(null);

  const [clinicChangeModal, setClinicChangeModal] = useState<{ type: "membership" | "session" | "request"; id: string; currentClinicId: string; defaultFee: string } | null>(null);
  const [newClinicId, setNewClinicId] = useState("");
  const [isPaidTransfer, setIsPaidTransfer] = useState(false);
  const [transferFee, setTransferFee] = useState("10.000");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");
  const { getAuthHeader } = useAuth();
  
  // Complaints Filters
  const [complaintSearch, setComplaintSearch] = useState("");
  const [complaintStatus, setComplaintStatus] = useState("all");
  const [complaintCategory, setComplaintCategory] = useState("all");

  const filteredComplaints = (complaintsData?.items || []).filter((c: any) => {
    if (complaintStatus !== "all" && c.status !== complaintStatus) return false;
    if (complaintCategory !== "all" && c.category !== complaintCategory) return false;
    if (complaintSearch.trim()) {
      const q = complaintSearch.toLowerCase();
      const subject = c.subject || "";
      const userName = c.userName || c.userId || "";
      if (!subject.toLowerCase().includes(q) && !userName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    ...(isCsDirector ? [{ key: "share_link_performance", icon: Icons.chart, label: ar() ? "أداء روابط المشاركة" : "Share Link Performance" }] : []),
    ...(isLegalOrAdmin ? [{ key: "kyc", icon: Icons.shield, label: t("kyc") }] : []),
    ...(isLegalOrAdmin ? [{ key: "invoice_reviews", icon: Icons.cash, label: ar() ? "مراجعة الفواتير" : "Invoice Reviews" }] : []),
    ...(isLegalOrAdmin ? [{ key: "eforms", icon: Icons.clipboard, label: ar() ? "النماذج الإلكترونية" : "eForms" }] : []),
    { key: "payments", icon: Icons.cash, label: t("payments") },
    { key: "sub_requests", icon: <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7.4-6.3-4.8-6.3 4.8 2.3-7.4-6-4.6h7.6z"/></svg>, label: ar() ? "طلبات برو" : "Pro Requests" },
    { key: "customers", icon: Icons.users, label: ar() ? "العملاء" : "Customers" },
    { key: "memberships", icon: Icons.offers, label: ar() ? "الاشتراكات" : "Memberships" },
    { key: "clinic_changes", icon: Icons.clinic, label: ar() ? "تغيير العيادة" : "Clinic Changes" },
    { key: "scheduling", icon: Icons.calendar, label: t("schedule") },
    { key: "chat", icon: Icons.clipboard, label: ar() ? "محادثات الحجوزات" : "Booking Chat" },
    { key: "complaints", icon: Icons.complaint, label: t("complaints") },
    { key: "profile", icon: Icons.profile, label: ar() ? "الملف الشخصي" : "Profile & Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={isCsDirector ? (ar() ? "مدير خدمة العملاء" : "CS Director") : isLegalOrAdmin ? (ar() ? "موظف قانوني" : "Legal Officer") : (ar() ? "خدمة العملاء" : "Customer Service")} subtitle={isElevated ? (ar() ? "إدارة التحققات والنماذج والمدفوعات" : "Manage KYC, eForms, payments & bookings") : (ar() ? "إدارة المدفوعات والحجوزات" : "Manage payments, memberships & bookings")}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            {/* ── Welcome Header ── */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-surface-900">{ar() ? "مرحباً بك" : "Welcome back"}</h2>
                <p className="text-sm text-surface-400 mt-0.5">{fmtDate(new Date())}</p>
              </div>
            </div>

            {/* ── KPI Summary Row ── */}
            <div className={`grid gap-3 grid-cols-2 sm:gap-4 ${isLegalOrAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {isLegalOrAdmin && (
                <KpiCard
                  accent="amber"
                  onClick={() => setActiveNav("kyc")}
                  icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
                  label={ar() ? "تحققات معلقة" : "Pending KYC"}
                  value={(kycData?.items || []).length}
                  sub={ar() ? "تتطلب مراجعة" : "needs review"}
                />
              )}
              <KpiCard
                accent="pink"
                onClick={() => setActiveNav("payments")}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                label={ar() ? "مدفوعات معلقة" : "Pending Payments"}
                value={(paymentsData?.items || []).length}
                sub={ar() ? "بانتظار المراجعة" : "awaiting confirm"}
              />
              <KpiCard
                accent="blue"
                onClick={() => setActiveNav("scheduling")}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                label={ar() ? "طلبات حجز" : "Booking Requests"}
                value={(bookingRequestsData?.items || []).length}
                sub={ar() ? "تنتظر الجدولة" : "to schedule"}
              />
              <KpiCard
                accent="rose"
                onClick={() => setActiveNav("complaints")}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 13a3 3 0 11-6 0 3 3 0 016 0zM2 18.5a8.5 8.5 0 0117 0M12 6a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                label={ar() ? "إجمالي الشكاوى" : "Total Complaints"}
                value={complaintsData?.total || 0}
                sub={ar() ? "خلال الفترة" : "in period"}
              />
            </div>

            {/* ── Action Queues ── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.832c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <h3 className="text-base font-bold text-surface-900">{ar() ? "قوائم العمل" : "Action Queues"}</h3>
              </div>
              <div className={`grid gap-6 xl:grid-cols-2 ${isLegalOrAdmin ? '2xl:grid-cols-3' : ''}`}>
                {isLegalOrAdmin && <KycQueue />}
                <PaymentQueue />
                <BookingRequestsQueue onTransfer={(id, clinicId) => {
                  setClinicChangeModal({ type: 'request', id, currentClinicId: clinicId, defaultFee: '5.000' });
                }} />
              </div>
            </div>

            {/* ── Referral Activity ── */}
            <ReferralActivityWidget />

            {/* ── Customer Memberships (Full Width) ── */}
            <CustomerMemberships onTransfer={(id, clinicId) => {
              setClinicChangeModal({ type: 'membership', id, currentClinicId: clinicId, defaultFee: '10.000' });
              setNewClinicId(clinicId);
              setIsPaidTransfer(false);
              setTransferFee("10.000");
              setTransferError(null);
            }} />
          </>
        )}
        {activeNav === "share_link_performance" && isCsDirector && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "أداء روابط المشاركة" : "Share Link Performance"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "تقارير أداء ومبيعات الإحالة لموظفي خدمة العملاء." : "Referral sales and performance reports for customer service staff."}</p>
            </div>
            <ReferralLeaderboardWidget allowedRoles={["cs", "cs_director", "legal"]} />
          </div>
        )}
        {activeNav === "kyc" && isLegalOrAdmin && <KycQueue />}
        {activeNav === "invoice_reviews" && isLegalOrAdmin && <InvoiceReviews />}
        {activeNav === "eforms" && isLegalOrAdmin && <EFormsAdminPanel />}
        {activeNav === "sub_requests" && <SubscriptionRequests />}
        {activeNav === "payments" && <PaymentsManager />}
        {activeNav === "memberships" && <CustomerMemberships onTransfer={(id, clinicId) => {
          setClinicChangeModal({ type: 'membership', id, currentClinicId: clinicId, defaultFee: '10.000' });
          setNewClinicId(clinicId);
          setIsPaidTransfer(false);
          setTransferFee("10.000");
          setTransferError(null);
        }} />}
        {activeNav === "customers" && <CustomersManager />}
        {activeNav === "clinic_changes" && <ClinicChangeRequestsQueue />}
        {activeNav === "scheduling" && (
           <div className="space-y-6">
              <BookingRequestsQueue onTransfer={(id, clinicId) => {
                setClinicChangeModal({ type: 'request', id, currentClinicId: clinicId, defaultFee: '5.000' });
              }} />
              <SchedulingTool />
           </div>
        )}
        {activeNav === "chat" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "محادثات الحجوزات" : "Booking Conversations"}</h2>
              <p className="text-sm text-surface-500 mt-1">
                {ar() ? "تواصل مع العملاء والعيادات وقم بإدارة طلبات الحجز." : "Coordinate with customers and clinics to manage booking requests."}
              </p>
            </div>
            <ChatWidget showBookingActions />
          </div>
        )}
        {activeNav === "complaints" && (
          <div className="card-elevated overflow-hidden">
            <div className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <h3 className="text-base font-bold text-surface-900">{ar() ? "الشكاوى" : "Complaints"}</h3>
              <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full lg:w-auto bg-surface-50/50 p-2 rounded-2xl border border-surface-100">
                <div className="relative w-full sm:w-64">
                  <svg className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 ${ar() ? 'right-3' : 'left-3'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input 
                    type="text" 
                    placeholder={ar() ? "بحث بالاسم أو الموضوع..." : "Search name or subject..."}
                    className={`input-field text-sm py-1.5 w-full ${ar() ? 'pr-9' : 'pl-9'}`}
                    value={complaintSearch}
                    onChange={e => setComplaintSearch(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <select 
                    className="select-field text-sm py-1.5 w-full sm:w-auto min-w-[140px]"
                    value={complaintStatus}
                    onChange={e => setComplaintStatus(e.target.value)}
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
                    value={complaintCategory}
                    onChange={e => setComplaintCategory(e.target.value)}
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
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>{ar() ? "الموضوع" : "Subject"}</th><th>{ar() ? "المرسل" : "From"}</th><th>{ar() ? "الفئة" : "Category"}</th><th>{ar() ? "الحالة" : "Status"}</th><th>{ar() ? "التاريخ" : "Date"}</th></tr></thead>
                <tbody>
                  {filteredComplaints.map((c: any) => (
                    <tr key={c.id} onClick={() => setSelectedComplaintId(c.id)} className="cursor-pointer hover:bg-surface-50 transition-colors">
                      <td className="font-medium">{c.subject}</td>
                      <td className="text-sm font-bold text-surface-700">{c.userName || c.userId}</td>
                      <td><span className="badge-sage">{c.category}</span></td>
                      <td><span className={c.status === "resolved" ? "badge-green" : c.status === "open" ? "badge-red" : "badge-yellow"}>{translateComplaintStatus(c.status)}</span></td>
                      <td className="text-xs">{fmtDate(c.createdAt)}</td>
                    </tr>
                  ))}
                  {filteredComplaints.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-icon"><svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div><div className="empty-state-title">{ar() ? "لا شكاوى" : "No complaints"}</div><div className="empty-state-sub">{ar() ? "لم يتم العثور على نتائج للفلتر الحالي." : "No results found for current filters."}</div></div></td></tr>}
                </tbody>
              </table>
            </div>
            {selectedComplaintId && <ComplaintModal id={selectedComplaintId} onClose={() => setSelectedComplaintId(null)} onUpdated={refetchComplaints} />}
          </div>
        )}
        {activeNav === "profile" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "الملف الشخصي والإعدادات" : "Profile & Settings"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "إدارة حسابك ورابط الإحالة في مكان واحد." : "Manage your account and referral link in one place."}</p>
            </div>
            <CsSettings />
            <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-100">
                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                  {Icons.share}
                  {ar() ? "رابط الإحالة" : "Referral & Share Link"}
                </h3>
              </div>
              <div className="p-6">
                <ShareLinkPage />
              </div>
            </div>
          </div>
        )}
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
