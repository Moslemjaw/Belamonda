import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../lib/api";
import i18n from "../app/i18n";

const ar = () => i18n.language === "ar";

type Notice = {
  _id: string;
  message: string;
  messageAr?: string;
  isActive: boolean;
};

export default function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotice = () => {
    apiFetch("/notices/active")
      .then((res: any) => setNotice(res.notice ?? null))
      .catch(() => {});
  };

  useEffect(() => {
    fetchNotice();
    intervalRef.current = setInterval(fetchNotice, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (!notice || dismissed) return null;

  const text = (ar() && notice.messageAr) ? notice.messageAr : notice.message;

  return (
    <div
      className="w-full bg-gradient-to-r from-brand-pink-600 via-brand-pink-500 to-brand-pink-600 text-white relative overflow-hidden shadow-sm"
      style={{ minHeight: "36px" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* shimmer overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
          animation: "shimmer 3s infinite",
        }}
      />

      {/* scrolling text */}
      <div className="flex items-center h-9 overflow-hidden">
        <div
          className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-wide"
          style={{
            animation: paused
              ? "none"
              : `marquee ${Math.max(18, text.length * 0.28)}s linear infinite`,
            paddingLeft: "100%",
            willChange: "transform",
          }}
        >
          <span className="inline-flex items-center gap-1.5 mr-6">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clipRule="evenodd" />
            </svg>
            {ar() ? "إشعار" : "Notice"}
          </span>
          {text}
          <span className="mx-16 opacity-40">✦</span>
          {text}
          <span className="mx-16 opacity-40">✦</span>
          {text}
        </div>
      </div>

      {/* dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-66.67%); }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
