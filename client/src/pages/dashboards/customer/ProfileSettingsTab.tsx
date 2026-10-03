// "activeTab === "profile" && profileSubTab === "settings"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function ProfileSettingsTab({ s }: { s: CustomerDashboardState }) {
  const { cardData, getAuthHeader, isEditingProfile, kycStatus, logout, profileForm, refetchProfile, setIsEditingProfile, setProfileForm, setShowKyc } = s;
  return (
    <section id="sec-settings" className="space-y-5 animate-fade-in scroll-mt-24">

              {/* Profile Hero Card */}
              <div className="relative rounded-3xl overflow-hidden bg-brand-gradient p-6 text-white shadow-glow">
                <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 80% 20%, white 0%, transparent 60%)"}} />
                <div className="relative flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center shrink-0 shadow-lg">
                    <span className="text-2xl font-black text-white select-none">
                      {(profileForm.name || profileForm.username || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">{ar() ? "حسابي" : "My Account"}</div>
                    <div className="text-xl font-black leading-tight truncate">{profileForm.name || profileForm.username}</div>
                    <div className="text-sm text-white/70 mt-0.5 font-mono truncate" dir="ltr">{profileForm.username ? `@${profileForm.username}` : profileForm.phone}</div>
                  </div>
                  <div className="ms-auto shrink-0">
                    {kycStatus === 'approved' ? (
                      <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/30">
                        <svg className="w-3.5 h-3.5 text-emerald-300" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span className="text-xs font-bold text-white">{ar() ? "موثق" : "Verified"}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 bg-amber-400/30 backdrop-blur-sm px-3 py-1.5 rounded-full border border-amber-300/40">
                        <svg className="w-3.5 h-3.5 text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                        <span className="text-xs font-bold text-amber-100">{ar() ? "غير موثق" : "Unverified"}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Details Card */}
              <div className="bg-white rounded-3xl border border-surface-200 overflow-hidden shadow-sm">
                <div className="flex justify-between items-center px-6 py-4 border-b border-surface-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-brand-pink-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <span className="font-bold text-surface-900">{ar() ? "البيانات الشخصية" : "Personal Details"}</span>
                  </div>
                  {!isEditingProfile ? (
                    <button onClick={() => setIsEditingProfile(true)} className="text-brand-pink-600 text-sm font-bold hover:text-brand-pink-700 bg-brand-pink-50 hover:bg-brand-pink-100 px-4 py-1.5 rounded-xl transition-colors">
                      {ar() ? "تعديل" : "Edit Profile"}
                    </button>
                  ) : (
                    <button onClick={async () => {
                      try {
                        await apiFetch("/users/me", {
                          method: "PATCH",
                          headers: getAuthHeader(),
                          body: JSON.stringify({
                            username: profileForm.username,
                            fullName: profileForm.name,
                            phone: profileForm.phone,
                            email: profileForm.email
                          })
                        });
                        setIsEditingProfile(false);
                        refetchProfile();
                      } catch (e: any) {
                        alert(e.message || "Failed to update profile");
                      }
                    }} className="text-emerald-600 text-sm font-bold hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-1.5 rounded-xl transition-colors flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {ar() ? "حفظ التغييرات" : "Save Changes"}
                    </button>
                  )}
                </div>
                <div className="p-6 grid gap-0 divide-y divide-surface-50">
                  {/* Username row */}
                  <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "اسم المستخدم" : "Username"}</div>
                        {isEditingProfile ? (
                          <input type="text" className="input-field py-1 text-sm" value={profileForm.username} onChange={e => setProfileForm({...profileForm, username: e.target.value})} dir="ltr" />
                        ) : (
                          profileForm.username ? (
                            <div className="font-bold text-brand-pink-600 font-mono text-sm">@{profileForm.username}</div>
                          ) : (
                            <div className="text-sm text-surface-400">{ar() ? "غير محدد" : "Not set"}</div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Full Name row */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "الاسم الكامل" : "Full Name"}</div>
                        {isEditingProfile ? (
                          <input type="text" className="input-field py-1 text-sm" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                        ) : (
                          <div className="font-semibold text-surface-900 text-sm">{profileForm.name}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Phone row */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "رقم الهاتف" : "Phone Number"}</div>
                        {isEditingProfile ? (
                          <input type="text" className="input-field py-1 text-sm" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} dir="ltr" />
                        ) : (
                          <div className="font-semibold text-surface-900 text-sm" dir="ltr">{profileForm.phone}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Email row */}
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                        <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "البريد الإلكتروني" : "Email Address"}</div>
                        {isEditingProfile ? (
                          <input type="email" className="input-field py-1 text-sm" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} dir="ltr" />
                        ) : (
                          <div className="font-semibold text-surface-900 text-sm">{profileForm.email}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Civil ID row (Only visible if Civil ID is present in cardData) */}
                  {cardData?.card?.civilIdNumberMasked && (
                    <div className="flex items-center justify-between py-4 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-surface-100 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.333 0 4 .667 4 2v1H5v-1c0-1.333 2.667-2 4-2z"/></svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-surface-400 mb-0.5">{ar() ? "الرقم المدني" : "Civil ID"}</div>
                          <div className="font-semibold text-surface-900 text-sm font-mono">{cardData.card.civilIdNumberMasked}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* KYC Verification Card */}
              <div className={`rounded-3xl border overflow-hidden ${kycStatus === 'approved' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                <div className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${kycStatus === 'approved' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                      {kycStatus === 'approved' ? (
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      ) : (
                        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-surface-500 mb-1">{ar() ? "التحقق الرقمي (KYC)" : "Digital KYC Verification"}</div>
                      <div className={`font-black text-lg ${kycStatus === 'approved' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {kycStatus === 'approved' ? (ar() ? "✓ هويتك موثقة" : "✓ Identity Verified") : (ar() ? "هويتك غير موثقة" : "Identity Unverified")}
                      </div>
                      {kycStatus === 'approved' && cardData?.card?.civilIdNumberMasked && (
                        <div className="text-xs text-emerald-800/80 mt-1 font-mono font-bold">
                          {ar() ? `الرقم المدني: ${cardData.card.civilIdNumberMasked}` : `Civil ID: ${cardData.card.civilIdNumberMasked}`}
                        </div>
                      )}
                      {(kycStatus === 'unverified' || kycStatus === 'rejected') && (
                        <p className="text-xs text-amber-700/80 mt-1.5 max-w-xs leading-relaxed">
                          {kycStatus === 'rejected' 
                            ? (ar() ? "تم رفض التوثيق السابق أو تم إلغاء توثيق حسابك من قبل الإدارة. يرجى التحديث وتقديم الطلب مجدداً." : "Your previous verification was rejected or your account was unverified by admin. Please resubmit.") 
                            : (ar() ? "أكملي التوثيق لتفعيل الدفع، شراء الباقات، وإدارة الكاش باك." : "Complete verification to enable payments, packages, and cashback.")}
                        </p>
                      )}
                    </div>
                  </div>
                  {(kycStatus === 'unverified' || kycStatus === 'rejected') && (
                    <button onClick={() => setShowKyc(true)} className="btn-primary shrink-0 shadow-md px-6">
                      {ar() ? "ابدأ التوثيق الآن" : "Start Verification"}
                    </button>
                  )}
                </div>
              </div>

              {/* Log Out */}
              <button onClick={logout} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-surface-500 hover:text-red-500 font-bold py-4 rounded-3xl border border-surface-200 hover:border-red-200 transition-all group">
                <svg className="w-4 h-4 group-hover:text-red-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                {ar() ? "تسجيل الخروج" : "Log Out"}
              </button>
            </section>
  );
}
