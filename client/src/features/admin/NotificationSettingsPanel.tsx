import { useState, useEffect } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiFetch } from "../../lib/api";
import i18n from "../../app/i18n";

const ar = () => i18n.language === "ar";

type NotifChannel = "in_app" | "email" | "sms" | "whatsapp";

type NotifTypeSetting = {
  type: string;
  label: string;
  category: "payment" | "session" | "engagement" | "communication" | "system";
  channels: Record<NotifChannel, boolean>;
};

const CATEGORY_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  payment:       { en: "Payment",       ar: "المدفوعات",      color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  session:       { en: "Session",       ar: "الجلسات",        color: "bg-blue-50 text-blue-700 border-blue-200" },
  engagement:    { en: "Engagement",    ar: "التفاعل",        color: "bg-purple-50 text-purple-700 border-purple-200" },
  communication: { en: "Communication", ar: "التواصل",        color: "bg-amber-50 text-amber-700 border-amber-200" },
  system:        { en: "System",        ar: "النظام",         color: "bg-surface-100 text-surface-600 border-surface-200" }
};

const CHANNEL_LABELS: Record<NotifChannel, { en: string; icon: string }> = {
  in_app:   { en: "In-App",   icon: "🔔" },
  email:    { en: "Email",    icon: "✉️" },
  sms:      { en: "SMS",      icon: "💬" },
  whatsapp: { en: "WhatsApp", icon: "📱" }
};

const CHANNELS: NotifChannel[] = ["in_app", "email", "sms", "whatsapp"];

export default function NotificationSettingsPanel() {
  const { getAuthHeader } = useAuth();
  const [settings, setSettings] = useState<NotifTypeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    apiFetch("/notifications/admin/settings", { headers: getAuthHeader() })
      .then((res: any) => setSettings(res.settings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [getAuthHeader]);

  const toggle = (type: string, channel: NotifChannel) => {
    setSettings((prev) =>
      prev.map((s) =>
        s.type === type
          ? { ...s, channels: { ...s.channels, [channel]: !s.channels[channel] } }
          : s
      )
    );
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const updates = settings.map((s) => ({ type: s.type, channels: s.channels }));
      await apiFetch("/notifications/admin/settings", {
        method: "PUT",
        headers: getAuthHeader(),
        body: JSON.stringify({ updates })
      });
      setSaved(true);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const categories = ["all", ...Array.from(new Set(settings.map((s) => s.category)))];
  const filtered = activeCategory === "all" ? settings : settings.filter((s) => s.category === activeCategory);

  const grouped = filtered.reduce<Record<string, NotifTypeSetting[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="shimmer h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-surface-900">
            {ar() ? "إعدادات الإشعارات" : "Notification Settings"}
          </h2>
          <p className="text-sm text-surface-500 mt-1">
            {ar()
              ? "تحكم في قنوات التوصيل لكل نوع إشعار على مستوى النظام."
              : "Control which delivery channels are active for each notification type system-wide."}
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className={`btn-primary flex items-center gap-2 self-start sm:self-auto ${saved ? "opacity-80" : ""}`}
        >
          {saving ? (
            <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : saved ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          ) : null}
          {saved ? (ar() ? "تم الحفظ" : "Saved") : (ar() ? "حفظ التغييرات" : "Save Changes")}
        </button>
      </div>

      {/* Channel legend */}
      <div className="flex flex-wrap gap-3">
        {CHANNELS.map((ch) => (
          <div key={ch} className="flex items-center gap-1.5 text-xs text-surface-500 bg-surface-50 px-3 py-1.5 rounded-lg border border-surface-200">
            <span>{CHANNEL_LABELS[ch].icon}</span>
            <span className="font-medium">{CHANNEL_LABELS[ch].en}</span>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const info = cat === "all" ? null : CATEGORY_LABELS[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                activeCategory === cat
                  ? "bg-brand-pink-500 text-white border-brand-pink-500"
                  : "bg-white text-surface-600 border-surface-200 hover:border-brand-pink-300"
              }`}
            >
              {cat === "all"
                ? (ar() ? "الكل" : "All")
                : (ar() ? info?.ar : info?.en) ?? cat}
            </button>
          );
        })}
      </div>

      {/* Settings table per category */}
      {Object.entries(grouped).map(([cat, items]) => {
        const catInfo = CATEGORY_LABELS[cat];
        return (
          <div key={cat} className="card-elevated overflow-hidden">
            <div className={`px-5 py-3 border-b border-surface-100 flex items-center gap-2`}>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${catInfo?.color ?? "bg-surface-100 text-surface-600 border-surface-200"}`}>
                {ar() ? catInfo?.ar : catInfo?.en}
              </span>
            </div>
            <div className="divide-y divide-surface-50">
              {/* Header row */}
              <div className="px-5 py-2 grid grid-cols-[1fr_repeat(4,48px)] gap-2 items-center">
                <div className="text-xs font-bold text-surface-400 uppercase tracking-wider">
                  {ar() ? "نوع الإشعار" : "Notification Type"}
                </div>
                {CHANNELS.map((ch) => (
                  <div key={ch} className="text-center text-xs text-surface-400" title={CHANNEL_LABELS[ch].en}>
                    {CHANNEL_LABELS[ch].icon}
                  </div>
                ))}
              </div>

              {items.map((s) => (
                <div
                  key={s.type}
                  className="px-5 py-3 grid grid-cols-[1fr_repeat(4,48px)] gap-2 items-center hover:bg-surface-50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-surface-800">{s.label}</div>
                    <div className="text-xs text-surface-400 font-mono">{s.type}</div>
                  </div>
                  {CHANNELS.map((ch) => (
                    <div key={ch} className="flex justify-center">
                      <button
                        onClick={() => toggle(s.type, ch)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          s.channels[ch] ? "bg-brand-pink-500" : "bg-surface-200"
                        }`}
                        title={`${CHANNEL_LABELS[ch].en}: ${s.channels[ch] ? "enabled" : "disabled"}`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                            s.channels[ch] ? "translate-x-4.5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
