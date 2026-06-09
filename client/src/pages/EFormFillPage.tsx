import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import i18n from "../app/i18n";
import { useAuth } from "../app/AuthContext";
import { apiFetch, API_BASE_URL } from "../lib/api";
import { FormRenderer, FormDefinition } from "../components/FormRenderer";

const ar = () => i18n.language === "ar";

export default function EFormFillPage() {
  const { auth, getAuthHeader } = useAuth();
  const { formId } = useParams<{ formId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const userOfferId = params.get("userOfferId") || undefined;
  const targetOfferId = params.get("offerId") || undefined;
  const returnTo = params.get("return") || "/dashboard";

  const [form, setForm] = useState<FormDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"fill" | "review" | "done">("fill");

  useEffect(() => {
    if (!formId || !auth) return;
    setLoading(true);
    apiFetch(`/eforms/forms/${formId}`, { headers: getAuthHeader() })
      .then((d: any) => setForm(d.form))
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [formId, auth]);

  if (!auth) return <div className="p-8 text-center"><Link to="/login" className="text-brand-pink-600 font-bold">{ar() ? "سجلي الدخول" : "Sign in"}</Link></div>;
  if (loading) return <div className="p-8 text-surface-400">{ar() ? "جاري التحميل…" : "Loading…"}</div>;
  if (error || !form) return <div className="p-8 text-red-600">{error ?? "Not found"}</div>;

  const setVal = (key: string, v: any) => setValues((s) => ({ ...s, [key]: v }));

  const validate = (): string | null => {
    for (const f of form.fields) {
      if (!f.required) continue;
      if (f.type === "signature") {
        if (!signature) return ar() ? `${f.labelEn} مطلوب` : `${f.labelEn} is required`;
        continue;
      }
      if (f.type === "file_upload") {
        if (files.length === 0) return ar() ? `${f.labelEn} مطلوب` : `${f.labelEn} is required`;
        continue;
      }
      const v = values[f.key];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
        return ar() ? `${f.labelEn} مطلوب` : `${f.labelEn} is required`;
      }
    }
    return null;
  };

  const goReview = () => {
    const err = validate();
    if (err) return alert(err);
    setStep("review");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const answers = form.fields
        .filter((f) => f.type !== "signature" && f.type !== "file_upload")
        .map((f) => ({ key: f.key, value: values[f.key] ?? null }));
      await apiFetch("/eforms/submit", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify({
          formId: form.id,
          userOfferId,
          targetKind: targetOfferId ? "offer" : "ad_hoc",
          targetRefId: targetOfferId,
          answers,
          signatureDataUrl: signature || undefined,
          uploadedFileRefs: files
        })
      });
      setStep("done");
      setTimeout(() => navigate(returnTo), 1500);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const token = (getAuthHeader() as any)?.Authorization?.replace("Bearer ", "");
    try {
      const r = await fetch(`${API_BASE_URL}/eforms/uploads`, {
        method: "POST",
        body: fd,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setFiles((s) => [...s, data.ref]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white border-b border-surface-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link to={returnTo} className="text-sm font-bold text-surface-500">← {ar() ? "رجوع" : "Back"}</Link>
        <h1 className="text-base font-bold text-surface-900 truncate">{ar() && form.titleAr ? form.titleAr : form.title}</h1>
        <div className="w-10" />
      </header>

      <main className="max-w-2xl mx-auto p-4 lg:p-8">
        {step === "fill" && (
          <div className="animate-fade-in">
            <FormRenderer
              form={form}
              values={values}
              signature={signature}
              files={files}
              onValueChange={setVal}
              onSignatureChange={setSignature}
              onFileUpload={handleFileUpload}
            />
            <button type="button" className="btn-primary w-full btn-lg mt-5" onClick={goReview}>
              {ar() ? "مراجعة وإرسال" : "Review & sign"}
            </button>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold">{ar() ? "تأكيد الإجابات" : "Confirm your answers"}</h2>
            <div className="card-elevated p-4 space-y-3">
              {form.fields.map((f) => {
                const label = ar() && f.labelAr ? f.labelAr : f.labelEn;
                let display: any = "—";
                if (f.type === "signature") display = signature ? (ar() ? "✓ تم التوقيع" : "✓ Signed") : "—";
                else if (f.type === "file_upload") display = files.length ? `${files.length} ${ar() ? "ملف" : "file(s)"}` : "—";
                else {
                  const v = values[f.key];
                  if (Array.isArray(v)) display = v.join(", ");
                  else if (v !== undefined && v !== null && v !== "") display = String(v);
                }
                return (
                  <div key={f.key} className="border-b border-surface-100 last:border-0 pb-2 last:pb-0">
                    <div className="text-xs font-bold text-surface-500">{label}</div>
                    <div className="text-sm text-surface-900">{display}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setStep("fill")}>{ar() ? "تعديل" : "Edit"}</button>
              <button type="button" className="btn-primary flex-1" disabled={submitting} onClick={() => void submit()}>
                {submitting ? (ar() ? "جاري الإرسال…" : "Submitting…") : ar() ? "إرسال نهائي" : "Submit & sign"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-surface-900">{ar() ? "تم الإرسال بنجاح" : "Form submitted"}</h2>
            <p className="text-sm text-surface-500 mt-1">{ar() ? "جاري التحويل…" : "Redirecting…"}</p>
          </div>
        )}
      </main>
    </div>
  );
}
