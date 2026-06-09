export async function exportComprehensiveReportXlsx(filters: { from?: string; to?: string } = {}, opts?: { rtl?: boolean }) {
  const rtl = opts?.rtl ?? true;
  const dateFilter = buildDateFilter(filters.from, filters.to);

  const usersQ: any = {};
  const paymentsQ: any = { status: "completed" };
  const membershipsQ: any = {};
  const txnsQ: any = {};
  const sessionsQ: any = {};

  if (dateFilter) {
    usersQ.createdAt = dateFilter;
    paymentsQ.createdAt = dateFilter;
    membershipsQ.createdAt = dateFilter;
    txnsQ.createdAt = dateFilter;
    sessionsQ.scheduledAt = dateFilter;
  }

  const [users, payments, memberships, txns, sessions] = await Promise.all([
    UserModel.find(usersQ).sort({ createdAt: -1 }).lean(),
    PaymentModel.find(paymentsQ).sort({ createdAt: -1 }).lean(),
    UserOfferModel.find(membershipsQ).sort({ createdAt: -1 }).lean(),
    WalletTxnModel.find(txnsQ).sort({ createdAt: -1 }).lean(),
    BookingSessionModel.find(sessionsQ).sort({ scheduledAt: -1 }).lean(),
  ]);

  // Build lookups
  const userMap: Record<string, any> = {};
  users.forEach((u: any) => {
    userMap[String(u._id)] = u;
    if (u.username) userMap[u.username] = u;
  });

  const offerIds = [...new Set([
    ...memberships.map((m: any) => String(m.offerId)),
    ...payments.map((p: any) => String(p.offerId)),
    ...sessions.map((s: any) => String(s.offerId)),
  ].filter(Boolean))];
  const offers = offerIds.length
    ? await OfferModel.find({ _id: { $in: offerIds } }).select("name").lean()
    : [];
  const offerMap: Record<string, string> = {};
  offers.forEach((o: any) => { offerMap[String(o._id)] = o.name; });

  const clinicIds = [...new Set([
    ...memberships.map((m: any) => String(m.clinicId)),
    ...payments.map((p: any) => String(p.clinicId)),
    ...sessions.map((s: any) => String(s.clinicId)),
  ].filter(Boolean))];
  const clinics = clinicIds.length
    ? await ClinicModel.find({ _id: { $in: clinicIds } }).select("nameEn").lean()
    : [];
  const clinicMap: Record<string, string> = {};
  clinics.forEach((c: any) => { clinicMap[String(c._id)] = c.nameEn; });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Belamonda";
  wb.created = new Date();

  const addSheet = (name: string, headers: string[], rows: any[][]) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: rtl }] });
    const headerRow = ws.getRow(1);
    headerRow.values = headers;
    headerRow.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    });
    rows.forEach((r, idx) => { ws.getRow(idx + 2).values = r; });
    
    // Auto-fit columns roughly
    headers.forEach((h, i) => {
      let max = h.length;
      rows.forEach(r => {
        const val = r[i] ? String(r[i]) : "";
        if (val.length > max) max = val.length;
      });
      ws.getColumn(i + 1).width = Math.min(50, max + 2);
    });
  };

  // 1. Customers
  addSheet(
    "Customers",
    ["User ID", "Full Name", "Username", "Phone", "Email", "National ID", "Role", "Status", "Joined"],
    users.map((u: any) => [
      String(u._id), u.fullName ?? "", u.username ?? "", u.phone ?? "", u.email ?? "",
      u.civilIdNumberMasked ?? "", u.role ?? "", u.isActive !== false ? "Active" : "Disabled",
      u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : ""
    ])
  );

  // 2. Subscriptions
  addSheet(
    "Subscriptions",
    ["Membership ID", "User ID", "Customer Name", "Phone", "Offer", "Status", "Purchase Mode", "Sessions Used", "Total Installments", "Installments Paid", "Amount (KWD)", "Activated", "Created"],
    memberships.map((m: any) => {
      const u = userMap[m.userId] || {};
      return [
        String(m._id), m.userId, u.fullName || u.username || "", u.phone || "",
        offerMap[String(m.offerId)] ?? "", m.status, m.purchaseMode ?? "",
        m.sessionsUsed ?? 0, m.installmentCount ?? "", m.installmentsPaid ?? 0,
        m.paymentAmountKwd ?? "",
        m.activatedAt ? new Date(m.activatedAt).toISOString().slice(0, 10) : "",
        m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : ""
      ];
    })
  );

  // 3. Sessions
  addSheet(
    "Sessions",
    ["Session ID", "Date", "Customer Name", "Phone", "Clinic", "Offer", "Status", "Bill (KWD)", "Session Type", "Notes"],
    sessions.map((s: any) => {
      const u = userMap[s.userId] || {};
      return [
        String(s._id),
        s.scheduledAt ? new Date(s.scheduledAt).toISOString().slice(0, 16).replace("T", " ") : "",
        u.fullName || u.username || "", u.phone || "",
        clinicMap[String(s.clinicId)] ?? "", offerMap[String(s.offerId)] ?? "",
        s.status, s.finalPaidKwd || s.totalBillKwd || "0", s.sessionType || "", s.notes || ""
      ];
    })
  );

  // 4. Payments
  addSheet(
    "Payments",
    ["Payment ID", "Date", "Customer Name", "Phone", "Offer", "Clinic", "Amount (KWD)", "Gross (KWD)", "Cashback Applied", "Method", "Purpose", "Status"],
    payments.map((p: any) => {
      const u = userMap[p.userId] || {};
      return [
        String(p._id),
        p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 16).replace("T", " ") : "",
        u.fullName || u.username || "", u.phone || "",
        offerMap[String(p.offerId)] ?? "", clinicMap[String(p.clinicId)] ?? "",
        p.amountKwd, p.grossAmountKwd ?? p.amountKwd, p.cashbackAppliedKwd ?? "0",
        p.method, p.purpose, p.status
      ];
    })
  );

  // 5. Cashback Transactions
  addSheet(
    "Cashback Txns",
    ["Txn ID", "Date", "Customer Name", "Phone", "Type", "Amount (KWD)", "Reason"],
    txns.map((t: any) => {
      const u = userMap[t.userId] || {};
      return [
        String(t._id),
        t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 16).replace("T", " ") : "",
        u.fullName || u.username || "", u.phone || "",
        t.type, t.amountKwd, t.reason ?? ""
      ];
    })
  );

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf as ArrayBuffer);
}
