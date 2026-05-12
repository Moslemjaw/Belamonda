import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import PublicLayout from "../components/PublicLayout";

type Clinic = {
  id: string;
  nameEn: string;
  nameAr: string;
  address: string;
  phone?: string;
  categoryTags?: string[];
  operatingHours?: { open: string; close: string };
};

export default function ClinicsPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiFetch("/clinics")
      .then((d: any) => setClinics(d.items as Clinic[]))
      .catch(() => setClinics([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clinics.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.nameEn.toLowerCase().includes(q) ||
      c.nameAr.includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

  return (
    <PublicLayout>
      <section className="bg-brand-gradient-soft border-b border-surface-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
          <h1 className="text-3xl sm:text-4xl font-black text-surface-900">
            {t("Partner clinics", "العيادات الشريكة")}
          </h1>
          <p className="text-surface-600 mt-2 max-w-xl">
            {t(
              "Belamonda partners with Kuwait's leading aesthetic clinics. Find your closest one.",
              "تتعاون بيلاموندو مع أرقى عيادات التجميل في الكويت. اعثري على الأقرب إليكِ."
            )}
          </p>
          <div className="mt-6 max-w-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search clinics or areas...", "ابحثي عن عيادة أو منطقة...")}
              className="input-field"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-elevated p-5">
                <div className="h-5 w-2/3 shimmer rounded" />
                <div className="mt-3 h-3 w-full shimmer rounded" />
                <div className="mt-2 h-3 w-1/2 shimmer rounded" />
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 card-elevated">
            <div className="text-5xl mb-3">🏥</div>
            <p className="font-bold text-surface-800">{t("No clinics match your search", "لا توجد عيادات تطابق بحثك")}</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <div key={c.id} className="card-elevated p-5 flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-2xl bg-brand-pink-100 text-brand-pink-600 grid place-items-center font-black text-lg">
                    {(isAr ? c.nameAr : c.nameEn).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-surface-900 leading-snug">
                      {isAr ? c.nameAr : c.nameEn}
                    </h3>
                    <p className="text-xs text-surface-500 mt-1 line-clamp-2">{c.address}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(c.categoryTags ?? []).slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-brand-sage-50 px-2 py-0.5 text-[10px] font-semibold text-brand-sage-700">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between text-xs text-surface-500">
                  {c.operatingHours ? (
                    <span>🕐 {c.operatingHours.open} – {c.operatingHours.close}</span>
                  ) : <span />}
                  {c.phone && <a href={`tel:${c.phone}`} className="font-semibold text-brand-pink-600 hover:text-brand-pink-700">📞 {c.phone}</a>}
                </div>
                <Link
                  to={`/offers?clinicId=${c.id}`}
                  className="mt-3 btn-secondary btn-sm justify-center"
                >
                  {t("See offers", "عرض العروض")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
