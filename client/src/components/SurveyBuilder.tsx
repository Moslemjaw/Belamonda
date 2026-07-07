import React from "react";
import { useTranslation } from "react-i18next";
import { SurveyQuestion } from "./SurveyRenderer";

interface SurveyBuilderProps {
  questions: SurveyQuestion[];
  onChange: (questions: SurveyQuestion[]) => void;
}

export function SurveyBuilder({ questions, onChange }: SurveyBuilderProps) {
  const { t, i18n } = useTranslation();
  const ar = () => i18n.language === "ar";

  const addQuestion = () => {
    const newQ: SurveyQuestion = {
      key: `q_${Date.now()}`,
      type: "short_text",
      labelEn: "",
      required: false
    };
    onChange([...questions, newQ]);
  };

  const updateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    const next = [...questions];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const removeQuestion = (index: number) => {
    const next = [...questions];
    next.splice(index, 1);
    onChange(next);
  };

  const moveQuestion = (index: number, dir: number) => {
    if (index + dir < 0 || index + dir >= questions.length) return;
    const next = [...questions];
    const temp = next[index];
    next[index] = next[index + dir];
    next[index + dir] = temp;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={q.key} className="p-4 border border-surface-200 rounded-xl bg-surface-50 relative group">
          <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => moveQuestion(idx, -1)} className="p-1 hover:bg-surface-200 rounded text-surface-500">
              ↑
            </button>
            <button type="button" onClick={() => moveQuestion(idx, 1)} className="p-1 hover:bg-surface-200 rounded text-surface-500">
              ↓
            </button>
            <button type="button" onClick={() => removeQuestion(idx)} className="p-1 hover:bg-red-100 rounded text-red-500 ml-2">
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-24">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-surface-700 mb-1">{ar() ? "نوع السؤال" : "Question Type"}</label>
              <select 
                className="input-field w-full text-sm" 
                value={q.type} 
                onChange={e => updateQuestion(idx, { type: e.target.value as any, options: e.target.value.includes("choice") ? [] : undefined })}
              >
                <option value="short_text">{ar() ? "نص قصير" : "Short Text"}</option>
                <option value="long_text">{ar() ? "نص طويل" : "Long Text"}</option>
                <option value="single_choice">{ar() ? "خيار واحد" : "Single Choice"}</option>
                <option value="multi_choice">{ar() ? "خيارات متعددة" : "Multiple Choice"}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-surface-700 mb-1">{ar() ? "السؤال (إنجليزي)" : "Question (English)"}</label>
              <input 
                type="text" 
                required 
                className="input-field w-full text-sm" 
                value={q.labelEn} 
                onChange={e => updateQuestion(idx, { labelEn: e.target.value })} 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-surface-700 mb-1">{ar() ? "السؤال (عربي)" : "Question (Arabic)"}</label>
              <input 
                type="text" 
                className="input-field w-full text-sm" 
                value={q.labelAr || ""} 
                onChange={e => updateQuestion(idx, { labelAr: e.target.value })} 
              />
            </div>

            {(q.type === "single_choice" || q.type === "multi_choice") && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-surface-700 mb-1">{ar() ? "الخيارات (افصل بينها بفاصلة ,)" : "Options (Comma separated)"}</label>
                <input 
                  type="text" 
                  required 
                  className="input-field w-full text-sm" 
                  value={(q.options || []).join(", ")} 
                  onChange={e => updateQuestion(idx, { options: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} 
                  placeholder={ar() ? "خيار 1, خيار 2, خيار 3" : "Option 1, Option 2, Option 3"}
                />
              </div>
            )}

            <div className="sm:col-span-2 flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id={`req_${q.key}`} 
                checked={q.required || false} 
                onChange={e => updateQuestion(idx, { required: e.target.checked })}
                className="w-4 h-4 text-brand-pink-600 rounded"
              />
              <label htmlFor={`req_${q.key}`} className="text-sm font-bold text-surface-700 cursor-pointer">
                {ar() ? "إجابة مطلوبة" : "Required Field"}
              </label>
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addQuestion} className="w-full py-3 border-2 border-dashed border-surface-300 rounded-xl text-surface-500 font-bold hover:bg-surface-50 hover:text-brand-pink-600 hover:border-brand-pink-300 transition-colors">
        + {ar() ? "إضافة سؤال" : "Add Question"}
      </button>
    </div>
  );
}
