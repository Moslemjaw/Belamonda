import react from "@vitejs/plugin-react";
import { defineConfig, type ProxyOptions } from "vite";

const API = "http://localhost:8080";

// API path prefixes forwarded to the backend in dev. Some of them (/clinics,
// /offers, and /me as a prefix of /memberships) collide with SPA routes, so
// browser page navigations (Accept: text/html) are served the app instead.
const API_PREFIXES = [
  "/auth", "/offers", "/clinics", "/categories", "/commerce", "/checkout", "/chat",
  "/eforms", "/referral", "/public", "/session-types", "/dashboards", "/users", "/kyc",
  "/payments", "/scheduling", "/wallet", "/notifications", "/tasks", "/reporting",
  "/complaints", "/products", "/uploads", "/health", "/promotions", "/subscriptions",
  "/cashback-requests", "/audit", "/notices", "/settings"
];

const apiProxy: ProxyOptions = {
  target: API,
  changeOrigin: true,
  bypass(req) {
    if (req.headers.accept?.includes("text/html")) return "/index.html";
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      ...Object.fromEntries(API_PREFIXES.map((p) => [`^${p}(/|$|\\?)`, apiProxy])),
      "^/me$": apiProxy,
      "/socket.io": { target: API, changeOrigin: true, ws: true }
    }
  }
});
