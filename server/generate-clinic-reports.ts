import fs from "fs";
import ExcelJS from "exceljs";

const clinicNameMap: Record<string, string> = {
  "مارينا 8": "Marina 8",
  "مارينا 2": "Marina 2",
  "مارينا5": "Marina 5",
  "المهبولة - سفن كلينك": "Seven Unit",
  "مستوصف اسيل - بنيد القار - يارو 11": "Aseel Clinic",
  "نوفا ميد دور 11 - السالمية": "Nova Clinic",
  "هوب كلينك دور 3 - اماني": "Hope Clinic",
  "هوب كلينك - كارول": "Hope Clinic",
  "آي ميد - صباح السالم": "E-Med Clinic"
};

interface ClientData {
  index: number;
  name: string;
  nationalId: string;
  phone: string;
  membership: string;
  clinic: string;
  expiryDate: string;
  salesRep: string;
  packageDate: string;
  packageType: string;
  paymentStatus: string;
  totalKd: string;
  amountPaidKd: string;
  remainingBalance: string;
  totalSessions: string;
  sessionsCompleted: string;
  sessionsRemaining: string;
  username: string;
  password: string;
  sessions: { number: string; date: string; clinic: string; cost: string; status: string; notes: string }[];
}

function parseClients(content: string): ClientData[] {
  const sections = content.split("────────────────────────────────────────────────────────────────────────────────");
  const clients: ClientData[] = [];

  for (const sec of sections) {
    if (!sec.trim()) continue;

    const indexMatch = sec.match(/^\s*(\d+)\.\s+(.+)/m);
    if (!indexMatch) continue;

    const client: ClientData = {
      index: parseInt(indexMatch[1]),
      name: indexMatch[2].trim(),
      nationalId: (sec.match(/National ID:\s*(.+)/)?.[1] || "").trim(),
      phone: (sec.match(/Phone:\s*(.+)/)?.[1] || "").trim(),
      membership: (sec.match(/Membership \/ Service:\s*(.+)/)?.[1] || "").trim(),
      clinic: (sec.match(/Clinic:\s*(.+)/)?.[1] || "").trim(),
      expiryDate: (sec.match(/Expiry Date:\s*(.+)/)?.[1] || "").trim(),
      salesRep: (sec.match(/Sales Rep:\s*(.+)/)?.[1] || "").trim(),
      packageDate: (sec.match(/Package Date:\s*(.+)/)?.[1] || "").trim(),
      packageType: (sec.match(/Package Type:\s*(.+)/)?.[1] || "").trim(),
      paymentStatus: (sec.match(/Payment Status:\s*(.+)/)?.[1] || "").trim(),
      totalKd: (sec.match(/Total \(KD\):\s*(.+)/)?.[1] || "").trim(),
      amountPaidKd: (sec.match(/Amount Paid \(KD\):\s*(.+)/)?.[1] || "").trim(),
      remainingBalance: (sec.match(/Remaining Balance \(KD\):\s*(.+)/)?.[1] || "0").trim(),
      totalSessions: (sec.match(/Total Sessions in Package:\s*(.+)/)?.[1] || "").trim(),
      sessionsCompleted: (sec.match(/Sessions Completed:\s*(.+)/)?.[1] || "").trim(),
      sessionsRemaining: (sec.match(/Sessions Remaining:\s*(.+)/)?.[1] || "").trim(),
      username: (sec.match(/Username:\s*(.+)/)?.[1] || "").trim(),
      password: (sec.match(/Password:\s*(.+)/)?.[1] || "").trim(),
      sessions: [],
    };

    const sessionRegex = /Session #([^\s]+)\s*—\s*([\d-]+):\s*([^|]+)\s*\|\s*(?:Cost:\s*([\d.]+)\s*KD\s*\|)?\s*Status:\s*([^|\n]+)(?:\s*\|\s*Notes:\s*(.+))?/g;
    let m;
    while ((m = sessionRegex.exec(sec)) !== null) {
      client.sessions.push({
        number: m[1].trim(),
        date: m[2].trim(),
        clinic: m[3].trim(),
        cost: m[4] ? m[4].trim() : "0",
        status: m[5].trim(),
        notes: m[6] ? m[6].trim() : "",
      });
    }

    clients.push(client);
  }

  return clients;
}

async function generateClinicExcel(clinicAr: string, clinicEn: string, clients: ClientData[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(clinicAr, { views: [{ rightToLeft: true }] });

  // ── Title row ──
  ws.mergeCells("A1:V1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `كشف حساب المركز الطبي عبر نظام بيلاموندو — ${clinicAr}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFCC0000" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 35;

  // ── Summary row ──
  // Compute totals
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalSessionCount = 0;
  const allSessions: any[] = [];

  for (const c of clients) {
    for (const s of c.sessions) {
      if (s.clinic === clinicAr) {
        totalSessionCount++;
        totalRevenue += parseFloat(s.cost || "0");
        totalPaid += parseFloat(s.cost || "0");
        allSessions.push({ client: c, session: s });
      }
    }
  }

  ws.mergeCells("A2:F2");
  ws.getCell("A2").value = `${clinicAr}`;
  ws.getCell("A2").font = { bold: true, size: 13, color: { argb: "FFCC0000" } };

  ws.getCell("G2").value = totalRevenue.toFixed(2);
  ws.getCell("G2").font = { bold: true, size: 12 };

  ws.mergeCells("H2:J2");
  ws.getCell("H2").value = `مستخدمات صحية ${clinicAr}`;
  ws.getCell("H2").font = { bold: true, size: 11 };

  // ── Stats row ──
  ws.getCell("P2").value = totalPaid.toFixed(2);
  ws.getCell("Q2").value = totalRevenue.toFixed(2);
  ws.getCell("R2").value = totalSessionCount;
  ws.getCell("P2").font = { bold: true };
  ws.getCell("Q2").font = { bold: true };
  ws.getCell("R2").font = { bold: true };

  // ── Headers (row 3) ──
  const headers = [
    "#",
    "الاسم",
    "نوع الباقة",
    "عدد الجلسات بالباقة",
    "الجلسات المنتهية",
    "الجلسات المتبقية",
    "المبلغ الإجمالي",
    "المبلغ المدفوع",
    "المبلغ المتبقي",
    "حالة الدفع",
    "تكلفة الجلسة",
    "حالة الجلسة",
    "تاريخ الجلسة",
    "المركز",
    "مندوب المبيعات",
    "الهاتف",
    "رقم الهوية",
    "تاريخ الباقة",
    "تاريخ الانتهاء",
    "اسم المستخدم",
    "كلمة المرور",
    "ملاحظات",
  ];

  const headerRow = ws.getRow(3);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCC0000" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 30;

  // ── Data rows ──
  let rowIdx = 4;
  let counter = 1;
  for (const { client, session } of allSessions) {
    const row = ws.getRow(rowIdx);
    const values = [
      counter,
      client.name,
      client.membership,
      parseInt(client.totalSessions) || 0,
      parseInt(client.sessionsCompleted) || 0,
      parseInt(client.sessionsRemaining) || 0,
      parseFloat(client.totalKd) || 0,
      parseFloat(client.amountPaidKd) || 0,
      parseFloat(client.remainingBalance) || 0,
      client.paymentStatus,
      parseFloat(session.cost) || 0,
      session.status,
      session.date,
      session.clinic,
      client.salesRep,
      client.phone,
      client.nationalId,
      client.packageDate,
      client.expiryDate,
      client.username,
      client.password,
      session.notes,
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });

    // Alternate row colors
    const bgColor = rowIdx % 2 === 0 ? "FFFFF2CC" : "FFFFFFFF";
    values.forEach((_, i) => {
      const cell = row.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    });

    // Color the status cell based on value
    const statusCell = row.getCell(12);
    if (session.status === "معتمد") {
      statusCell.font = { color: { argb: "FF008000" }, bold: true };
    } else if (session.status === "غير معتمد") {
      statusCell.font = { color: { argb: "FFCC0000" }, bold: true };
    }

    // Color payment status
    const payStatusCell = row.getCell(10);
    if (client.paymentStatus === "Fully Paid") {
      payStatusCell.font = { color: { argb: "FF008000" }, bold: true };
    } else {
      payStatusCell.font = { color: { argb: "FFCC6600" }, bold: true };
    }

    rowIdx++;
    counter++;
  }

  // ── Column widths ──
  const widths = [5, 25, 18, 10, 10, 10, 12, 12, 12, 14, 10, 12, 14, 25, 12, 18, 18, 14, 14, 16, 16, 20];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  const safeClinicName = clinicEn.replace(/[^a-zA-Z0-9]/g, "_");
  const filePath = `../clinic_reports/${safeClinicName}.xlsx`;
  fs.mkdirSync("../clinic_reports", { recursive: true });
  await wb.xlsx.writeFile(filePath);
  console.log(`Generated: ${filePath} (${allSessions.length} sessions)`);
}

async function main() {
  const content = fs.readFileSync("../clients_data_mock.txt", "utf-8");
  const clients = parseClients(content);
  console.log(`Parsed ${clients.length} clients`);

  // Collect all unique clinic names from sessions
  const clinicSet = new Set<string>();
  for (const c of clients) {
    for (const s of c.sessions) {
      clinicSet.add(s.clinic);
    }
  }

  console.log(`Found ${clinicSet.size} clinics: ${[...clinicSet].join(", ")}`);

  for (const clinicAr of clinicSet) {
    const clinicEn = clinicNameMap[clinicAr] || clinicAr;
    await generateClinicExcel(clinicAr, clinicEn, clients);
  }

  console.log("\nDone! All clinic reports generated in ../clinic_reports/");
}

main().catch(console.error);
