import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import DashboardShell, { Icons } from "../../components/DashboardShell";
import { useAuth } from "../../app/AuthContext";
import { useClinicSchedule } from "../../hooks/useApi";
import { apiFetch } from "../../lib/api";
import { sharedClinics } from "../../lib/clinics";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

function KpiCard({ label, value, icon, isHighlighted, iconBg = "bg-brand-pink-50", iconText = "text-brand-pink-600", iconBorder = "border-brand-pink-100" }: { label: string; value: string | number; icon: React.ReactNode; isHighlighted?: boolean; iconBg?: string; iconText?: string; iconBorder?: string; }) {
  return (
    <div className={`card-elevated p-6 flex flex-col justify-between relative overflow-hidden group ${isHighlighted ? 'bg-gradient-to-br from-brand-pink-500 to-brand-pink-700 text-white border-none shadow-brand-pink-500/30 shadow-lg' : 'bg-white'}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-10 transition-transform duration-500 group-hover:scale-110 ${isHighlighted ? 'bg-white/10' : iconBg.replace('bg-', 'bg-').concat('/50')}`} />
      <div className="flex justify-between items-start mb-6">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm backdrop-blur-md ${isHighlighted ? 'bg-white/20 text-white' : `${iconBg} ${iconText} border ${iconBorder}`}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${isHighlighted ? 'text-brand-pink-100' : 'text-surface-500'}`}>{label}</div>
        <div className={`text-4xl font-black ${isHighlighted ? 'text-white' : 'text-surface-900'}`}>{value}</div>
      </div>
    </div>
  );
}

function SessionCard({ session, onMark }: { session: any; onMark: (id: string, status: string) => void }) {
  const allGreen = session.eligibility?.offerActive && session.eligibility?.paymentConfirmed && session.eligibility?.intervalMet;
  const time = new Date(session.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = new Date(session.scheduledAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className={`card-elevated p-5 relative overflow-hidden group transition-all hover:shadow-lg flex flex-col ${!allGreen && session.status === "scheduled" ? "border-red-200 bg-red-50/10" : "bg-white"}`}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${session.status === 'completed' ? 'bg-emerald-500' : session.status === 'no_show' ? 'bg-red-500' : session.status === 'cancelled' ? 'bg-surface-300' : 'bg-brand-pink-500'}`} />
      
      <div className="flex justify-between items-start mb-5 pl-2">
        <div className="flex items-center gap-3">
           <div className="w-11 h-11 rounded-2xl bg-surface-100 flex items-center justify-center text-brand-pink-600 font-bold text-lg shadow-sm">
             {(session.userId || session.userOfferId || "?").charAt(0).toUpperCase()}
           </div>
           <div>
             <div className="text-sm font-bold text-surface-900">{session.userId || session.userOfferId?.slice(0, 12)}</div>
             <div className="text-xs text-surface-500 font-medium mt-0.5">{date}</div>
           </div>
        </div>
        <div className="text-right">
           <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 text-surface-900 text-sm font-bold shadow-sm">
             <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             {time}
           </span>
        </div>
      </div>

      <div className="space-y-2 mb-5 bg-surface-50 p-4 rounded-2xl border border-surface-100/50 pl-4 ml-2">
        {session.payment && (
          <div className="flex items-center justify-between text-xs pb-2 border-b border-surface-200">
            <span className="text-surface-600 font-medium">{ar() ? "سجل الدفع" : "Enrollment payment"}</span>
            <span className="font-bold text-surface-800">
              {session.payment.status} · {session.payment.amountKwd} KWD
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
           <span className="text-surface-600 font-medium">{ar() ? "العرض نشط" : "Offer Active"}</span>
           {session.eligibility?.offerActive ? <span className="text-emerald-600 font-bold flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Yes</span> : <span className="text-red-500 font-bold">No</span>}
        </div>
        <div className="flex items-center justify-between text-xs">
           <span className="text-surface-600 font-medium">{ar() ? "حالة الدفع" : "Payment"}</span>
           {session.eligibility?.paymentConfirmed ? <span className="text-emerald-600 font-bold flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> OK</span> : <span className="text-red-500 font-bold">Pending</span>}
        </div>
        <div className="flex items-center justify-between text-xs">
           <span className="text-surface-600 font-medium">{ar() ? "المدة المتاحة" : "Interval Met"}</span>
           {session.eligibility?.intervalMet ? <span className="text-emerald-600 font-bold flex items-center gap-1.5"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> Yes</span> : <span className="text-red-500 font-bold border-b border-dashed border-red-300 pb-0.5">Too early</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto pl-2">
        <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg ${session.status === "completed" ? "bg-emerald-100 text-emerald-700" : session.status === "no_show" ? "bg-red-100 text-red-700" : session.status === "cancelled" ? "bg-surface-200 text-surface-600" : "bg-blue-100 text-blue-700"}`}>
          {session.status.replace('_', ' ')}
        </span>
        {session.status === "scheduled" && allGreen && (
          <div className="flex gap-2">
            <button className="flex items-center gap-1 bg-emerald-500 text-white hover:bg-emerald-600 transition-colors rounded-xl px-4 py-2 text-xs font-bold shadow-sm" onClick={() => onMark(session.id, "completed")}>
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
               {ar() ? "مكتمل" : "Complete"}
            </button>
            <button className="flex items-center gap-1 bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors rounded-xl px-3 py-2 text-xs font-bold shadow-sm" onClick={() => onMark(session.id, "no_show")}>
               {ar() ? "لم يحضر" : "No Show"}
            </button>
          </div>
        )}
      </div>
      {session.cashbackUnlockedKwd && parseFloat(session.cashbackUnlockedKwd) > 0 && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-emerald-400 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm">
           +{session.cashbackUnlockedKwd} KWD
        </div>
      )}
    </div>
  );
}

export default function ClinicDashboard() {
  const { t } = useTranslation();
  const { auth, getAuthHeader } = useAuth();
  const [activeNav, setActiveNav] = useState("home");
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  // Clinic staff accounts are linked to a clinicId from backend auth.
  // Fall back to the old demo clinic ids only if missing.
  const CLINIC_ID = auth?.clinicId || auth?.userId || sharedClinics[0].id;
  const clinicData = sharedClinics.find((c) => c.id === CLINIC_ID) || sharedClinics[0];

  const [settingsForm, setSettingsForm] = useState({
    nameEn: clinicData.nameEn,
    nameAr: clinicData.nameAr,
    address: "Kuwait City",
    contactName: "Admin",
    contactPhone: "+965 90000000",
    contactEmail: `contact@${CLINIC_ID}.com`
  });
  const { data, loading, refetch } = useClinicSchedule(CLINIC_ID);

  useEffect(() => {
    const t = window.setInterval(() => {
      void refetch();
    }, 15_000);
    return () => window.clearInterval(t);
  }, [refetch]);

  const sessions = data?.items || [];
  const scheduled = sessions.filter(s => s.status === "scheduled");
  const completed = sessions.filter(s => s.status === "completed");
  const noShows = sessions.filter(s => s.status === "no_show");

  const markSession = async (sessionId: string, status: string) => {
    try {
      await apiFetch(`/scheduling/clinic/sessions/${sessionId}/mark`, {
        method: "POST", headers: getAuthHeader(),
        body: JSON.stringify({ status, notes: `Marked as ${status}` }),
      });
      refetch();
    } catch (e: any) { alert(e.message); }
  };

  const navItems = [
    { key: "home", icon: Icons.dashboard, label: t("dashboard") },
    { key: "schedule", icon: Icons.calendar, label: t("schedule") },
    { key: "performance", icon: Icons.chart, label: ar() ? "الأداء" : "Performance" },
    { key: "settings", icon: Icons.settings, label: t("settings") },
  ];

  return (
    <DashboardShell navItems={navItems} activeKey={activeNav} onNavigate={setActiveNav} title={ar() ? "لوحة العيادة" : "Clinic Dashboard"} subtitle={ar() ? `${clinicData.nameAr} — جدول اليوم` : `${clinicData.nameEn} — Today's Schedule`}>
      <div className="space-y-6 animate-fade-in">
        {(activeNav === "home" || activeNav === "schedule") && (
          <>
            {/* Stats */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <KpiCard icon={Icons.calendar} label={ar() ? "إجمالي المواعيد" : "Total Sessions"} value={sessions.length} isHighlighted />
              <KpiCard icon={Icons.calendar} label={ar() ? "مجدولة" : "Scheduled"} value={scheduled.length} iconBg="bg-blue-50" iconText="text-blue-600" iconBorder="border-blue-100" />
              <KpiCard icon={Icons.calendar} label={ar() ? "مكتملة" : "Completed"} value={completed.length} iconBg="bg-emerald-50" iconText="text-emerald-600" iconBorder="border-emerald-100" />
              <KpiCard icon={Icons.calendar} label={ar() ? "لم يحضر" : "No Show"} value={noShows.length} iconBg="bg-red-50" iconText="text-red-500" iconBorder="border-red-100" />
            </div>

            {/* Sessions Grid */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-surface-900">{ar() ? "المواعيد" : "Appointments"}</h3>
                <button className="btn-ghost btn-sm bg-white border border-surface-200 shadow-sm rounded-lg" onClick={refetch}>↻ {ar() ? "تحديث السجل" : "Refresh Log"}</button>
              </div>
              {loading ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[1,2,3,4].map(i => <div key={i} className="shimmer h-64 rounded-3xl" />)}</div>
              ) : sessions.length === 0 ? (
                <div className="card-elevated p-12 text-center flex flex-col items-center justify-center border-dashed border-2 border-surface-200 bg-surface-50/50 min-h-[300px]">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl shadow-sm mb-4">📅</div>
                  <h3 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "الجدول فارغ" : "Your schedule is clear"}</h3>
                  <div className="text-sm text-surface-500">{ar() ? "لا توجد مواعيد مجدولة لهذه العيادة حالياً." : "No appointments scheduled for this clinic at the moment."}</div>
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sessions.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)).map(s => (
                    <SessionCard key={s.id} session={s} onMark={markSession} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeNav === "performance" && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold text-surface-900">{ar() ? "أداء العيادة" : "Clinic Performance"}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
               <KpiCard icon={Icons.calendar} label={ar() ? "جلسات مكتملة" : "Completed"} value={completed.length} iconBg="bg-emerald-50" iconText="text-emerald-600" iconBorder="border-emerald-100" />
               <KpiCard icon={Icons.calendar} label={ar() ? "نسبة عدم الحضور" : "No-Show Rate"} value={`${sessions.length > 0 ? ((noShows.length / sessions.length) * 100).toFixed(1) : "0"}%`} iconBg="bg-red-50" iconText="text-red-500" iconBorder="border-red-100" />
               <KpiCard icon={Icons.chart} label={ar() ? "معدل الإكمال" : "Completion Rate"} value={`${sessions.length > 0 ? ((completed.length / sessions.length) * 100).toFixed(1) : "0"}%`} iconBg="bg-blue-50" iconText="text-blue-600" iconBorder="border-blue-100" />
               <KpiCard icon={Icons.calendar} label={ar() ? "قادمة" : "Upcoming"} value={scheduled.length} />
            </div>
            
            <div className="card-elevated p-8 min-h-[300px] flex flex-col items-center justify-center border border-surface-200">
               <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center text-surface-400 mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
               </div>
               <h3 className="text-lg font-bold text-surface-900">{ar() ? "الرسوم البيانية المتقدمة قريباً" : "Advanced Charts Coming Soon"}</h3>
               <p className="text-surface-500 mt-1 max-w-sm text-center">{ar() ? "سنقوم بتوفير تحليلات مفصلة للإيرادات والمواعيد قريباً." : "Detailed analytics for revenue and appointments will be available here soon."}</p>
            </div>
          </div>
        )}

        {activeNav === "settings" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-surface-900">{ar() ? "إعدادات العيادة" : "Clinic Settings"}</h3>
              {!isEditingSettings ? (
                <button onClick={() => setIsEditingSettings(true)} className="btn-secondary btn-sm bg-white shadow-sm border border-surface-200">{ar() ? "تعديل البيانات" : "Edit Details"}</button>
              ) : (
                <button onClick={() => { setIsEditingSettings(false); alert(ar() ? "تم الحفظ بنجاح!" : "Saved successfully!"); }} className="btn-primary btn-sm">{ar() ? "حفظ التعديلات" : "Save Changes"}</button>
              )}
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
        )}
      </div>
    </DashboardShell>
  );
}
