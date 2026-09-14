const fs = require('fs');

const data = JSON.parse(fs.readFileSync('output_results.json', 'utf8'));

let markdown = `# Detailed Status Report for Requested Customers & Dates\n\n`;
markdown += `**Report Generated:** ${new Date().toISOString().split('T')[0]}\n`;
markdown += `**Total Records Processed:** 20\n\n`;

markdown += `## Summary Table\n\n`;
markdown += `| # | Phone Number | Date (From Image) | Customer Name | Customer Status | Package / Offer | Booking Request Status | Session Status & Date | Scan Log Status & Date |\n`;
markdown += `|---|---|---|---|---|---|---|---|---|\n`;

data.forEach(item => {
  const rowNum = item.row;
  const phone = item.inputPhone;
  const date = item.targetDate;

  if (!item.userFound) {
    markdown += `| ${rowNum} | \`${phone}\` | ${date} | *Not Found* | ❌ Not Registered | N/A | N/A | N/A | N/A |\n`;
    return;
  }

  const user = item.user;
  const customerName = user.fullName || 'N/A';
  const customerId = user.shortId || user.id;

  // Primary Offer
  let offerName = 'N/A';
  if (item.userOffers && item.userOffers.length > 0) {
    offerName = item.userOffers.map(o => `${o.offerTitle} (${o.clinicName})`).join(', ');
  }

  // Requests summary
  let requestSummary = 'No Requests';
  if (item.requests && item.requests.length > 0) {
    requestSummary = item.requests.map(r => {
      let dt = r.clinicScheduledAt ? new Date(r.clinicScheduledAt).toISOString().split('T')[0] : '';
      return `${r.status}${dt ? ` (${dt})` : ''} [${r.clinicName || ''}]`;
    }).join('<br>');
  }

  // Sessions summary
  let sessionSummary = 'No Sessions';
  if (item.sessions && item.sessions.length > 0) {
    sessionSummary = item.sessions.map(s => {
      let dt = s.scheduledAt ? new Date(s.scheduledAt).toISOString().split('T')[0] : '';
      return `**${s.shortId || ''}**: ${s.status} on ${dt} [${s.clinicName || ''}]`;
    }).join('<br>');
  }

  // Scans summary
  let scanSummary = 'No Scans';
  if (item.scans && item.scans.length > 0) {
    scanSummary = item.scans.map(sc => {
      let dt = sc.scannedAt ? new Date(sc.scannedAt).toISOString().split('T')[0] : '';
      return `${sc.status} on ${dt} [${sc.clinicName || ''}]`;
    }).join('<br>');
  }

  markdown += `| ${rowNum} | \`${phone}\` | ${date} | ${customerName} (\`${customerId}\`) | ✅ Registered | ${offerName} | ${requestSummary} | ${sessionSummary} | ${scanSummary} |\n`;
});

markdown += `\n---\n\n## Full Detailed Breakdown (Row by Row)\n\n`;

data.forEach(item => {
  const rowNum = item.row;
  const phone = item.inputPhone;
  const date = item.targetDate;

  markdown += `### Row ${rowNum}: Phone \`${phone}\` | Date \`${date}\`\n`;

  if (!item.userFound) {
    markdown += `- **Customer Status:** ❌ **Customer Not Found in Database**\n`;
    markdown += `- **Details:** No user account exists with phone number \`${phone}\` (checked with and without country code \`+965\`).\n`;
    markdown += `- **Sessions / Requests / Scans:** None.\n\n`;
    return;
  }

  const u = item.user;
  markdown += `- **Customer Name:** ${u.fullName} (ID: \`${u.shortId || u.id}\`)\n`;
  markdown += `- **Registered Phone:** \`${u.phone}\`\n`;
  markdown += `- **Account Created:** ${u.createdAt ? u.createdAt.split('T')[0] : 'N/A'}\n`;
  markdown += `- **Offers / Packages Subscribed:** ${item.userOffersCount}\n`;

  if (item.userOffers && item.userOffers.length > 0) {
    item.userOffers.forEach(o => {
      markdown += `  - 📦 **${o.offerTitle}** at *${o.clinicName}*\n`;
    });
  }

  // Booking Requests
  markdown += `- **Booking Requests (${item.requests.length}):**\n`;
  if (item.requests.length === 0) {
    markdown += `  - *No booking requests found.*\n`;
  } else {
    item.requests.forEach(r => {
      let dt = r.clinicScheduledAt ? new Date(r.clinicScheduledAt).toISOString().split('T')[0] : 'Not specified';
      let created = r.createdAt ? r.createdAt.split('T')[0] : '';
      markdown += `  - 📝 Status: **\`${r.status}\`** | Clinic: *${r.clinicName}* | Scheduled Date: **${dt}** | Created: ${created}${r.rejectionReason ? ` (Reason: ${r.rejectionReason})` : ''}${r.notes ? ` (Notes: "${r.notes}")` : ''}\n`;
    });
  }

  // Booking Sessions
  markdown += `- **Booking Sessions (${item.sessions.length}):**\n`;
  if (item.sessions.length === 0) {
    markdown += `  - *No scheduled/completed sessions found.*\n`;
  } else {
    item.sessions.forEach(s => {
      let dt = s.scheduledAt ? new Date(s.scheduledAt).toISOString().split('T')[0] : 'N/A';
      markdown += `  - 🗓️ Session ID: \`${s.shortId || s._id}\` | Status: **\`${s.status}\`** | Date: **${dt}** | Clinic: *${s.clinicName}* | Offer: *${s.offerTitle}*${s.notes ? ` (Notes: "${s.notes}")` : ''}\n`;
    });
  }

  // Scan Logs
  markdown += `- **Scan Logs (${item.scans.length}):**\n`;
  if (item.scans.length === 0) {
    markdown += `  - *No QR scan logs found.*\n`;
  } else {
    item.scans.forEach(sc => {
      let scanDt = sc.scannedAt ? new Date(sc.scannedAt).toISOString().replace('T', ' ').substring(0, 16) : 'N/A';
      markdown += `  - 📱 Scan Status: **\`${sc.status}\`** | Scanned At: **${scanDt}** | Clinic: *${sc.clinicName}* | Offer: *${sc.offerName}* | Had Scheduled Session: ${sc.hadScheduledSession ? 'Yes' : 'No'}\n`;
    });
  }

  markdown += `\n`;
});

fs.writeFileSync('customer_status_report.md', markdown);
console.log('Successfully generated customer_status_report.md');
