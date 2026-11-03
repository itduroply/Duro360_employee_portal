// Shared helpers for the Credit Approval module (Dealer Unlocking).
// Amounts are in rupees, as in the source credit approval app. Ageing
// buckets and their order match the get-branch-customers function.

export const AGEING_BUCKETS = [
  { key: 'aging0To30', label: '0-30' },
  { key: 'aging31To60', label: '31-60' },
  { key: 'aging61To90', label: '61-90' },
  { key: 'aging91To120', label: '91-120' },
  { key: 'aging121To180', label: '121-180' },
  { key: 'agingAbove180', label: 'Above 180' },
];

export const OPERATORS = [
  { value: '<', label: 'Less than' },
  { value: '<=', label: 'Less than or equal to' },
  { value: '>', label: 'Greater than' },
  { value: '>=', label: 'Greater than or equal to' },
  { value: 'between', label: 'In between' },
];

export const CREDIT_ROLES = ['Requester', 'Approver', 'EDP'];

// Requests are identified by a long unique id. People see and search a short
// reference made from its first 8 characters, for example CR-3F9A12BC.
export function shortId(id) {
  return `CR-${String(id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function toNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

// Indian digit grouping for plain digits (200101664 -> 2,00,01,664).
export function withCommas(value) {
  const match = String(value ?? '').match(/^(-?)(\d+)(\.\d*)?$/);
  return match ? `${match[1]}${Number(match[2]).toLocaleString('en-IN')}${match[3] ?? ''}` : String(value ?? '');
}

export function rupees(value) {
  const n = toNumber(value);
  return Number.isFinite(n) && String(value ?? '').trim() !== ''
    ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
    : '—';
}

// Requests saved before the Temporary/Permanent choice existed were all temporary.
export const requestTypeOf = (value) => (value === 'Permanent' ? 'Permanent' : 'Temporary');

export function ruleSummary(rule) {
  if (rule.dealers?.length) return `${rule.dealers.length} specific dealer${rule.dealers.length > 1 ? 's' : ''}, any amount`;
  const op = OPERATORS.find((o) => o.value === rule.operator);
  const lower = withCommas(String(rule.amount));
  return rule.operator === 'between'
    ? `Between ₹ ${lower} and ₹ ${withCommas(String(rule.upperAmount))}`
    : `${op?.label ?? rule.operator} ₹ ${lower}`;
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// A date, or a date and time when the value carries a time.
export function formatWhen(value) {
  return String(value ?? '').length > 10 ? formatDateTime(value) : formatDate(value);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
