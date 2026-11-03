import { useEffect, useMemo, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import Select from '../../components/common/Select.jsx';
import Alert from '../../components/common/Alert.jsx';
import { SearchIcon, CloseIcon } from '../../components/common/icons.jsx';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { CHECKBOX, INPUT, INPUT_OK, LABEL } from '../../components/common/formStyles.js';
import { schemesApi } from '../../api/schemesApi';
import { SCHEME_TYPES, schemeRule, todayIso } from '../../utils/schemes.js';

const EMPTY_FORM = {
  name: '', type: SCHEME_TYPES[0], start_date: '', end_date: '',
  purchase_target: '', incentive_rate: '', note: '', audience: 'ALL',
};
const LIST_LIMIT = 50; // dealer rows shown at once in the picker

function DealerPicker({ directory, selected, onChange }) {
  const [search, setSearch] = useState('');
  const [zone, setZone] = useState('');

  const zones = useMemo(() => Array.from(new Set(directory.map((d) => d.zone).filter(Boolean))).sort(), [directory]);
  const byCode = useMemo(() => new Map(directory.map((d) => [d.customer_code, d])), [directory]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory.filter(
      (d) =>
        (!zone || d.zone === zone) &&
        (!q || d.customer_name?.toLowerCase().includes(q) || d.customer_code.toLowerCase().includes(q))
    );
  }, [directory, search, zone]);

  const toggle = (code) => onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  const addAllMatches = () => onChange(Array.from(new Set([...selected, ...matches.map((d) => d.customer_code)])));

  return (
    <div className="rounded-xl border border-gray-200">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-3 sm:flex-row">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-500">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dealer name or code"
            className={`${INPUT} ${INPUT_OK} pl-11`}
          />
        </div>
        <Select value={zone} onChange={(e) => setZone(e.target.value)} wrapperClassName="sm:w-40" aria-label="Zone">
          <option value="">All Zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-theme-xs text-gray-500">
        <span>{matches.length.toLocaleString('en-IN')} dealers match</span>
        {matches.length > 0 && (
          <button type="button" onClick={addAllMatches} className="font-medium text-brand-500 hover:text-brand-600">
            Select all {matches.length.toLocaleString('en-IN')}
          </button>
        )}
      </div>

      <ul className="custom-scrollbar max-h-52 overflow-y-auto px-2 pb-2">
        {matches.slice(0, LIST_LIMIT).map((d) => (
          <li key={d.customer_code}>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50">
              <input type="checkbox" checked={selected.includes(d.customer_code)} onChange={() => toggle(d.customer_code)} className={CHECKBOX} />
              <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-800">{d.customer_name}</span>
              <span className="text-theme-xs text-gray-500">
                {d.customer_code}
                {d.zone && ` · ${d.zone}`}
              </span>
            </label>
          </li>
        ))}
        {matches.length > LIST_LIMIT && (
          <li className="px-2 py-2 text-theme-xs text-gray-500">
            Showing the first {LIST_LIMIT}. Search or pick a zone to find the rest.
          </li>
        )}
      </ul>

      {selected.length > 0 && (
        <div className="border-t border-gray-100 p-3">
          <div className="mb-2 flex items-center justify-between text-theme-xs">
            <span className="font-medium text-gray-700">{selected.length.toLocaleString('en-IN')} selected</span>
            <button type="button" onClick={() => onChange([])} className="font-medium text-gray-500 hover:text-gray-700">
              Clear
            </button>
          </div>
          <div className="custom-scrollbar flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {selected.map((code) => (
              <span key={code} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-theme-xs font-medium text-brand-600">
                {byCode.get(code)?.customer_name || code}
                <button type="button" onClick={() => toggle(code)} aria-label={`Remove ${code}`} className="rounded-full p-0.5 hover:bg-brand-100">
                  <span className="block h-3 w-3 [&_svg]:h-3 [&_svg]:w-3">
                    <CloseIcon />
                  </span>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Console "+ Create Scheme". `directory` is the Dealer Directory list
// (for picking dealers); `directoryError` explains why it may be empty.
export default function CreateSchemeModal({ open, directory, directoryError, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [dealerCodes, setDealerCodes] = useState([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...EMPTY_FORM, start_date: todayIso() });
    setDealerCodes([]);
    setError('');
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const datesWrong = form.start_date && form.end_date && form.end_date < form.start_date;
  const canPreview = Number(form.purchase_target) > 0 && Number(form.incentive_rate) > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (datesWrong) return;
    if (form.audience === 'SELECTED' && dealerCodes.length === 0) {
      setError('Pick at least one dealer, or choose All Dealers.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await schemesApi.create({
        ...form,
        purchase_target: Number(form.purchase_target),
        incentive_rate: Number(form.incentive_rate),
        dealerCodes: form.audience === 'SELECTED' ? dealerCodes : [],
      });
      onCreated(form.name.trim());
    } catch (err) {
      setError(err.message || 'Could not create this scheme.');
    } finally {
      setIsSaving(false);
    }
  }

  const SchemesIcon = NAV_ICONS.schemes;

  return (
    <Modal
      open={open}
      size="lg"
      title="Create Scheme"
      subtitle="Dealers see it on their portal as soon as it is saved."
      icon={SchemesIcon && <SchemesIcon />}
      onClose={onClose}
      locked={isSaving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="create-scheme-form" isLoading={isSaving}>
            Create Scheme
          </Button>
        </>
      }
    >
      <form id="create-scheme-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <TextInput id="scheme-name" label="Scheme Name" placeholder="e.g. Festive Season Booster 2026" value={form.name} onChange={set('name')} required />
          </div>
          <Select id="scheme-type" label="Type" value={form.type} onChange={set('type')} wrapperClassName="mb-4">
            {SCHEME_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          <TextInput id="scheme-start" label="Start Date" type="date" value={form.start_date} onChange={set('start_date')} required />
          <TextInput
            id="scheme-end"
            label="End Date"
            type="date"
            min={form.start_date || undefined}
            value={form.end_date}
            onChange={set('end_date')}
            error={datesWrong ? 'End date must be on or after the start date.' : ''}
            required
          />
          <TextInput
            id="scheme-target"
            label="Purchase Target (Rs Lacs)"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="e.g. 12"
            value={form.purchase_target}
            onChange={set('purchase_target')}
            required
          />
          <TextInput
            id="scheme-rate"
            label="Incentive (% of purchase value)"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            placeholder="e.g. 1.5"
            value={form.incentive_rate}
            onChange={set('incentive_rate')}
            required
          />
        </div>

        {canPreview && (
          <p className="-mt-1 mb-4 rounded-lg bg-gray-50 px-3 py-2 text-theme-xs text-gray-600">
            Dealers will see: <span className="font-medium text-gray-800">{schemeRule(form)}</span>
          </p>
        )}

        <div className="mb-4">
          <label htmlFor="scheme-note" className={LABEL}>
            Note for dealers <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <textarea
            id="scheme-note"
            rows={2}
            value={form.note}
            onChange={set('note')}
            placeholder="e.g. Only invoiced orders count towards the target."
            className={`${INPUT} ${INPUT_OK} h-auto resize-none`}
          />
        </div>

        <p className={LABEL}>Who is this scheme for?</p>
        <div className="mb-3 grid grid-cols-2 gap-3">
          {[
            { value: 'ALL', label: 'All Dealers', hint: 'Every dealer sees it' },
            { value: 'SELECTED', label: 'Selected Dealers', hint: 'Pick by name, code or zone' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                form.audience === opt.value ? 'border-brand-300 bg-brand-50/50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input type="radio" name="audience" value={opt.value} checked={form.audience === opt.value} onChange={set('audience')} className="mt-0.5 accent-brand-500" />
              <span>
                <span className="block text-theme-sm font-medium text-gray-800">{opt.label}</span>
                <span className="block text-theme-xs text-gray-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {form.audience === 'SELECTED' &&
          (directoryError ? (
            <Alert variant="error">{directoryError}</Alert>
          ) : (
            <DealerPicker directory={directory} selected={dealerCodes} onChange={setDealerCodes} />
          ))}

        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}
      </form>
    </Modal>
  );
}
