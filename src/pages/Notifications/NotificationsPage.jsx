import { useState } from 'react';
import ModulePage, { KpiStrip, TabBar, PendingButton } from '../../components/ModulePage/ModulePage.jsx';
import Panel from '../../components/ModulePage/Panel.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import { CHECKBOX, LABEL } from '../../components/common/formStyles.js';
import { SHOW_SAMPLE_DATA, SAMPLE_NOTIFICATIONS, TODAY } from '../../data/sample/index.js';
import { formatCount, formatDate, inPeriod } from '../../utils/format.js';

const notifications = SHOW_SAMPLE_DATA ? SAMPLE_NOTIFICATIONS : [];
const has = notifications.length > 0;

const AUDIENCES = ['All Dealers', 'Dealers in a Zone', 'Selected Dealers'];
const CHANNELS = ['Portal', 'Email'];
const FIELD =
  'w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10';

// Compose box. Nothing is sent yet -- Send stays disabled until a sending
// service is connected.
function ComposeNotification() {
  const [form, setForm] = useState({ title: '', message: '', audience: AUDIENCES[0], channels: ['Portal'] });

  function toggleChannel(channel) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(channel) ? f.channels.filter((c) => c !== channel) : [...f.channels, channel],
    }));
  }

  return (
    <Panel title="New Notification" subtitle="Write a message and choose who gets it." className="xl:col-span-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="notification-title" className={LABEL}>
            Title
          </label>
          <input
            id="notification-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={`${FIELD} h-10`}
          />
        </div>
        <div>
          <label htmlFor="notification-audience" className={LABEL}>
            Send To
          </label>
          <select
            id="notification-audience"
            value={form.audience}
            onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}
            className={`${FIELD} h-10 cursor-pointer`}
          >
            {AUDIENCES.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor="notification-message" className={`${LABEL} mt-4`}>
        Message
      </label>
      <textarea
        id="notification-message"
        rows={5}
        value={form.message}
        onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        className={`${FIELD} py-2.5`}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-5">
          <span className="text-sm font-medium text-gray-700">Channel</span>
          {CHANNELS.map((channel) => (
            <label key={channel} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.channels.includes(channel)}
                onChange={() => toggleChannel(channel)}
                className={CHECKBOX}
              />
              {channel}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <PendingButton>Save Draft</PendingButton>
          <PendingButton variant="primary">Send</PendingButton>
        </div>
      </div>
    </Panel>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M5 8.2a5 5 0 0 1 10 0v3.3l1.5 2.5h-13L5 11.5V8.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.2 16.5a1.9 1.9 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Right column: what has been sent, scheduled or saved as draft.
function NotificationHistory() {
  const [tab, setTab] = useState('Sent');
  const shown = notifications.filter((n) => n.status === tab);
  return (
    <Panel
      title="History"
      right={<TabBar tabs={['Sent', 'Scheduled', 'Drafts']} active={tab} onChange={setTab} />}
      className="xl:col-span-2"
      flush
    >
      {shown.length === 0 ? (
        <EmptyState icon="notifications" title={`No ${tab.toLowerCase()} notifications`} hint="Notifications will be listed here with who got them and when." />
      ) : (
        <ol className="divide-y divide-gray-100">
          {shown.map((n) => (
            <li key={n.id} className="flex gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <BellIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-theme-sm font-medium text-gray-800">{n.title}</p>
                <p className="mt-0.5 text-theme-xs text-gray-500">
                  {n.audience} · {n.channel}
                </p>
              </div>
              <div className="shrink-0 text-right text-theme-xs text-gray-500">
                <p>{n.date === '—' ? 'Not sent' : formatDate(n.date)}</p>
                <p className="mt-0.5 text-gray-400">{n.by}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export default function NotificationsPage() {
  const count = (test) => (has ? formatCount(notifications.filter(test).length) : undefined);
  return (
    <ModulePage title="Notifications" description="Send notifications to dealers and see what has been sent.">
      <KpiStrip
        items={[
          { label: 'Sent This Month', value: count((n) => n.status === 'Sent' && inPeriod(n.date, 'This Month', TODAY)), icon: 'notifications', tone: 'brand' },
          { label: 'Scheduled', value: count((n) => n.status === 'Scheduled'), icon: 'outstanding', tone: 'warning' },
          { label: 'Drafts', value: count((n) => n.status === 'Drafts'), icon: 'documents', tone: 'gray' },
          { label: 'Sent This Year', value: count((n) => n.status === 'Sent'), icon: 'dealers', tone: 'success' },
        ]}
      />
      <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-5">
        <ComposeNotification />
        <NotificationHistory />
      </div>
    </ModulePage>
  );
}
