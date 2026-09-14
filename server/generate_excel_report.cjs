const fs = require('fs');
const ExcelJS = require('exceljs');

async function buildExcel() {
  const data = JSON.parse(fs.readFileSync('output_results.json', 'utf8'));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Belamonda Admin';
  workbook.lastModifiedBy = 'Belamonda Admin';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Customer Status Report', {
    views: [{ showGridLines: true }]
  });

  // Define columns
  worksheet.columns = [
    { header: '#', key: 'rowNum', width: 6 },
    { header: 'Input Phone', key: 'inputPhone', width: 14 },
    { header: 'Image Date', key: 'targetDate', width: 14 },
    { header: 'Reg. Status', key: 'userFound', width: 14 },
    { header: 'User ID', key: 'shortId', width: 14 },
    { header: 'Customer Full Name', key: 'fullName', width: 26 },
    { header: 'Registered Phone', key: 'phone', width: 16 },
    { header: 'Subscribed Package / Offer', key: 'offers', width: 30 },
    { header: 'Clinic', key: 'clinics', width: 20 },
    { header: 'Booking Requests Status', key: 'requests', width: 35 },
    { header: 'Booking Sessions Status & Dates', key: 'sessions', width: 45 },
    { header: 'QR Scan Logs & Dates', key: 'scans', width: 40 },
    { header: 'Notes / Remarks', key: 'notes', width: 35 }
  ];

  // Style Header Row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1F4E79' } // Dark blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 28;

  data.forEach(item => {
    const rowNum = item.row;
    const phone = item.inputPhone;
    const date = item.targetDate;

    if (!item.userFound) {
      const addedRow = worksheet.addRow({
        rowNum: rowNum,
        inputPhone: phone,
        targetDate: date,
        userFound: 'Not Found ❌',
        shortId: '-',
        fullName: 'Not Registered',
        phone: '-',
        offers: '-',
        clinics: '-',
        requests: 'None',
        sessions: 'None',
        scans: 'None',
        notes: 'Phone number not found in database'
      });

      addedRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      // Light red highlight for missing user
      addedRow.getCell('userFound').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FCE4D6' }
      };
      addedRow.getCell('userFound').font = { color: { argb: 'C00000' }, bold: true };
      return;
    }

    const u = item.user;
    const shortId = u.shortId || u.id;
    const fullName = u.fullName || 'N/A';
    const regPhone = u.phone || phone;

    let offersStr = '-';
    let clinicsStr = '-';
    if (item.userOffers && item.userOffers.length > 0) {
      offersStr = item.userOffers.map(o => o.offerTitle).join(', ');
      clinicsStr = item.userOffers.map(o => o.clinicName).join(', ');
    }

    let reqsStr = 'None';
    if (item.requests && item.requests.length > 0) {
      reqsStr = item.requests.map(r => {
        let dt = r.clinicScheduledAt ? new Date(r.clinicScheduledAt).toISOString().split('T')[0] : '';
        return `${r.status}${dt ? ` (${dt})` : ''} [${r.clinicName || ''}]`;
      }).join('\n');
    }

    let sessStr = 'None';
    if (item.sessions && item.sessions.length > 0) {
      sessStr = item.sessions.map(s => {
        let dt = s.scheduledAt ? new Date(s.scheduledAt).toISOString().split('T')[0] : '';
        return `${s.shortId || ''}: ${s.status} (${dt}) [${s.clinicName || ''}]`;
      }).join('\n');
    }

    let scansStr = 'None';
    if (item.scans && item.scans.length > 0) {
      scansStr = item.scans.map(sc => {
        let dt = sc.scannedAt ? new Date(sc.scannedAt).toISOString().split('T')[0] : '';
        return `${sc.status} (${dt}) [${sc.clinicName || ''}]`;
      }).join('\n');
    }

    let notesArr = [];
    if (item.sessions && item.sessions.length > 0) {
      item.sessions.forEach(s => { if (s.notes) notesArr.push(`Session ${s.shortId}: ${s.notes}`); });
    }
    if (item.requests && item.requests.length > 0) {
      item.requests.forEach(r => { if (r.notes) notesArr.push(`Request: ${r.notes}`); });
    }

    const addedRow = worksheet.addRow({
      rowNum: rowNum,
      inputPhone: phone,
      targetDate: date,
      userFound: 'Registered ✅',
      shortId: shortId,
      fullName: fullName,
      phone: regPhone,
      offers: offersStr,
      clinics: clinicsStr,
      requests: reqsStr,
      sessions: sessStr,
      scans: scansStr,
      notes: notesArr.join('\n') || '-'
    });

    addedRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    addedRow.getCell('rowNum').alignment = { vertical: 'middle', horizontal: 'center' };
    addedRow.getCell('inputPhone').alignment = { vertical: 'middle', horizontal: 'center' };
    addedRow.getCell('targetDate').alignment = { vertical: 'middle', horizontal: 'center' };
    addedRow.getCell('userFound').alignment = { vertical: 'middle', horizontal: 'center' };
    addedRow.getCell('shortId').alignment = { vertical: 'middle', horizontal: 'center' };
    addedRow.getCell('phone').alignment = { vertical: 'middle', horizontal: 'center' };

    addedRow.getCell('userFound').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'E2EFDA' }
    };
    addedRow.getCell('userFound').font = { color: { argb: '375623' }, bold: true };
  });

  // Borders for all cells
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'D9D9D9' } },
        left: { style: 'thin', color: { argb: 'D9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'D9D9D9' } },
        right: { style: 'thin', color: { argb: 'D9D9D9' } }
      };
    });
  });

  const filePath = 'customer_status_report.xlsx';
  await workbook.xlsx.writeFile(filePath);
  console.log(`SUCCESSFULLY CREATED ${filePath}`);
}

buildExcel().catch(err => console.error(err));
