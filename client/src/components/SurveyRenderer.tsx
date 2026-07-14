import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, API_BASE_URL } from "../lib/api";

export interface SurveyQuestion {
  key: string;
  type: "short_text" | "long_text" | "single_choice" | "multi_choice";
  labelEn: string;
  labelAr?: string;
  options?: string[];
  required?: boolean;
}

interface SurveyRendererProps {
  slug: string;
  title: string;
  description: string;
  imageUrl?: string;
  questions: SurveyQuestion[];
  onSuccess?: () => void;
}

export function SurveyRenderer({ slug, title, description, imageUrl, questions, onSuccess }: SurveyRendererProps) {
  const { t, i18n } = useTranslation();
  const ar = () => i18n.language === "ar";
  
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleAnswer = (key: string, value: any) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const handleMultiChoice = (key: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      if (checked) {
        return { ...prev, [key]: [...current, option] };
      } else {
        return { ...prev, [key]: current.filter((x: string) => x !== option) };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Format answers array
    const answersArray = Object.keys(answers).map(key => ({
      key,
      value: answers[key]
    }));

    try {
      const payload = {
        answers: answersArray,
        guestName,
        guestPhone,
        guestEmail
      };

      const token = localStorage.getItem("token");
      const headers: any = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await apiFetch(`/promotions/public/${slug}/submit`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-2xl mx-auto border border-brand-pink-100">
        <div className="w-16 h-16 bg-brand-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-brand-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-2xl font-black text-surface-900 mb-2">
          {ar() ? "شكراً لك!" : "Thank You!"}
        </h2>
        <p className="text-surface-600 mb-6">
          {ar() ? "تم إرسال إجاباتك بنجاح." : "Your survey responses have been submitted successfully."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 bg-brand-pink-100 text-brand-pink-600 font-bold text-xs rounded-full mb-4 uppercase tracking-wider">
          {ar() ? "استبيان" : "Survey"}
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-surface-900 mb-4">{title}</h1>
        {imageUrl && (
          <img src={imageUrl} alt={title} className="max-w-full h-auto mx-auto rounded-2xl shadow-sm mb-6" style={{ maxHeight: '300px' }} />
        )}
        <p className="text-base sm:text-lg text-surface-600 leading-relaxed">{description}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-surface-100 space-y-8">
        {/* Form Header */}
        <div className="pb-6 border-b border-surface-100 mb-6">
          <h3 className="text-lg font-bold text-surface-900">{ar() ? "يرجى تعبئة النموذج أدناه" : "Please fill out the form below"}</h3>
        </div>

        {/* Survey Questions */}
        <div className="space-y-8">
          {questions.map((q, idx) => (
            <div key={q.key} className="space-y-3">
              <label className="block text-sm font-bold text-surface-900">
                <span className="text-brand-pink-500 mr-2">{idx + 1}.</span>
                {ar() ? q.labelAr || q.labelEn : q.labelEn}
                {q.required && <span className="text-red-500 ml-1">*</span>}
              </label>

              {q.type === "short_text" && (
                <input 
                  type="text" 
                  className="input-field w-full" 
                  required={q.required} 
                  value={answers[q.key] || ""} 
                  onChange={e => handleAnswer(q.key, e.target.value)} 
                />
              )}

              {q.type === "long_text" && (
                <textarea 
                  className="input-field w-full" 
                  rows={3} 
                  required={q.required} 
                  value={answers[q.key] || ""} 
                  onChange={e => handleAnswer(q.key, e.target.value)} 
                />
              )}

              {q.type === "single_choice" && (
                <div className="space-y-2">
                  {q.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-3 p-3 border border-surface-200 rounded-xl cursor-pointer hover:bg-surface-50 transition-colors">
                      <input 
                        type="radio" 
                        name={q.key} 
                        className="w-4 h-4 text-brand-pink-600 focus:ring-brand-pink-500" 
                        required={q.required} 
                        checked={answers[q.key] === opt}
                        onChange={() => handleAnswer(q.key, opt)} 
                      />
                      <span className="text-sm font-medium text-surface-800">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "multi_choice" && (
                <div className="space-y-2">
                  {q.options?.map((opt, i) => (
                    <label key={i} className="flex items-center gap-3 p-3 border border-surface-200 rounded-xl cursor-pointer hover:bg-surface-50 transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-brand-pink-600 rounded focus:ring-brand-pink-500" 
                        checked={(answers[q.key] || []).includes(opt)}
                        onChange={(e) => handleMultiChoice(q.key, opt, e.target.checked)} 
                      />
                      <span className="text-sm font-medium text-surface-800">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <div className="text-sm font-bold text-red-600 bg-red-50 p-4 rounded-xl">{error}</div>}

        <button 
          type="submit" 
          disabled={submitting} 
          className="btn-primary w-full py-4 text-lg shadow-sm hover:shadow transition-all"
        >
          {submitting ? "..." : (ar() ? "إرسال الإجابات" : "Submit Survey")}
        </button>
      </form>
    </div>
  );
}
