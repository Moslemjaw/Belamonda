import { createRequire } from "node:module";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { kwDate, kwDateTime } from "../../utils/kwDate.js";
import type { CellValue, ReportColumn, ReportDoc, ReportTable } from "./financeReports.service.js";

/**
 * Renders a ReportDoc to Excel or PDF. Both use the same document as the
 * on-screen preview, so the numbers always match.
 */

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export const hasArabic = (s: string) => ARABIC.test(s);

/**
 * Splits text into words in the order they should be drawn left to right.
 * pdfkit shapes each Arabic word correctly but lays words out left to right,
 * so a right-to-left sentence has to be reordered word by word.
 */
export function visualTokens(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!tokens.some(hasArabic)) return tokens;
  const firstStrong = tokens.find((t) => /[A-Za-z]/.test(t) || hasArabic(t));
  const rtlBase = !!firstStrong && hasArabic(firstStrong);

  // Group consecutive words by direction; numbers and symbols join the run they sit in.
  const runs: { rtl: boolean; words: string[] }[] = [];
  for (const t of tokens) {
    const strong = hasArabic(t) ? true : /[A-Za-z]/.test(t) ? false : null;
    const last = runs[runs.length - 1];
    if (last && (strong === null || strong === last.rtl)) last.words.push(t);
    else runs.push({ rtl: strong ?? rtlBase, words: [t] });
  }
  const ordered = rtlBase ? runs.reverse() : runs;
  return ordered.flatMap((r) => (r.rtl ? [...r.words].reverse() : r.words));
}

// ── Excel ───────────────────────────────────────────────────────────────────

const PINK = "FFDB2777";
const BORDER = { style: "thin" as const, color: { argb: "FFE2E8F0" } };
const label = (l: { en: string; ar: string }) => `${l.en} / ${l.ar}`;
const period = (doc: ReportDoc) => `${kwDate(`${doc.from}T12:00:00Z`)} – ${kwDate(`${doc.to}T12:00:00Z`)}`;

function cellValue(col: ReportColumn, v: CellValue) {
  if (v === null || v === undefined || v === "") return "";
  if (col.kind === "kwd" || col.kind === "int") {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}

function addSheet(wb: ExcelJS.Workbook, doc: ReportDoc, table: ReportTable, name: string) {
  const ws = wb.addWorksheet(name.slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
  const width = Math.max(table.columns.length, 2);
  ws.mergeCells(1, 1, 1, width);
  ws.getCell(1, 1).value = `${label(doc.title)} — ${label(table.title)}`;
  ws.getCell(1, 1).font = { size: 14, bold: true };
  ws.mergeCells(2, 1, 2, width);
  ws.getCell(2, 1).value = `${period(doc)}  ·  Generated ${kwDateTime(doc.generatedAt)} (Kuwait)`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: "FF64748B" } };

  const header = ws.getRow(4);
  header.values = table.columns.map((c) => label(c.label));
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PINK } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
  });

  table.rows.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    row.values = table.columns.map((c) => cellValue(c, r[c.key]));
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      const col = table.columns[n - 1];
      if (col?.kind === "kwd") cell.numFmt = "#,##0.000";
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (i % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });
  });

  let last = 4 + table.rows.length;
  if (table.totals) {
    const row = ws.getRow(++last);
    row.values = table.columns.map((c) => cellValue(c, table.totals![c.key] ?? null));
    row.eachCell({ includeEmpty: true }, (cell, n) => {
      if (table.columns[n - 1]?.kind === "kwd") cell.numFmt = "#,##0.000";
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE7F3" } };
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
    });
  }
  if (table.note) {
    ws.mergeCells(last + 2, 1, last + 2, width);
    ws.getCell(last + 2, 1).value = label(table.note);
    ws.getCell(last + 2, 1).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  }

  table.columns.forEach((c, i) => {
    let max = Math.min(30, label(c.label).length);
    for (const r of table.rows.slice(0, 500)) max = Math.max(max, String(r[c.key] ?? "").length);
    ws.getColumn(i + 1).width = Math.max(10, Math.min(45, max + 2));
  });
  if (table.rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: table.columns.length } };
}

export async function renderReportXlsx(doc: ReportDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Belamonda";
  wb.created = new Date();

  const summary = wb.addWorksheet("Summary");
  summary.getColumn(1).width = 46;
  summary.getColumn(2).width = 22;
  summary.getColumn(3).width = 46;
  summary.getCell("A1").value = label(doc.title);
  summary.getCell("A1").font = { size: 16, bold: true };
  summary.getCell("A2").value = period(doc);
  summary.getCell("A3").value = `Generated ${kwDateTime(doc.generatedAt)} (Kuwait)`;
  summary.getCell("A3").font = { size: 10, color: { argb: "FF64748B" } };
  let r = 5;
  for (const card of doc.cards) {
    summary.getCell(r, 1).value = label(card.label);
    summary.getCell(r, 1).font = { bold: true };
    summary.getCell(r, 2).value = card.value;
    summary.getCell(r, 2).alignment = { horizontal: "right" };
    if (card.hint) summary.getCell(r, 3).value = label(card.hint);
    r++;
  }
  if (doc.check) {
    r++;
    summary.getCell(r, 1).value = doc.check.ok ? "Matches the Payments Ledger / مطابق لسجل المدفوعات" : "Does NOT match the Payments Ledger / غير مطابق لسجل المدفوعات";
    summary.getCell(r, 1).font = { bold: true, color: { argb: doc.check.ok ? "FF047857" : "FFB91C1C" } };
    summary.getCell(r, 2).value = `Report ${doc.check.reportTotalKwd} · Ledger ${doc.check.ledgerTotalKwd} · Diff ${doc.check.diffKwd}`;
    r++;
  }
  for (const note of doc.notes) {
    r++;
    summary.getCell(r, 1).value = label(note);
    summary.getCell(r, 1).font = { italic: true, size: 9, color: { argb: "FF64748B" } };
  }

  const used = new Set<string>();
  for (const table of doc.tables) {
    let name = table.title.en.replace(/[\\/?*[\]:]/g, " ").slice(0, 28);
    while (used.has(name)) name = `${name.slice(0, 26)}_${used.size}`;
    used.add(name);
    addSheet(wb, doc, table, name);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}

// ── PDF ─────────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
let arabicFonts: { regular: string; bold: string } | null | undefined;
function arabicFontPaths() {
  if (arabicFonts !== undefined) return arabicFonts;
  try {
    arabicFonts = {
      regular: require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff"),
      bold: require.resolve("@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff"),
    };
  } catch {
    arabicFonts = null;
  }
  return arabicFonts;
}

type Pdf = InstanceType<typeof PDFDocument>;
const M = 30;
const ROW_H = 15;

/** Draws one line of text in a box, switching to the Arabic font word by word. Truncates with "…". */
function drawLine(pdf: Pdf, text: string, x: number, y: number, width: number, opts: { bold?: boolean; size: number; align?: "left" | "right" }) {
  const latin = opts.bold ? "Helvetica-Bold" : "Helvetica";
  const fonts = arabicFontPaths();
  const arabic = fonts ? (opts.bold ? "ArabicBold" : "Arabic") : latin;
  const words = visualTokens(String(text ?? ""));
  if (!words.length) return;
  const fontFor = (w: string) => (hasArabic(w) ? arabic : latin);
  pdf.fontSize(opts.size);
  const space = pdf.font(latin).widthOfString(" ");
  const widthOf = (w: string) => pdf.font(fontFor(w)).widthOfString(w);

  let parts = words.map((w) => ({ w, width: widthOf(w) }));
  let total = parts.reduce((n, p) => n + p.width, 0) + space * (parts.length - 1);
  if (total > width) {
    const ell = pdf.font(latin).widthOfString("…");
    while (parts.length > 1 && total + ell > width) {
      const removed = parts.pop()!;
      total -= removed.width + space;
    }
    if (parts.length === 1 && parts[0].width + ell > width && !hasArabic(parts[0].w)) {
      let w = parts[0].w;
      while (w.length > 1 && pdf.font(latin).widthOfString(w) + ell > width) w = w.slice(0, -1);
      parts = [{ w, width: pdf.font(latin).widthOfString(w) }];
      total = parts[0].width;
    }
    parts.push({ w: "…", width: ell });
    total += ell;
  }
  let cx = opts.align === "right" ? x + Math.max(0, width - total) : x;
  // Draw on a shared baseline: the Arabic font's taller ascent would otherwise push its words down.
  const baseline = y + opts.size * 0.82;
  for (const p of parts) {
    pdf.font(fontFor(p.w)).text(p.w, cx, baseline, { lineBreak: false, baseline: "alphabetic" });
    cx += p.width + space;
  }
}

function fmtCell(col: ReportColumn, v: CellValue) {
  if (v === null || v === undefined) return "";
  if (col.kind === "kwd") {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : String(v);
  }
  return String(v);
}

function columnWidths(pdf: Pdf, table: ReportTable, available: number) {
  pdf.fontSize(7.5);
  const want = table.columns.map((c) => {
    let w = pdf.font("Helvetica-Bold").widthOfString(c.label.en);
    for (const r of table.rows.slice(0, 300)) w = Math.max(w, pdf.font("Helvetica").widthOfString(fmtCell(c, r[c.key])));
    return Math.min(w + 8, c.kind ? 80 : 160);
  });
  const sum = want.reduce((a, b) => a + b, 0);
  return want.map((w) => (w * available) / sum);
}

export function renderReportPdf(doc: ReportDoc): Promise<Buffer> {
  const pdf = new PDFDocument({ size: "A4", layout: "landscape", margin: M, bufferPages: true, info: { Title: doc.title.en, Author: "Belamonda" } });
  const fonts = arabicFontPaths();
  if (fonts) {
    pdf.registerFont("Arabic", fonts.regular);
    pdf.registerFont("ArabicBold", fonts.bold);
  }
  const chunks: Buffer[] = [];
  pdf.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  const W = pdf.page.width - 2 * M;
  const bottom = () => pdf.page.height - M - 18;

  const header = () => {
    drawLine(pdf, doc.title.en, M, M, W * 0.6, { bold: true, size: 16 });
    drawLine(pdf, `${period(doc)}   ·   Generated ${kwDateTime(doc.generatedAt)} (Kuwait time)`, M, M + 22, W, { size: 9 });
    pdf.moveTo(M, M + 36).lineTo(M + W, M + 36).strokeColor("#DB2777").lineWidth(1).stroke();
    return M + 46;
  };
  let y = header();

  if (doc.check) {
    const ok = doc.check.ok;
    pdf.roundedRect(M, y, W, 18, 3).fill(ok ? "#ECFDF5" : "#FEF2F2");
    pdf.fillColor(ok ? "#047857" : "#B91C1C");
    drawLine(pdf, `${ok ? "Matches the Payments Ledger" : "Does NOT match the Payments Ledger"}  —  report ${doc.check.reportTotalKwd} KWD, ledger ${doc.check.ledgerTotalKwd} KWD, difference ${doc.check.diffKwd}`, M + 6, y + 5, W - 12, { bold: true, size: 8.5 });
    pdf.fillColor("black");
    y += 26;
  }

  // Summary cards, 4 per row.
  const perRow = 4;
  const cw = (W - (perRow - 1) * 8) / perRow;
  doc.cards.forEach((card, i) => {
    const cx = M + (i % perRow) * (cw + 8);
    const cy = y + Math.floor(i / perRow) * 48;
    pdf.roundedRect(cx, cy, cw, 42, 4).lineWidth(0.5).strokeColor("#E2E8F0").stroke();
    pdf.fillColor("#64748B");
    drawLine(pdf, card.label.en, cx + 8, cy + 6, cw - 16, { size: 7.5 });
    pdf.fillColor(card.tone === "bad" ? "#B91C1C" : card.tone === "good" ? "#047857" : "#0F172A");
    drawLine(pdf, card.value, cx + 8, cy + 17, cw - 16, { bold: true, size: 12 });
    pdf.fillColor("#64748B");
    if (card.hint) drawLine(pdf, card.hint.en, cx + 8, cy + 32, cw - 16, { size: 6.5 });
    pdf.fillColor("black");
  });
  y += Math.ceil(doc.cards.length / perRow) * 48 + 6;

  for (const table of doc.tables) {
    const widths = columnWidths(pdf, table, W);
    const drawHeader = () => {
      pdf.rect(M, y, W, ROW_H + 2).fill("#DB2777");
      pdf.fillColor("white");
      let x = M;
      table.columns.forEach((c, i) => {
        drawLine(pdf, c.label.en, x + 3, y + 4.5, widths[i] - 6, { bold: true, size: 7.5, align: c.kind ? "right" : "left" });
        x += widths[i];
      });
      pdf.fillColor("black");
      y += ROW_H + 2;
    };
    const newPage = () => {
      pdf.addPage();
      y = header();
    };

    if (y + 20 + 2 * ROW_H > bottom()) newPage();
    drawLine(pdf, table.title.en, M, y, W, { bold: true, size: 10 });
    y += 15;
    drawHeader();

    const drawRow = (r: Record<string, CellValue>, style: { bold?: boolean; fill?: string }) => {
      if (y + ROW_H > bottom()) {
        newPage();
        drawHeader();
      }
      if (style.fill) pdf.rect(M, y, W, ROW_H).fill(style.fill);
      pdf.fillColor("black");
      let x = M;
      table.columns.forEach((c, i) => {
        drawLine(pdf, fmtCell(c, r[c.key] ?? null), x + 3, y + 4, widths[i] - 6, { size: 7.5, bold: style.bold, align: c.kind ? "right" : "left" });
        x += widths[i];
      });
      pdf.moveTo(M, y + ROW_H).lineTo(M + W, y + ROW_H).lineWidth(0.3).strokeColor("#E2E8F0").stroke();
      y += ROW_H;
    };

    if (!table.rows.length) {
      pdf.fillColor("#64748B");
      drawLine(pdf, "No records in this period.", M + 3, y + 4, W, { size: 8 });
      pdf.fillColor("black");
      y += ROW_H;
    }
    table.rows.forEach((r, i) => drawRow(r, { fill: i % 2 ? "#F8FAFC" : undefined }));
    if (table.totals) drawRow(table.totals, { bold: true, fill: "#FCE7F3" });
    if (table.note) {
      pdf.fillColor("#64748B");
      drawLine(pdf, table.note.en, M, y + 4, W, { size: 7 });
      pdf.fillColor("black");
      y += 12;
    }
    y += 14;
  }

  for (const note of doc.notes) {
    if (y + 12 > bottom()) newPageSimple();
    pdf.fillColor("#64748B");
    drawLine(pdf, note.en, M, y, W, { size: 7.5 });
    pdf.fillColor("black");
    y += 12;
  }
  function newPageSimple() {
    pdf.addPage();
    y = header();
  }

  const range = pdf.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    pdf.switchToPage(range.start + i);
    // The footer sits inside the bottom margin; without this pdfkit would start a new page.
    pdf.page.margins.bottom = 0;
    pdf.fillColor("#94A3B8");
    drawLine(pdf, `Belamonda · ${doc.title.en} · Page ${i + 1} of ${range.count}`, M, pdf.page.height - M - 8, W, { size: 7, align: "right" });
  }
  pdf.end();
  return done;
}
