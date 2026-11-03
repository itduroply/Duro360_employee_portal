import { SERIES_COLORS, ORDINAL_BLUE } from '../../components/Charts/chartTheme.js';
import { SHOW_SAMPLE_DATA, MONTHLY, REPORT_MONTHS, salesByDealer, salesByZone, orderStatusCounts,
  SAMPLE_OUTSTANDING, AGEING_BUCKETS, SAMPLE_SCHEMES, QUERY_MONTHLY, DOCUMENT_REQUESTS_MONTHLY, LOGIN_DAILY,} from '../../data/sample/index.js';
import { formatCount, formatLacs, formatLacsWhole, monthLabel } from '../../utils/format.js';

const [BLUE, ORANGE] = SERIES_COLORS;
const lacs = (v) => `${formatLacs(v)} Lacs`;
const sum = (list) => list.reduce((s, v) => s + v, 0);
const lastN = (list, n) => list.slice(-n);
const months = (range) => lastN(REPORT_MONTHS, range).map(monthLabel);

export const REPORT_GROUPS = [
  {
    module: 'Sales',
    icon: 'orders',
    reports: [
      {
        name: 'Sales by Dealer',
        build: () => {
          const top = salesByDealer.slice(0, 10);
          return {
            summary: [
              { label: 'Total Sales', value: formatLacsWhole(sum(salesByDealer.map((d) => d.value))), unit: 'Rs Lacs' },
              { label: 'Top Dealer', value: top[0]?.label ?? '—' },
              { label: 'Dealers Ordering', value: formatCount(salesByDealer.length) },
            ],
            chart: { type: 'bars', title: 'Top 10 dealers by order value', subtitle: 'April to date, Rs Lacs', rows: top, format: formatLacs },
            table: { columns: ['Dealer', 'Order Value (Rs Lacs)'], rows: salesByDealer.map((d) => [d.label, formatLacs(d.value)]) },
          };
        },
      },
      {
        name: 'Sales by Zone',
        about: 'Order value per zone and selling branch.',
        build: () => {
          const total = sum(salesByZone.map((z) => z.value));
          const best = [...salesByZone].sort((a, b) => b.value - a.value)[0];
          return {
            summary: [
              { label: 'Total Sales', value: formatLacsWhole(total), unit: 'Rs Lacs' },
              { label: 'Top Zone', value: best.label },
              { label: 'Top Zone Share', value: `${Math.round((best.value / total) * 100)}%` },
            ],
            chart: {
              type: 'column',
              title: 'Order value by zone',
              subtitle: 'April to date, Rs Lacs',
              labels: salesByZone.map((z) => z.label),
              series: [{ name: 'Order value', color: BLUE, values: salesByZone.map((z) => z.value) }],
              format: lacs,
            },
            table: { columns: ['Zone', 'Order Value (Rs Lacs)', 'Share'], rows: salesByZone.map((z) => [z.label, formatLacs(z.value), `${Math.round((z.value / total) * 100)}%`]) },
          };
        },
      },
      {
        name: 'Order Summary',
        about: 'Orders by status, with dispatch and delivery dates.',
        monthly: true,
        build: (range) => {
          const counts = lastN(MONTHLY.orderCount, range);
          return {
            summary: orderStatusCounts.slice(0, 3).map((s) => ({ label: s.label, value: formatCount(s.value) })),
            chart: {
              type: 'column',
              title: 'Orders placed per month',
              subtitle: 'Cancelled orders not counted',
              labels: months(range),
              series: [{ name: 'Orders', color: BLUE, values: counts }],
              format: (v) => `${v} orders`,
            },
            table: {
              columns: ['Month', 'Orders', 'Order Value (Rs Lacs)'],
              rows: months(range).map((m, i) => [m, formatCount(counts[i]), formatLacs(lastN(MONTHLY.orderValue, range)[i])]),
            },
          };
        },
      },
    ],
  },
  {
    module: 'Accounts',
    icon: 'outstanding',
    reports: [
      {
        name: 'Invoice Register',
        about: 'All invoices raised in a period.',
        monthly: true,
        build: (range) => {
          const values = lastN(MONTHLY.invoiceValue, range);
          return {
            summary: [
              { label: 'Invoiced', value: formatLacsWhole(sum(values)), unit: 'Rs Lacs' },
              { label: 'Monthly Average', value: formatLacsWhole(sum(values) / values.length), unit: 'Rs Lacs' },
            ],
            chart: {
              type: 'column',
              title: 'Invoice value per month',
              subtitle: 'Rs Lacs',
              labels: months(range),
              series: [{ name: 'Invoiced', color: BLUE, values }],
              format: lacs,
            },
            table: { columns: ['Month', 'Invoiced (Rs Lacs)'], rows: months(range).map((m, i) => [m, formatLacs(values[i])]) },
          };
        },
      },
      {
        name: 'Payment Collection',
        about: 'Payments received, by mode and by dealer.',
        monthly: true,
        build: (range) => {
          const invoiced = lastN(MONTHLY.invoiceValue, range);
          const collected = lastN(MONTHLY.collections, range);
          return {
            summary: [
              { label: 'Collected', value: formatLacsWhole(sum(collected)), unit: 'Rs Lacs' },
              { label: 'Invoiced', value: formatLacsWhole(sum(invoiced)), unit: 'Rs Lacs' },
              { label: 'Collected vs Invoiced', value: `${Math.round((sum(collected) / sum(invoiced)) * 100)}%` },
            ],
            chart: {
              type: 'line',
              title: 'Invoiced and collected per month',
              subtitle: 'Rs Lacs',
              labels: months(range),
              series: [
                { name: 'Invoiced', color: BLUE, values: invoiced },
                { name: 'Collected', color: ORANGE, values: collected },
              ],
              format: lacs,
            },
            table: {
              columns: ['Month', 'Invoiced (Rs Lacs)', 'Collected (Rs Lacs)'],
              rows: months(range).map((m, i) => [m, formatLacs(invoiced[i]), formatLacs(collected[i])]),
            },
          };
        },
      },
      {
        name: 'Debtors Ageing',
        about: 'Outstanding split into 0–30, 31–60, 61–90 and 90+ days.',
        build: () => {
          const totals = AGEING_BUCKETS.map((b) => sum(SAMPLE_OUTSTANDING.map((d) => d.buckets[b])));
          const total = sum(totals);
          return {
            summary: [
              { label: 'Total Outstanding', value: formatLacsWhole(total), unit: 'Rs Lacs' },
              { label: 'Over 60 Days', value: formatLacsWhole(totals[2] + totals[3]), unit: 'Rs Lacs' },
              { label: 'Over 60 Days Share', value: `${Math.round(((totals[2] + totals[3]) / total) * 100)}%` },
            ],
            chart: {
              type: 'stacked',
              title: 'Outstanding by age of invoice',
              subtitle: 'Older debt is darker, Rs Lacs',
              parts: AGEING_BUCKETS.map((b, i) => ({ label: `${b} Days`, value: totals[i], color: ORDINAL_BLUE[i] })),
              format: formatLacs,
            },
            table: {
              columns: ['Dealer', ...AGEING_BUCKETS.map((b) => `${b} (Rs Lacs)`), 'Total (Rs Lacs)'],
              rows: SAMPLE_OUTSTANDING.map((d) => [d.name, ...AGEING_BUCKETS.map((b) => formatLacs(d.buckets[b])), formatLacs(d.outstanding)]),
            },
          };
        },
      },
      {
        name: 'Credit Limit Use',
        about: 'Outstanding against credit limit for each dealer.',
        build: () => {
          const over = SAMPLE_OUTSTANDING.filter((d) => d.outstanding > d.creditLimit);
          return {
            summary: [
              { label: 'Dealers over Limit', value: formatCount(over.length) },
              { label: 'Amount over Limit', value: formatLacsWhole(sum(over.map((d) => d.outstanding - d.creditLimit))), unit: 'Rs Lacs' },
            ],
            chart: {
              type: 'bars',
              title: 'Outstanding against credit limit',
              subtitle: 'Dark marker = credit limit. Orange bar = over the limit. Rs Lacs',
              rows: SAMPLE_OUTSTANDING.map((d) => ({ label: d.name, value: d.outstanding, limit: d.creditLimit })),
              format: formatLacs,
            },
            table: {
              columns: ['Dealer', 'Outstanding (Rs Lacs)', 'Credit Limit (Rs Lacs)', 'Used'],
              rows: SAMPLE_OUTSTANDING.map((d) => [d.name, formatLacs(d.outstanding), formatLacs(d.creditLimit), `${Math.round((d.outstanding / d.creditLimit) * 100)}%`]),
            },
          };
        },
      },
    ],
  },
  {
    module: 'Schemes',
    icon: 'schemes',
    reports: [
      {
        name: 'Scheme Performance',
        about: 'Dealers enrolled and payout for each scheme.',
        build: () => {
          const paid = SAMPLE_SCHEMES.filter((s) => s.payout > 0);
          return {
            summary: [
              { label: 'Total Payout', value: formatLacsWhole(sum(SAMPLE_SCHEMES.map((s) => s.payout))), unit: 'Rs Lacs' },
              { label: 'Schemes with Payout', value: formatCount(paid.length) },
            ],
            chart: {
              type: 'bars',
              title: 'Payout by scheme',
              subtitle: 'Rs Lacs',
              rows: [...paid].sort((a, b) => b.payout - a.payout).map((s) => ({ label: s.name, value: s.payout })),
              format: formatLacs,
            },
            table: {
              columns: ['Scheme', 'Dealers Enrolled', 'Payout (Rs Lacs)'],
              rows: SAMPLE_SCHEMES.map((s) => [s.name, `${s.dealers} of ${s.target}`, formatLacs(s.payout)]),
            },
          };
        },
      },
    ],
  },
  {
    module: 'Service',
    icon: 'queries',
    reports: [
      {
        name: 'Query Resolution',
        about: 'Queries raised, resolved and average reply time.',
        monthly: true,
        build: (range) => {
          const raised = lastN(QUERY_MONTHLY.raised, range);
          const resolved = lastN(QUERY_MONTHLY.resolved, range);
          return {
            summary: [
              { label: 'Raised', value: formatCount(sum(raised)) },
              { label: 'Resolved', value: formatCount(sum(resolved)) },
              { label: 'Average Reply', value: `${lastN(QUERY_MONTHLY.avgReplyHours, 1)[0]} hrs` },
            ],
            chart: {
              type: 'line',
              title: 'Queries raised and resolved per month',
              labels: months(range),
              series: [
                { name: 'Raised', color: BLUE, values: raised },
                { name: 'Resolved', color: ORANGE, values: resolved },
              ],
              format: (v) => `${v} queries`,
            },
            table: {
              columns: ['Month', 'Raised', 'Resolved', 'Average Reply (hrs)'],
              rows: months(range).map((m, i) => [m, raised[i], resolved[i], lastN(QUERY_MONTHLY.avgReplyHours, range)[i]]),
            },
          };
        },
      },
      {
        name: 'Document Requests',
        about: 'Documents asked for by dealers and how fast they were shared.',
        monthly: true,
        build: (range) => {
          const requested = lastN(DOCUMENT_REQUESTS_MONTHLY.requested, range);
          const shared = lastN(DOCUMENT_REQUESTS_MONTHLY.shared, range);
          return {
            summary: [
              { label: 'Requested', value: formatCount(sum(requested)) },
              { label: 'Shared', value: formatCount(sum(shared)) },
            ],
            chart: {
              type: 'column',
              title: 'Document requests per month',
              labels: months(range),
              series: [
                { name: 'Requested', color: BLUE, values: requested },
                { name: 'Shared', color: ORANGE, values: shared },
              ],
              format: (v) => `${v} documents`,
            },
            table: { columns: ['Month', 'Requested', 'Shared'], rows: months(range).map((m, i) => [m, requested[i], shared[i]]) },
          };
        },
      },
    ],
  },
  {
    module: 'Access',
    icon: 'auditLogs',
    reports: [
      {
        name: 'Login Activity',
        about: 'Logins by user and role, including failed attempts.',
        build: () => ({
          summary: [
            { label: 'Logins, Last 14 Days', value: formatCount(sum(LOGIN_DAILY.success)) },
            { label: 'Failed Attempts', value: formatCount(sum(LOGIN_DAILY.failed)) },
          ],
          chart: {
            type: 'line',
            title: 'Logins per day',
            subtitle: 'Last 14 days',
            labels: LOGIN_DAILY.days,
            series: [
              { name: 'Successful', color: BLUE, values: LOGIN_DAILY.success },
              { name: 'Failed', color: ORANGE, values: LOGIN_DAILY.failed },
            ],
            format: (v) => `${v} logins`,
          },
          table: { columns: ['Day', 'Successful', 'Failed'], rows: LOGIN_DAILY.days.map((d, i) => [d, LOGIN_DAILY.success[i], LOGIN_DAILY.failed[i]]) },
        }),
      },
    ],
  },
];

export const HAS_REPORT_DATA = SHOW_SAMPLE_DATA;
