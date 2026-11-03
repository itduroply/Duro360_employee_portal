import { useEffect, useMemo, useRef, useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import Select from '../../components/common/Select.jsx';
import Alert from '../../components/common/Alert.jsx';
import { CloseIcon } from '../../components/common/icons.jsx';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { CHECKBOX, HINT_ERROR, INPUT, INPUT_OK, LABEL } from '../../components/common/formStyles.js';
import { complaintsApi } from '../../api/complaintsApi';
import { formatDate } from '../../utils/format.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the complaint-docs bucket limit
const EMPTY_FORM = {
  origin: 'DEALER', dealerCode: '', customerName: '', customerMobile: '', invoiceNo: '',
  amount: '', installationContext: '', remarks: '',
};

const ORIGINS = [
  {
    value: 'DEALER',
    title: 'Dealer',
    hint: 'Pre-sale — defect found at the dealer’s warehouse or shop, before resale.',
    icon: <path d="M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01" />,
  },
  {
    value: 'END_CUSTOMER',
    title: 'End-Customer',
    hint: 'Post-sale — issue found after installation or use at the customer’s site.',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.6.7 2.6 2.3 3 4.7" />
      </>
    ),
  },
];

const SECTION_ICONS = {
  parties: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.3c1.6.7 2.6 2.3 3 4.7" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  value: <path d="M7 5h10M7 9h10M7 5c5 0 7 2 7 4s-2 4-7 4l6 6" />,
  evidence: <path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.8 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7.2" />,
};

function Svg({ children, className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h4 className="mb-4 mt-8 flex items-center gap-2 text-theme-xs font-semibold uppercase tracking-wider text-gray-500 first:mt-0">
      <Svg>{icon}</Svg>
      {children}
    </h4>
  );
}

function Req({ children, note }) {
  return (
    <>
      {children} <span className="text-error-500">*</span>
      {note && <span className="ml-1 text-theme-xs font-normal text-gray-400">{note}</span>}
    </>
  );
}

function formatRupees(value) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fileSize(bytes) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// A dashed drop zone. Shows the chosen files below it, each with a remove
// button. `multiple` zones keep adding files; single zones replace.
function FileDrop({ id, label, title, hint, accept, multiple = false, files, onChange, error, onReject }) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  function take(list) {
    const picked = Array.from(list || []);
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      onReject(`${tooBig.name} is larger than 10 MB.`);
      return;
    }
    onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
  }

  return (
    <div className="mb-5">
      <p className={LABEL} id={`${id}-label`}>
        {label}
      </p>
      <button
        type="button"
        id={id}
        aria-labelledby={`${id}-label`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsOver(false);
          take(e.dataTransfer.files);
        }}
        className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed px-4 py-4 text-left transition-colors focus:outline-none focus:ring-3 focus:ring-brand-500/15 ${
          error ? 'border-error-300 bg-error-50/40' : isOver ? 'border-brand-400 bg-brand-50' : 'border-brand-200 bg-brand-25 hover:border-brand-300 hover:bg-brand-50'
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-500 shadow-theme-xs">
          <Svg className="h-5 w-5">{SECTION_ICONS.evidence}</Svg>
        </span>
        <span className="min-w-0">
          <span className="block text-theme-sm font-semibold text-gray-700">{title}</span>
          <span className="block text-theme-xs text-gray-500">{hint}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
      {error && <p className={HINT_ERROR}>{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-700">{f.name}</span>
              <span className="shrink-0 text-theme-xs text-gray-400">{fileSize(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${f.name}`}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <span className="block h-4 w-4 [&_svg]:h-4 [&_svg]:w-4">
                  <CloseIcon />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OriginCards({ value, onChange }) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Origination">
      {ORIGINS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-3 focus:ring-brand-500/15 ${
              active ? 'border-brand-500 bg-brand-50 shadow-theme-xs ring-1 ring-brand-500/30' : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-brand-25'
            }`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              <Svg className="h-5 w-5">{o.icon}</Svg>
            </span>
            <span className="min-w-0">
              <span className="block text-theme-sm font-semibold text-gray-800">{o.title}</span>
              <span className="mt-0.5 block text-theme-xs leading-relaxed text-gray-500">{o.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function InvoiceLines({ dealerCode, invoiceNo, lines, isLoading, error, selected, onToggle }) {
  if (!invoiceNo) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-theme-sm text-gray-500">
        <Svg className="h-6 w-6 text-gray-400">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />
        </Svg>
        Select an invoice above to pull in its product lines.
      </div>
    );
  }
  if (isLoading) return <p className="rounded-2xl border border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-500">Loading product lines…</p>;
  if (error) return <Alert variant="error">{error}</Alert>;
  if (lines.length === 0) {
    return <p className="rounded-2xl border border-gray-200 px-4 py-6 text-center text-theme-sm text-gray-500">No product lines found for {invoiceNo}.</p>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-theme-xs text-gray-500">
        <span className="font-medium text-gray-700">Product lines on {invoiceNo}</span>
        <span>{selected.size} of {lines.length} selected</span>
      </div>
      <ul className="custom-scrollbar max-h-56 divide-y divide-gray-100 overflow-y-auto">
        {lines.map((l) => (
          <li key={`${dealerCode}-${l.src_id}`}>
            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
              <input type="checkbox" checked={selected.has(l.src_id)} onChange={() => onToggle(l.src_id)} className={CHECKBOX} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-theme-sm font-medium text-gray-800">{l.item_name || 'Item'}</span>
                <span className="block truncate text-theme-xs text-gray-500">
                  {[l.brand, l.sub_brand_name, l.thickness ? `${Number(l.thickness)} mm` : null].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <span className="shrink-0 text-right text-theme-xs text-gray-500">
                {l.quantity_pcs !== null && l.quantity_pcs !== undefined ? `${Number(l.quantity_pcs).toLocaleString('en-IN')} ${l.uom_code || 'pcs'}` : '—'}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "File Complaint" form. Closes through `onFiled(complaintNo)` once saved.
export default function FileComplaintModal({ open, onClose, onFiled }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [invoiceFile, setInvoiceFile] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [extras, setExtras] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [dealers, setDealers] = useState([]);
  const [dealersState, setDealersState] = useState({ loading: false, error: '' });
  const [invoices, setInvoices] = useState([]);
  const [invoicesState, setInvoicesState] = useState({ loading: false, error: '' });
  const [lines, setLines] = useState([]);
  const [linesState, setLinesState] = useState({ loading: false, error: '' });
  const [selectedLines, setSelectedLines] = useState(new Set());

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Fresh form each time it opens; dealers load once per opening.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setForm(EMPTY_FORM);
    setInvoiceFile([]);
    setPhotos([]);
    setExtras([]);
    setErrors({});
    setSubmitError('');
    setInvoices([]);
    setLines([]);
    setSelectedLines(new Set());
    setDealersState({ loading: true, error: '' });
    complaintsApi
      .dealers()
      .then((rows) => !cancelled && (setDealers(rows), setDealersState({ loading: false, error: '' })))
      .catch((err) => !cancelled && setDealersState({ loading: false, error: err.message || 'Could not load dealers.' }));
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Invoices follow the dealer.
  useEffect(() => {
    setInvoices([]);
    setLines([]);
    setSelectedLines(new Set());
    if (!form.dealerCode) return undefined;
    let cancelled = false;
    setInvoicesState({ loading: true, error: '' });
    complaintsApi
      .invoices(form.dealerCode)
      .then((rows) => !cancelled && (setInvoices(rows), setInvoicesState({ loading: false, error: '' })))
      .catch((err) => !cancelled && setInvoicesState({ loading: false, error: err.message || 'Could not load invoices.' }));
    return () => {
      cancelled = true;
    };
  }, [form.dealerCode]);

  // Product lines follow the invoice; all start ticked.
  useEffect(() => {
    setLines([]);
    setSelectedLines(new Set());
    if (!form.dealerCode || !form.invoiceNo) return undefined;
    let cancelled = false;
    setLinesState({ loading: true, error: '' });
    complaintsApi
      .invoiceLines(form.dealerCode, form.invoiceNo)
      .then((rows) => {
        if (cancelled) return;
        setLines(rows);
        setSelectedLines(new Set(rows.map((r) => r.src_id)));
        setLinesState({ loading: false, error: '' });
      })
      .catch((err) => !cancelled && setLinesState({ loading: false, error: err.message || 'Could not load product lines.' }));
    return () => {
      cancelled = true;
    };
  }, [form.dealerCode, form.invoiceNo]);

  const dealer = useMemo(() => dealers.find((d) => d.customer_code === form.dealerCode), [dealers, form.dealerCode]);
  const invoice = useMemo(() => invoices.find((i) => i.document_number === form.invoiceNo), [invoices, form.invoiceNo]);
  const isEndCustomer = form.origin === 'END_CUSTOMER';

  function toggleLine(id) {
    setSelectedLines((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErrors((e) => ({ ...e, lines: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.dealerCode) e.dealerCode = 'Select a dealer.';
    if (isEndCustomer) {
      if (!form.customerName.trim()) e.customerName = 'Customer name is required.';
      if (!/^[6-9]\d{9}$/.test(form.customerMobile.trim())) e.customerMobile = 'Enter a 10-digit mobile number.';
    }
    if (!form.invoiceNo) e.invoiceNo = 'Select an invoice.';
    else if (selectedLines.size === 0) e.lines = 'Select at least one product line.';
    if (!(Number(form.amount) > 0)) e.amount = 'Enter the complaint amount.';
    if (invoiceFile.length === 0) e.invoiceFile = 'Attach the invoice copy.';
    if (photos.length === 0) e.photos = 'Attach at least one site photograph.';
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      setSubmitError(`${keys.length} field${keys.length > 1 ? 's' : ''} need${keys.length > 1 ? '' : 's'} attention.`);
      document.getElementById(`complaint-${keys[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitError('');
    setIsSaving(true);
    try {
      const chosen = lines
        .filter((l) => selectedLines.has(l.src_id))
        .map((l) => ({ item_name: l.item_name, brand: l.brand, quantity: l.quantity_pcs, uom: l.uom_code }));
      const complaintNo = await complaintsApi.file({
        origin: form.origin,
        dealer_code: form.dealerCode,
        customer_name: isEndCustomer ? form.customerName.trim() : null,
        customer_mobile: isEndCustomer ? form.customerMobile.trim() : null,
        invoice_no: form.invoiceNo,
        invoice_date: invoice?.document_date || null,
        lines: chosen,
        amount: Number(form.amount),
        installation_context: form.installationContext,
        remarks: form.remarks,
        invoiceFile: invoiceFile[0],
        photoFiles: photos,
        extraFiles: extras,
      });
      onFiled(complaintNo);
    } catch (err) {
      setSubmitError(err.message || 'Could not register this complaint.');
    } finally {
      setIsSaving(false);
    }
  }

  const ComplaintsIcon = NAV_ICONS.complaints;
  const textareaClass = `${INPUT} ${INPUT_OK} h-auto min-h-24 resize-y py-3`;

  return (
    <Modal
      open={open}
      size="xl"
      title="File a New Complaint"
      subtitle="One sheet, top to bottom."
      icon={ComplaintsIcon && <ComplaintsIcon />}
      onClose={onClose}
      locked={isSaving}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form="file-complaint-form" isLoading={isSaving}>
            Register Complaint
          </Button>
        </>
      }
    >
      <form id="file-complaint-form" onSubmit={handleSubmit} noValidate>
        <SectionTitle icon={SECTION_ICONS.parties}>A. Origination &amp; Parties</SectionTitle>
        <OriginCards value={form.origin} onChange={(v) => set('origin', v)} />

        <div id="complaint-dealerCode" className="mb-1">
          <Select
            id="complaint-dealer"
            label={<Req>Dealer Name</Req>}
            value={form.dealerCode}
            onChange={(e) => {
              set('dealerCode', e.target.value);
              set('invoiceNo', '');
            }}
            disabled={dealersState.loading}
            className={errors.dealerCode ? '!border-error-300' : ''}
          >
            <option value="">{dealersState.loading ? 'Loading dealers…' : '— select —'}</option>
            {dealers.map((d) => (
              <option key={d.customer_code} value={d.customer_code}>
                {d.customer_name} ({d.customer_code})
              </option>
            ))}
          </Select>
          {errors.dealerCode && <p className={HINT_ERROR}>{errors.dealerCode}</p>}
          {dealersState.error ? (
            <Alert variant="error" className="mt-2">{dealersState.error}</Alert>
          ) : (
            <p className="mt-1.5 flex items-center gap-1.5 text-theme-xs text-gray-500">
              <Svg className="h-3.5 w-3.5">{ORIGINS[0].icon}</Svg>
              From the Dealer Master{dealer?.selling_branch ? `, ${dealer.selling_branch} branch` : ', filtered to your branch'}.
            </p>
          )}
        </div>

        {isEndCustomer && (
          <div className="mt-4 grid grid-cols-1 gap-x-5 sm:grid-cols-2">
            <div id="complaint-customerName">
              <TextInput
                id="complaint-customer-name"
                label={<Req>Customer Name</Req>}
                placeholder="Name of the end-customer"
                value={form.customerName}
                onChange={(e) => set('customerName', e.target.value)}
                error={errors.customerName}
              />
            </div>
            <div id="complaint-customerMobile">
              <TextInput
                id="complaint-customer-mobile"
                label={<Req>Customer Mobile</Req>}
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={form.customerMobile}
                onChange={(e) => set('customerMobile', e.target.value.replace(/\D/g, ''))}
                error={errors.customerMobile}
              />
            </div>
          </div>
        )}

        <SectionTitle icon={SECTION_ICONS.invoice}>B. Invoice &amp; Product Lines</SectionTitle>
        <div id="complaint-invoiceNo" className="mb-4">
          <Select
            id="complaint-invoice"
            label={<Req>Invoice Number</Req>}
            value={form.invoiceNo}
            onChange={(e) => set('invoiceNo', e.target.value)}
            disabled={!form.dealerCode || invoicesState.loading}
            className={errors.invoiceNo ? '!border-error-300' : ''}
          >
            <option value="">
              {!form.dealerCode ? 'Select a Dealer first' : invoicesState.loading ? 'Loading invoices…' : invoices.length === 0 ? 'No invoices found for this dealer' : '— select —'}
            </option>
            {invoices.map((i) => (
              <option key={i.document_number} value={i.document_number}>
                {i.document_number} · {formatDate(i.document_date)} · {formatRupees(i.net_amount)}
              </option>
            ))}
          </Select>
          {errors.invoiceNo && <p className={HINT_ERROR}>{errors.invoiceNo}</p>}
          {invoicesState.error ? (
            <Alert variant="error" className="mt-2">{invoicesState.error}</Alert>
          ) : (
            <p className="mt-1.5 text-theme-xs text-gray-500">Billed-from-Duroply invoices for this dealer, pulled from the backend, not typed.</p>
          )}
        </div>
        <div id="complaint-lines">
          <InvoiceLines
            dealerCode={form.dealerCode}
            invoiceNo={form.invoiceNo}
            lines={lines}
            isLoading={linesState.loading}
            error={linesState.error}
            selected={selectedLines}
            onToggle={toggleLine}
          />
          {errors.lines && <p className={HINT_ERROR}>{errors.lines}</p>}
        </div>

        <SectionTitle icon={SECTION_ICONS.value}>C. Complaint Value</SectionTitle>
        <div id="complaint-amount">
          <TextInput
            id="complaint-amount-input"
            label={<Req>Complaint Amount (₹)</Req>}
            type="number"
            min="1"
            step="0.01"
            inputMode="decimal"
            placeholder="Approximate compensation value"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            error={errors.amount}
          />
        </div>

        <SectionTitle icon={SECTION_ICONS.evidence}>D. Evidence</SectionTitle>
        <div id="complaint-invoiceFile">
          <FileDrop
            id="complaint-invoice-file"
            label={<Req>Invoice Copy</Req>}
            title="Attach invoice"
            hint="PDF or image"
            accept="application/pdf,image/jpeg,image/png"
            files={invoiceFile}
            onChange={(f) => (setInvoiceFile(f), setErrors((e) => ({ ...e, invoiceFile: undefined })))}
            onReject={(m) => setErrors((e) => ({ ...e, invoiceFile: m }))}
            error={errors.invoiceFile}
          />
        </div>
        <div id="complaint-photos">
          <FileDrop
            id="complaint-photos-file"
            label={<Req note="(at least one)">Site Photographs</Req>}
            title="Attach photo"
            hint="JPEG or PNG"
            accept="image/jpeg,image/png"
            multiple
            files={photos}
            onChange={(f) => (setPhotos(f), setErrors((e) => ({ ...e, photos: undefined })))}
            onReject={(m) => setErrors((e) => ({ ...e, photos: m }))}
            error={errors.photos}
          />
        </div>

        <div className="mb-5">
          <label htmlFor="complaint-install" className={LABEL}>Installation Context</label>
          <textarea
            id="complaint-install"
            rows={3}
            placeholder="Optional notes"
            value={form.installationContext}
            onChange={(e) => set('installationContext', e.target.value)}
            className={textareaClass}
          />
        </div>
        <div className="mb-5">
          <label htmlFor="complaint-remarks" className={LABEL}>Dealer / Customer Remarks</label>
          <textarea
            id="complaint-remarks"
            rows={3}
            placeholder="Optional"
            value={form.remarks}
            onChange={(e) => set('remarks', e.target.value)}
            className={textareaClass}
          />
        </div>

        <FileDrop
          id="complaint-extra-file"
          label="Additional Supporting Documents"
          title="Attach document (optional)"
          hint="Optional"
          accept="application/pdf,image/jpeg,image/png"
          multiple
          files={extras}
          onChange={setExtras}
          onReject={(m) => setSubmitError(m)}
        />

        {submitError && (
          <Alert variant="error" className="mt-2">
            {submitError}
          </Alert>
        )}
      </form>
    </Modal>
  );
}
