import { useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "../lib/api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../app/AuthContext";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

export type ClinicChangeModalProps = {
  modal: { type: "membership" | "session" | "request"; id: string; currentClinicId: string; defaultFee: string };
  onClose: () => void;
};

export default function ClinicChangeModal({ modal, onClose }: ClinicChangeModalProps) {
  const { getAuthHeader } = useAuth();
  const { data: clinicsData } = useApi<{ items: any[] }>("/clinics");

  const [newClinicId, setNewClinicId] = useState(modal.currentClinicId || "");
  const [isPaidTransfer, setIsPaidTransfer] = useState(false);
  const [transferFee, setTransferFee] = useState(modal.defaultFee);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-slide-up relative">
        <button
          className="absolute top-5 right-5 text-surface-400 hover:text-surface-900 transition-colors"
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <h3 className="text-xl font-bold text-surface-900 mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-brand-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          {ar() ? "تغيير عيادة تقديم الخدمة" : "Change Clinic"}
        </h3>
        <p className="text-xs text-surface-500 -mt-3 mb-5">
          {ar() ? "تغيير عيادة تقديم الخدمة للمريض." : "Transfer the service clinic for the patient."}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "العيادة الجديدة" : "New Clinic"}</label>
            <select
              className="select-field w-full"
              value={newClinicId}
              onChange={e => setNewClinicId(e.target.value)}
            >
              <option value="">-- {ar() ? "اختر العيادة" : "Select Clinic"} --</option>
              {(clinicsData?.items || []).map((c: any) => (
                <option key={c.id} value={c.id}>{ar() ? c.nameAr : c.nameEn}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-bold text-surface-900 block mb-2">{ar() ? "رسوم تغيير العيادة" : "Transfer Fee"}</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="csDashPaidTransfer"
                  checked={!isPaidTransfer}
                  onChange={() => {
                    setIsPaidTransfer(false);
                    setTransferFee("0.000");
                    setTransferError(null);
                  }}
                  className="text-brand-pink-500 focus:ring-brand-pink-400"
                />
                <span className="text-sm font-medium">{ar() ? "مجاني (إعفاء)" : "Free (Waive)"}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="csDashPaidTransfer"
                  checked={isPaidTransfer}
                  onChange={() => {
                    setIsPaidTransfer(true);
                    setTransferFee(modal.defaultFee);
                    setTransferError(null);
                  }}
                  className="text-brand-pink-500 focus:ring-brand-pink-400"
                />
                <span className="text-sm font-medium">{ar() ? "مدفوع (خصم رسوم)" : "Paid (Charge Fee)"}</span>
              </label>
            </div>
          </div>

          {isPaidTransfer && (
            <div className="animate-slide-down">
              <label className="text-xs font-bold text-surface-700 block mb-1.5">{ar() ? "مبلغ الرسوم (د.ك)" : "Fee Amount (KWD)"}</label>
              <input
                type="number"
                min="0"
                step="0.001"
                className="input-field w-full text-sm bg-surface-50"
                value={transferFee}
                onChange={e => {
                  setTransferFee(e.target.value);
                  setTransferError(null);
                }}
              />
            </div>
          )}

          {transferError && (
            <div className="text-xs text-red-500 font-semibold bg-red-50 p-3 rounded-xl border border-red-200 animate-pulse">
              {transferError}
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            className="flex-1 bg-surface-100 hover:bg-surface-200 text-surface-700 font-bold py-3 rounded-xl transition-colors text-sm"
            onClick={onClose}
            disabled={transferSaving}
          >
            {ar() ? "إلغاء" : "Cancel"}
          </button>
          <button
            className="flex-1 bg-brand-pink-500 hover:bg-brand-pink-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm text-sm"
            disabled={transferSaving || !newClinicId}
            onClick={async () => {
              setTransferSaving(true);
              setTransferError(null);

              try {
                const path = modal.type === "membership"
                  ? `/commerce/admin/user-offers/${modal.id}/change-clinic`
                  : modal.type === "request"
                  ? `/scheduling/admin/requests/${modal.id}/change-clinic`
                  : `/scheduling/admin/sessions/${modal.id}/change-clinic`;

                await apiFetch(path, {
                  method: "POST",
                  headers: getAuthHeader(),
                  body: JSON.stringify({
                    clinicId: newClinicId,
                    isPaid: isPaidTransfer,
                    feeAmount: isPaidTransfer ? Number(transferFee).toFixed(3) : "0.000"
                  })
                });

                onClose();
                window.location.reload();
              } catch (e: any) {
                setTransferError(e.message || "Failed to transfer clinic");
              } finally {
                setTransferSaving(false);
              }
            }}
          >
            {transferSaving ? "…" : (ar() ? "تأكيد ونقل" : "Confirm & Transfer")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
