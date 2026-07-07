import React from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";

interface SurveySubmissionsModalProps {
  promotionId: string;
  promotionTitle: string;
  onClose: () => void;
}

export function SurveySubmissionsModal({ promotionId, promotionTitle, onClose }: SurveySubmissionsModalProps) {
  const { t, i18n } = useTranslation();
  const ar = () => i18n.language === "ar";

  const { data, isLoading, error } = useApi<{ items: any[] }>(`/promotions/admin/${promotionId}/submissions`);
  const submissions = data?.items || [];

  return (
    <div className="fixed inset-0 z-50 bg-surface-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-slide-up">
        
        <div className="flex items-center justify-between p-6 border-b border-surface-100">
          <div>
            <h2 className="text-xl font-black text-surface-900">{ar() ? "ردود الاستبيان:" : "Survey Responses:"} {promotionTitle}</h2>
            <p className="text-sm text-surface-500 mt-1">
              {isLoading ? (ar() ? "جاري التحميل..." : "Loading...") : `${submissions.length} ${ar() ? "رد" : "responses"}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 rounded-full transition-colors text-surface-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-surface-50">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-4 font-bold">{error.message || "Failed to load"}</div>
          )}

          {!isLoading && submissions.length === 0 && !error && (
            <div className="text-center text-surface-500 py-12 bg-white rounded-xl border border-surface-200">
              {ar() ? "لا توجد ردود حتى الآن." : "No responses yet."}
            </div>
          )}

          {!isLoading && submissions.length > 0 && (
            <div className="space-y-4">
              {submissions.map((sub, idx) => (
                <div key={sub._id} className="bg-white p-5 rounded-xl border border-surface-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-100 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-pink-100 text-brand-pink-700 font-bold rounded-full flex items-center justify-center">
                        #{submissions.length - idx}
                      </div>
                      <div>
                        <div className="font-bold text-surface-900">{sub.guestName || (ar() ? "مجهول" : "Anonymous")}</div>
                        <div className="text-xs text-surface-500 flex gap-3">
                          {sub.guestPhone && <span>📞 {sub.guestPhone}</span>}
                          {sub.guestEmail && <span>✉️ {sub.guestEmail}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-surface-400">
                      {new Date(sub.createdAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {sub.answers?.map((ans: any, i: number) => {
                      let valDisplay = "—";
                      if (Array.isArray(ans.value)) valDisplay = ans.value.join(", ");
                      else if (ans.value !== undefined && ans.value !== null && ans.value !== "") valDisplay = String(ans.value);
                      
                      return (
                        <div key={i} className="bg-surface-50 p-3 rounded-lg border border-surface-100">
                          <div className="text-[10px] font-bold text-surface-500 uppercase mb-1">{ans.key}</div>
                          <div className="text-sm font-semibold text-surface-900">{valDisplay}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
