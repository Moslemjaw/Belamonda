import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import type { Role } from "@belamonda/shared";
import { passwordLogin } from "../lib/demoTokens";

const roleRoutes: { role: Role; label: string; routes: { to: string; label: string }[] }[] = [
  {
    role: "customer",
    label: "Customer",
    routes: [
      { to: "/kyc-demo", label: "KYC" },
      { to: "/payment-demo", label: "Offers + Payments" },
      { to: "/wallet-demo", label: "Wallet" },
      { to: "/notifications-demo", label: "Notifications" }
    ]
  },
  {
    role: "cs",
    label: "Customer Service",
    routes: [
      { to: "/kyc-demo", label: "KYC queue" },
      { to: "/payment-demo", label: "Pending payments" },
      { to: "/scheduling-demo", label: "Scheduling" },
      { to: "/tasks-demo", label: "Today’s Tasks" }
    ]
  },
  {
    role: "finance",
    label: "Finance",
    routes: [
      { to: "/finance-demo", label: "Snapshot + Reports" },
      { to: "/tasks-demo", label: "Today’s Tasks" }
    ]
  },
  {
    role: "clinicStaff",
    label: "Clinic",
    routes: [
      { to: "/scheduling-demo", label: "Schedule + Completion" },
      { to: "/tasks-demo", label: "Today’s Tasks" }
    ]
  },
  {
    role: "admin",
    label: "Admin",
    routes: [
      { to: "/catalog-demo", label: "Clinics + Offers CRUD" },
      { to: "/tasks-demo", label: "Task manager (demo)" },
      { to: "/finance-demo", label: "Reports (as admin)" }
    ]
  }
];

export default function Dashboard() {
  const [userId, setUserId] = useState("cust1");
  const [role, setRole] = useState<Role>("customer");
  const [token, setToken] = useState("");

  const allowed = useMemo(() => roleRoutes.find((r) => r.role === role)!, [role]);

  async function login() {
    const r = await passwordLogin({ identifier: userId, password: "demo12345" });
    setToken(r.accessToken);
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <header className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Dashboards</div>
            <div className="mt-1 text-sm text-neutral-300">
              Role-based entry points (local MVP). Next step is turning each demo into its real dashboard UI.
            </div>
          </div>
          <Link className="text-indigo-400 hover:text-indigo-300" to="/">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-neutral-400">User ID</label>
              <input
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Role</label>
              <select
                className="mt-1 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="customer">customer</option>
                <option value="cs">cs</option>
                <option value="finance">finance</option>
                <option value="clinicStaff">clinicStaff</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                className="w-full rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400"
                onClick={login}
              >
                Login
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-400">
            Token (for demos that require it): <span className="text-neutral-200 break-all">{token || "—"}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">{allowed.label} routes</div>
            <div className="mt-3 grid gap-2">
              {allowed.routes.map((r) => (
                <Link
                  key={r.to}
                  className="rounded-md border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm hover:bg-neutral-800"
                  to={r.to}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">All demos</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {[
                "/kyc-demo",
                "/catalog-demo",
                "/payment-demo",
                "/scheduling-demo",
                "/wallet-demo",
                "/notifications-demo",
                "/tasks-demo",
                "/finance-demo"
              ].map((to) => (
                <Link
                  key={to}
                  className="rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 hover:bg-neutral-800"
                  to={to}
                >
                  {to}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

