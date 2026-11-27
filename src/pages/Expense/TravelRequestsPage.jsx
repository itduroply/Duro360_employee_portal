import { useState } from 'react';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Select from '../../components/common/Select.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { expenseApi } from '../../api/expenseApi.js';
import { travelRoute, todayIso } from '../../utils/expensePolicy.js';
import { TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY } from '../../components/common/tableStyles.js';
import { BOX, Field, Input, TextArea, CitySelect, RouteSteps, fmtDate } from './expenseUi.jsx';

const NEEDS = [
  { key: 'car', label: 'Hired car' },
  { key: 'air', label: 'Air travel' },
  { key: 'train', label: 'Higher train class' },
  { key: 'own', label: 'Own vehicle (HOD also approves)' },
  { key: 'stay', label: 'Accommodation' },
];
const blank = (base) => ({ fromCity: base, toCity: '', startDate: '', endDate: '', purpose: '', mode: 'train', needs: {} });

export default function TravelRequestsPage() {
  const { user } = useAuth();
  const profile = expenseApi.getProfile(user?.id);
  const [items, setItems] = useState(() => expenseApi.listTravel(user?.id));
  const [form, setForm] = useState(() => blank(profile.baseCity));
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const count = (s) => items.filter((t) => t.status === s).length;
  const route = travelRoute(form.needs);

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.fromCity) next.fromCity = 'Choose the From city.';
    if (!form.toCity) next.toCity = 'Choose the To city.';
    if (!form.startDate || !form.endDate) next.dates = 'Choose the start and end dates.';
    else if (form.endDate < form.startDate) next.dates = 'End date is before the start date.';
    if (!form.purpose.trim()) next.purpose = 'Purpose is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const tr = expenseApi.requestTravel(user.id, form, route);
      setItems(expenseApi.listTravel(user.id));
      setForm(blank(profile.baseCity));
      setNotice(`Travel request ${tr.number} sent to ${route[0]}. Do not book before it is approved.`);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ModulePage title="Travel Requests" description="Ask for approval before the trip. An approved request counts as the prior approval the policy asks for." live>
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <KpiStrip
        items={[
          { label: 'Pending', value: String(count('Pending')), icon: 'outstanding', tone: 'warning' },
          { label: 'Approved', value: String(count('Approved')), icon: 'auditLogs', tone: 'success' },
          { label: 'Rejected', value: String(count('Rejected')), icon: 'queries', tone: 'error' },
        ]}
      />

      <form onSubmit={submit} className={`${BOX} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`} noValidate>
        <Field label="From city" error={errors.fromCity}><CitySelect value={form.fromCity} onChange={(v) => setForm({ ...form, fromCity: v })} /></Field>
        <Field label="To city" error={errors.toCity}><CitySelect value={form.toCity} onChange={(v) => setForm({ ...form, toCity: v })} /></Field>
        <Field label="Start date" error={errors.dates}><Input type="date" min={todayIso()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
        <Field label="End date"><Input type="date" min={form.startDate || todayIso()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        <Field label="Mode">
          <Select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="train">Train</option><option value="bus">Bus</option><option value="air">Air</option><option value="car">Car or taxi</option><option value="own">Own vehicle</option>
          </Select>
        </Field>
        <Field label="Purpose" error={errors.purpose} className="sm:col-span-2 lg:col-span-3">
          <TextArea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} />
        </Field>
        <fieldset className="sm:col-span-2 lg:col-span-4">
          <legend className="mb-2 text-sm font-medium text-gray-700">What do you need approved?</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {NEEDS.map((n) => (
              <label key={n.key} className="flex cursor-pointer items-center gap-2 text-theme-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={Boolean(form.needs[n.key])} onChange={(e) => setForm({ ...form, needs: { ...form.needs, [n.key]: e.target.checked } })} />
                {n.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <RouteSteps route={route} stage={-1} />
          <Button type="submit">Send request</Button>
        </div>
      </form>

      <div className={TABLE_WRAPPER}>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr><th className={TH}>Request No.</th><th className={TH}>Trip</th><th className={TH}>Dates</th><th className={TH}>Needs</th><th className={TH}>Status</th><th className={TH}>Waiting with</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} className="p-0"><EmptyState icon="reports" title="No travel requests yet" hint="Use the form above to send one." /></td></tr>
              )}
              {items.map((t) => (
                <tr key={t.id} className={TABLE_ROW}>
                  <td className={`${TD} ${TD_PRIMARY} whitespace-nowrap text-brand-600`}>{t.number}</td>
                  <td className={TD}>{t.fromCity} to {t.toCity}<span className="block max-w-[240px] truncate text-theme-xs text-gray-400" title={t.purpose}>{t.purpose}</span></td>
                  <td className={`${TD} whitespace-nowrap`}>{fmtDate(t.startDate)} – {fmtDate(t.endDate)}</td>
                  <td className={TD}>{NEEDS.filter((n) => t.needs?.[n.key]).map((n) => n.label.split(' (')[0]).join(', ') || '—'}</td>
                  <td className={TD}><StatusChip status={t.status} /></td>
                  <td className={TD}>{t.status === 'Pending' ? t.route[t.stage ?? 0] : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModulePage>
  );
}
