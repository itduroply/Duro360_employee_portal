import { useState } from 'react';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import EmptyState from '../../components/ModulePage/EmptyState.jsx';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { expenseApi } from '../../api/expenseApi.js';
import { ADVANCE_ROUTE, money } from '../../utils/expensePolicy.js';
import { TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY } from '../../components/common/tableStyles.js';
import { BOX, Field, Input, TextArea, RouteSteps, fmtDate } from './expenseUi.jsx';

export default function AdvancesPage() {
  const { user } = useAuth();
  const [advances, setAdvances] = useState(() => expenseApi.listAdvances(user?.id));
  const [form, setForm] = useState({ amount: '', purpose: '' });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const issued = advances.reduce((s, a) => s + (a.issued || 0), 0);
  const adjusted = advances.reduce((s, a) => s + (a.adjusted || 0), 0);
  const waiting = advances.filter((a) => a.status === 'Requested').length;

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!(Number(form.amount) > 0)) next.amount = 'Enter an amount above zero.';
    if (!form.purpose.trim()) next.purpose = 'Say what the advance is for. Link it to an event, meeting or trip.';
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const adv = expenseApi.requestAdvance(user.id, form, ADVANCE_ROUTE);
      setAdvances(expenseApi.listAdvances(user.id));
      setForm({ amount: '', purpose: '' });
      setNotice(`Advance ${adv.number} requested for ${money(adv.amount)}. It is with the Reporting Manager.`);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <ModulePage title="Advances" description="Request money before you spend it. The balance is adjusted when a claim is paid." live>
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <KpiStrip
        items={[
          { label: 'Balance (₹)', value: Math.round(issued - adjusted).toLocaleString('en-IN'), icon: 'payments', tone: 'brand' },
          { label: 'Issued (₹)', value: Math.round(issued).toLocaleString('en-IN'), icon: 'invoices', tone: 'success' },
          { label: 'Adjusted (₹)', value: Math.round(adjusted).toLocaleString('en-IN'), icon: 'transactions', tone: 'warning' },
          { label: 'Waiting for approval', value: String(waiting), icon: 'outstanding', tone: 'error' },
        ]}
      />

      <form onSubmit={submit} className={`${BOX} grid gap-4 sm:grid-cols-3`} noValidate>
        <Field label="Amount (₹)" error={errors.amount}>
          <Input type="number" min="0" inputMode="decimal" invalid={Boolean(errors.amount)} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </Field>
        <Field label="Purpose" error={errors.purpose} className="sm:col-span-2">
          <TextArea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Event, meeting or trip the advance is for" />
        </Field>
        <div className="sm:col-span-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <RouteSteps route={ADVANCE_ROUTE} stage={-1} />
          <Button type="submit">Request advance</Button>
        </div>
      </form>

      <div className={TABLE_WRAPPER}>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Advance No.</th><th className={TH}>Requested</th><th className={TH}>Purpose</th>
                <th className={`${TH} text-right`}>Amount</th><th className={`${TH} text-right`}>Adjusted</th><th className={TH}>Status</th><th className={TH}>Route</th>
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 && (
                <tr><td colSpan={7} className="p-0"><EmptyState icon="payments" title="No advances yet" hint="Use the form above to request one." /></td></tr>
              )}
              {advances.map((a) => (
                <tr key={a.id} className={TABLE_ROW}>
                  <td className={`${TD} ${TD_PRIMARY} whitespace-nowrap text-brand-600`}>{a.number}</td>
                  <td className={`${TD} whitespace-nowrap`}>{fmtDate(a.requestedAt)}</td>
                  <td className={TD}><span className="block max-w-[260px] truncate" title={a.purpose}>{a.purpose}</span></td>
                  <td className={`${TD} whitespace-nowrap text-right font-semibold text-gray-800`}>{money(a.amount)}</td>
                  <td className={`${TD} whitespace-nowrap text-right`}>{money(a.adjusted)}</td>
                  <td className={TD}><StatusChip status={a.status} /></td>
                  <td className={TD}><RouteSteps route={a.route} stage={a.stage ?? 0} done={a.status === 'Issued'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ModulePage>
  );
}
