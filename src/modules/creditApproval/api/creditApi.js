// The only door between the Credit Approval screens and the data.
//
// Every call goes to a credit Edge Function (supabase/functions/credit-*).
// The business rules live in those functions: who may act, how the approver is
// chosen from the routing rules, what is final, and what is written to the
// record. Nothing here decides any of that, so the screens cannot get around it.
//
// This file only reshapes what the functions return into what the screens use.

import { supabase } from '../../../lib/supabaseClient.js';
import { shortId } from '../lib/format.js';

// Calls one function. A failed call throws an Error with the function's own
// message (for example "Remark is mandatory to approve a request.").
//
// A 401 usually means the login token ran out (for example after the tab sat in
// the background). The session is refreshed and the call is sent once more. If
// that still fails, the login is over: sign out so the app returns to the login
// page, instead of showing "Unauthorized" on every screen.
async function call(name, body) {
  let { data, error } = await supabase.functions.invoke(`credit-${name}`, { body: body ?? {} });
  if (error?.context?.status === 401) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed?.session) {
      ({ data, error } = await supabase.functions.invoke(`credit-${name}`, { body: body ?? {} }));
    }
    if (error?.context?.status === 401) {
      await supabase.auth.signOut();
      throw new Error('Your session has expired. Please log in again.');
    }
  }
  if (error) {
    let message = error.message;
    try {
      const reply = await error.context.json();
      message = reply?.error || reply?.message || message;
    } catch {
      // The reply was not JSON. Keep the generic message above.
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const withRef = (rows) => (rows ?? []).map((r) => ({ ...r, ref: shortId(r.id) }));

export const creditApi = {
  // ── Who am I ─────────────────────────────────────────────
  // { name, role } with role one of requester, approver, edp.
  getUserRole: () => call('get-user-role'),

  // ── Requester ────────────────────────────────────────────
  async getRequesterRequisitions() {
    const data = await call('get-requester-requisitions');
    return { ...data, requisitions: withRef(data.requisitions) };
  },
  getBranchCustomers: (branchCode) => call('get-branch-customers', { branchCode }),
  getCustomerPerformance: (customerCode) => call('get-customer-performance', { customerCode }),
  // Permanent requests only: average payment days, last revision date and the
  // Temporary unlock counts for one financial year.
  getPermanentInsight: (customerCode, financialYearStart) => call('get-permanent-insight', { customerCode, financialYearStart }),
  // attachments are results of uploadAttachment made before the request exists.
  submitRequisition: (formData, attachments = []) => call('submit-requisition', { formData, attachments }),

  // The conversation on one request, plus the decision once there is one.
  async getQueryThread(requisitionId) {
    const data = await call('get-requisition-query-thread', { requisitionId });
    const thread = (data.thread ?? []).map((m) => ({ id: m.id, type: m.type, message: m.message, byName: m.by, at: m.createdAt, attachments: m.attachments ?? [] }));
    const decision = data.approval
      ? { kind: 'Approved', text: data.approval.remark, byName: data.approval.by, at: data.approval.at, attachments: data.approval.attachments ?? [] }
      : data.rejection
        ? { kind: 'Rejected', text: data.rejection.reason, byName: data.rejection.by, at: data.rejection.at, attachments: data.rejection.attachments ?? [] }
        : null;
    // Approvals of the levels below the last one, for a Permanent request.
    const earlierApprovals = (data.earlierApprovals ?? []).map((a) => ({ level: a.level, text: a.remark, byName: a.by, at: a.at, attachments: a.attachments ?? [] }));
    return { thread, decision, earlierApprovals, awaitingReply: thread.length > 0 && thread[thread.length - 1].type === 'query' };
  },

  replyQuery: (requisitionId, message, attachments = []) => call('reply-requisition-query', { requisitionId, message, attachments }),

  // Stores one file against a request. The result goes in the attachments of
  // the query or reply that is sent next. With no requisitionId (a new request
  // that is not sent yet) the Requester keeps the file until it is submitted.
  uploadAttachment(requisitionId, file) {
    const body = new FormData();
    if (requisitionId) body.append('requisitionId', requisitionId);
    body.append('file', file);
    return call('upload-attachment', body);
  },

  // ── Approver ─────────────────────────────────────────────
  async getApproverRequisitions() {
    const data = await call('get-approver-requisitions');
    return { requisitions: withRef(data.requisitions).map((r) => ({ ...r, status: cap(r.status) })) };
  },
  getApproverActionHistory: () => call('get-approver-action-history'),
  // action is approve, reject or query. Pass remark, reason or queryMessage to match.
  // Any action may also carry attachments (results of uploadAttachment).
  processRequisition: (input) => call('process-requisition', input),

  // ── EDP ──────────────────────────────────────────────────
  // EDP reads every request, and closes it once it is approved.
  async getEdpRequisitions() {
    const data = await call('get-edp-requisitions');
    return { requisitions: withRef(data.requisitions) };
  },
  getEdpRequisitionThread: (requisitionId) => call('get-edp-requisition-thread', { requisitionId }),
  closeRequisition: (requisitionId, remark) => call('close-requisition', { requisitionId, remark }),

  // ── Credit users (portal Super Admin) ────────────────────
  async listCreditUsers() {
    const data = await call('get-admin-data');
    const rulesByRequester = new Map();
    for (const rule of data.approvalRules ?? []) {
      const list = rulesByRequester.get(rule.requester_employee_id) ?? [];
      list.push(rule);
      rulesByRequester.set(rule.requester_employee_id, list);
    }
    const branchById = new Map((data.sellingBranches ?? []).map((b) => [b.id, b]));
    const branchIdsByRequester = new Map();
    for (const row of data.requesterSellingBranches ?? []) {
      const list = branchIdsByRequester.get(row.requester_employee_id) ?? [];
      list.push(row.selling_branch_id);
      branchIdsByRequester.set(row.requester_employee_id, list);
    }
    const users = (data.employees ?? []).map((e) => {
      const sellingBranchIds = branchIdsByRequester.get(e.employee_id) ?? [];
      return {
        id: e.employee_id,
        code: e.employee_code,
        name: e.employee_name,
        email: e.email,
        mobile: e.mobile_no,
        role: e.role_name,
        sellingBranchIds,
        sellingBranches: sellingBranchIds.map((id) => branchById.get(id)).filter(Boolean),
        rules: (rulesByRequester.get(e.employee_id) ?? [])
          .sort((a, b) => a.priority - b.priority)
          .map((r) => ({
            operator: r.condition_operator,
            amount: Number(r.amount_min),
            upperAmount: r.amount_max == null ? null : Number(r.amount_max),
            approverId: r.approver_employee_id,
            secondApproverId: r.second_approver_employee_id ?? null,
            dealers: r.dealers ?? [],
          })),
      };
    });
    return {
      users,
      // The Permanent approval levels: [{ level, approverIds }], in order.
      permanentLevels: data.permanentLevels ?? [],
      sellingBranches: data.sellingBranches ?? [],
      dealers: data.dealers ?? [],
      approvers: users.filter((u) => u.role === 'Approver').map((u) => ({ id: u.id, name: u.name })),
    };
  },

  // Portal logins that can still be added to credit approval.
  async listPortalLogins() {
    const data = await call('list-portal-logins');
    return data.logins ?? [];
  },

  // Adds a person, or changes one when editingId is given. Rules are sent in
  // the order shown on screen, which becomes their priority.
  saveCreditUser(form, editingId = null) {
    const payload = {
      email: form.email,
      employeeCode: form.employeeCode,
      employeeName: form.name,
      mobileNo: form.mobile,
      roleName: form.role,
      sellingBranchIds: form.role === 'Requester' ? form.sellingBranchIds.map(Number) : [],
      approvalRules: form.role === 'Requester'
        ? [...form.rules]
          // Dealer rules go first, so they are checked before any amount rule.
          // They have no amount test, so they are stored as "from 0 up".
          .sort((a, b) => Number(b.kind === 'dealer') - Number(a.kind === 'dealer'))
          .map((r) => (r.kind === 'dealer'
            ? { operator: '>=', amount: '0', upperAmount: '', approverId: r.approverId, secondApproverId: r.secondApproverId || null, dealers: r.dealers.map((d) => ({ code: d.code })) }
            : { operator: r.operator, amount: r.amount, upperAmount: r.upperAmount, approverId: r.approverId, secondApproverId: r.secondApproverId || null, dealers: [] }))
        : [],
    };
    return editingId ? call('update-employee', { ...payload, employeeId: editingId }) : call('create-employee', payload);
  },

  // Saves the Permanent levels. The order sent is the order of the levels.
  setPermanentApprovers: (levels) => call('set-permanent-approvers', { levels: levels.map((l) => ({ approverIds: l.approverIds.map(Number) })) }),

  revokeCreditUser: (employeeId) => call('delete-employee', { employeeId }),
};
