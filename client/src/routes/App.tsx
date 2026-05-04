import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../app/AuthContext";
import LoginPage from "../pages/LoginPage";
import CustomerDashboard from "../pages/dashboards/CustomerDashboard";
import AdminDashboard from "../pages/dashboards/AdminDashboard";
import CsDashboard from "../pages/dashboards/CsDashboard";
import FinanceDashboard from "../pages/dashboards/FinanceDashboard";
import ClinicDashboard from "../pages/dashboards/ClinicDashboard";

function RoleDashboard() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;

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
      <Route
        path="/login"
        element={auth ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RoleDashboard />
          </RequireAuth>
        }
      />
      {/* Default redirect */}
      <Route
        path="*"
        element={<Navigate to={auth ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}
