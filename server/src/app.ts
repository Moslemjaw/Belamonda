import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authRouter } from "./modules/auth/auth.router.js";
import { authRequired } from "./middlewares/authRequired.js";
import { kycRouter } from "./modules/kyc/kyc.router.js";
import { clinicsRouter } from "./modules/clinics/clinics.router.js";
import { offersRouter } from "./modules/offers/offers.router.js";
import { commerceRouter } from "./modules/commerce/commerce.router.js";
import { paymentsRouter } from "./modules/payments/payments.router.js";
import { schedulingRouter } from "./modules/scheduling/scheduling.router.js";
import { walletRouter } from "./modules/wallet/wallet.router.js";
import { notificationsRouter } from "./modules/notifications/notifications.router.js";
import { tasksRouter } from "./modules/tasks/tasks.router.js";
import { reportingRouter } from "./modules/reporting/reporting.router.js";
import { complaintsRouter } from "./modules/complaints/complaints.router.js";
import { productsRouter } from "./modules/products/products.router.js";
import { publicRouter } from "./modules/public/public.router.js";
import { categoriesRouter } from "./modules/categories/categories.router.js";
import { dashboardsRouter } from "./modules/dashboards/dashboards.router.js";
import { sessionTypesRouter } from "./modules/session-types/sessionTypes.router.js";
import { usersRouter } from "./modules/users/users.router.js";
import { uploadsRouter } from "./modules/uploads/uploads.router.js";
import path from "path";

export function createApp() {
  const app = express();

  app.use(helmet());

  const allowedOrigins =
    env.CLIENT_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ??
    (env.CLIENT_ORIGIN ? [env.CLIENT_ORIGIN] : []);

  app.use(
    cors({
      origin(origin, cb) {
        // Allow non-browser requests (curl, health checks)
        if (!origin) return cb(null, true);

        // Dev convenience: allow any localhost port to support Vite switching ports.
        if (env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(origin)) {
          return cb(null, true);
        }

        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  // Local uploads (admin image upload). In production replace with S3/Cloudflare R2.
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.use("/uploads-api", uploadsRouter);

  app.use("/auth", authRouter);
  app.use("/public", publicRouter);
  app.use("/categories", categoriesRouter);
  app.use("/dashboards", dashboardsRouter);
  app.use("/session-types", sessionTypesRouter);
  app.use("/users", usersRouter);
  app.use("/kyc", kycRouter);
  app.use("/clinics", clinicsRouter);
  app.use("/offers", offersRouter);
  app.use("/commerce", commerceRouter);
  app.use("/payments", paymentsRouter);
  app.use("/scheduling", schedulingRouter);
  app.use("/wallet", walletRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/tasks", tasksRouter);
  app.use("/reporting", reportingRouter);
  app.use("/complaints", complaintsRouter);
  app.use("/products", productsRouter);

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "belamonda-api" });
  });

  app.get("/me", authRequired, (req, res) => {
    res.json({ userId: req.auth!.userId, role: req.auth!.role });
  });

  app.use(errorHandler);

  return app;
}

