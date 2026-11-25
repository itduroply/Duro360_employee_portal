import { useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import Select from '../../components/common/Select.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import { HINT_ERROR, INPUT, INPUT_ERROR, INPUT_OK, LABEL } from '../../components/common/formStyles.js';
import { complaintsApi } from '../../api/complaintsApi';
import { formatDate } from '../../utils/format.js';
import { FileDrop, NATURES, OTHER, natureText } from './FileComplaintPage.jsx';

// The filer's edit of a complaint no approver has decided on yet. Dealer,
// invoice and selling branch stay as they are; everything else can change.
// The database re-checks the rules (migration 20261124130000_complaint_edit.sql).

const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const baseName = (path) => String(path || '').split('/').pop();
const existing = (path) => ({ name: baseName(path), path });

// "Other: cracks at the edge" -> { nature: 'Other', other: 'cracks at the edge' }
function splitNature(value) {
  const text = String(value ?? '');
  if (!text) return { nature: '', other: '' };
  if (NATURES.includes(text)) return { nature: text, other: '' };
  if (text === OTHER || text.startsWith(`${OTHER}:`)) return { nature: OTHER, other: text.slice(OTHER.length + 1).trim() };
  // A value from outside the list: keep it by treating it as an "Other" reason.
  return { nature: OTHER, other: text };
}

export default function EditComplaintModal({ complaint, onClose, onSaved }) {
  const lines = useMemo(() => (Array.isArray(complaint.lines) ? complaint.lines : []), [complaint.lines]);
  const [amount, setAmount] = useState(String(complaint.amount ?? ''));
  const [remarks, setRemarks] = useState(complaint.remarks ?? '');
  const [physicalVisit, setPhysicalVisit] = useState(Boolean(complaint.physical_visit));
  const [visitDate, setVisitDate] = useState(complaint.physical_visit_date ?? '');
  const [defects, setDefects] = useState(() =>
    lines.map((l) => {
      const primary = splitNature(l.primary_nature);
      const secondary = splitNature(l.secondary_nature);
      return {
        qty: l.qty_defective != null ? String(l.qty_defective) : '',
        primary: primary.nature,
        primaryOther: primary.other,
        secondary: secondary.nature,
        secondaryOther: secondary.other,
      };
    })
  );
  const [invoice, setInvoice] = useState(complaint.invoice_path ? [existing(complaint.invoice_path)] : []);
  const [photos, setPhotos] = useState((complaint.photo_paths ?? []).map(existing));
  const [extras, setExtras] = useState((complaint.extra_paths ?? []).map(existing));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const today = todayIso();
  const patchLine = (i, patch) => {
    setDefects((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    setErrors((e) => ({ ...e, lines: undefined }));
  };
  const clear = (key) => setErrors((e) => ({ ...e, [key]: undefined }));

  function validate() {
    const e = {};
    if (!(Number(amount) > 0)) e.amount = 'Enter the complaint amount.';
    if (physicalVisit) {
      if (!visitDate) e.visitDate = 'Enter the physical visit date.';
      else if (visitDate > today) e.visitDate = 'The visit date cannot be in the future.';
    }
    const lineErrors = {};
    defects.forEach((d, i) => {
      const le = {};
      const supplied = lines[i].quantity;
      if (!(Number(d.qty) > 0) || !Number.isInteger(Number(d.qty))) le.qty = 'Enter a whole number above zero.';
      else if (supplied != null && Number(d.qty) > Number(supplied)) le.qty = `Cannot be more than Qty Supplied (${Number(supplied)}).`;
      if (!d.primary) le.primary = 'Select the primary nature.';
      if (d.primary === OTHER && !d.primaryOther.trim()) le.primaryOther = 'Write the other reason.';
      if (d.secondary === OTHER && !d.secondaryOther.trim()) le.secondaryOther = 'Write the other reason.';
      if (Object.keys(le).length) lineErrors[i] = le;
    });
    if (Object.keys(lineErrors).length) e.lines = lineErrors;
    if (invoice.length === 0) e.invoice = 'Attach the invoice copy.';
    if (photos.length === 0) e.photos = 'Attach at least one site photograph.';
    return e;
  }

  async function save() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setSubmitError('Some fields need attention.');
      return;
    }
    setBusy(true);
    setSubmitError('');
    try {
      const result = await complaintsApi.update({
        id: complaint.id,
        amount: Number(amount),
        remarks: remarks.trim(),
        physicalVisit,
        visitDate,
        lineDefects: defects.map((d, idx) => ({
          idx,
          qty_defective: Number(d.qty),
          primary_nature: natureText(d.primary, d.primaryOther),
          secondary_nature: d.secondary ? natureText(d.secondary, d.secondaryOther) : null,
        })),
        invoice: invoice[0].path ?? invoice[0],
        photos: photos.map((f) => f.path ?? f),
        extras: extras.map((f) => f.path ?? f),
      });
      onSaved(result);
    } catch (err) {
      setSubmitError(err.message || 'The complaint could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const textareaClass = `${INPUT} ${INPUT_OK} h-auto min-h-16 resize-y py-2`;
  const natureOptions = (
    <>
      <option value="">— select —</option>
      {NATURES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </>
  );

  return (
    <Modal
      open
      size="xl"
      locked={busy}
      onClose={onClose}
      title="Edit complaint"
      subtitle={`${complaint.complaint_no} · ${complaint.dealer_name} · Invoice ${complaint.invoice_no}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} isLoading={busy}>Save changes</Button>
        </>
      }
    >
      <Alert variant="info" className="mb-5">
        You can edit this complaint until the first approver decides on it. Dealer, invoice and selling branch cannot be changed. A new amount
        can send the complaint to a different approver, and the approval then starts again.
      </Alert>

      <div className="grid grid-cols-1 gap-x-5 gap-y-1 sm:grid-cols-2">
        <TextInput
          id="edit-amount"
          label="Complaint Amount (₹)"
          type="number"
          min="1"
          step="0.01"
          inputMode="decimal"
          value={amount}
          onChange={(e) => (setAmount(e.target.value), clear('amount'))}
          error={errors.amount}
        />
        <div className="mb-4">
          <p className={LABEL}>Physical Visit</p>
          <div className="grid w-full max-w-[12rem] grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Physical visit">
            {[[true, 'Yes'], [false, 'No']].map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={physicalVisit === value}
                onClick={() => (setPhysicalVisit(value), !value && setVisitDate(''), clear('visitDate'))}
                className={`flex h-9 items-center justify-center rounded-lg text-theme-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-500/15 ${
                  physicalVisit === value ? 'bg-white text-brand-600 shadow-theme-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {physicalVisit && (
          <TextInput
            id="edit-visit-date"
            label="Physical Visit Date"
            type="date"
            max={today}
            value={visitDate}
            onChange={(e) => (setVisitDate(e.target.value), clear('visitDate'))}
            error={errors.visitDate}
          />
        )}
      </div>

      <h4 className="mb-2.5 mt-2 text-theme-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Product lines</h4>
      <div className="mb-5 flex flex-col gap-3">
        {lines.map((l, i) => {
          const d = defects[i];
          const err = errors.lines?.[i] || {};
          return (
            <div key={i} className="rounded-xl border border-gray-200 p-3.5">
              <p className="text-theme-sm font-semibold text-gray-800">
                {l.item_name || 'Item'}
                {l.brand && <span className="ml-2 text-theme-xs font-normal text-gray-500">{l.brand}</span>}
              </p>
              <p className="mb-3 text-theme-xs text-gray-500">
                {l.thickness != null ? `${Number(l.thickness)} mm` : '—'} · {l.length_m != null && l.width_m != null ? `${Number(l.length_m)} × ${Number(l.width_m)} m` : '—'} · Qty Supplied {l.quantity ?? '—'}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className={LABEL} htmlFor={`edit-qty-${i}`}>Qty Defective</label>
                  <input
                    id={`edit-qty-${i}`}
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={d.qty}
                    onChange={(e) => patchLine(i, { qty: e.target.value })}
                    className={`${INPUT} ${err.qty ? INPUT_ERROR : INPUT_OK}`}
                  />
                  {err.qty && <p className={HINT_ERROR}>{err.qty}</p>}
                </div>
                <div>
                  <Select id={`edit-primary-${i}`} label="Primary Nature" value={d.primary} onChange={(e) => patchLine(i, { primary: e.target.value })} className={err.primary ? '!border-error-300' : ''}>
                    {natureOptions}
                  </Select>
                  {err.primary && <p className={HINT_ERROR}>{err.primary}</p>}
                  {d.primary === OTHER && (
                    <>
                      <textarea rows={2} placeholder="Write the other reason" value={d.primaryOther} onChange={(e) => patchLine(i, { primaryOther: e.target.value })} className={`${INPUT} ${err.primaryOther ? INPUT_ERROR : INPUT_OK} mt-2 h-auto min-h-16 resize-y py-2`} />
                      {err.primaryOther && <p className={HINT_ERROR}>{err.primaryOther}</p>}
                    </>
                  )}
                </div>
                <div>
                  <Select id={`edit-secondary-${i}`} label="Secondary Nature" value={d.secondary} onChange={(e) => patchLine(i, { secondary: e.target.value })}>
                    {natureOptions}
                  </Select>
                  {d.secondary === OTHER && (
                    <>
                      <textarea rows={2} placeholder="Write the other reason" value={d.secondaryOther} onChange={(e) => patchLine(i, { secondaryOther: e.target.value })} className={`${INPUT} ${err.secondaryOther ? INPUT_ERROR : INPUT_OK} mt-2 h-auto min-h-16 resize-y py-2`} />
                      {err.secondaryOther && <p className={HINT_ERROR}>{err.secondaryOther}</p>}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <FileDrop
          id="edit-invoice-file"
          label="Invoice Copy (Duro)"
          title="Replace invoice"
          hint="PDF or image"
          accept="application/pdf,image/jpeg,image/png"
          files={invoice}
          onChange={(f) => (setInvoice(f), clear('invoice'))}
          onReject={(m) => setErrors((e) => ({ ...e, invoice: m }))}
          error={errors.invoice}
        />
        <FileDrop
          id="edit-photos-file"
          label="Site Photographs"
          title="Add photo"
          hint="JPEG or PNG"
          accept="image/jpeg,image/png"
          multiple
          files={photos}
          onChange={(f) => (setPhotos(f), clear('photos'))}
          onReject={(m) => setErrors((e) => ({ ...e, photos: m }))}
          error={errors.photos}
        />
        {extras.length > 0 && (
          <div className="sm:col-span-2">
            <FileDrop
              id="edit-extra-file"
              label="Additional Supporting Documents"
              title="Add document"
              hint="Optional"
              accept="application/pdf,image/jpeg,image/png"
              multiple
              files={extras}
              onChange={setExtras}
              onReject={(m) => setSubmitError(m)}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <label htmlFor="edit-remarks" className={LABEL}>Dealer / Customer Remarks</label>
          <textarea id="edit-remarks" rows={2} placeholder="Optional" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={textareaClass} />
        </div>
      </div>

      {submitError && <Alert variant="error" className="mt-4">{submitError}</Alert>}
      <p className="mt-3 text-theme-xs text-gray-400">Complaint date {formatDate(complaint.complaint_date || complaint.created_at)} stays the same.</p>
    </Modal>
  );
}
