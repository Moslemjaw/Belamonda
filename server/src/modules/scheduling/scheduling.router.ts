import { Router } from "express";
import { customerRoutes } from "./scheduling.customer.routes.js";
import { requestsRoutes } from "./scheduling.requests.routes.js";
import { clinicRoutes } from "./scheduling.clinic.routes.js";
import { adminRoutes } from "./scheduling.admin.routes.js";

/**
 * Mounted at /scheduling. The route groups are mounted in the order they were originally
 * declared in, so Express matches requests exactly as before the split.
 */
export const schedulingRouter = Router();
schedulingRouter.use(customerRoutes, requestsRoutes, clinicRoutes, adminRoutes);

// Re-exported for existing importers (chat, scripts).
export { ensureConversationFor, findClinicStaffUserIds, resolveUserOffer } from "./scheduling.helpers.js";
