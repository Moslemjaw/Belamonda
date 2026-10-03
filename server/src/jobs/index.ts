import { startPurchaseReminders } from "../services/purchaseReminders.service.js";
import { startFormSignatureReminders } from "../services/formSignatureReminders.service.js";
import { startReconciliationCron } from "../services/reconciliation.service.js";

/** Start every interval job. Each tick is guarded by a Mongo lease (jobs/lease.ts). */
export function startJobs() {
  startPurchaseReminders();
  startFormSignatureReminders();
  startReconciliationCron();
}
