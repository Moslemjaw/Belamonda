const KW_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuwait",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

/** Human-readable Kuwait time for messages and notifications: dd/MM/yyyy HH:mm. */
export function kwDateTime(input?: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return String(input);
  return KW_FORMAT.format(d).replace(",", "");
}

const KW_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kuwait",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

/** Kuwait calendar date for messages: dd/MM/yyyy. */
export function kwDate(input?: string | Date | null): string {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return String(input);
  return KW_DATE_FORMAT.format(d);
}

/**
 * Mongo date range for whole Kuwait calendar days (UTC+3), inclusive.
 * `from`/`to` are dates like "2026-10-01" (a time part is ignored).
 */
export function kwDateRange(from?: string, to?: string): { $gte?: Date; $lte?: Date } | undefined {
  const f: { $gte?: Date; $lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCHours(d.getUTCHours() - 3);
      f.$gte = d;
    }
  }
  if (to) {
    const d = new Date(to);
    if (!isNaN(d.getTime())) {
      d.setUTCHours(23, 59, 59, 999);
      d.setUTCHours(d.getUTCHours() - 3);
      f.$lte = d;
    }
  }
  return Object.keys(f).length ? f : undefined;
}
