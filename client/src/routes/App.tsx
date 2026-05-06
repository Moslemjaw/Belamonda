import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import LoginPage from "../pages/LoginPage";
import HomePage from "../pages/HomePage";

const CustomerDashboard = lazy(() => import("../pages/dashboards/CustomerDashboard"));
const AdminDashboard = lazy(() => import("../pages/dashboards/AdminDashboard"));
const CsDashboard = lazy(() => import("../pages/dashboards/CsDashboard"));
const FinanceDashboard = lazy(() => import("../pages/dashboards/FinanceDashboard"));
const ClinicDashboard = lazy(() => import("../pages/dashboards/ClinicDashboard"));

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

export default function App() {
  const { auth } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={auth ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RoleDashboard />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to={auth ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}
