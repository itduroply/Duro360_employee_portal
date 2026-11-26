import { supabase } from '../lib/supabaseClient';

// Complaints filed by the Duro team. Reads go straight to the table (Row Level
// Security lets only a Super Admin, or an Admin granted `complaints`, in).
// Lookups and the save go through the database functions in
// supabase/migrations/20261028120000_add_complaints.sql.
const BUCKET = 'complaint-docs';
const COLUMNS =
  'id, complaint_no, origin, dealer_code, dealer_name, branch_name, customer_name, customer_mobile, ' +
  'invoice_no, invoice_date, lines, amount, status, filed_by, filed_by_name, created_at, selling_branch, ' +
  'installation_context, remarks, invoice_path, photo_paths, extra_paths, ' +
  'current_approver_id, current_approver_name, manager_level, requested_level, rejection_reason, approved_at';
// Added by migrations 20261124120000_complaint_register_details.sql and 20261124130000_complaint_edit.sql.
const DETAIL_COLUMNS = ', complaint_date, dealer_mobile, dealer_email, physical_visit, physical_visit_date, manufacturing_factory, version, edited_at, edited_by_name, branch_remarks, factory_response, target_close_date, actual_close_date';

// Every status a complaint can hold. The first three are the approval flow
// (migration 20261112130000); the rest are older statuses still on file.
export const COMPLAINT_STATUSES = ['PENDING_MANAGER', 'PENDING_ACCOUNTS', 'APPROVED', 'REJECTED', 'REGISTERED', 'IN_REVIEW', 'RESOLVED'];
export const COMPLAINT_STATUS_LABEL = {
  PENDING_MANAGER: 'Pending with Manager',
  PENDING_ACCOUNTS: 'Pending with Accounts',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REGISTERED: 'Registered',
  IN_REVIEW: 'In Review',
  RESOLVED: 'Resolved',
};

// Decisions, mails and settings go through the complaint-approvals Edge
// Function; the rules themselves are in the database.
async function invokeApprovals(action, payload = {}) {
  const send = () => supabase.functions.invoke('complaint-approvals', { body: { action, payload } });
  let { data, error } = await send();
  // A 401 usually means the token ran out while the tab was in the background.
  // Refresh and retry once; if it still fails, the login is over.
  if (error?.context?.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed?.session) ({ data, error } = await send());
    if (error?.context?.status === 401) {
      await supabase.auth.signOut();
      throw new Error('Your session has expired. Please log in again.');
    }
  }
  if (error) {
    let message = error.message;
    try {
      const body = await error.context.json();
      if (body?.error || body?.message) message = body.error || body.message;
    } catch {
      // Not JSON; keep the generic message.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

function fail(error) {
  if (error) throw new Error(error.message);
}

function extension(file) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : 'bin';
}

export const complaintsApi = {
  // One page of history, newest first, plus the total for the pager.
  // `statuses` keeps only those statuses; `search` matches the complaint
  // number, dealer name, dealer code or invoice number.
  async list({ page, pageSize, statuses, search }) {
    const from = (page - 1) * pageSize;
    // Commas and brackets would break the filter text, so they are dropped.
    const term = String(search ?? '').replace(/[,()*%\\]/g, ' ').trim();
    const run = (columns) => {
      let query = supabase
        .from('complaints')
        .select(columns, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1);
      if (statuses?.length) query = query.in('status', statuses);
      if (term) {
        query = query.or(
          ['complaint_no', 'dealer_name', 'dealer_code', 'invoice_no'].map((column) => `${column}.ilike.*${term}*`).join(',')
        );
      }
      return query;
    };
    let { data, error, count } = await run(COLUMNS + DETAIL_COLUMNS);
    // The database may not have the new columns yet; read the old set then.
    if (error && /column|does not exist/i.test(error.message)) ({ data, error, count } = await run(COLUMNS));
    fail(error);
    return { rows: data, total: count ?? 0 };
  },

  // Status counts for the page header strip.
  async counts() {
    const statuses = COMPLAINT_STATUSES;
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

  // Dealers with sales in one selling branch. The branch must be one of the
  // branches tagged to this person (migration 20261113120000_complaint_multi_branch.sql).
  async dealers(branch) {
    const { data, error } = await supabase.rpc('complaint_dealers', { p_branch: branch });
    fail(error);
    return data;
  },

  // Branch assignments for the Assign Users page (Super Admin): a Map of
  // person id -> [selling branch ids]. A person with no entry files for every branch.
  async branchAssignments() {
    const { data, error } = await supabase.from('complaint_branch_access').select('profile_id, selling_branch_id');
    fail(error);
    const map = new Map();
    (data ?? []).forEach((r) => map.set(r.profile_id, [...(map.get(r.profile_id) ?? []), r.selling_branch_id]));
    return map;
  },

  // Saves the whole set in one step. An empty list means every branch.
  async setBranches(profileId, branchIds) {
    const { error } = await supabase.rpc('complaint_set_branches', { p_profile: profileId, p_branch_ids: branchIds });
    fail(error);
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
  async file({ invoiceFile, photoFiles, extraFiles, branchRemarks, factoryResponse, ...complaint }) {
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
    // Branch remarks are saved right after filing. The complaint is already
    // registered, so a failure here is reported but does not undo it.
    let branchRemarksError = '';
    if (String(branchRemarks ?? '').trim()) {
      try {
        await this.setBranchRemarks(id, branchRemarks, false);
      } catch (err) {
        branchRemarksError = err.message || 'Branch remarks could not be saved.';
      }
    }
    if (factoryResponse) {
      try {
        await this.setFactoryResponse(id, factoryResponse, false);
      } catch (err) {
        branchRemarksError ||= err.message || 'Factory response could not be saved.';
      }
    }
    return { complaintNo: data, id, branchRemarksError };
  },

  // ── Approvals ───────────────────────────────────────────────
  // What the signed-in person may do: { canFile, isAccounts, pending, hasHistory }.
  async access() {
    const { data, error } = await supabase.rpc('my_complaint_access');
    fail(error);
    return data;
  },
  // Complaints waiting on the signed-in person.
  async approvalInbox() {
    const { data, error } = await supabase.rpc('my_complaint_approvals');
    fail(error);
    return data ?? [];
  },
  // Every decision the signed-in person made.
  async approvalHistory() {
    const { data, error } = await supabase.rpc('my_complaint_history');
    fail(error);
    return data ?? [];
  },
  // The decisions taken on one complaint so far, oldest first.
  async decisions(complaintId) {
    const { data, error } = await supabase
      .from('complaint_approval')
      .select('id, stage, manager_level, approver_name, decision, reason, decided_at')
      .eq('complaint_id', complaintId)
      .order('decided_at');
    fail(error);
    return data ?? [];
  },
  // Short-lived download links for a complaint's invoice, photos and documents.
  async fileLinks(complaint) {
    const paths = [
      ...(complaint.invoice_path ? [[complaint.invoice_path, 'Invoice']] : []),
      ...(complaint.photo_paths ?? []).map((p, i) => [p, `Photo ${i + 1}`]),
      ...(complaint.extra_paths ?? []).map((p, i) => [p, `Document ${i + 1}`]),
    ];
    if (paths.length === 0) return [];
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths.map(([p]) => p), 600);
    fail(error);
    return paths.map(([path, label], i) => ({ path, label, url: data?.[i]?.signedUrl ?? null }));
  },
  // Tells the manager (or the accounts team) a complaint just filed is waiting on them.
  notifyFiled: (complaintNo) => invokeApprovals('notify_filed', { complaintNo }),
  // decision is APPROVED or REJECTED. A reason is mandatory to reject.
  // `version` is the version the approver saw; a complaint edited since is refused.
  decide: ({ complaintId, decision, reason, version }) => invokeApprovals('decide', { complaintId, decision, reason, version }),

  // ── Edit (migration 20261124130000_complaint_edit.sql) ───────────
  // One complaint, read with the same row rules as the list.
  async get(id) {
    const { data, error } = await supabase.from('complaints').select('*').eq('id', id).maybeSingle();
    fail(error);
    return data;
  },
  // What the signed-in person may edit now: { canEditComplaint, canEditComment, comment }.
  async editRights(id) {
    const { data, error } = await supabase.rpc('complaint_edit_rights', { p_complaint: id });
    fail(error);
    return data;
  },
  // Every edit made on one complaint, oldest first.
  async editLog(id) {
    const { data, error } = await supabase
      .from('complaint_edit_log')
      .select('id, kind, editor_name, version, changes, edited_at')
      .eq('complaint_id', id)
      .order('edited_at');
    fail(error);
    return data ?? [];
  },
  // The approver's own comment, after they approved.
  async editComment(id, comment) {
    const { data, error } = await supabase.rpc('complaint_edit_comment', { p_complaint: id, p_comment: comment });
    fail(error);
    return data;
  },
  // The filer's edit. `invoice`, `photos` and `extras` hold either a stored
  // path (kept as it is) or a File (uploaded to the complaint's folder first).
  async update({ id, amount, remarks, branchRemarks, factoryResponse, physicalVisit, visitDate, lineDefects, invoice, photos, extras }) {
    const stamp = Date.now();
    let n = 0;
    const store = async (item, label) => {
      if (typeof item === 'string') return item;
      n += 1;
      const path = `${id}/${label}-edit-${stamp}-${n}.${extension(item)}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, item, { contentType: item.type, upsert: false });
      fail(error);
      return path;
    };
    const invoicePath = await store(invoice, 'invoice');
    const photoPaths = [];
    for (const f of photos) photoPaths.push(await store(f, 'photo'));
    const extraPaths = [];
    for (const f of extras) extraPaths.push(await store(f, 'document'));

    const { data, error } = await supabase.rpc('complaint_update', {
      p_id: id,
      p: {
        amount,
        remarks,
        physical_visit: physicalVisit,
        physical_visit_date: physicalVisit ? visitDate : null,
        line_defects: lineDefects,
        invoice_path: invoicePath,
        photo_paths: photoPaths,
        extra_paths: extraPaths,
      },
    });
    fail(error);
    const saved = await this.setBranchRemarks(id, branchRemarks ?? '', true);
    const response = await this.setFactoryResponse(id, factoryResponse ?? '', true);
    return { ...data, changed: Boolean(data?.changed || saved?.changed || response?.changed) };
  },
  // Branch remarks (migration 20261126120000_complaint_branch_remarks.sql). `isEdit`
  // false is the first save after filing: nothing is logged.
  async setBranchRemarks(id, remarks, isEdit = true) {
    const { data, error } = await supabase.rpc('complaint_set_branch_remarks', { p_complaint: id, p_remarks: remarks, p_is_edit: isEdit });
    fail(error);
    return data;
  },
  // Factory response: '', SATISFIED or DISSATISFIED (migration 20261126130000_complaint_factory_response.sql).
  async setFactoryResponse(id, response, isEdit = true) {
    const { data, error } = await supabase.rpc('complaint_set_factory_response', { p_complaint: id, p_response: response, p_is_edit: isEdit });
    fail(error);
    return data;
  },
  settings: () => invokeApprovals('settings'),
  saveSettings: ({ bands, memberIds }) => invokeApprovals('save_settings', { bands, memberIds }),
};
