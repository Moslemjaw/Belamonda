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
