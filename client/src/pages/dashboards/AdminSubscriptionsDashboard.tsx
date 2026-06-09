import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

type SubscriptionPlan = {
  _id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  price: number;
  durationMonths: number;
  minimumCommitmentMonths: number;
  isActive: boolean;
};

export function AdminSubscriptionsDashboard() {
  const { getAuthHeader } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/subscriptions/plans", { headers: getAuthHeader() }) as SubscriptionPlan[];
      setPlans(data);
    } catch (e: any) {
      console.error("Failed to load plans:", e);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleCreate = async (data: Partial<SubscriptionPlan>) => {
    try {
      setSaving(true);
      await apiFetch("/subscriptions/plans", {
        method: "POST",
        headers: getAuthHeader(),
        body: JSON.stringify(data),
      });
      setIsModalOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, data: Partial<SubscriptionPlan>) => {
    try {
      setSaving(true);
      await apiFetch(`/subscriptions/plans/${id}`, {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify(data),
      });
      setIsModalOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(ar() ? "هل أنت متأكد من حذف هذه الباقة؟" : "Are you sure you want to delete this plan?")) return;
    try {
      await apiFetch(`/subscriptions/plans/${id}`, { method: "DELETE", headers: getAuthHeader() });
      fetchPlans();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleOpenNew = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">{ar() ? "إدارة باقات بيلاموندو برو" : "Belamonda Pro Plans"}</h2>
          <p className="text-sm text-surface-500 mt-1">{ar() ? "إنشاء وإدارة خطط الاشتراك والأسعار والالتزامات" : "Create and manage subscription plans, pricing, and commitment rules"}</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="btn-primary btn-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          {ar() ? "إضافة باقة" : "Add Plan"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="shimmer h-72 rounded-2xl" />)}
        </div>
      )}

      {/* Empty */}
      {!loading && plans.length === 0 && (
        <div className="card-elevated bg-white rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-pink-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-surface-900 mb-1">{ar() ? "لا توجد باقات حالياً" : "No Subscription Plans Yet"}</h3>
          <p className="text-sm text-surface-500 mb-4">{ar() ? "أنشئ أول باقة اشتراك لبيلاموندو برو" : "Create your first Belamonda Pro subscription plan"}</p>
          <button onClick={handleOpenNew} className="btn-primary btn-sm">
            {ar() ? "إضافة أول باقة" : "Create First Plan"}
          </button>
        </div>
      )}

      {/* Plan Cards */}
      {!loading && plans.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan._id} className="card-elevated bg-white rounded-2xl p-6 flex flex-col relative overflow-hidden group">
              {/* Decorative blob */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-[100px] -z-0 bg-gradient-to-br from-brand-pink-50/80 to-amber-50/40 transition-transform duration-500 group-hover:scale-110" />
              
              <div className="relative z-10 flex-1 flex flex-col">
                {/* Status badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${plan.isActive ? "bg-emerald-50 text-emerald-700" : "bg-surface-100 text-surface-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${plan.isActive ? "bg-emerald-500" : "bg-surface-400"}`} />
                    {plan.isActive ? (ar() ? "نشطة" : "Active") : (ar() ? "غير نشطة" : "Inactive")}
                  </span>
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">PRO</span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-black text-surface-900 mb-1">{ar() ? plan.nameAr : plan.nameEn}</h3>
                <p className="text-xs text-surface-500 mb-4 flex-grow line-clamp-2">{ar() ? plan.descriptionAr : plan.descriptionEn}</p>

                {/* Price */}
                <div className="flex items-end gap-1.5 mb-4">
                  <span className="text-4xl font-black bg-gradient-to-br from-brand-pink-600 to-brand-pink-500 bg-clip-text text-transparent">{plan.price.toFixed(3)}</span>
                  <div className="pb-1.5 leading-tight">
                    <span className="text-xs text-surface-500 font-bold block">KWD</span>
                    <span className="text-[10px] text-surface-400">/ {plan.durationMonths} {ar() ? "شهر" : plan.durationMonths === 1 ? "Month" : "Months"}</span>
                  </div>
                </div>

                {/* Commitment Rule */}
                <div className="bg-surface-50 rounded-xl p-3 text-sm text-surface-600 mb-5 border border-surface-100">
                  <div className="flex items-center gap-2 font-medium">
                    <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
                    {plan.minimumCommitmentMonths > 0
                      ? (ar() ? `التزام لا يقل عن ${plan.minimumCommitmentMonths} أشهر` : `Min. commitment: ${plan.minimumCommitmentMonths} Month${plan.minimumCommitmentMonths > 1 ? "s" : ""}`)
                      : (ar() ? "بدون التزام" : "No minimum commitment")
                    }
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex-1 flex items-center justify-center gap-2 bg-surface-100 hover:bg-surface-200 text-surface-700 py-2.5 rounded-xl font-bold text-sm transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    {ar() ? "تعديل" : "Edit"}
                  </button>
                  <button
                    onClick={() => handleDelete(plan._id)}
                    className="w-10 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <PlanModal
          plan={editingPlan}
          onClose={() => { setIsModalOpen(false); setEditingPlan(null); }}
          onSave={(data) => {
            if (editingPlan) {
              handleUpdate(editingPlan._id, data);
            } else {
              handleCreate(data);
            }
          }}
          isLoading={saving}
        />
      )}
    </div>
  );
}

/* ── Modal Component ── */
function PlanModal({
  plan,
  onClose,
  onSave,
  isLoading,
}: {
  plan: SubscriptionPlan | null;
  onClose: () => void;
  onSave: (data: Partial<SubscriptionPlan>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    nameEn: plan?.nameEn || "",
    nameAr: plan?.nameAr || "",
    descriptionEn: plan?.descriptionEn || "",
    descriptionAr: plan?.descriptionAr || "",
    price: plan?.price ?? 0,
    durationMonths: plan?.durationMonths ?? 1,
    minimumCommitmentMonths: plan?.minimumCommitmentMonths ?? 1,
    isActive: plan ? plan.isActive : true,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "number") {
      setFormData((prev) => ({ ...prev, [name]: Number(value) }));
    } else if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const F = (label: string, children: React.ReactNode) => (
    <div>
      <label className="text-xs font-medium text-surface-500 mb-1 block">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-surface-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-pink-50 via-white to-brand-sage-100/40 px-6 py-5 border-b border-surface-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white shadow-sm border border-brand-pink-100 flex items-center justify-center text-brand-pink-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-surface-900">
                {plan ? (ar() ? "تعديل الباقة" : "Edit Plan") : (ar() ? "إضافة باقة جديدة" : "Add New Plan")}
              </h4>
              <div className="text-xs text-surface-500 mt-0.5">{ar() ? "حدد تفاصيل باقة الاشتراك" : "Configure subscription plan details"}</div>
            </div>
          </div>
          <button onClick={onClose} className="icon-btn">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Form */}
        <form
          className="p-6 overflow-y-auto flex-1 space-y-4"
          onSubmit={(e) => { e.preventDefault(); onSave(formData); }}
        >
          <div className="grid grid-cols-2 gap-4">
            {F(ar() ? "اسم الباقة (EN)" : "Plan Name (English)", <input required name="nameEn" value={formData.nameEn} onChange={handleChange} className="input-field" placeholder="e.g. Monthly Plan" />)}
            {F(ar() ? "اسم الباقة (AR)" : "Plan Name (Arabic)", <input required name="nameAr" value={formData.nameAr} onChange={handleChange} className="input-field text-right" dir="rtl" placeholder="مثال: الباقة الشهرية" />)}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {F(ar() ? "الوصف (EN)" : "Description (English)", <textarea name="descriptionEn" value={formData.descriptionEn} onChange={handleChange} className="input-field" rows={2} />)}
            {F(ar() ? "الوصف (AR)" : "Description (Arabic)", <textarea name="descriptionAr" value={formData.descriptionAr} onChange={handleChange} className="input-field text-right" rows={2} dir="rtl" />)}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {F(ar() ? "السعر (KWD)" : "Price (KWD)", <input required type="number" step="0.001" min="0" name="price" value={formData.price} onChange={handleChange} className="input-field" />)}
            {F(ar() ? "المدة (أشهر)" : "Duration (Months)", <input required type="number" min="1" name="durationMonths" value={formData.durationMonths} onChange={handleChange} className="input-field" />)}
            {F(ar() ? "الحد الأدنى للالتزام (أشهر)" : "Min Commitment (M)", <input required type="number" min="0" name="minimumCommitmentMonths" value={formData.minimumCommitmentMonths} onChange={handleChange} className="input-field" />)}
          </div>

          {/* Active toggle */}
          <div className={`rounded-xl border p-4 transition-colors ${formData.isActive ? "border-emerald-300 bg-emerald-50/50" : "border-surface-200 bg-surface-50"}`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${formData.isActive ? "bg-emerald-500" : "bg-surface-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.isActive ? "translate-x-5" : ""}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-surface-900">
                  {formData.isActive ? (ar() ? "الباقة نشطة" : "Plan is Active") : (ar() ? "الباقة غير نشطة" : "Plan is Inactive")}
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  {formData.isActive
                    ? (ar() ? "ستظهر هذه الباقة للعملاء ويمكنهم الاشتراك" : "This plan is visible and available for purchase")
                    : (ar() ? "الباقة مخفية ولا يمكن الاشتراك بها" : "This plan is hidden and cannot be purchased")
                  }
                </div>
              </div>
            </label>
          </div>

          {/* Save/Cancel */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-surface-100">
            <button type="button" onClick={onClose} disabled={isLoading} className="btn-secondary btn-sm">
              {ar() ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary btn-sm flex items-center gap-2">
              {isLoading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {ar() ? "حفظ الباقة" : "Save Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminSubscriptionsDashboard;
