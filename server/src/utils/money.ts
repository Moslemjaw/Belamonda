/**
 * KWD amounts are stored as strings with exactly 3 decimals ("12.500").
 * Do arithmetic in integer mils (1 KWD = 1000 mils) to avoid float drift.
 */

/** "12.500" -> 12500. Missing/empty -> 0. */
export function kwdToMils(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === "") return 0;
  if (typeof s === "number") return Math.round(s * 1000);
  const str = String(s).trim();
  const negative = str.startsWith("-");
  const [a, b = "000"] = str.replace(/^-/, "").split(".");
  const m = Number(a || "0") * 1000 + Number(b.padEnd(3, "0").slice(0, 3));
  return negative ? -m : m;
}

/** 12500 -> "12.500". */
export function milsToKwd(m: number): string {
  const rounded = Math.round(m);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  return `${sign}${Math.floor(abs / 1000)}.${String(abs % 1000).padStart(3, "0")}`;
}
