import { supabase } from '../lib/supabaseClient';

// Complaints filed by the Duro team. Reads go straight to the table (Row Level
// Security lets only a Super Admin, or an Admin granted `complaints`, in).
// Lookups and the save go through the database functions in
// supabase/migrations/20261028120000_add_complaints.sql.
const BUCKET = 'complaint-docs';
const COLUMNS =
  'id, complaint_no, origin, dealer_code, dealer_name, branch_name, customer_name, customer_mobile, ' +
  'invoice_no, invoice_date, lines, amount, status, filed_by_name, created_at';

function fail(error) {
  if (error) throw new Error(error.message);
}

function extension(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : 'bin';
}

export const complaintsApi = {
  // One page of history, newest first, plus the total for the pager.
  async list({ page, pageSize }) {
    const from = (page - 1) * pageSize;
    const { data, error, count } = await supabase
      .from('complaints')
      .select(COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    fail(error);
    return { rows: data, total: count ?? 0 };
  },

  // Status counts for the page header strip.
  async counts() {
    const statuses = ['REGISTERED', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];
    const results = await Promise.all(
      statuses.map((s) => supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', s))
    );
    results.forEach((r) => fail(r.error));
    return Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0]));
  },

  // Selling branches this person may file for (all, or just their own).
  async branches() {
    const { data, error } = await supabase.rpc('complaint_branches');
    fail(error);
    return data;
  },

  // Dealers with sales in one selling branch.
  async dealers(branch) {
    const { data, error } = await supabase.rpc('complaint_dealers', { p_branch: branch });
    fail(error);
    return data;
  },

  async invoices(dealerCode) {
    const { data, error } = await supabase.rpc('complaint_invoices', { p_dealer_code: dealerCode });
    fail(error);
    return data;
  },

  async invoiceLines(dealerCode, documentNumber) {
    const { data, error } = await supabase.rpc('complaint_invoice_lines', {
      p_dealer_code: dealerCode,
      p_document_number: documentNumber,
    });
    fail(error);
    return data;
  },

  // Uploads every file to <new id>/, then registers the complaint. A new id is
  // made on every attempt, so a retry never collides with files left by a
  // failed one. Returns the complaint number.
  async file({ invoiceFile, photoFiles, extraFiles, ...complaint }) {
    const id = crypto.randomUUID();
    const invoicePath = `${id}/invoice.${extension(invoiceFile)}`;
    const photoPaths = photoFiles.map((f, i) => `${id}/photo-${i + 1}.${extension(f)}`);
    const extraPaths = extraFiles.map((f, i) => `${id}/document-${i + 1}.${extension(f)}`);
    const uploads = [
      [invoicePath, invoiceFile],
      ...photoPaths.map((p, i) => [p, photoFiles[i]]),
      ...extraPaths.map((p, i) => [p, extraFiles[i]]),
    ];

    for (const [path, file] of uploads) {
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      fail(error);
    }

    const { data, error } = await supabase.rpc('file_complaint', {
      complaint: { ...complaint, id, invoice_path: invoicePath, photo_paths: photoPaths, extra_paths: extraPaths },
    });
    fail(error);
    return data;
  },
};
