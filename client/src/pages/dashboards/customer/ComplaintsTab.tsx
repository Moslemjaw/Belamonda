// "activeTab === "profile" && profileSubTab === "complaints"" section of the customer dashboard (moved unchanged from CustomerDashboard.tsx).
import { apiFetch } from "../../../lib/api";
import { ar } from "./shared";
import type { CustomerDashboardState } from "./useCustomerDashboard";

export function ComplaintsTab({ s }: { s: CustomerDashboardState }) {
  const { complaintForm, getAuthHeader, setActiveTab, setChatConvId, setComplaintForm, setSysAlert } = s;
  return (
    <section id="sec-complaints" className="animate-fade-in scroll-mt-24">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                </div>
                <div>
                  <h2 className="text-base font-black text-surface-900">{ar() ? "الشكاوى والدعم" : "Complaints & Support"}</h2>
                  <p className="text-xs text-surface-400">{ar() ? "قدم شكوى أو تواصل مع خدمة العملاء" : "Submit a complaint or contact support"}</p>
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
                        <option value="clinic">{ar() ? "شكوى على عيادة" : "Clinic Complaint"}</option>
                        <option value="service_quality">{ar() ? "مشكلة في التطبيق" : "App Issue"}</option>
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

                <div className="bg-brand-pink-50/50 rounded-3xl p-5 border border-brand-pink-100 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm">
                    <svg className="w-6 h-6 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-surface-900 mb-1">{ar() ? "هل تحتاج لمساعدة فورية؟" : "Need immediate help?"}</h3>
                    <p className="text-sm text-surface-600 mb-3">{ar() ? "تحدث مباشرة مع فريق خدمة العملاء لدينا." : "Chat directly with our customer support team."}</p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await apiFetch("/chat/conversations/cs", { method: "POST", headers: getAuthHeader() }) as any;
                          if (res.conversation?.id) {
                            setChatConvId(res.conversation.id);
                          } else {
                            setChatConvId(undefined);
                          }
                        } catch (e) {
                          console.error(e);
                          setChatConvId(undefined);
                        }
                        setActiveTab("chat");
                      }}
                      className="text-xs font-bold bg-white border border-brand-pink-200 text-brand-pink-600 hover:bg-brand-pink-50 px-4 py-2 rounded-xl transition-colors shadow-sm"
                    >
                      {ar() ? "فتح المحادثة" : "Open Live Chat"}
                    </button>
                  </div>
                </div>
              </div>
            </section>
  );
}
