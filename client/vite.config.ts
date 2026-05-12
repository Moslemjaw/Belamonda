import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/auth": { target: "http://localhost:8081", changeOrigin: true },
      "/offers": { target: "http://localhost:8081", changeOrigin: true },
      "/clinics": { target: "http://localhost:8081", changeOrigin: true },
      "/categories": { target: "http://localhost:8081", changeOrigin: true },
      "/commerce": { target: "http://localhost:8081", changeOrigin: true },
      "/checkout": { target: "http://localhost:8081", changeOrigin: true },
      "/chat": { target: "http://localhost:8081", changeOrigin: true },
      "/eforms": { target: "http://localhost:8081", changeOrigin: true },
      "/referral": { target: "http://localhost:8081", changeOrigin: true },
      "/public": { target: "http://localhost:8081", changeOrigin: true },
      "/session-types": { target: "http://localhost:8081", changeOrigin: true },
      "/dashboards": { target: "http://localhost:8081", changeOrigin: true },
      "/users": { target: "http://localhost:8081", changeOrigin: true },
      "/kyc": { target: "http://localhost:8081", changeOrigin: true },
      "/payments": { target: "http://localhost:8081", changeOrigin: true },
      "/scheduling": { target: "http://localhost:8081", changeOrigin: true },
      "/wallet": { target: "http://localhost:8081", changeOrigin: true },
      "/notifications": { target: "http://localhost:8081", changeOrigin: true },
      "/tasks": { target: "http://localhost:8081", changeOrigin: true },
      "/reporting": { target: "http://localhost:8081", changeOrigin: true },
      "/complaints": { target: "http://localhost:8081", changeOrigin: true },
      "/products": { target: "http://localhost:8081", changeOrigin: true },
      "/uploads": { target: "http://localhost:8081", changeOrigin: true },
      "/me": { target: "http://localhost:8081", changeOrigin: true },
      "/health": { target: "http://localhost:8081", changeOrigin: true },
      "/socket.io": {
        target: "http://localhost:8081",
        changeOrigin: true,
        ws: true
      }
    }
  }
});
