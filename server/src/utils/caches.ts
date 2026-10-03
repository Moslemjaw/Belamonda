import { ModelCache } from "./cache.js";

/** Short-lived caches for rarely-changing reference data (cleared on any write to the model). */
export const offerCache = new ModelCache<any>(30_000);
export const clinicCache = new ModelCache<any>(30_000);
export const categoryCache = new ModelCache<any>(30_000);
/** A staff member's clinic (permission checks on every clinic action). Cleared on any user write. */
export const userClinicCache = new ModelCache<{ clinicId?: string }>(15_000);
/** Public catalog responses (offers/clinics/categories lists). Cleared on any offer, clinic or category write. */
export const catalogCache = new ModelCache<any>(30_000);
