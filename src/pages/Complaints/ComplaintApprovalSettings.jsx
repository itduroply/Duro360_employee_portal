import { useEffect, useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import { complaintsApi } from '../../api/complaintsApi';
import { usersApi } from '../../api/usersApi';
import { INPUT, LABEL } from '../../components/common/formStyles.js';
import { TABLE, TABLE_HEAD, TABLE_ROW, TD, TH, TABLE_WRAPPER } from '../../components/common/tableStyles.js';

const withCommas = (value) => {
  const raw = String(value ?? '').replace(/[^\d.]/g, '');
  if (raw === '') return '';
  const [whole, frac] = raw.split('.');
  return Number(whole).toLocaleString('en-IN') + (frac !== undefined ? `.${frac}` : '');
};

const stripCommas = (value) => String(value ?? '').replace(/[^\d.]/g, '');

// Super Admin only: the amount bands that pick the manager level, and the
// accounts team. Saved as a whole; a filed complaint keeps the band it got.
export default function ComplaintApprovalSettings() {
  const [bands, setBands] = useState([]);
  const [members, setMembers] = useState([]);
  const [people, setPeople] = useState([]);
  const [pick, setPick] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true); 
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([complaintsApi.settings(), usersApi.listEmployees(), usersApi.listAdmins()])
      .then(([settings, employees, admins]) => {
        if (cancelled) return;
        setBands(settings.bands.map((b) => ({ ...b, minAmount: String(b.minAmount), maxAmount: b.maxAmount === null ? '' : String(b.maxAmount), managerLevel: String(b.managerLevel) })));
        setMembers(settings.members);
        const all = [...(employees.users ?? []), ...(admins.users ?? [])].filter((u) => u.status === 'ACTIVE');
        setPeople(all);
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load the settings.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const chosen = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((p) => !chosen.has(p.id))
      .filter((p) => !q || [p.name, p.email, p.employee_id].some((v) => String(v ?? '').toLowerCase().includes(q)))
      .slice(0, 50);
  }, [people, chosen, query]);

  function setBand(index, field, value) {
    setBands((list) => list.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function addBand() {
    const last = bands[bands.length - 1];
    const from = last && last.maxAmount ? String(Number(stripCommas(last.maxAmount)) + 1) : '';
    setBands((list) => [...list, { minAmount: from, maxAmount: '', managerLevel: String((Number(last?.managerLevel) || 0) + 1) }]);
  }

  function addMember() {
    const p = people.find((x) => x.id === pick);
    if (!p) return;
    setMembers((list) => [...list, { id: p.id, name: p.name, email: p.email, employeeId: p.employee_id, active: true }]);
    setPick('');
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await complaintsApi.saveSettings({
        bands: bands.map((b) => ({ minAmount: stripCommas(b.minAmount), maxAmount: stripCommas(b.maxAmount), managerLevel: b.managerLevel })),
        memberIds: members.map((m) => m.id),
      });
      setNotice(result.message);
    } catch (err) {
      setError(err.message || 'The settings could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-theme-sm text-gray-500">Loading settings…</p>;

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      <div className={TABLE_WRAPPER}>
        <div className="px-5 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-gray-800">Amount bands</h3>
          <p className="mt-1 text-theme-xs text-gray-500">
            Level 1 is the filer's own reporting manager, level 2 is that manager's manager, and so on. Leave "To" empty for no upper limit.
            A band change applies to complaints filed after it is saved.
          </p>
        </div>
        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>From (₹)</th>
                <th className={TH}>To (₹)</th>
                <th className={TH}>Manager level</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b, i) => (
                <tr key={i} className={TABLE_ROW}>
                  <td className={TD}>
                    <input className={`${INPUT} w-40`} inputMode="decimal" value={withCommas(b.minAmount)} onChange={(e) => setBand(i, 'minAmount', stripCommas(e.target.value))} />
                  </td>
                  <td className={TD}>
                    <input className={`${INPUT} w-40`} inputMode="decimal" placeholder="No limit" value={withCommas(b.maxAmount)} onChange={(e) => setBand(i, 'maxAmount', stripCommas(e.target.value))} />
                  </td>
                  <td className={TD}>
                    <input className={`${INPUT} w-24`} inputMode="numeric" value={b.managerLevel} onChange={(e) => setBand(i, 'managerLevel', e.target.value.replace(/\D/g, ''))} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <button type="button" className="text-theme-sm font-medium text-error-500 hover:underline" onClick={() => setBands((list) => list.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 px-5 py-3 sm:px-6">
          <Button variant="secondary" size="sm" onClick={addBand}>Add band</Button>
        </div>
      </div>

      <div className={TABLE_WRAPPER}>
        <div className="px-5 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-gray-800">Accounts team</h3>
          <p className="mt-1 text-theme-xs text-gray-500">Any one of these people can give the accounts approval. They see the complaint under My approvals.</p>
        </div>
        <div className="px-5 pb-4 sm:px-6">
          {members.length === 0 && <p className="mb-3 text-theme-sm text-warning-700">No member yet. Complaints approved by a manager will wait until someone is added.</p>}
          <ul className="mb-4 flex flex-wrap gap-2">
            {members.map((m) => (
              <li key={m.id} className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-theme-sm">
                <span className="font-medium text-gray-800">{m.name}</span>
                <span className="text-gray-500">{m.employeeId || m.email}</span>
                {m.active === false && <span className="text-error-500">inactive</span>}
                <button type="button" aria-label={`Remove ${m.name}`} className="text-gray-400 hover:text-error-500" onClick={() => setMembers((list) => list.filter((x) => x.id !== m.id))}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className={LABEL} htmlFor="accounts-search">Find a person</label>
              <input id="accounts-search" className={INPUT} placeholder="Name, email or employee code" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="accounts-pick">Add to accounts team</label>
              <select id="accounts-pick" className={INPUT} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Select…</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.employee_id || p.email}
                  </option>
                ))}
              </select>
            </div>
            <Button variant="secondary" onClick={addMember} disabled={!pick}>Add</Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} isLoading={saving}>Save settings</Button>
      </div>
    </div>
  );
}
