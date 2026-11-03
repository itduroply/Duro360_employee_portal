import { SERIES_COLORS, ORDINAL_BLUE } from '../../components/Charts/chartTheme.js';
import { usersApi } from '../../api/usersApi.js';
import { schemesApi } from '../../api/schemesApi.js';
import { warrantyApi } from '../../api/warrantyApi.js';
import { queriesApi } from '../../api/queriesApi.js';
import { creditApi } from '../../modules/creditApproval/api/creditApi.js';
import { formatCount, formatLacs, formatLacsWhole, monthLabel } from '../../utils/format.js';

// Live reports. Each module below matches one Admin feature (the same key the
// Super Admin ticks in Users > Admins), and reads the same data as that
// feature's own page, so Row Level Security and the Edge Functions decide what
// each person can see. Nothing here is sample data.
//
// A module has:
//   load()           fetches the rows
//   build(rows, n)   returns { summary, charts }; n is the range in months
// A chart is { id, type, title, subtitle, span, table, ...what the type needs }.
const [C1, C2, C3, C4] = SERIES_COLORS;

const sum = (list) => list.reduce((s, v) => s + v, 0);
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '0%');
const countBy = (rows, key) => rows.reduce((m, r) => m.set(key(r), (m.get(key(r)) || 0) + 1), new Map());
const toRows = (map, limit) =>
  [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, limit);

// The last n calendar months as 'YYYY-MM', oldest first.
function monthKeys(n) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

// How many rows fall in each of the last n months, by the date `at(row)`.
function perMonth(rows, at, n) {
  const keys = monthKeys(n);
  const counts = new Map(keys.map((k) => [k, 0]));
  rows.forEach((r) => {
    const k = at(r)?.slice(0, 7);
    if (counts.has(k)) counts.set(k, counts.get(k) + 1);
  });
  return { labels: keys.map(monthLabel), values: keys.map((k) => counts.get(k)) };
}

const donutParts = (rows, colors = SERIES_COLORS) => rows.map((r, i) => ({ ...r, color: colors[i % colors.length] }));
const tableOf = (columns, rows) => ({ columns, rows });
const todayIso = () => new Date().toISOString().slice(0, 10);

// ── Dealers ─────────────────────────────────────────────────────────────
const dealers = {
  key: 'dealers',
  label: 'Dealers',
  icon: 'dealers',
  about: 'Dealer directory by zone, selling branch and credit limit.',
  load: async () => (await usersApi.listDealerDirectory()).dealers,
  build(rows) {
    const byZone = toRows(countBy(rows, (d) => d.zone || 'Not set'));
    const byBranch = toRows(countBy(rows, (d) => d.selling_branch || 'Not set'), 10);
    const limitLacs = (d) => (Number(d.credit_limit) || 0) / 100000;
    const withLimit = rows.filter((d) => limitLacs(d) > 0);
    const topLimits = [...withLimit].sort((a, b) => limitLacs(b) - limitLacs(a)).slice(0, 10);
    return {
      summary: [
        { label: 'Dealers', value: formatCount(rows.length), icon: 'dealers', tone: 'brand' },
        { label: 'Zones', value: formatCount(byZone.length) },
        { label: 'Selling Branches', value: formatCount(countBy(rows, (d) => d.selling_branch || 'Not set').size) },
        { label: 'Total Credit Limit', value: formatLacsWhole(sum(rows.map(limitLacs))), unit: 'Rs Lacs' },
      ],
      charts: [
        {
          id: 'zone', type: 'donut', title: 'Dealers by zone', subtitle: 'Share of the dealer directory',
          parts: donutParts(byZone.slice(0, 4).concat(byZone.length > 4 ? [{ label: 'Other zones', value: sum(byZone.slice(4).map((z) => z.value)) }] : [])),
          centerLabel: 'Dealers', format: formatCount,
          table: tableOf(['Zone', 'Dealers', 'Share'], byZone.map((z) => [z.label, formatCount(z.value), pct(z.value, rows.length)])),
        },
        {
          id: 'branch', type: 'bars', title: 'Top selling branches', subtitle: 'Dealers per branch, top 10',
          rows: byBranch, format: formatCount,
          table: tableOf(['Selling Branch', 'Dealers'], byBranch.map((b) => [b.label, formatCount(b.value)])),
        },
        {
          id: 'limits', type: 'bars', span: 2, title: 'Highest credit limits', subtitle: 'Top 10 dealers, Rs Lacs',
          rows: topLimits.map((d) => ({ label: d.customer_name, value: limitLacs(d) })), format: formatLacs,
          table: tableOf(['Dealer', 'Credit Limit (Rs Lacs)'], topLimits.map((d) => [d.customer_name, formatLacs(limitLacs(d))])),
        },
      ],
    };
  },
};

// ── Schemes ─────────────────────────────────────────────────────────────
const schemes = {
  key: 'schemes',
  label: 'Schemes',
  icon: 'schemes',
  about: 'Scheme status, types and how many dealers each one reaches.',
  load: () => schemesApi.list(),
  build(rows, range) {
    const today = todayIso();
    const stateOf = (s) => (s.start_date > today ? 'Upcoming' : s.end_date < today ? 'Ended' : 'Active');
    const states = countBy(rows, stateOf);
    const byType = toRows(countBy(rows, (s) => s.type || 'Other'));
    const started = perMonth(rows, (s) => s.start_date, range);
    const reach = [...rows]
      .map((s) => ({ label: s.name, value: s.audience === 'ALL' ? null : (s.scheme_dealers || []).length, all: s.audience === 'ALL' }))
      .filter((s) => !s.all && s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return {
      summary: [
        { label: 'Schemes', value: formatCount(rows.length), icon: 'schemes', tone: 'brand' },
        { label: 'Active Now', value: formatCount(states.get('Active') || 0), tone: 'success' },
        { label: 'Upcoming', value: formatCount(states.get('Upcoming') || 0), tone: 'warning' },
        { label: 'For All Dealers', value: formatCount(rows.filter((s) => s.audience === 'ALL').length) },
      ],
      charts: [
        {
          id: 'state', type: 'donut', title: 'Schemes by status', subtitle: 'Today, by start and end date',
          parts: ['Active', 'Upcoming', 'Ended'].map((k, i) => ({ label: k, value: states.get(k) || 0, color: [C4, C3, ORDINAL_BLUE[0]][i] })),
          centerLabel: 'Schemes', format: formatCount,
          table: tableOf(['Status', 'Schemes'], ['Active', 'Upcoming', 'Ended'].map((k) => [k, formatCount(states.get(k) || 0)])),
        },
        {
          id: 'type', type: 'bars', title: 'Schemes by type', subtitle: 'All schemes created',
          rows: byType, format: formatCount,
          table: tableOf(['Type', 'Schemes'], byType.map((t) => [t.label, formatCount(t.value)])),
        },
        {
          id: 'started', type: 'column', title: 'Schemes started per month', subtitle: `Last ${range} months`,
          labels: started.labels, series: [{ name: 'Schemes started', color: C1, values: started.values }], format: (v) => `${v} schemes`,
          table: tableOf(['Month', 'Schemes Started'], started.labels.map((m, i) => [m, started.values[i]])),
        },
        {
          id: 'reach', type: 'bars', title: 'Dealers per selected scheme', subtitle: 'Schemes for chosen dealers only, top 10',
          rows: reach, format: formatCount,
          table: tableOf(['Scheme', 'Dealers'], reach.map((s) => [s.label, formatCount(s.value)])),
        },
      ],
    };
  },
};

// ── Duro Certificates ───────────────────────────────────────────────────
const warranty = {
  key: 'warranty',
  label: 'Duro Certificates',
  icon: 'warranty',
  about: 'Certificates raised, issued and waiting, by program and dealer.',
  monthly: true,
  load: () => warrantyApi.list(),
  build(rows, range) {
    const states = countBy(rows, (c) => c.status);
    const raised = perMonth(rows, (c) => c.created_at, range);
    const issued = perMonth(rows.filter((c) => c.status === 'ISSUED'), (c) => c.created_at, range);
    const byProgram = toRows(countBy(rows, (c) => c.program || 'Other'));
    const byDealer = toRows(countBy(rows, (c) => c.dealer_name || c.dealer_code || 'Unknown'), 10);
    const decided = (states.get('ISSUED') || 0) + (states.get('REJECTED') || 0);
    return {
      summary: [
        { label: 'Certificates', value: formatCount(rows.length), icon: 'warranty', tone: 'brand' },
        { label: 'Issued', value: formatCount(states.get('ISSUED') || 0), tone: 'success' },
        { label: 'Pending', value: formatCount(states.get('PENDING') || 0), tone: 'warning' },
        { label: 'Approval Rate', value: pct(states.get('ISSUED') || 0, decided) },
      ],
      charts: [
        {
          id: 'trend', type: 'area', span: 2, title: 'Certificates per month', subtitle: `Raised and issued, last ${range} months`,
          labels: raised.labels,
          series: [{ name: 'Raised', color: C1, values: raised.values }, { name: 'Issued', color: C4, values: issued.values }],
          format: (v) => `${v} certificates`,
          table: tableOf(['Month', 'Raised', 'Issued'], raised.labels.map((m, i) => [m, raised.values[i], issued.values[i]])),
        },
        {
          id: 'status', type: 'donut', title: 'Certificates by status', subtitle: 'All certificates',
          parts: ['ISSUED', 'PENDING', 'REJECTED'].map((k, i) => ({ label: { ISSUED: 'Issued', PENDING: 'Pending', REJECTED: 'Rejected' }[k], value: states.get(k) || 0, color: [C4, C3, C1][i] })),
          centerLabel: 'Certificates', format: formatCount,
          table: tableOf(['Status', 'Certificates'], ['ISSUED', 'PENDING', 'REJECTED'].map((k) => [k, formatCount(states.get(k) || 0)])),
        },
        {
          id: 'program', type: 'donut', title: 'Duro and Tower', subtitle: 'Certificates by program',
          parts: donutParts(byProgram), centerLabel: 'Certificates', format: formatCount,
          table: tableOf(['Program', 'Certificates'], byProgram.map((p) => [p.label, formatCount(p.value)])),
        },
        {
          id: 'dealer', type: 'bars', span: 2, title: 'Top dealers by certificates', subtitle: 'Top 10 dealers',
          rows: byDealer, format: formatCount,
          table: tableOf(['Dealer', 'Certificates'], byDealer.map((d) => [d.label, formatCount(d.value)])),
        },
      ],
    };
  },
};

// ── Dealer Queries ──────────────────────────────────────────────────────
const queries = {
  key: 'queries',
  label: 'Dealer Queries',
  icon: 'queries',
  about: 'Queries and complaints raised, resolved and how fast.',
  monthly: true,
  load: () => queriesApi.list(),
  build(rows, range) {
    const states = countBy(rows, (q) => q.status);
    const raised = perMonth(rows, (q) => q.raisedOn, range);
    const resolvedRows = rows.filter((q) => q.resolvedOn);
    const resolved = perMonth(resolvedRows, (q) => q.resolvedOn, range);
    const hours = resolvedRows.map((q) => (new Date(q.resolvedOn) - new Date(q.raisedOn)) / 3600000).filter((h) => h >= 0);
    const avgHours = hours.length ? Math.round(sum(hours) / hours.length) : 0;
    const byType = toRows(countBy(rows, (q) => q.type));
    const byRelated = toRows(countBy(rows, (q) => q.related || 'Other'), 8);
    const open = (states.get('Open') || 0) + (states.get('In Progress') || 0);
    return {
      summary: [
        { label: 'Queries', value: formatCount(rows.length), icon: 'queries', tone: 'brand' },
        { label: 'Open', value: formatCount(open), tone: 'warning' },
        { label: 'Resolved', value: formatCount((states.get('Resolved') || 0) + (states.get('Closed') || 0)), tone: 'success' },
        { label: 'Average Resolution', value: avgHours >= 48 ? `${Math.round(avgHours / 24)} days` : `${avgHours} hrs` },
      ],
      charts: [
        {
          id: 'trend', type: 'area', span: 2, title: 'Queries per month', subtitle: `Raised and resolved, last ${range} months`,
          labels: raised.labels,
          series: [{ name: 'Raised', color: C1, values: raised.values }, { name: 'Resolved', color: C4, values: resolved.values }],
          format: (v) => `${v} queries`,
          table: tableOf(['Month', 'Raised', 'Resolved'], raised.labels.map((m, i) => [m, raised.values[i], resolved.values[i]])),
        },
        {
          id: 'status', type: 'donut', title: 'Queries by status', subtitle: 'All queries',
          parts: ['Open', 'In Progress', 'Resolved', 'Closed'].map((k, i) => ({ label: k, value: states.get(k) || 0, color: [C3, C2, C4, ORDINAL_BLUE[0]][i] })),
          centerLabel: 'Queries', format: formatCount,
          table: tableOf(['Status', 'Queries'], ['Open', 'In Progress', 'Resolved', 'Closed'].map((k) => [k, formatCount(states.get(k) || 0)])),
        },
        {
          id: 'type', type: 'donut', title: 'Query or complaint', subtitle: 'By type',
          parts: donutParts(byType), centerLabel: 'Queries', format: formatCount,
          table: tableOf(['Type', 'Queries'], byType.map((t) => [t.label, formatCount(t.value)])),
        },
        {
          id: 'related', type: 'bars', span: 2, title: 'What dealers ask about', subtitle: 'Queries by topic',
          rows: byRelated, format: formatCount,
          table: tableOf(['Topic', 'Queries'], byRelated.map((t) => [t.label, formatCount(t.value)])),
        },
      ],
    };
  },
};

// ── Dealer Unlocking ────────────────────────────────────────────────────
// The credit functions answer by the person's credit role: a Requester sees
// their own requests, an Approver the ones they hold, EDP every request.
const dealerUnlocking = {
  key: 'dealerUnlocking',
  label: 'Dealer Unlocking',
  icon: 'dealerUnlocking',
  about: 'Credit unlock requests by status, type and branch.',
  monthly: true,
  async load() {
    const { role } = await creditApi.getUserRole();
    const { requisitions } =
      role === 'edp' ? await creditApi.getEdpRequisitions()
        : role === 'approver' ? await creditApi.getApproverRequisitions()
          : await creditApi.getRequesterRequisitions();
    return { role, requisitions };
  },
  build({ role, requisitions: rows }, range) {
    const status = (r) => String(r.status || '').toLowerCase();
    const states = countBy(rows, status);
    const sent = perMonth(rows, (r) => r.sentAt, range);
    const decided = rows.filter((r) => ['approved', 'rejected', 'closed'].includes(status(r)));
    const approved = (states.get('approved') || 0) + (states.get('closed') || 0);
    const byBranch = toRows(countBy(rows, (r) => r.branchName || 'Not set'), 8);
    const byType = toRows(countBy(rows, (r) => r.requestType || 'Temporary'));
    const scope = { edp: 'All requests', approver: 'Requests assigned to you', requester: 'Requests you raised' }[role] || 'Requests';
    return {
      summary: [
        { label: scope, value: formatCount(rows.length), icon: 'dealerUnlocking', tone: 'brand' },
        { label: 'Open', value: formatCount((states.get('pending') || 0) + (states.get('referred') || 0)), tone: 'warning' },
        { label: 'Approved', value: formatCount(approved), tone: 'success' },
        { label: 'Approval Rate', value: pct(approved, decided.length) },
      ],
      charts: [
        {
          id: 'trend', type: 'column', span: 2, title: 'Requests per month', subtitle: `${scope}, last ${range} months`,
          labels: sent.labels, series: [{ name: 'Requests', color: C1, values: sent.values }], format: (v) => `${v} requests`,
          table: tableOf(['Month', 'Requests'], sent.labels.map((m, i) => [m, sent.values[i]])),
        },
        {
          id: 'status', type: 'donut', title: 'Requests by status', subtitle: scope,
          parts: [['pending', 'Pending', C3], ['referred', 'Referred', C2], ['approved', 'Approved', C4], ['rejected', 'Rejected', C1], ['closed', 'Closed', ORDINAL_BLUE[0]]]
            .map(([k, label, color]) => ({ label, value: states.get(k) || 0, color })),
          centerLabel: 'Requests', format: formatCount,
          table: tableOf(['Status', 'Requests'], [...states.entries()].map(([k, v]) => [k[0].toUpperCase() + k.slice(1), formatCount(v)])),
        },
        {
          id: 'type', type: 'donut', title: 'Temporary and Permanent', subtitle: 'By request type',
          parts: donutParts(byType), centerLabel: 'Requests', format: formatCount,
          table: tableOf(['Type', 'Requests'], byType.map((t) => [t.label, formatCount(t.value)])),
        },
        {
          id: 'branch', type: 'bars', span: 2, title: 'Requests by branch', subtitle: 'Top 8 branches',
          rows: byBranch, format: formatCount,
          table: tableOf(['Branch', 'Requests'], byBranch.map((b) => [b.label, formatCount(b.value)])),
        },
      ],
    };
  },
};

export const REPORT_MODULES = [dealers, schemes, warranty, queries, dealerUnlocking];

// The modules this person may see: a Super Admin sees all of them, an Admin
// only the features the Super Admin ticked for them.
export function modulesFor(user) {
  if (user?.roles?.includes('SUPERADMIN')) return REPORT_MODULES;
  const held = user?.permissions || [];
  return REPORT_MODULES.filter((m) => held.includes(m.key));
}
