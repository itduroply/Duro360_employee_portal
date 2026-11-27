import { formatDate, formatDateTime } from '../../utils/format.js';

// Builds a PDF of a complaint with every detail and saves it straight to the
// computer (no print dialog). The PDF libraries load only when this runs.

const text = (v) => (v === null || v === undefined || String(v).trim() === '' ? '—' : String(v));
const num = (n) => String(Number(n));
const fileName = (p) => String(p || '').split('/').pop();
// The built-in PDF fonts have no rupee sign, so the amount is written as "Rs.".
const rupees = (v) => `Rs. ${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function stageText(row) {
  if (row.status === 'PENDING_COORDINATOR') return 'Waiting on the Complaint Coordinator';
  if (row.status === 'PENDING_MANAGER') return `Waiting on ${row.current_approver_name || 'the reporting manager'}`;
  if (row.status === 'PENDING_ACCOUNTS') return 'Waiting on the accounts team';
  return '';
}

// Turns a saved complaints row (as read from the database) into the snapshot
// that downloadComplaint() expects. Complaints filed before the extra details
// existed simply show a dash for them.
export function complaintToPrint(row, statusLabel, extra = {}) {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  return {
    complaintNo: row.complaint_no,
    complaintDate: row.complaint_date || String(row.created_at || '').slice(0, 10),
    originLabel: row.origin === 'END_CUSTOMER' ? 'End-Customer' : 'Dealer',
    isEndCustomer: row.origin === 'END_CUSTOMER',
    customerName: row.customer_name,
    customerMobile: row.customer_mobile,
    sellingBranch: row.selling_branch || row.branch_name,
    zone: extra.zone || '',
    filedBy: row.filed_by_name,
    filedAt: row.created_at ? formatDateTime(row.created_at) : '',
    status: statusLabel || row.status,
    stage: stageText(row),
    managerLevel: row.manager_level,
    requestedLevel: row.requested_level,
    approvedAt: row.approved_at ? formatDateTime(row.approved_at) : '',
    rejectionReason: row.rejection_reason,
    decisions: extra.decisions || [],
    installation: row.installation_context,
    dealerName: row.dealer_name,
    dealerCode: row.dealer_code,
    dealerMobile: row.dealer_mobile,
    dealerEmail: row.dealer_email,
    physicalVisit: Boolean(row.physical_visit),
    visitDate: row.physical_visit_date,
    invoiceNo: row.invoice_no,
    invoiceDate: row.invoice_date,
    factory: /trading/i.test(row.manufacturing_factory || '') ? '' : row.manufacturing_factory,
    amount: row.amount,
    lines: lines.map((l) => ({
      ...l,
      supplied: l.quantity,
      qtyDefective: l.qty_defective,
      primary: l.primary_nature,
      secondary: l.secondary_nature,
    })),
    invoiceFileName: fileName(row.invoice_path),
    photoNames: (row.photo_paths || []).map(fileName),
    extraNames: (row.extra_paths || []).map(fileName),
    remarks: row.remarks,
    branchRemarks: row.branch_remarks,
    targetCloseDate: row.target_close_date,
    actualCloseDate: row.actual_close_date,
    factoryResponse: { SATISFIED: 'Satisfied', DISSATISFIED: 'Dissatisfied' }[row.factory_response] || '',
    routing: statusLabel ? `Status: ${statusLabel}.` : '',
  };
}

// `c` is the snapshot taken when the complaint was saved (see FileComplaintPage)
// or the result of complaintToPrint(). Saves Complaint-<number>.pdf.
export async function downloadComplaint(c) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 14;
  const right = 196;
  const printedOn = formatDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));

  // Header
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(31, 41, 55).text('Complaint Registration', left, 18);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(107, 114, 128).text('Duroply Industries Limited', left, 24);
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(31, 41, 55).text(text(c.complaintNo), right, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(107, 114, 128).text(`Complaint Date: ${formatDate(c.complaintDate)}`, right, 24, { align: 'right' });
  doc.setDrawColor(31, 41, 55).setLineWidth(0.5).line(left, 28, right, 28);

  let y = 33;
  const gap = () => (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 6;

  // A section of label/value pairs, two per row.
  function pairs(title, items) {
    const rows = [];
    for (let i = 0; i < items.length; i += 2) {
      const [l1, v1] = items[i];
      const [l2, v2] = items[i + 1] || ['', ''];
      rows.push([l1, text(v1), l2, l2 ? text(v2) : '']);
    }
    autoTable(doc, {
      startY: y,
      margin: { left, right: 210 - right },
      head: [[{ content: title, colSpan: 4 }]],
      body: rows,
      theme: 'plain',
      headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, textColor: [31, 41, 55], overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 36, textColor: [107, 114, 128] },
        1: { cellWidth: 55, fontStyle: 'bold' },
        2: { cellWidth: 36, textColor: [107, 114, 128] },
        3: { cellWidth: 55, fontStyle: 'bold' },
      },
    });
    y = gap();
  }

  pairs('COMPLAINT', [
    ['Complaint Number', c.complaintNo],
    ['Complaint Date', formatDate(c.complaintDate)],
    ['Origination', c.originLabel],
    ['Selling Branch', c.sellingBranch],
    ...(c.zone ? [['Zone', c.zone]] : []),
    ['Filed By', c.filedBy],
    ...(c.isEndCustomer ? [['Customer Name', c.customerName], ['Customer Mobile', c.customerMobile]] : []),
  ]);

  pairs('STATUS & APPROVAL', [
    ['Status', c.status],
    ['Filed On', c.filedAt || formatDate(c.complaintDate)],
    ['Target Close Date', c.targetCloseDate ? formatDate(c.targetCloseDate) : ''],
    ['Actual Close Date', c.actualCloseDate ? formatDate(c.actualCloseDate) : ''],
    ['Current Stage', c.stage],
    ['Manager Level', c.managerLevel ? `Level ${c.managerLevel}${c.requestedLevel && c.requestedLevel !== c.managerLevel ? ` (band asked for level ${c.requestedLevel})` : ''}` : ''],
    ['Approved On', c.approvedAt],
    ['Rejection Reason', c.rejectionReason],
  ]);

  pairs('DEALER', [
    ['Dealer Name', c.dealerName],
    ['Dealer Code', c.dealerCode],
    ['Mobile Number', c.dealerMobile],
    ['Email ID', c.dealerEmail],
    ['Physical Visit', c.physicalVisit ? 'Yes' : 'No'],
    ['Physical Visit Date', c.physicalVisit ? formatDate(c.visitDate) : '—'],
  ]);

  pairs('INVOICE', [
    ['Invoice Number', c.invoiceNo],
    ['Invoice Date', c.invoiceDate ? formatDate(c.invoiceDate) : '—'],
    ...(c.zone ? [['Zone', c.zone]] : []),
    ['Selling Branch', c.sellingBranch],
    ['Manufacturing Factory', c.factory],
    ['Complaint Amount', rupees(c.amount)],
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left, right: 210 - right },
    head: [['Product', 'Thick', 'Size', 'Qty Supplied', 'Qty Defective', 'Primary Nature', 'Secondary Nature']],
    body: c.lines.map((l) => [
      `${text(l.item_name)}${l.brand ? `\n${l.brand}` : ''}`,
      l.thickness != null ? `${num(l.thickness)} mm` : '—',
      l.length_m != null && l.width_m != null ? `${num(l.length_m)} x ${num(l.width_m)} m` : '—',
      l.supplied != null ? Number(l.supplied).toLocaleString('en-IN') : '—',
      text(l.qtyDefective),
      text(l.primary),
      text(l.secondary),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.8, textColor: [31, 41, 55], lineColor: [209, 213, 219], overflow: 'linebreak' },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
  });
  y = gap();

  if (c.decisions?.length) {
    autoTable(doc, {
      startY: y,
      margin: { left, right: 210 - right },
      head: [['Decision', 'By', 'Stage', 'Date', 'Reason']],
      body: c.decisions.map((d) => [
        d.decision === 'APPROVED' ? 'Approved' : 'Rejected',
        text(d.approver_name),
        d.stage === 'COORDINATOR' ? 'Complaint Coordinator' : d.stage === 'ACCOUNTS' ? 'Accounts team' : `Manager level ${text(d.manager_level)}`,
        d.decided_at ? formatDateTime(d.decided_at) : '—',
        text(d.reason),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.8, textColor: [31, 41, 55], lineColor: [209, 213, 219], overflow: 'linebreak' },
    });
    y = gap();
  }

  pairs('EVIDENCE & REMARKS', [
    ['Invoice Copy', c.invoiceFileName],
    ['Site Photographs', c.photoNames?.length ? c.photoNames.join(', ') : '—'],
    ['Additional Documents', c.extraNames?.length ? c.extraNames.join(', ') : '—'],
    // The filing form no longer asks for this. Print it only on older complaints that have it.
    ...(c.installation ? [['Installation Context', c.installation]] : []),
    ['Dealer / Customer Remarks', c.remarks],
    ['Branch Remarks', c.branchRemarks],
    ['Factory Response', c.factoryResponse],
  ]);

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(107, 114, 128);
    doc.text(`Downloaded on ${printedOn}. ${c.routing || ''}`.trim(), left, 289);
    doc.text(`Page ${p} of ${pages}`, right, 289, { align: 'right' });
  }

  doc.save(`Complaint-${String(c.complaintNo || 'details').replace(/[^\w-]+/g, '_')}.pdf`);
}
