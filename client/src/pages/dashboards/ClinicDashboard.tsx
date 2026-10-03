import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useClinicSchedule, useClinicStats, invalidateCache } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import ClinicBookingRequestsTab from "./ClinicBookingRequestsTab";
import ClinicMissedSessionsTab from "./ClinicMissedSessionsTab";
import ChatWidget from "../../components/ChatWidget";
import ShareLinkPage from "../../components/ShareLinkPage";
import NoticeBanner from "../../components/NoticeBanner";
import { KpiCard } from "../../components/KpiCard";
import { UserProfilePanel } from "./admin/UserProfilePanel";
import { ar, RescheduleModal, ClinicPerformanceTab } from "./clinic/shared";
import { SessionCard } from "./clinic/SessionCard";
import { ScheduleTable } from "./clinic/ScheduleTable";
import { ClinicInvoicesTab } from "./clinic/ClinicInvoicesTab";
import { ClinicCompletedSessionsTab } from "./clinic/ClinicCompletedSessionsTab";
import { ClinicReportsTab } from "./clinic/ClinicReportsTab";
import { ClinicScannerTab } from "./clinic/ClinicScannerTab";

// Re-exported for existing importers.
export { SESSION_STATUS_STYLE } from "./clinic/shared";

export default function ClinicDashboard() {
  const { t } = useTranslation();
  const { auth, getAuthHeader } = useAuth();
  const [activeNav, setActiveNav] = useState("home");
  const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "all">("today");
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [clinicSaving, setClinicSaving] = useState(false);
  const [clinicSaveMsg, setClinicSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [chatConvId, setChatConvId] = useState<string | undefined>(undefined);
  const [complaintForm, setComplaintForm] = useState({ category: "other", subject: "", description: "" });
  const [sysAlert, setSysAlert] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [missedCount, setMissedCount] = useState(0);
  const [requestsCount, setRequestsCount] = useState(0);
  
  // Clinic staff accounts are linked to a clinicId from backend auth.
  // Fall back to the old demo clinic ids only if missing.
  const CLINIC_ID = auth?.clinicId || auth?.userId || "clinic_fallback";
  const [clinicData, setClinicData] = useState<{nameEn: string, nameAr: string}>({ nameEn: "Loading...", nameAr: "جاري التحميل..." });

  useEffect(() => {
     apiFetch(`/clinics/${CLINIC_ID}`).then((res: any) => {
        if (res.clinic) {
           setClinicData({ nameEn: res.clinic.nameEn, nameAr: res.clinic.nameAr });
           setSettingsForm({
             nameEn: res.clinic.nameEn || "",
             nameAr: res.clinic.nameAr || "",
             address: res.clinic.address || "Kuwait City",
             contactName: res.clinic.contactName || "Admin",
             contactPhone: res.clinic.contactPhone || res.clinic.phone || "+965 —",
             contactEmail: res.clinic.contactEmail || `contact@clinic.com`
           });
        }
     }).catch(() => {
        setClinicData({ nameEn: "Clinic Dashboard", nameAr: "لوحة العيادة" });
     });
  }, [CLINIC_ID]);

  const [settingsForm, setSettingsForm] = useState({
    nameEn: clinicData.nameEn,
    nameAr: clinicData.nameAr,
    address: "Kuwait City",
    contactName: "Admin",
    contactPhone: "+965 90000000",
    contactEmail: `contact@clinic.com`
  });
  const { data, loading, refetch } = useClinicSchedule(CLINIC_ID);
  const { data: statsData } = useClinicStats(CLINIC_ID);
  useEffect(() => {
    const t = window.setInterval(() => {
      void refetch();
    }, 60_000);
    return () => window.clearInterval(t);
  }, [refetch]);

  const sessions = data?.items || [];
  const scheduledAppointments = sessions.filter(s => s.status === "scheduled" || s.status === "slot_accepted" || s.status === "confirmed");
  const scheduled = scheduledAppointments;
  const completed = sessions.filter(s => s.status === "completed");
  const noShows = sessions.filter(s => s.status === "no_show");

  const [rescheduleSessionId, setRescheduleSessionId] = useState<string | null>(null);

  const markSession = async (sessionId: string, status: string, posData?: any) => {
    try {
      await apiFetch(`/scheduling/clinic/sessions/${sessionId}/mark`, {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ status, notes: `Marked as ${status}`, ...(posData || {}) }),
      });
      invalidateCache("/scheduling/clinic/");
      void refetch(true);
    } catch (e: any) { alert(e.message); }
  };

  const rescheduleSession = async (sessionId: string, scheduledAt: string, forceOverride: boolean = false) => {
    try {
      await apiFetch(`/scheduling/clinic/sessions/${sessionId}/reschedule`, {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ scheduledAt, forceOverride: forceOverride || undefined }),
      });
      invalidateCache("/scheduling/clinic/");
      void refetch(true);
      setRescheduleSessionId(null);
    } catch (e: any) {
      if (e?.message === "INTERVAL_WARNING" || e?.data?.code === "INTERVAL_WARNING" || e?.data?.error === "INTERVAL_WARNING") {
        const warnMsg = (ar() ? e.data?.messageAr : e.data?.message) || e.data?.messageAr || e.data?.message || (ar() ? "الموعد المختار يبعد أقل من 25 يوماً عن آخر جلسة للعميلة." : "The selected date is less than 25 days from the last completed session.");
        const promptMsg = ar()
          ? `⚠️ تنبيه فترة التباعد:\n\n${warnMsg}\n\nهل تريد إعادة الجدولة وتجاوز التنبيه؟`
          : `⚠️ Interval Warning:\n\n${warnMsg}\n\nDo you want to reschedule anyway and override this warning?`;
        if (window.confirm(promptMsg)) {
          return rescheduleSession(sessionId, scheduledAt, true);
        }
        return;
      }
      alert(e.message);
    }
  };

  const saveClinicSettings = async () => {
    setClinicSaving(true);
    setClinicSaveMsg(null);
    try {
      const res: any = await apiFetch("/clinics/me", {
        method: "PATCH",
        headers: getAuthHeader(),
        body: JSON.stringify({
          nameEn: settingsForm.nameEn,
          nameAr: settingsForm.nameAr,
          address: settingsForm.address,
          contactName: settingsForm.contactName,
          contactPhone: settingsForm.contactPhone,
          contactEmail: settingsForm.contactEmail,
        }),
      });
      if (res.clinic) {
        setClinicData({ nameEn: res.clinic.nameEn, nameAr: res.clinic.nameAr });
      }
      setIsEditingSettings(false);
      setClinicSaveMsg({ type: "ok", text: ar() ? "تم الحفظ بنجاح!" : "Saved successfully!" });
      setTimeout(() => setClinicSaveMsg(null), 4000);
    } catch (e: any) {
      setClinicSaveMsg({ type: "err", text: e.message || (ar() ? "فشل الحفظ" : "Save failed") });
    } finally {
      setClinicSaving(false);
    }
  };

  const markPaidFromSchedule = async (bookingRequestId: string) => {
    try {
      await apiFetch(`/scheduling/requests/${bookingRequestId}/mark-paid`, {
        method: "POST",
        headers: getAuthHeader(),
      });
      refetch();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "scanner", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>, label: ar() ? "ماسح البطاقة" : "Scan Card" },
    { key: "chat", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>, label: ar() ? "محادثات الحجوزات" : "Booking Chat" },
    { key: "booking_requests", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, label: ar() ? "طلبات الحجز" : "Booking Requests" },
    { key: "schedule", icon: Icons.calendar, label: t("schedule") },
    { key: "missed_sessions", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: ar() ? "الجلسات الفائتة" : "Missed Sessions" },
    { key: "invoices", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, label: ar() ? "سجل الجلسات" : "Sessions Log" },
    { key: "completed_sessions", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: ar() ? "الجلسات المكتملة" : "Completed Sessions" },
    // { key: "reports", icon: Icons.report, label: ar() ? "التقارير" : "Reports" },
    // { key: "performance", icon: Icons.chart, label: ar() ? "الأداء" : "Performance" },
    { key: "complaints", icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>, label: ar() ? "الشكاوى والدعم" : "Complaints & Support" },
    { key: "profile", icon: Icons.profile, label: ar() ? "الملف الشخصي" : "Profile & Settings" },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة العيادة" : "Clinic Dashboard"} subtitle={ar() ? `${clinicData.nameAr} — جدول اليوم` : `${clinicData.nameEn} — Today's Schedule`} banner={<NoticeBanner />}>
      <div className="space-y-6 animate-fade-in">
        {activeNav === "home" && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 mb-10">
              <KpiCard icon={Icons.calendar} label={ar() ? "إجمالي المواعيد" : "Total Sessions"} value={statsData?.stats?.total ?? sessions.length} isHighlighted accent="pink" />
              <KpiCard icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label={ar() ? "مجدولة" : "Scheduled"} value={statsData?.stats?.scheduled ?? scheduled.length} accent="blue" />
              <KpiCard icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label={ar() ? "مكتملة" : "Completed"} value={statsData?.stats?.completed ?? completed.length} accent="emerald" />
              <KpiCard icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} label={ar() ? "لم يحضر" : "No Show"} value={statsData?.stats?.no_show ?? noShows.length} accent="red" />
            </div>

            {/* Dashboard 3-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">

              {/* ── Column 1: Appointments (2 cols) ── */}
              <div className="lg:col-span-2 xl:col-span-2 min-w-0">
                <div className="bg-white rounded-[28px] border border-surface-200/80 shadow-sm overflow-hidden h-full flex flex-col">
                  {/* Section header */}
                  <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-surface-100 bg-gradient-to-r from-white to-surface-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-brand-pink-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                          <h3 className="text-base font-black text-surface-900">{ar() ? "المواعيد" : "Appointments"}</h3>
                          <p className="text-[11px] text-surface-400 font-medium mt-0.5">{ar() ? "إدارة المواعيد المجدولة" : "Manage your scheduled sessions"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                        <div className="flex bg-surface-100/60 p-0.5 rounded-xl border border-surface-200/50">
                          <button onClick={() => setDateFilter("today")} className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold whitespace-nowrap transition-all ${dateFilter === "today" ? "bg-white text-brand-pink-600 shadow-sm border border-surface-200/50" : "text-surface-500 hover:text-surface-700"}`}>{ar() ? "اليوم" : "Today"}</button>
                          <button onClick={() => setDateFilter("tomorrow")} className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold whitespace-nowrap transition-all ${dateFilter === "tomorrow" ? "bg-white text-brand-pink-600 shadow-sm border border-surface-200/50" : "text-surface-500 hover:text-surface-700"}`}>{ar() ? "غداً" : "Tomorrow"}</button>
                          <button onClick={() => setDateFilter("all")} className={`px-3 py-1.5 rounded-[10px] text-[11px] font-bold whitespace-nowrap transition-all ${dateFilter === "all" ? "bg-white text-brand-pink-600 shadow-sm border border-surface-200/50" : "text-surface-500 hover:text-surface-700"}`}>{ar() ? "الكل" : "All"}</button>
                        </div>
                        <button className="p-2 bg-white border border-surface-200 shadow-sm rounded-xl hover:bg-surface-50 transition-colors shrink-0" onClick={() => { invalidateCache("/scheduling/clinic/"); void refetch(true); }} title="Refresh">
                          <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* Section body */}
                  <div className="p-4 sm:p-5 flex-1 overflow-y-auto" style={{ maxHeight: '700px' }}>
                    {loading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="shimmer h-56 rounded-2xl" />)}</div>
                    ) : scheduledAppointments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-surface-50 rounded-2xl flex items-center justify-center text-3xl mb-4 border border-surface-100">📅</div>
                        <h4 className="text-sm font-bold text-surface-700 mb-1">{ar() ? "الجدول فارغ" : "Your schedule is clear"}</h4>
                        <p className="text-xs text-surface-400 max-w-[200px]">{ar() ? "لا توجد مواعيد مجدولة لهذه العيادة حالياً." : "No appointments scheduled for this clinic."}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {scheduledAppointments
                          .filter(s => {
                            if (dateFilter === "all") return true;
                            const d = new Date(s.scheduledAt);
                            const today = new Date();
                            if (dateFilter === "today") return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                            if (dateFilter === "tomorrow") {
                              const tomorrow = new Date(today);
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              return d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
                            }
                            return true;
                          })
                          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
                          .map(s => (
                          <SessionCard key={s.id} session={s} onMarkPaid={markPaidFromSchedule} onReschedule={(id) => setRescheduleSessionId(id)} />
                        ))}
                        {scheduledAppointments.filter(s => {
                            if (dateFilter === "all") return true;
                            const d = new Date(s.scheduledAt);
                            const today = new Date();
                            if (dateFilter === "today") return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                            if (dateFilter === "tomorrow") {
                              const tomorrow = new Date(today);
                              tomorrow.setDate(tomorrow.getDate() + 1);
                              return d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth() && d.getFullYear() === tomorrow.getFullYear();
                            }
                            return true;
                          }).length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                              <div className="w-12 h-12 bg-surface-50 rounded-xl flex items-center justify-center text-2xl mb-3 border border-surface-100">🔍</div>
                              <p className="text-xs font-medium text-surface-400">{ar() ? "لا توجد مواعيد مطابقة للفلتر" : "No appointments match the selected filter"}</p>
                            </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Column 2: Booking Requests ── */}
              <div className="lg:col-span-1 xl:col-span-1 min-w-0">
                <div className="bg-white rounded-[28px] border border-surface-200/80 shadow-sm overflow-hidden h-full flex flex-col">
                  <div className="px-5 pt-5 pb-4 border-b border-surface-100 bg-gradient-to-r from-white to-blue-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-blue-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <div>
                          <h3 className="text-base font-black text-surface-900">{ar() ? "طلبات الحجز" : "Booking Requests"}</h3>
                          <p className="text-[11px] text-surface-400 font-medium mt-0.5">{ar() ? "مراجعة وتأكيد الطلبات" : "Review & confirm requests"}</p>
                        </div>
                      </div>
                      {requestsCount > 0 && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                          {requestsCount} {ar() ? "طلب جديد" : "new"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: '700px' }}>
                    <ClinicBookingRequestsTab clinicId={CLINIC_ID} onCountLoaded={setRequestsCount} />
                  </div>
                </div>
              </div>

              {/* ── Column 3: Missed Sessions ── */}
              <div className="lg:col-span-1 xl:col-span-1 min-w-0">
                <div className="bg-white rounded-[28px] border border-surface-200/80 shadow-sm overflow-hidden h-full flex flex-col">
                  <div className="px-5 pt-5 pb-4 border-b border-surface-100 bg-gradient-to-r from-white to-red-50/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-2xl bg-red-50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div>
                          <h3 className="text-base font-black text-surface-900">{ar() ? "الجلسات الفائتة" : "Missed Sessions"}</h3>
                          <p className="text-[11px] text-surface-400 font-medium mt-0.5">{ar() ? "إعادة جدولة أو حذف" : "Reschedule or remove"}</p>
                        </div>
                      </div>
                      {missedCount > 0 && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                          {missedCount} {ar() ? "فائتة" : "missed"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto" style={{ maxHeight: '700px' }}>
                    <ClinicMissedSessionsTab clinicId={CLINIC_ID} onCountLoaded={setMissedCount} />
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

        {activeNav === "schedule" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "جدول العيادة" : "Clinic Schedule"}</h3>
              <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg" onClick={() => { invalidateCache("/scheduling/clinic/"); void refetch(true); }}>
                ↻ {ar() ? "تحديث" : "Refresh"}
              </button>
            </div>
            <ScheduleTable sessions={sessions} onMark={markSession} onMarkPaid={markPaidFromSchedule} onSelectUser={(userId) => setSelectedUser({ id: userId })} onReschedule={(id) => setRescheduleSessionId(id)} />
          </div>
        )}

        {activeNav === "chat" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "محادثات الحجوزات" : "Booking Conversations"}</h2>
              <p className="text-sm text-surface-500 mt-1">
                {ar() ? "اقترح أوقاتاً وأكد الحجوزات مع العملاء وخدمة العملاء." : "Propose times and confirm bookings with customers and CR."}
              </p>
            </div>
            {chatConvId && (
              <div className="text-xs text-surface-500">
                {ar() ? `تم فتح محادثة الطلب: ${chatConvId.slice(0, 8)}` : `Opened from request conversation: ${chatConvId.slice(0, 8)}`}
              </div>
            )}
            <ChatWidget key={chatConvId ?? "default"} conversationId={chatConvId} showBookingActions clinicMode={true} />
          </div>
        )}
        {activeNav === "performance" && (
          <ClinicPerformanceTab clinicId={CLINIC_ID} sessions={sessions} completed={completed} noShows={noShows} scheduled={scheduled} />
        )}

        {activeNav === "invoices" && (
          <ClinicInvoicesTab clinicId={CLINIC_ID} />
        )}

        {activeNav === "completed_sessions" && (
          <ClinicCompletedSessionsTab clinicId={CLINIC_ID} />
        )}

        {activeNav === "scanner" && (
          <ClinicScannerTab clinicId={CLINIC_ID} onMarkSession={markSession} />
        )}

        {activeNav === "reports" && (
          <ClinicReportsTab clinicId={CLINIC_ID} />
        )}

        {activeNav === "booking_requests" && (
          <ClinicBookingRequestsTab clinicId={CLINIC_ID} />
        )}
        {activeNav === "missed_sessions" && (
          <ClinicMissedSessionsTab clinicId={CLINIC_ID} />
        )}

        {activeNav === "complaints" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
              </div>
              <div>
                <h2 className="text-base font-black text-surface-900">{ar() ? "الشكاوى والدعم" : "Complaints & Support"}</h2>
                <p className="text-xs text-surface-400">{ar() ? "قدم شكوى أو تواصل مع الدعم الفني" : "Submit a complaint or contact support"}</p>
              </div>
            </div>

            <div className="space-y-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!complaintForm.subject || !complaintForm.description) return;
                  try {
                    await apiFetch("/complaints/me", {
                      method: "POST",
                      headers: getAuthHeader(),
                      body: JSON.stringify(complaintForm)
                    });
                    setComplaintForm({ category: "other", subject: "", description: "" });
                    setSysAlert(ar() ? "تم إرسال الشكوى بنجاح وسيتم مراجعتها قريباً" : "Complaint submitted successfully and will be reviewed soon");
                    setTimeout(() => setSysAlert(null), 5000);
                  } catch (err: any) {
                    setSysAlert(err.message || (ar() ? "حدث خطأ أثناء إرسال الشكوى" : "Error submitting complaint"));
                    setTimeout(() => setSysAlert(null), 5000);
                  }
                }}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-surface-200 shadow-sm"
              >
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-surface-900 mb-1 block">{ar() ? "الفئة" : "Category"}</label>
                    <select
                      className="select-field w-full bg-surface-50 border-surface-200"
                      value={complaintForm.category}
                      onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })}
                    >
                      <option value="system">{ar() ? "مشكلة في النظام" : "System Issue"}</option>
                      <option value="billing">{ar() ? "مشكلة مالية" : "Billing Issue"}</option>
                      <option value="other">{ar() ? "أخرى" : "Other"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-surface-900 mb-1 block">{ar() ? "الموضوع" : "Subject"}</label>
                    <input
                      required
                      minLength={3}
                      type="text"
                      className="input-field w-full bg-surface-50 border-surface-200"
                      value={complaintForm.subject}
                      onChange={(e) => setComplaintForm({ ...complaintForm, subject: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-surface-900 mb-1 block">{ar() ? "التفاصيل" : "Description"}</label>
                    <textarea
                      required
                      minLength={10}
                      className="input-field w-full h-24 resize-none bg-surface-50 border-surface-200"
                      value={complaintForm.description}
                      onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full sm:w-auto mt-2">
                    {ar() ? "إرسال الشكوى" : "Submit Complaint"}
                  </button>
                </div>
              </form>

              {sysAlert && (
                <div className="max-w-md bg-surface-900 text-white text-sm font-medium px-4 py-3 rounded-2xl animate-fade-in">
                  {sysAlert}
                </div>
              )}
            </div>
          </div>
        )}

        {activeNav === "profile" && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold text-surface-900">{ar() ? "الملف الشخصي والإعدادات" : "Profile & Settings"}</h2>
              <p className="text-sm text-surface-500 mt-1">{ar() ? "إدارة بيانات العيادة ورابط الإحالة." : "Manage clinic details and your referral link."}</p>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                <h3 className="text-lg font-bold text-surface-900">{ar() ? "إعدادات العيادة" : "Clinic Settings"}</h3>
                <div className="flex items-center gap-2">
                  {clinicSaveMsg && (
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${clinicSaveMsg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {clinicSaveMsg.text}
                    </span>
                  )}
                  {!isEditingSettings ? (
                    <button onClick={() => { setIsEditingSettings(true); setClinicSaveMsg(null); }} className="btn-secondary btn-sm bg-white shadow-sm border border-surface-200">{ar() ? "تعديل البيانات" : "Edit Details"}</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => { setIsEditingSettings(false); setClinicSaveMsg(null); }} className="btn-secondary btn-sm">{ar() ? "إلغاء" : "Cancel"}</button>
                      <button onClick={saveClinicSettings} disabled={clinicSaving} className="btn-primary btn-sm">
                        {clinicSaving ? (ar() ? "جاري الحفظ..." : "Saving...") : (ar() ? "حفظ التعديلات" : "Save Changes")}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="card-elevated p-6 bg-gradient-to-br from-surface-50 to-white">
                  <h4 className="font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    {ar() ? "البيانات الأساسية" : "Basic Details"}
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">Clinic Name (English)</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.nameEn} onChange={e => setSettingsForm({...settingsForm, nameEn: e.target.value})} /> : <div className="text-lg font-bold text-surface-900 p-2 bg-surface-100 rounded-lg">{settingsForm.nameEn}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">اسم العيادة (عربي)</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.nameAr} onChange={e => setSettingsForm({...settingsForm, nameAr: e.target.value})} /> : <div className="text-lg font-bold text-surface-900 p-2 bg-surface-100 rounded-lg">{settingsForm.nameAr}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "الموقع / العنوان" : "Location / Address"}</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.address} onChange={e => setSettingsForm({...settingsForm, address: e.target.value})} /> : <div className="text-base font-medium text-surface-700 p-2 bg-surface-100 rounded-lg flex items-center gap-2"><svg className="w-4 h-4 text-brand-pink-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>{settingsForm.address}</div>}
                    </div>
                  </div>
                </div>

                <div className="card-elevated p-6 bg-gradient-to-br from-surface-50 to-white">
                  <h4 className="font-bold text-surface-900 mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    {ar() ? "بيانات التواصل" : "Contact Details"}
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "اسم المسؤول" : "Contact Person"}</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.contactName} onChange={e => setSettingsForm({...settingsForm, contactName: e.target.value})} /> : <div className="text-base font-bold text-surface-900 p-2 bg-surface-100 rounded-lg">{settingsForm.contactName}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "رقم الهاتف" : "Phone Number"}</label>
                      {isEditingSettings ? <input className="input-field bg-white" value={settingsForm.contactPhone} onChange={e => setSettingsForm({...settingsForm, contactPhone: e.target.value})} dir="ltr" /> : <div className="text-base font-medium text-surface-900 p-2 bg-surface-100 rounded-lg font-mono" dir="ltr">{settingsForm.contactPhone}</div>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2 block">{ar() ? "البريد الإلكتروني" : "Email Address"}</label>
                      {isEditingSettings ? <input type="email" className="input-field bg-white" value={settingsForm.contactEmail} onChange={e => setSettingsForm({...settingsForm, contactEmail: e.target.value})} dir="ltr" /> : <div className="text-base font-medium text-surface-900 p-2 bg-surface-100 rounded-lg font-mono" dir="ltr">{settingsForm.contactEmail}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-100">
                <h3 className="font-bold text-surface-900 flex items-center gap-2">
                  {Icons.share}
                  {ar() ? "رابط الإحالة" : "Referral & Share Link"}
                </h3>
              </div>
              <div className="p-6">
                <ShareLinkPage hideHeader />
              </div>
            </div>
          </div>
        )}

      </div>
      {selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <UserProfilePanel 
              user={selectedUser} 
              onClose={() => setSelectedUser(null)}
              onRoleChange={() => {}}
              onStatusChange={() => {}}
              onLoginAs={() => {}}
            />
          </div>
        </div>
      )}
      <RescheduleModal
        isOpen={!!rescheduleSessionId}
        onClose={() => setRescheduleSessionId(null)}
        onSubmit={(scheduledAt) => { if (rescheduleSessionId) rescheduleSession(rescheduleSessionId, scheduledAt); }}
      />
    </DashboardShell>
  );
}
