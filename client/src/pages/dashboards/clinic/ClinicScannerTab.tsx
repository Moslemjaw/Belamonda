import { useState, useEffect, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useAuth } from "../../../app/AuthContext";
import { apiFetch } from "../../../lib/api";
import { fmtDate, fmtDateTime } from "../../../lib/dateFormat";
import { ar, AdjustCashbackModal } from "./shared";
import { ScanTabs } from "./ScanTabs";

export function ClinicScannerTab({ clinicId, onMarkSession }: { clinicId?: string; onMarkSession: (sessionId: string, status: string, posData?: any) => Promise<void> }) {
  const { getAuthHeader } = useAuth();
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Today's Expected Scans State
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState<{ total: number; attended: number; awaiting: number; noShow: number; cancelled: number } | null>(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayFilter, setTodayFilter] = useState<"all" | "awaiting" | "attended">("all");
  const [todaySearch, setTodaySearch] = useState("");

  const fetchTodayExpected = useCallback(async () => {
    if (!clinicId) return;
    setTodayLoading(true);
    try {
      const res: any = await apiFetch(`/scheduling/clinic/${clinicId}/today-expected-scans`, {
        headers: getAuthHeader(),
      });
      setTodayItems(res.items || []);
      setTodayStats(res.stats || null);
    } catch {
      setTodayItems([]);
      setTodayStats(null);
    } finally {
      setTodayLoading(false);
    }
  }, [clinicId, getAuthHeader]);

  useEffect(() => {
    fetchTodayExpected();
  }, [fetchTodayExpected]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isStopped = false;

    if (showScanner) {
      html5QrCode = new Html5Qrcode("qr-reader", { 
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minDim * 0.75);
          return { width: size, height: size };
        }, aspectRatio: 1.0 },
        (decodedText) => {
          if (isStopped) return;
          
          let extracted = decodedText.trim();
          const match = extracted.match(/\/verify\/([a-f0-9]+)/i);
          if (match) extracted = match[1];
          if (extracted.length < 10) return; // Ignore false positives and keep scanning

          isStopped = true;
          setToken(decodedText);
          setShowScanner(false);
          try {
            html5QrCode?.stop().catch(() => {}).finally(() => html5QrCode?.clear());
          } catch (e) {}
          handleScan(decodedText, true);
        },
        () => {}
      ).catch((err) => {
        console.error(err);
        setError(ar() ? "تعذر تشغيل الكاميرا. تحقق من الصلاحيات." : "Could not start camera. Check permissions.");
      });

      return () => {
        isStopped = true;
        try {
          html5QrCode?.stop().catch(() => {}).finally(() => html5QrCode?.clear());
        } catch (e) {}
      };
    }
  }, [showScanner]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [showAdjustCb, setShowAdjustCb] = useState(false);
  const [showNoScheduledModal, setShowNoScheduledModal] = useState(false);
  const [showAttendedModal, setShowAttendedModal] = useState(false);
  const [scannedSessionInfo, setScannedSessionInfo] = useState<{ scheduledAt?: string | null; shownAt?: string | null }>({});

  const handleScan = async (scanToken?: string, isInitialScan: boolean = false) => {
    const rawInput = scanToken ?? token;
    if (!rawInput.trim()) return;
    
    // Extract token from URL if full URL was pasted
    let extracted = rawInput.trim();
    const match = extracted.match(/\/verify\/([a-f0-9]+)/i);
    if (match) extracted = match[1];
    
    if (isInitialScan) {
      setLoading(true);
      setError(null);
      setResult(null);
    }
    try {
      const data = await apiFetch<any>(`/public/clinic/scan/${extracted}${isInitialScan ? "" : "?refresh=1"}`, {
        headers: getAuthHeader(),
      });
      setResult(data);

      if (isInitialScan) {
        const scanTime = new Date().toISOString();
        const clinicScheduledSessions = (data?.clinicSessions || []).filter((s: any) => s.status === "scheduled" || s.status === "slot_assigned");
        const currentSession = clinicScheduledSessions[0];
        const matchedBooking = (data?.clinicBookings || []).find((b: any) => b.scheduledSessionId === currentSession?.id || b.id === currentSession?.id);

        setScannedSessionInfo({
          scheduledAt: currentSession?.scheduledAt || matchedBooking?.clinicScheduledAt || matchedBooking?.proposedAt || null,
          shownAt: matchedBooking?.shownAt || scanTime
        });

        if (clinicScheduledSessions.length > 0) {
          await handleMarkSession(currentSession.id, "completed");
        } else {
          setShowNoScheduledModal(true);
          // The scan was still logged — refresh today's list (handleMarkSession does this otherwise)
          fetchTodayExpected();
        }
      }
    } catch (e: any) {
      if (isInitialScan) {
        setError(e.message || (ar() ? "لم يتم العثور على العميل" : "Customer not found"));
      }
    } finally {
      if (isInitialScan) {
        setLoading(false);
      }
    }
  };

  const handleMarkSession = async (sessionId: string, status: string, posData?: any) => {
    setMarkingId(sessionId);
    // Optimistically update only the session list in state without refreshing the entire card
    setResult((prev: any) => {
      if (!prev) return prev;
      const updatedSessions = (prev.clinicSessions || []).map((s: any) =>
        s.id === sessionId ? { ...s, status: status, completedAt: status === "completed" ? new Date().toISOString() : s.completedAt } : s
      );
      const updatedBookings = (prev.clinicBookings || []).map((b: any) =>
        (b.scheduledSessionId === sessionId || b.id === sessionId) ? { ...b, status: status } : b
      );
      return { ...prev, clinicSessions: updatedSessions, clinicBookings: updatedBookings };
    });

    try {
      await onMarkSession(sessionId, status, posData);
      if (status === "completed") {
        setShowAttendedModal(true);
      }
      // Silently sync latest background data
      await handleScan(undefined, false);
      // Keep "Today's Expected Customers" in step with the scan/attendance just recorded
      fetchTodayExpected();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setMarkingId(null);
    }
  };

  const card = result?.card;
  const clinicSessions = result?.clinicSessions ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-surface-900">{ar() ? "ماسح بطاقة العضوية" : "Membership Card Scanner"}</h2>
        <p className="text-sm text-surface-500 mt-1">{ar() ? "امسح رمز QR من بطاقة العميل أو أدخل الرمز يدوياً لعرض بياناته." : "Scan the QR code from the customer's card or enter the token manually."}</p>
      </div>

      {/* Scanner input */}
      <div className="card-elevated p-6 bg-gradient-to-br from-surface-50 to-white">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="w-5 h-5 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleScan(undefined, true); }}
              placeholder={ar() ? "أدخل رمز البطاقة أو الصق رابط QR..." : "Enter card token or paste QR link..."}
              className="input-field text-sm py-3 pl-11 pr-4 w-full bg-white"
              dir="ltr"
            />
          </div>
          <button
            onClick={() => setShowScanner(!showScanner)}
            className={`px-4 py-3 rounded-xl flex items-center justify-center gap-2 shrink-0 border transition-colors ${showScanner ? 'bg-red-50 text-red-600 border-red-200' : 'bg-surface-50 hover:bg-surface-100 text-surface-700 border-surface-200'}`}
            title={ar() ? "مسح عبر الكاميرا" : "Scan via Camera"}
          >
            {showScanner ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )}
          </button>
          <button
            onClick={() => handleScan(undefined, true)}
            disabled={loading || !token.trim()}
            className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            )}
            {ar() ? "بحث" : "Search"}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            {error}
          </div>
        )}

        {showScanner && (
          <div className="mt-4 rounded-xl overflow-hidden border border-surface-200 bg-black">
            <div id="qr-reader" className="w-full"></div>
          </div>
        )}
      </div>

      {/* Results */}
      {card && (() => {
        const scanKyc = result?.kyc;
        const scanMemberships = result?.memberships ?? [];
        const scanPayments = result?.payments ?? [];
        const scanBookings = result?.clinicBookings ?? [];
        const SCAN_TABS = [
          { key: "info", label: ar() ? "المعلومات" : "Info" },
          { key: "memberships", label: ar() ? "العضويات" : "Memberships" },
          { key: "sessions", label: ar() ? "الجلسات" : "Sessions" },
          { key: "payments", label: ar() ? "المدفوعات" : "Payments" },
          { key: "kyc", label: ar() ? "الهوية" : "KYC / ID" },
        ];
        return (
        <div className="space-y-5 animate-fade-in">
          {/* Customer Profile Card */}
          <div className="bg-white/80 backdrop-blur-xl border border-surface-200/60 shadow-lg shadow-surface-200/20 rounded-[32px] overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-pink-500/5 rounded-bl-full -z-10" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-tr-full -z-10" />
            
            <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-brand-pink-500 rounded-[20px] rotate-3 opacity-20"></div>
                  <div className="h-20 w-20 rounded-[20px] bg-gradient-to-br from-brand-pink-50 to-white flex items-center justify-center text-3xl font-black text-brand-pink-600 shadow-sm border border-brand-pink-100/50 relative z-10">
                    {(card.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-black text-surface-900 tracking-tight">{card.displayName}</div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2">
                    {card.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-surface-600 font-mono" dir="ltr">
                        <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {card.phone}
                      </div>
                    )}
                    {card.email && (
                      <div className="flex items-center gap-1.5 text-sm text-surface-600">
                        <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {card.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {card.kycVerified && (
                      <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        {ar() ? "هوية موثقة" : "ID Verified"}
                      </span>
                    )}
                    {card.memberSince && (
                      <span className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-2.5 py-1 rounded-lg bg-surface-100/80">
                        {ar() ? "عضو منذ" : "Since"} {fmtDate(card.memberSince)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="bg-surface-50/50 border-t border-surface-200/50 p-4 sm:p-6 grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6 relative z-10">
              <div className="flex flex-col justify-center">
                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-pink-500 hidden sm:block"></div>
                  {ar() ? "عضويات فعالة" : "Active Offers"}
                </div>
                <div className="text-2xl font-black text-surface-900">{scanMemberships.filter((m: any) => m.status === "active").length}</div>
              </div>
              <div className="flex flex-col justify-center relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-8 bg-surface-200/50 hidden sm:block"></div>
                <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider mb-1 flex items-center gap-1.5 sm:pl-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 hidden sm:block"></div>
                  {ar() ? "جلسات مجدولة" : "Scheduled"}
                </div>
                <div className="text-2xl font-black text-surface-900 sm:pl-6">{card.activeSessionCount ?? 0}</div>
              </div>
              <div className="col-span-2 sm:col-span-1 border-t sm:border-t-0 border-surface-200/50 pt-4 sm:pt-0 flex flex-col justify-center relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-8 bg-surface-200/50 hidden sm:block"></div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 flex items-center gap-1.5 sm:pl-6">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 hidden sm:block"></div>
                  {ar() ? "كاشباك متاح" : "Cashback"}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 sm:pl-6 flex-wrap">
                  <div className="text-xl sm:text-2xl font-black text-emerald-600 truncate">{card.cashbackUnlockedKwd ?? "0.000"}</div>
                  <button onClick={() => setShowAdjustCb(true)} className="btn-ghost btn-sm text-[10px] bg-white border border-surface-200 rounded-lg shadow-sm shrink-0">
                    {ar() ? "تعديل" : "Adjust"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <ScanTabs maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} clinicProducts={result?.clinicProducts ?? []} tabs={SCAN_TABS} kyc={scanKyc} memberships={scanMemberships} payments={scanPayments} clinicSessions={clinicSessions} clinicBookings={scanBookings} markingId={markingId} onMarkSession={handleMarkSession} onUpdatePrice={async (bookingId: string, newPriceKwd: string) => {
            try {
              await apiFetch(`/scheduling/requests/${bookingId}/update-price`, {
                method: "POST",
                headers: getAuthHeader(),
                body: JSON.stringify({ sessionPriceKwd: newPriceKwd })
              });
              await handleScan();
            } catch (e: any) { alert(e.message); }
          }} onMarkPaid={async (id: string, posData?: any) => {
            try {
              await apiFetch(`/scheduling/requests/${id}/mark-paid`, { 
                method: "POST", 
                headers: getAuthHeader(),
                body: JSON.stringify(posData || {})
              });
              await handleScan();
            } catch (e: any) { alert(e.message); }
          }} />
          <AdjustCashbackModal isOpen={showAdjustCb} onClose={() => setShowAdjustCb(false)} maxCashbackKwd={card.cashbackUnlockedKwd ?? "0.000"} onAdjust={async (amountKwd, reason) => {
            await apiFetch("/public/clinic/wallet/adjust", {
              method: "POST", headers: getAuthHeader(), body: JSON.stringify({ userId: result?.card?.userId, amountKwd, reason })
            });
            await handleScan();
          }} />

          {/* No Scheduled Sessions Warning Modal */}
          {showNoScheduledModal && (
            <div className="fixed inset-0 z-[100] bg-surface-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative border border-surface-200 text-center animate-scale-up">
                <button 
                  onClick={() => setShowNoScheduledModal(false)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-900 flex items-center justify-center transition-colors font-bold text-base"
                >
                  ✕
                </button>

                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 shadow-inner">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-surface-900 mb-1 leading-tight">
                  {ar() ? "لا يوجد موعد مجدول" : "No Scheduled Session"}
                </h3>

                {card?.displayName && (
                  <div className="my-4 p-4 bg-red-50/80 border border-red-200/80 rounded-2xl text-center space-y-2">
                    <div className="text-base font-black text-red-950 flex items-center justify-center gap-2">
                      <span className="text-lg">👤</span>
                      <span>{card.displayName}</span>
                    </div>
                    <div className="pt-2 border-t border-red-200/60 flex items-center justify-between text-xs text-red-900 font-semibold px-2">
                      <span>{ar() ? "تاريخ الحضور / المسح:" : "Shown date:"}</span>
                      <span className="font-mono text-sm font-bold bg-white/90 text-red-950 px-2.5 py-1 rounded-lg border border-red-200 shadow-sm">
                        {fmtDateTime(scannedSessionInfo.shownAt || new Date())}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-sm text-surface-600 leading-relaxed mb-6">
                  {ar() 
                    ? `العميل (${card?.displayName || ""}) ليس لديه أي جلسة مجدولة حالياً. يرجى التواصل مع فريق بيلاموندو.` 
                    : `Customer (${card?.displayName || ""}) does not have any scheduled session. Please contact the Belamonda team.`}
                </p>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={() => {
                      setShowNoScheduledModal(false);
                      window.open("https://wa.me/", "_blank");
                    }}
                    className="w-full py-3.5 px-5 bg-brand-pink-500 hover:bg-brand-pink-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-pink-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.572-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                    </svg>
                    {ar() ? "التواصل مع بيلاموندو" : "Contact Belamonda Team"}
                  </button>
                  <button
                    onClick={() => setShowNoScheduledModal(false)}
                    className="w-full py-3 px-5 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-2xl font-bold transition-colors"
                  >
                    {ar() ? "إغلاق" : "Close"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Attendance Success Confirmation Modal */}
          {showAttendedModal && (
            <div className="fixed inset-0 z-[100] bg-surface-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative border border-surface-200 text-center animate-scale-up">
                <button 
                  onClick={() => setShowAttendedModal(false)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-900 flex items-center justify-center transition-colors font-bold text-base"
                >
                  ✕
                </button>

                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 shadow-inner">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-surface-900 mb-1 leading-tight">
                  {ar() ? "تم تسجيل الحضور بنجاح" : "Attendance Recorded Successfully"}
                </h3>

                {card?.displayName && (
                  <div className="my-4 p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl text-center space-y-2">
                    <div className="text-base font-black text-emerald-950 flex items-center justify-center gap-2">
                      <span className="text-lg">👤</span>
                      <span>{card.displayName}</span>
                    </div>
                    <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900 font-semibold px-2">
                      <span>{ar() ? "تاريخ الحضور / المسح:" : "Shown date:"}</span>
                      <span className="font-mono text-sm font-bold bg-white/90 text-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm">
                        {fmtDateTime(scannedSessionInfo.shownAt || new Date())}
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-sm text-surface-600 leading-relaxed mb-6">
                  {ar() 
                    ? `تم تسجيل حضور العميل (${card?.displayName || ""}) للجلسة بنجاح وتحديث بيانات الجلسة.` 
                    : `The attendance for customer (${card?.displayName || ""}) has been recorded successfully.`}
                </p>

                <button
                  onClick={() => setShowAttendedModal(false)}
                  className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {ar() ? "تم" : "Done"}
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Today's Expected Scans & Attendance Section */}
      <div className="card-elevated p-6 bg-white border border-surface-200 rounded-2xl shadow-sm space-y-5 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-pink-50 flex items-center justify-center text-brand-pink-600 shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-surface-900">
                  {ar() ? "مواعيد اليوم المتوقع حضورهم ومسحهم" : "Today's Expected Customers to Scan"}
                </h3>
                <p className="text-xs text-surface-500 mt-0.5">
                  {ar() ? "العملاء المجدولين لزيارة العيادة اليوم مع حالة الحضور والمسح" : "Customers scheduled to visit today with their scan & attendance status"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {todayStats && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-surface-100 font-bold text-surface-700">
                  {ar() ? "الإجمالي:" : "Total:"} {todayStats.total}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {ar() ? "حضر:" : "Attended:"} {todayStats.attended}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  {ar() ? "في الانتظار:" : "Awaiting:"} {todayStats.awaiting}
                </span>
              </div>
            )}
            <button
              onClick={fetchTodayExpected}
              disabled={todayLoading}
              className="p-2 rounded-xl border border-surface-200 hover:bg-surface-50 text-surface-600 transition-colors shrink-0"
              title={ar() ? "تحديث" : "Refresh"}
            >
              <svg className={`w-4 h-4 ${todayLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search & Filter pills */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <svg className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={ar() ? "بحث بالاسم أو الهاتف..." : "Filter by name or phone..."}
              value={todaySearch}
              onChange={(e) => setTodaySearch(e.target.value)}
              className="input-field text-xs py-2 pl-9 pr-3 w-full"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setTodayFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                todayFilter === "all" ? "bg-brand-pink-500 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
              }`}
            >
              {ar() ? "الكل" : "All"} ({todayItems.length})
            </button>
            <button
              onClick={() => setTodayFilter("awaiting")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                todayFilter === "awaiting" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {ar() ? "في انتظار المسح" : "Awaiting Scan"} ({todayStats?.awaiting ?? 0})
            </button>
            <button
              onClick={() => setTodayFilter("attended")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                todayFilter === "attended" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {ar() ? "تم الحضور" : "Attended"} ({todayStats?.attended ?? 0})
            </button>
          </div>
        </div>

        {/* List / Table */}
        <div className="overflow-x-auto border border-surface-200 rounded-xl">
          <table className="data-table whitespace-nowrap min-w-full">
            <thead>
              <tr>
                <th>{ar() ? "الموعد" : "Time"}</th>
                <th>{ar() ? "العميل" : "Customer"}</th>
                <th>{ar() ? "الخدمة / الباقة" : "Service"}</th>
                <th>{ar() ? "حالة الحضور" : "Attending Status"}</th>
                <th>{ar() ? "حالة المسح (QR)" : "Scan Status"}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {(() => {
                const filteredTodayItems = todayItems.filter((item) => {
                  if (item.status === "slot_assigned" || item.status === "request_received") return false;
                  if (todayFilter === "awaiting" && item.attendanceStatus !== "awaiting" && item.attendanceStatus !== "checked_in") return false;
                  if (todayFilter === "attended" && item.attendanceStatus !== "attended") return false;
                  if (todaySearch.trim()) {
                    const q = todaySearch.trim().toLowerCase();
                    const name = (item.customerName || "").toLowerCase();
                    const phone = (item.customerPhone || "").toLowerCase();
                    return name.includes(q) || phone.includes(q);
                  }
                  return true;
                });

                if (filteredTodayItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-surface-400">
                        {todayLoading
                          ? (ar() ? "جاري التحميل..." : "Loading today's schedule...")
                          : (ar() ? "لا توجد مواعيد مطابقة لهذا اليوم" : "No matching appointments scheduled for today")}
                      </td>
                    </tr>
                  );
                }

                return filteredTodayItems.map((it) => {
                  const isAttended = it.attendanceStatus === "attended";
                  
                  return (
                    <tr key={it.id} className="hover:bg-surface-50 transition-colors">
                      <td className="font-mono text-xs font-bold text-surface-900">
                        {it.scheduledAt
                          ? new Date(it.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "—"}
                      </td>
                      <td>
                        <div className="font-bold text-surface-900">{it.customerName}</div>
                        {it.customerPhone && <div className="text-xs text-surface-500 font-mono">{it.customerPhone}</div>}
                      </td>
                      <td className="font-medium text-surface-700 text-xs">
                        {it.offerName}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isAttended
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : it.attendanceStatus === "no_show"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : it.attendanceStatus === "cancelled"
                            ? "bg-surface-100 text-surface-600 border-surface-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {it.attendanceStatus === "attended" ? (ar() ? "حضر" : "Attended")
                            : it.attendanceStatus === "checked_in" ? (ar() ? "وصل" : "Checked In")
                            : it.attendanceStatus === "no_show" ? (ar() ? "لم يحضر" : "No Show")
                            : it.attendanceStatus === "cancelled" ? (ar() ? "ملغي" : "Cancelled")
                            : (ar() ? "في الانتظار" : "Awaiting")}
                        </span>
                      </td>
                      <td>
                        {it.hasScannedToday ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{ar() ? "تم المسح" : "Scanned"}</span>
                            {it.scannedAt && (
                              <span className="font-mono text-[11px] text-surface-400">
                                ({new Date(it.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-surface-400 font-medium">
                            {ar() ? "لم يتم المسح بعد" : "Not scanned yet"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
