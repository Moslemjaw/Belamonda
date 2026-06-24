import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import LoginPage from "../pages/LoginPage";
import HomePage from "../pages/HomePage";
import SignupPage from "../pages/SignupPage";

import OfferDetailPage from "../pages/OfferDetailPage";
import MembershipPage from "../pages/MembershipPage";
import ClinicsPage from "../pages/ClinicsPage";
import PromoPage from "../pages/PromoPage";

// Helper to auto-reload if a chunk fails to load (e.g. after a new deployment)
const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        // Return a dummy promise that never resolves while the page reloads
        return new Promise(() => {});
      }
      throw error;
    }
  });

const EFormFillPage = lazyWithRetry(() => import("../pages/EFormFillPage"));
const CustomerDashboard = lazyWithRetry(() => import("../pages/dashboards/CustomerDashboard"));
const AdminDashboard = lazyWithRetry(() => import("../pages/dashboards/AdminDashboard"));
const CsDashboard = lazyWithRetry(() => import("../pages/dashboards/CsDashboard"));
const FinanceDashboard = lazyWithRetry(() => import("../pages/dashboards/FinanceDashboard"));
const ClinicDashboard = lazyWithRetry(() => import("../pages/dashboards/ClinicDashboard"));
const VerifyPage = lazyWithRetry(() => import("../pages/VerifyPage"));

/** Redirects /offers/:id to /memberships/:id */
function OfferRedirect() {
  const { id } = useParams();
  return <Navigate to={`/memberships/${id}`} replace />;
}

function DashboardFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 text-surface-600 text-sm font-medium">
      Loading dashboard…
    </div>
  );
}

function RoleDashboard() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;

  const dash = (() => {
    switch (auth.role) {
      case "customer":
        return <CustomerDashboard />;
      case "admin":
        return <AdminDashboard />;
      case "cs":
      case "legal":
      case "cs_director":
        return <CsDashboard />;
      case "finance":
        return <FinanceDashboard />;
      case "clinicStaff":
        return <ClinicDashboard />;
      default:
        return <Navigate to="/login" replace />;
    }
  })();

  return <Suspense fallback={<DashboardFallback />}>{dash}</Suspense>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const [params] = useSearchParams();
  if (auth) {
    const offerId = params.get("offerId");
    if (offerId) return <Navigate to={`/memberships/${offerId}`} replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/offers" element={<Navigate to="/memberships" replace />} />
      <Route path="/membership" element={<Navigate to="/memberships" replace />} />
      <Route path="/memberships" element={<MembershipPage />} />
      <Route path="/offers/:id" element={<OfferRedirect />} />
      <Route path="/memberships/:id" element={<OfferDetailPage />} />
      <Route path="/promo/:slug" element={<PromoPage />} />
      
      <Route path="/clinics" element={<ClinicsPage />} />
      <Route path="/signup" element={<AuthRedirect><SignupPage /></AuthRedirect>} />
      <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RoleDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/forms/fill/:formId"
        element={
          <RequireAuth>
            <Suspense fallback={<DashboardFallback />}>
              <EFormFillPage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route
        path="/verify/:token"
        element={
          <Suspense fallback={<DashboardFallback />}>
            <VerifyPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to={auth ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}
