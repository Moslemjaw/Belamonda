import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { BelamondaIcon } from "../components/BelamondaLogo";

type HomePayload = {
  featuredOffers: Array<{
    id: string;
    name: string;
    subscriptionPriceKwd: string;
    category: string;
    featured?: boolean;
  }>;
  categoriesPreview: Array<{ id: string; nameEn: string; nameAr: string; slug: string }>;
  ctas: { browsePath: string; signupPath: string; loginPath: string };
};

export default function HomePage() {
  const [data, setData] = useState<HomePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await apiFetch("/public/home")) as HomePayload;
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-50 via-white to-brand-pink-50/30">
      <header className="border-b border-surface-100 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BelamondaIcon size={36} />
            <span className="text-lg font-bold tracking-tight text-surface-900">Belamonda</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-surface-700 hover:bg-surface-100">
              Sign in
            </Link>
            <Link to="/login" className="btn-primary btn-sm px-5 shadow-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <section className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-pink-600 mb-3">Premium aesthetic care</p>
          <h1 className="text-4xl sm:text-5xl font-black text-surface-900 leading-tight mb-4">
            Offers & clinics, simplified.
          </h1>
          <p className="text-surface-600 text-lg mb-8 leading-relaxed">
            Browse curated packages, filter by category, and manage bookings with a calm, focused experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/login" className="btn-primary px-8 py-3 text-base shadow-brand-pink-500/20 shadow-lg">
              Browse offers
            </Link>
            <Link
              to="/login"
              className="rounded-xl border border-surface-200 bg-white px-8 py-3 text-base font-semibold text-surface-800 hover:border-brand-pink-200 hover:bg-brand-pink-50/50 transition-colors"
            >
              Create account
            </Link>
          </div>
        </section>

        {loading && <div className="text-center text-surface-500 py-12">Loading…</div>}
        {error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-center">
            Could not load catalog ({error}). Ensure the API is running and <code className="font-mono">VITE_API_BASE_URL</code> is set.
          </div>
        )}

        {data && !loading && (
          <>
            <section className="mb-16">
              <div className="flex items-end justify-between mb-6">
                <h2 className="text-xl font-bold text-surface-900">Featured offers</h2>
                <Link to="/login" className="text-sm font-semibold text-brand-pink-600 hover:text-brand-pink-700">
                  View all →
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(data.featuredOffers.length ? data.featuredOffers : []).slice(0, 8).map((o) => (
                  <article
                    key={o.id}
                    className="card-elevated p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow bg-white border border-surface-100"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wide text-brand-pink-500">{o.category}</div>
                    <h3 className="font-bold text-surface-900 leading-snug line-clamp-2">{o.name}</h3>
                    <div className="text-lg font-black text-brand-pink-600 mt-auto">{o.subscriptionPriceKwd} KWD</div>
                    <Link to="/login" className="text-sm font-semibold text-surface-700 hover:text-brand-pink-600">
                      Details →
                    </Link>
                  </article>
                ))}
              </div>
              {data.featuredOffers.length === 0 && (
                <p className="text-surface-500 text-center py-8">No featured offers yet. Sign in as admin to create offers.</p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold text-surface-900 mb-6">Categories</h2>
              <div className="flex flex-wrap gap-3">
                {data.categoriesPreview.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center rounded-full border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-800 shadow-sm"
                  >
                    {c.nameEn}
                  </span>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-surface-100 bg-white py-8 mt-12">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-surface-500">
          © {new Date().getFullYear()} Belamonda
        </div>
      </footer>
    </div>
  );
}
