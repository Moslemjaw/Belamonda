import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import { env } from "./config/env.js";
import { chatRouter, UPLOAD_DIR } from "./modules/chat/chat.router.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { authRequired } from "./middlewares/authRequired.js";
import { kycRouter } from "./modules/kyc/kyc.router.js";
import { clinicsRouter } from "./modules/clinics/clinics.router.js";
import { offersRouter } from "./modules/offers/offers.router.js";
import { commerceRouter } from "./modules/commerce/commerce.router.js";
import { checkoutRouter } from "./modules/commerce/checkout.router.js";
import { paymentsRouter } from "./modules/payments/payments.router.js";
import { schedulingRouter } from "./modules/scheduling/scheduling.router.js";
import { walletRouter } from "./modules/wallet/wallet.router.js";
import { notificationsRouter } from "./modules/notifications/notifications.router.js";
import { tasksRouter } from "./modules/tasks/tasks.router.js";
import { reportingRouter } from "./modules/reporting/reporting.router.js";
import { complaintsRouter } from "./modules/complaints/complaints.router.js";
import { productsRouter } from "./modules/products/products.router.js";
import { publicRouter } from "./modules/public/public.router.js";
import { walletPassRouter } from "./modules/public/walletPass.router.js";
import { categoriesRouter } from "./modules/categories/categories.router.js";
import { dashboardsRouter } from "./modules/dashboards/dashboards.router.js";
import { sessionTypesRouter } from "./modules/session-types/sessionTypes.router.js";
import { usersRouter } from "./modules/users/users.router.js";
import { eformsRouter } from "./modules/eforms/eforms.router.js";
import { referralRouter } from "./modules/referral/referral.router.js";
import { auditRouter } from "./modules/audit/audit.router.js";
import { noticesRouter } from "./modules/notices/notices.router.js";
import { settingsRouter } from "./modules/settings/settings.router.js";
import { cashbackRequestsRouter } from "./modules/cashback-requests/cashbackRequests.router.js";
import { subscriptionsRouter } from "./modules/subscriptions/subscriptions.router.js";
import promotionsRouter from "./modules/promotions/promotions.router.js";

/** First path segment for routes registered on this app — avoids SPA fallback stealing API/Socket.IO traffic. */
const RESERVED_FIRST_SEGMENTS = new Set([
  "uploads",
  "chat",
  "auth",
  "public",
  "categories",
  "dashboards",
  "session-types",
  "users",
  "kyc",
  "clinics",
  "offers",
  "commerce",
  "checkout",
  "payments",
  "scheduling",
  "wallet",
  "notifications",
  "tasks",
  "reporting",
  "complaints",
  "products",
  "eforms",
  "referral",
  "audit",
  "notices",
  "settings",
  "cashback-requests",
  "subscriptions",
  "promotions",
  "health",
  "me",
  "socket.io"
]);

function firstPathSegment(urlPath: string): string | undefined {
  const parts = urlPath.split("/").filter(Boolean);
  return parts[0];
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());

  const allowedOrigins =
    env.CLIENT_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ??
    (env.CLIENT_ORIGIN ? [env.CLIENT_ORIGIN] : []);

  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser requests (curl, health checks)
        if (!origin) return cb(null, true);

        if (env.NODE_ENV !== "production") {
          // Allow any localhost port (Vite dev server)
          if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
          // Allow Replit dev proxy domains (with or without port)
          if (/\.replit\.dev(:\d+)?$/.test(origin)) return cb(null, true);
          if (/\.pike\.replit\.dev(:\d+)?$/.test(origin)) return cb(null, true);
        }

        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "50mb" }));

  // Static-serve chat upload directory.
  app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
      maxAge: "1h",
      setHeaders: (res) => {
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      }
    })
  );

  app.use("/chat", chatRouter);
  app.use("/auth", authRouter);
  app.use("/public", publicRouter);
  app.use("/public", walletPassRouter);
  app.use("/categories", categoriesRouter);
  app.use("/dashboards", dashboardsRouter);
  app.use("/session-types", sessionTypesRouter);
  app.use("/users", usersRouter);
  app.use("/kyc", kycRouter);
  app.use("/clinics", clinicsRouter);
  app.use("/offers", offersRouter);
  app.use("/commerce", commerceRouter);
  app.use("/checkout", checkoutRouter);
  app.use("/payments", paymentsRouter);
  app.use("/scheduling", schedulingRouter);
  app.use("/wallet", walletRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/tasks", tasksRouter);
  app.use("/reporting", reportingRouter);
  app.use("/complaints", complaintsRouter);
  app.use("/products", productsRouter);
  app.use("/eforms", eformsRouter);
  app.use("/referral", referralRouter);
  app.use("/audit", auditRouter);
  app.use("/notices", noticesRouter);
  app.use("/settings", settingsRouter);
  app.use("/cashback-requests", cashbackRequestsRouter);
  app.use("/subscriptions", subscriptionsRouter);
  app.use("/promotions", promotionsRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "belamonda-api" });
  });

  app.get("/me", authRequired, (req, res) => {
    res.json({ userId: req.auth!.userId, role: req.auth!.role });
  });

  // Same-origin SPA (Render / single-service deploy): `dist` is next to `server/dist` after build.
  if (env.NODE_ENV === "production") {
    const __dir = path.dirname(fileURLToPath(import.meta.url));
    // Try two possible paths depending on build structure
    const clientDist1 = path.resolve(__dir, "../../client/dist");
    const clientDist2 = path.resolve(__dir, "../../../client/dist");
    const clientDist = fs.existsSync(path.join(clientDist1, "index.html")) ? clientDist1 : clientDist2;
    console.log("[SPA] Serving client from:", clientDist);
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get("*", (req, res, next) => {
      const seg = firstPathSegment(req.path);
      if (seg && RESERVED_FIRST_SEGMENTS.has(seg)) return next();
      const indexPath = path.join(clientDist, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error("[SPA] Failed to send index.html:", err.message, "| path:", indexPath);
          // Return a simple HTML page instead of redirecting to avoid infinite redirect loop
          res.status(200).send(`
            <!DOCTYPE html>
            <html>
              <head><meta charset="utf-8"><title>Belamonda Setup</title></head>
              <body style="font-family: sans-serif; padding: 2rem;">
                <h2>Frontend Build Missing</h2>
                <p>The server is running, but the frontend React application was not found.</p>
                <p>Path checked: <code>${indexPath}</code></p>
                <p>Check the Render build logs to ensure the client build succeeded.</p>
              </body>
            </html>
          `);
        }
      });
    });
  }

  app.use(errorHandler);

  return app;
}

