import { useState, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import { fmtDateTime, fmtDate } from "../../lib/dateFormat";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

type TargetUser = {
  id: string;
  fullName: string;
  phone: string;
  shortId: string;
  email: string;
  gender: string;
  verificationStatus: string;
  createdAt: string | null;
};

type MatchedUser = {
  id: string;
  fullName: string;
  phone: string;
  shortId: string;
};

type SessionItem = {
  id: string;
  shortId: string | null;
  clinicId: string;
  clinicNameEn: string;
  clinicNameAr: string;
  offerName: string;
  scheduledAt: string | null;
  status: string;
  clinicPaymentStatus: string;
  sessionPriceKwd: string;
  finalPaidKwd: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string | null;
};

type RequestItem = {
  id: string;
  clinicId: string;
  clinicNameEn: string;
  clinicNameAr: string;
  offerName: string;
  status: string;
  adminSuggestedAt: string | null;
  clinicScheduledAt: string | null;
  shownAt: string | null;
  scheduledSessionId: string | null;
  notes: string | null;
  clinicPaymentStatus: string;
  bookingRoute: string;
  createdAt: string | null;
};

type ScanItem = {
  id: string;
  clinicId: string;
  clinicNameEn: string;
  clinicNameAr: string;
  offerName: string;
  scannedAt: string | null;
  status: string;
  hadScheduledSession: boolean;
  scannedBy: string;
};

type MembershipItem = {
  id: string;
  offerId: string;
  offerName: string;
  membershipType: string;
  status: string;
  maxSessions: number | null;
  sessionsUsed: number;
  createdAt: string | null;
  validUntil: string | null;
  cashbackBalanceKwd: string;
};

type Stats = {
  totalSessions: number;
  completedSessions: number;
  scheduledSessions: number;
  cancelledSessions: number;
  totalRequests: number;
  completedRequests: number;
  cancelledRequests: number;
  totalScans: number;
  attendedScans: number;
  totalMemberships: number;
  activeMemberships: number;
};

const STATUS_PILL: Record<string, { cls: string; labelEn: string; labelAr: string }> = {
  completed:        { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", labelEn: "Completed", labelAr: "مكتمل" },
  scheduled:        { cls: "bg-blue-50 text-blue-700 border-blue-200", labelEn: "Scheduled", labelAr: "مجدول" },
  slot_assigned:    { cls: "bg-indigo-50 text-indigo-700 border-indigo-200", labelEn: "Slot Assigned", labelAr: "تم تحديد الوقت" },
  request_received: { cls: "bg-amber-50 text-amber-700 border-amber-200", labelEn: "Request Received", labelAr: "تم استلام الطلب" },
  open:             { cls: "bg-amber-50 text-amber-700 border-amber-200", labelEn: "Open", labelAr: "مفتوح" },
  checked_in:       { cls: "bg-teal-50 text-teal-700 border-teal-200", labelEn: "Checked In", labelAr: "تم الحضور" },
  in_progress:      { cls: "bg-purple-50 text-purple-700 border-purple-200", labelEn: "In Progress", labelAr: "قيد التنفيذ" },
  cancelled:        { cls: "bg-red-50 text-red-700 border-red-200", labelEn: "Cancelled", labelAr: "ملغى" },
  rejected:         { cls: "bg-red-50 text-red-700 border-red-200", labelEn: "Rejected", labelAr: "مرفوض" },
  no_show:          { cls: "bg-rose-50 text-rose-700 border-rose-200", labelEn: "No Show", labelAr: "لم يحضر" },
  attended:         { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", labelEn: "Attended", labelAr: "حضر" },
  no_scheduled_session: { cls: "bg-orange-50 text-orange-700 border-orange-200", labelEn: "No Scheduled Session", labelAr: "بدون موعد مسبق" },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_PILL[status] ?? { cls: "bg-surface-100 text-surface-600 border-surface-200", labelEn: status, labelAr: status };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${meta.cls}`}>
      {ar() ? meta.labelAr : meta.labelEn}
    </span>
  );
}

export default function AdminCustomerSessionStatusTab() {
  const { getAuthHeader } = useAuth();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"timeline" | "sessions" | "requests" | "scans" | "memberships">("timeline");

  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [matchedUsers, setMatchedUsers] = useState<MatchedUser[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchCustomerStatus = useCallback(async (searchQuery: string, targetUserId?: string) => {
    if (!searchQuery.trim() && !targetUserId) return;
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("query", searchQuery.trim());
      if (targetUserId) params.set("userId", targetUserId);

      const res = await apiFetch(`/scheduling/admin/customer-session-status?${params.toString()}`, {
        headers: getAuthHeader(),
      }) as {
        targetUser: TargetUser | null;
        matchedUsers: MatchedUser[];
        sessions: SessionItem[];
        requests: RequestItem[];
        scans: ScanItem[];
        memberships: MembershipItem[];
        stats: Stats | null;
      };

      setTargetUser(res.targetUser);
      setMatchedUsers(res.matchedUsers || []);
      setSessions(res.sessions || []);
      setRequests(res.requests || []);
      setScans(res.scans || []);
      setMemberships(res.memberships || []);
      setStats(res.stats || null);
    } catch {
      setTargetUser(null);
      setMatchedUsers([]);
      setSessions([]);
      setRequests([]);
      setScans([]);
      setMemberships([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      fetchCustomerStatus(query);
    }
  };

  // Build unified chronological timeline
  const timelineEvents = [
    ...sessions.map((s) => ({
      id: `sess_${s.id}`,
      type: "session" as const,
      timestamp: s.scheduledAt || s.createdAt || "",
      clinicName: ar() ? s.clinicNameAr : s.clinicNameEn,
      title: s.offerName,
      status: s.status,
      code: s.shortId,
      detail: s.notes || (s.status === "completed" ? (ar() ? "تم إتمام الجلسة" : "Session completed") : null),
      payment: s.clinicPaymentStatus,
    })),
    ...requests.map((r) => ({
      id: `req_${r.id}`,
      type: "request" as const,
      timestamp: r.clinicScheduledAt || r.adminSuggestedAt || r.createdAt || "",
      clinicName: ar() ? r.clinicNameAr : r.clinicNameEn,
      title: r.offerName,
      status: r.status,
      code: null,
      detail: r.notes ? `${ar() ? "ملاحظات:" : "Notes:"} ${r.notes}` : null,
      payment: r.clinicPaymentStatus,
    })),
    ...scans.map((sc) => ({
      id: `scan_${sc.id}`,
      type: "scan" as const,
      timestamp: sc.scannedAt || "",
      clinicName: ar() ? sc.clinicNameAr : sc.clinicNameEn,
      title: ar() ? `مسح الرمز (QR Scan)` : `QR Scan Check-in`,
      status: sc.status,
      code: null,
      detail: `${ar() ? "بواسطة:" : "Scanned by:"} ${sc.scannedBy}`,
      payment: null,
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="card-elevated bg-gradient-to-r from-brand-pink-500 via-brand-pink-600 to-brand-pink-800 text-white p-6 sm:p-8 rounded-2xl shadow-xl border-none relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase mb-3">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {ar() ? "سجل حالة الجلسات الشامل (360°)" : "Customer 360 Session Status"}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {ar() ? "البحث والتحقق الشامل من جلسات العميل" : "Comprehensive Customer Session Journey"}
          </h2>
          <p className="text-brand-pink-100 text-sm sm:text-base mt-2 leading-relaxed">
            {ar()
              ? "ابحث عن أي عميل بالاسم أو رقم الهاتف لعرض كافة الجلسات المجدولة، طلبات الحجز، وسجلات فحص الباركود (QR) في مكان واحد."
              : "Search any customer by name, mobile, or ID to instantly review all scheduled sessions, booking requests, and QR check-in scans together."}
          </p>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-6 relative z-10">
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-2 rounded-2xl shadow-2xl border border-white/20">
            <div className="relative flex-1 flex items-center">
              <svg className="w-5 h-5 text-surface-400 absolute left-4 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                className="w-full pl-12 pr-4 py-3 bg-transparent text-surface-900 placeholder:text-surface-400 font-medium text-sm sm:text-base focus:outline-none"
                placeholder={ar() ? "اكتب اسم العميل، رقم الهاتف (مثال: 97858533)، أو الرمز..." : "Enter customer name, mobile number, or short ID..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1 mr-2 text-surface-400 hover:text-surface-600 rounded-full hover:bg-surface-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-brand-pink-600 hover:bg-brand-pink-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              {ar() ? "بحث وتجميع" : "Search & Combine"}
            </button>
          </div>
        </form>
      </div>

      {/* Multiple Matches Switcher Bar */}
      {matchedUsers.length > 1 && (
        <div className="bg-white border border-surface-200 rounded-xl p-3 flex flex-wrap items-center gap-2 shadow-sm animate-fade-in">
          <span className="text-xs font-bold text-surface-500 mr-2 flex items-center gap-1.5">
            <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {ar() ? "نتائج مطابقة متعددة:" : "Matching Customers:"}
          </span>
          {matchedUsers.map((u) => {
            const isSelected = targetUser?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => fetchCustomerStatus(u.fullName, u.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                  isSelected
                    ? "bg-brand-pink-500 text-white shadow-sm"
                    : "bg-surface-50 text-surface-700 hover:bg-brand-pink-50 hover:text-brand-pink-600 border border-surface-200"
                }`}
              >
                <span>{u.fullName}</span>
                <span className={`text-[10px] font-mono ${isSelected ? "text-brand-pink-100" : "text-surface-400"}`}>
                  ({u.phone})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Initial Clean Empty State */}
      {!searched && !loading && (
        <div className="bg-white border border-surface-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-brand-pink-50 text-brand-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-surface-900">
            {ar() ? "الصفحة جاهزة — ابحث باسم العميل" : "Ready to Search — Enter Customer Name"}
          </h3>
          <p className="text-surface-500 text-sm max-w-md mx-auto mt-2 leading-relaxed">
            {ar()
              ? "لم يتم تحميل أي بيانات مسبقاً لتسريع الصفحة. اكتب اسم العميل أو رقمه في شريط البحث أعلاه لجلب الجلسات والطلبات والفحوصات فوراً."
              : "No initial data is preloaded for maximum performance. Simply type a customer name or mobile number above to fetch all records."}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white border border-surface-200 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-12 h-12 border-4 border-brand-pink-100 border-t-brand-pink-500 rounded-full animate-spin mx-auto mb-4" />
          <h4 className="text-base font-bold text-surface-800">{ar() ? "جاري تجميع بيانات الجلسات والطلبات والفحوصات..." : "Combining Sessions, Requests & Scans..."}</h4>
          <p className="text-xs text-surface-400 mt-1">{ar() ? "البحث في قواعد البيانات المتعددة" : "Querying BookingSessions, BookingRequests & ScanLogs"}</p>
        </div>
      )}

      {/* No Results Found */}
      {searched && !loading && !targetUser && (
        <div className="bg-white border border-surface-200 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-black text-surface-900">{ar() ? "لم يتم العثور على العميل" : "Customer Not Found"}</h3>
          <p className="text-surface-500 text-sm max-w-sm mx-auto mt-2">
            {ar()
              ? "تأكد من كتابة الاسم أو رقم الهاتف بالشكل الصحيح وحاول مرة أخرى."
              : "Please check the spelling of the name or mobile number and try again."}
          </p>
        </div>
      )}

      {/* Loaded Customer 360 View */}
      {searched && !loading && targetUser && (
        <div className="space-y-6">
          {/* Customer Profile & KPI Header Card */}
          <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-surface-100">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-pink-500 to-brand-pink-400 text-white flex items-center justify-center text-xl font-black shadow-md shrink-0">
                  {targetUser.fullName.charAt(0) || "C"}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-xl font-black text-surface-900">{targetUser.fullName}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-surface-100 text-surface-600 border border-surface-200">
                      {targetUser.shortId || targetUser.id}
                    </span>
                    {targetUser.verificationStatus === "approved" ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        {ar() ? "موثق" : "Verified"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        {ar() ? "غير موثق" : "Unverified"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-surface-500 flex-wrap">
                    <span className="font-mono font-medium text-surface-700">{targetUser.phone}</span>
                    {targetUser.email && <span>• {targetUser.email}</span>}
                    {targetUser.createdAt && <span>• {ar() ? "انضم في:" : "Joined:"} {fmtDate(targetUser.createdAt)}</span>}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 self-end lg:self-center">
                <button
                  onClick={() => fetchCustomerStatus(query, targetUser.id)}
                  className="btn-ghost flex items-center gap-1.5 text-xs font-bold text-surface-600 hover:text-brand-pink-600"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {ar() ? "تحديث" : "Refresh"}
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 text-center">
                  <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">{ar() ? "الجلسات الفعلية" : "Sessions Log"}</span>
                  <div className="text-2xl font-black text-brand-pink-600 mt-1">{stats.totalSessions}</div>
                  <div className="text-[11px] text-emerald-600 font-bold mt-0.5">
                    {stats.completedSessions} {ar() ? "مكتملة" : "completed"}
                  </div>
                </div>

                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 text-center">
                  <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">{ar() ? "طلبات الحجز" : "Requests"}</span>
                  <div className="text-2xl font-black text-indigo-600 mt-1">{stats.totalRequests}</div>
                  <div className="text-[11px] text-surface-500 mt-0.5">
                    {stats.completedRequests} {ar() ? "مكتمل" : "completed"} • {stats.cancelledRequests} {ar() ? "ملغى" : "cancelled"}
                  </div>
                </div>

                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 text-center">
                  <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">{ar() ? "سجلات الفحص (QR)" : "QR Scans"}</span>
                  <div className="text-2xl font-black text-teal-600 mt-1">{stats.totalScans}</div>
                  <div className="text-[11px] text-teal-700 font-bold mt-0.5">
                    {stats.attendedScans} {ar() ? "حضور مؤكد" : "attended"}
                  </div>
                </div>

                <div className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 text-center">
                  <span className="text-xs font-bold text-surface-500 uppercase tracking-wider">{ar() ? "العضويات" : "Memberships"}</span>
                  <div className="text-2xl font-black text-amber-500 mt-1">{stats.totalMemberships}</div>
                  <div className="text-[11px] text-amber-700 font-bold mt-0.5">
                    {stats.activeMemberships} {ar() ? "نشطة" : "active"}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-surface-200 gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveSubTab("timeline")}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === "timeline"
                  ? "border-brand-pink-600 text-brand-pink-600 bg-brand-pink-50/50 rounded-t-xl"
                  : "border-transparent text-surface-500 hover:text-surface-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {ar() ? "المخطط الزمني الموحد" : "Unified Timeline"}
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-surface-200 text-surface-700">
                {timelineEvents.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("sessions")}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === "sessions"
                  ? "border-brand-pink-600 text-brand-pink-600 bg-brand-pink-50/50 rounded-t-xl"
                  : "border-transparent text-surface-500 hover:text-surface-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {ar() ? "سجل الجلسات (Sessions)" : "Sessions Log"}
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-surface-200 text-surface-700">
                {sessions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("requests")}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === "requests"
                  ? "border-brand-pink-600 text-brand-pink-600 bg-brand-pink-50/50 rounded-t-xl"
                  : "border-transparent text-surface-500 hover:text-surface-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {ar() ? "طلبات الحجز (Requests)" : "Booking Requests"}
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-surface-200 text-surface-700">
                {requests.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("scans")}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === "scans"
                  ? "border-brand-pink-600 text-brand-pink-600 bg-brand-pink-50/50 rounded-t-xl"
                  : "border-transparent text-surface-500 hover:text-surface-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              {ar() ? "سجلات الفحص (QR Scans)" : "QR Scans"}
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-surface-200 text-surface-700">
                {scans.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("memberships")}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeSubTab === "memberships"
                  ? "border-brand-pink-600 text-brand-pink-600 bg-brand-pink-50/50 rounded-t-xl"
                  : "border-transparent text-surface-500 hover:text-surface-800"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {ar() ? "العضويات (Memberships)" : "Memberships"}
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-surface-200 text-surface-700">
                {memberships.length}
              </span>
            </button>
          </div>

          {/* Sub-Tab 1: Unified Timeline */}
          {activeSubTab === "timeline" && (
            <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-surface-900">{ar() ? "المخطط الزمني الموحد لرحلة العميل" : "Unified Journey Timeline"}</h4>
                  <p className="text-xs text-surface-500 mt-0.5">{ar() ? "تسلسل زمني يجمع كافة الأحداث (الطلبات، الفحوصات، والجلسات الفعلية)" : "Chronological feed of all customer touchpoints"}</p>
                </div>
              </div>

              {timelineEvents.length === 0 ? (
                <div className="text-center py-12 text-surface-400 text-sm">{ar() ? "لا توجد أحداث مسجلة" : "No timeline events recorded"}</div>
              ) : (
                <div className="relative border-l-2 rtl:border-r-2 rtl:border-l-0 border-surface-200 ml-4 rtl:mr-4 rtl:ml-0 space-y-6">
                  {timelineEvents.map((ev) => {
                    let typeBadge = "";
                    let iconColor = "";
                    if (ev.type === "session") {
                      typeBadge = ar() ? "جلسة (Session)" : "Session";
                      iconColor = "bg-brand-pink-500";
                    } else if (ev.type === "request") {
                      typeBadge = ar() ? "طلب حجز (Request)" : "Booking Request";
                      iconColor = "bg-indigo-500";
                    } else {
                      typeBadge = ar() ? "فحص باركود (QR Scan)" : "QR Scan Check-in";
                      iconColor = "bg-teal-500";
                    }

                    return (
                      <div key={ev.id} className="relative pl-6 rtl:pr-6 rtl:pl-0 group">
                        {/* Dot */}
                        <div className={`absolute -left-2.5 rtl:-right-2.5 rtl:left-auto top-1.5 w-5 h-5 rounded-full border-4 border-white ${iconColor} shadow-sm`} />

                        <div className="bg-surface-50 hover:bg-surface-100/70 transition-colors p-4 rounded-xl border border-surface-200">
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-white text-surface-700 border border-surface-200">
                                  {typeBadge}
                                </span>
                                <h5 className="text-sm font-black text-surface-900">{ev.title}</h5>
                                {ev.code && (
                                  <span className="font-mono text-xs font-bold text-surface-500 bg-surface-200 px-2 py-0.5 rounded">
                                    {ev.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-surface-600 mt-1 flex items-center gap-2 flex-wrap font-medium">
                                <span className="text-brand-pink-600 font-bold">{ev.clinicName}</span>
                                {ev.detail && <span>• {ev.detail}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge status={ev.status} />
                              {ev.payment && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  ev.payment === "paid"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {ev.payment === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
                                </span>
                              )}
                              <span className="text-xs font-mono text-surface-400 shrink-0">
                                {ev.timestamp ? fmtDateTime(ev.timestamp) : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sub-Tab 2: Sessions Table */}
          {activeSubTab === "sessions" && (
            <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-surface-900">{ar() ? "سجل الجلسات الفعلي (Booking Sessions)" : "Active & Completed Sessions"}</h4>
                  <p className="text-xs text-surface-500">{ar() ? "الجلسات المسجلة في جدول المواعيد" : "Confirmed sessions on clinic calendars"}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-surface-200 rounded-xl">
                <table className="data-table whitespace-nowrap min-w-full">
                  <thead>
                    <tr>
                      <th>{ar() ? "الرمز" : "Code"}</th>
                      <th>{ar() ? "العيادة" : "Clinic"}</th>
                      <th>{ar() ? "الخدمة / الباقة" : "Service"}</th>
                      <th>{ar() ? "تاريخ الموعد" : "Scheduled At"}</th>
                      <th>{ar() ? "الحالة" : "Status"}</th>
                      <th>{ar() ? "الدفع" : "Payment"}</th>
                      <th>{ar() ? "ملاحظات" : "Notes"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-surface-400">
                          {ar() ? "لا توجد جلسات مسجلة لهذا العميل" : "No sessions found for this customer"}
                        </td>
                      </tr>
                    ) : (
                      sessions.map((s) => (
                        <tr key={s.id}>
                          <td className="font-mono text-xs font-bold text-brand-pink-600">{s.shortId || s.id.slice(-6)}</td>
                          <td className="font-bold text-surface-800">{ar() ? s.clinicNameAr : s.clinicNameEn}</td>
                          <td className="font-medium text-surface-700">{s.offerName}</td>
                          <td className="font-mono text-xs font-medium text-surface-800">
                            {s.scheduledAt ? fmtDateTime(s.scheduledAt) : "—"}
                          </td>
                          <td><StatusBadge status={s.status} /></td>
                          <td>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                              s.clinicPaymentStatus === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}>
                              {s.clinicPaymentStatus === "paid" ? (ar() ? "مدفوع" : "Paid") : (ar() ? "معلق" : "Pending")}
                            </span>
                          </td>
                          <td className="text-xs text-surface-500 max-w-[200px] truncate" title={s.notes || ""}>{s.notes || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Booking Requests Table */}
          {activeSubTab === "requests" && (
            <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-surface-900">{ar() ? "طلبات الحجز (Booking Requests)" : "Booking Requests"}</h4>
                  <p className="text-xs text-surface-500">{ar() ? "سجل كافة الطلبات والتغييرات المقترحة من الإدارة والعيادة" : "Request logs and proposed slots"}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-surface-200 rounded-xl">
                <table className="data-table whitespace-nowrap min-w-full">
                  <thead>
                    <tr>
                      <th>{ar() ? "العيادة" : "Clinic"}</th>
                      <th>{ar() ? "الخدمة / الباقة" : "Service"}</th>
                      <th>{ar() ? "موعد مقترح من الإدارة" : "Admin Suggested Date"}</th>
                      <th>{ar() ? "الموعد المعدل من العيادة" : "Clinic Scheduled Date"}</th>
                      <th>{ar() ? "تاريخ الطلب" : "Request Date"}</th>
                      <th>{ar() ? "الحالة" : "Status"}</th>
                      <th>{ar() ? "الملاحظات" : "Notes"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {requests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-surface-400">
                          {ar() ? "لا توجد طلبات حجز مسجلة لهذا العميل" : "No booking requests found for this customer"}
                        </td>
                      </tr>
                    ) : (
                      requests.map((r) => (
                        <tr key={r.id}>
                          <td className="font-bold text-surface-800">{ar() ? r.clinicNameAr : r.clinicNameEn}</td>
                          <td className="font-medium text-surface-700">{r.offerName}</td>
                          <td className="text-amber-700 font-medium text-xs font-mono">
                            {r.adminSuggestedAt ? fmtDateTime(r.adminSuggestedAt) : "—"}
                          </td>
                          <td className="text-emerald-700 font-medium text-xs font-mono">
                            {r.clinicScheduledAt ? fmtDateTime(r.clinicScheduledAt) : "—"}
                          </td>
                          <td className="text-xs text-surface-500 font-mono">
                            {r.createdAt ? fmtDateTime(r.createdAt) : "—"}
                          </td>
                          <td><StatusBadge status={r.status} /></td>
                          <td className="text-xs text-surface-500 max-w-[200px] truncate" title={r.notes || ""}>{r.notes || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: QR Scans Table */}
          {activeSubTab === "scans" && (
            <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-surface-900">{ar() ? "سجلات فحص الباركود (QR Scan History)" : "QR Scan History"}</h4>
                  <p className="text-xs text-surface-500">{ar() ? "سجلات الحضور الفعلي للعميل في فروع العيادات عبر QR" : "Physical verification logs when customer arrived at clinics"}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-surface-200 rounded-xl">
                <table className="data-table whitespace-nowrap min-w-full">
                  <thead>
                    <tr>
                      <th>{ar() ? "العيادة" : "Clinic"}</th>
                      <th>{ar() ? "الباقة / الخدمة" : "Membership / Service"}</th>
                      <th>{ar() ? "تاريخ ووقت الفحص" : "Scan Date & Time"}</th>
                      <th>{ar() ? "نتيجة الفحص" : "Result"}</th>
                      <th>{ar() ? "تم الفحص بواسطة" : "Scanned By"}</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {scans.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-surface-400">
                          {ar() ? "لا توجد سجلات فحص QR لهذا العميل" : "No QR scans recorded for this customer"}
                        </td>
                      </tr>
                    ) : (
                      scans.map((sc) => (
                        <tr key={sc.id}>
                          <td className="font-bold text-surface-800">{ar() ? sc.clinicNameAr : sc.clinicNameEn}</td>
                          <td className="font-medium text-surface-700">{sc.offerName}</td>
                          <td className="font-mono text-xs font-bold text-brand-pink-600">
                            {sc.scannedAt ? fmtDateTime(sc.scannedAt) : "—"}
                          </td>
                          <td><StatusBadge status={sc.status} /></td>
                          <td className="text-xs text-surface-600">{sc.scannedBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab 5: Memberships Cards */}
          {activeSubTab === "memberships" && (
            <div className="bg-white border border-surface-200 rounded-2xl p-6 shadow-sm">
              <div className="mb-4">
                <h4 className="text-base font-black text-surface-900">{ar() ? "العضويات والباقات المسجلة" : "Customer Memberships & Packages"}</h4>
                <p className="text-xs text-surface-500">{ar() ? "الباقات المشترك بها ورصيد الجلسات والكاش باك" : "Enrolled packages, session balance, and cashback"}</p>
              </div>

              {memberships.length === 0 ? (
                <div className="text-center py-12 text-surface-400 text-sm">{ar() ? "لا توجد عضويات مسجلة" : "No memberships found"}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {memberships.map((m) => (
                    <div key={m.id} className="border border-surface-200 rounded-2xl p-4 bg-surface-50 hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h5 className="font-black text-surface-900 text-sm truncate">{m.offerName}</h5>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="space-y-1.5 text-xs text-surface-600 mt-3 pt-3 border-t border-surface-200">
                        <div className="flex justify-between">
                          <span>{ar() ? "الجلسات المستهلكة:" : "Sessions Used:"}</span>
                          <span className="font-bold text-surface-900">{m.sessionsUsed} / {m.maxSessions ?? "∞"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{ar() ? "تاريخ الاشتراك:" : "Enrolled On:"}</span>
                          <span className="font-mono">{m.createdAt ? fmtDate(m.createdAt) : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{ar() ? "صالح حتى:" : "Valid Until:"}</span>
                          <span className="font-mono">{m.validUntil ? fmtDate(m.validUntil) : "—"}</span>
                        </div>
                        {parseFloat(m.cashbackBalanceKwd || "0") > 0 && (
                          <div className="flex justify-between text-brand-pink-600 font-bold">
                            <span>{ar() ? "رصيد الكاش باك:" : "Cashback Balance:"}</span>
                            <span>{m.cashbackBalanceKwd} KWD</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
