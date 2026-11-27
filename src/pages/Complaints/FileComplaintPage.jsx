import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ModulePage from '../../components/ModulePage/ModulePage.jsx';
import Button from '../../components/common/Button.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import Select from '../../components/common/Select.jsx';
import Alert from '../../components/common/Alert.jsx';
import Modal from '../../components/common/Modal.jsx';
import { CloseIcon } from '../../components/common/icons.jsx';
import { HINT_ERROR, INPUT, INPUT_ERROR, INPUT_OK, LABEL } from '../../components/common/formStyles.js';
import { complaintsApi } from '../../api/complaintsApi';
import { formatDate } from '../../utils/format.js';
import ComplaintGate from './ComplaintGate.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { downloadComplaint } from './printComplaint.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // matches the complaint-docs bucket limit
const EMPTY_FORM = {
  origin: 'DEALER', sellingBranch: '', dealerCode: '', customerName: '', customerMobile: '', invoiceNo: '',
  amount: '', installationContext: '', remarks: '', branchRemarks: '', factoryResponse: '', physicalVisit: 'NO', visitDate: '',
};

// "Other: cracks at the edge" -> { nature: 'Other', other: 'cracks at the edge' }
function splitNature(value) {
  const text = String(value ?? '');
  if (!text) return { nature: '', other: '' };
  if (NATURES.includes(text)) return { nature: text, other: '' };
  if (text === OTHER || text.startsWith(`${OTHER}:`)) return { nature: OTHER, other: text.slice(OTHER.length + 1).trim() };
  // A value from outside the list: keep it by treating it as an "Other" reason.
  return { nature: OTHER, other: text };
}

const baseName = (path) => String(path || '').split('/').pop();
const storedFile = (path) => ({ name: baseName(path), path });

// A saved complaint, turned into the form's own state. Product lines have no
// line key in the saved row, so their position stands in for it.
function formFromComplaint(c) {
  const lines = (Array.isArray(c.lines) ? c.lines : []).map((l, i) => ({ ...l, line_key: String(i) }));
  const defects = {};
  lines.forEach((l) => {
    const primary = splitNature(l.primary_nature);
    const secondary = splitNature(l.secondary_nature);
    defects[l.line_key] = {
      qty: l.qty_defective != null ? String(l.qty_defective) : '',
      primary: primary.nature,
      primaryOther: primary.other,
      secondary: secondary.nature,
      secondaryOther: secondary.other,
    };
  });
  return {
    lines,
    defects,
    form: {
      origin: c.origin,
      sellingBranch: c.selling_branch || '',
      dealerCode: c.dealer_code || '',
      customerName: c.customer_name || '',
      customerMobile: c.customer_mobile || '',
      invoiceNo: c.invoice_no || '',
      amount: c.amount != null ? String(c.amount) : '',
      installationContext: c.installation_context || '',
      remarks: c.remarks || '',
      branchRemarks: c.branch_remarks || '',
      factoryResponse: c.factory_response || '',
      physicalVisit: c.physical_visit ? 'YES' : 'NO',
      visitDate: c.physical_visit_date || '',
    },
    invoiceFile: c.invoice_path ? [storedFile(c.invoice_path)] : [],
    photos: (c.photo_paths ?? []).map(storedFile),
    extras: (c.extra_paths ?? []).map(storedFile),
    // Stand-ins for the lookups, so the locked selects still show the saved choice.
    branch: { name: c.selling_branch || c.branch_name || '' },
    dealer: { customer_code: c.dealer_code, customer_name: c.dealer_name, mobile_no: c.dealer_mobile, email: c.dealer_email },
    invoice: { document_number: c.invoice_no, document_date: c.invoice_date, manufacturing_factory: c.manufacturing_factory },
  };
}

// Today's date in India as YYYY-MM-DD. This is the complaint date.
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// A nature of "Other" is saved as "Other: <reason>".
export const OTHER = 'Other';
export const natureText = (nature, other) => (nature === OTHER ? `${OTHER}: ${String(other ?? '').trim()}` : nature || '');

// Nature of complaint, picked per product line (primary is required, secondary optional).
export const NATURES = [
  'Delamination',
  'Borer / Termite Attack',
  'Moisture Absorption / Swelling',
  'Surface Defect / Finish Issue',
  'Size / Dimension Mismatch',
  'Warping / Bending',
  'Color Mismatch',
  'Core Gap / Void',
  'Breakage / Damage in Transit',
  'Other',
];

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

const CHECK = <path d="M5 12.5l4.5 4.5L19 7.5" />;

// One step of the form, as its own card. The badge turns green once the
// step's required fields are filled.
function Section({ id, step, icon, title, hint, done, children }) {
  return (
    <section id={id} className="scroll-mt-28 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-sm">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
            done ? 'bg-success-500 text-white' : 'bg-brand-50 text-brand-500'
          }`}
        >
          <Svg className="h-4 w-4">{done ? CHECK : icon}</Svg>
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
          <h3 className="text-theme-sm font-semibold text-gray-800">
            <span className="mr-1.5 text-gray-400">{step}</span>
            {title}
          </h3>
          {hint && <p className="hidden text-theme-xs text-gray-500 sm:block">{hint}</p>}
        </div>
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
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
export function FileDrop({ id, label, title, hint, accept, multiple = false, maxFiles, files, onChange, error, onReject }) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  function take(list) {
    const picked = Array.from(list || []);
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      onReject(`${tooBig.name} is larger than 10 MB.`);
      return;
    }
    if (multiple && maxFiles && files.length + picked.length > maxFiles) {
      onReject(`You can attach only ${maxFiles} files. Remove one to add another.`);
      return;
    }
    onChange(multiple ? [...files, ...picked] : picked.slice(0, 1));
  }

  return (
    <div>
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
        className={`flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-3.5 py-3 text-left transition-colors focus:outline-none focus:ring-3 focus:ring-brand-500/15 ${
          error ? 'border-error-300 bg-error-50/40' : isOver ? 'border-brand-400 bg-brand-50' : 'border-brand-200 bg-brand-25 hover:border-brand-300 hover:bg-brand-50'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-500 shadow-theme-xs">
          <Svg className="h-4 w-4">{SECTION_ICONS.evidence}</Svg>
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
              {f.size != null && <span className="shrink-0 text-theme-xs text-gray-400">{fileSize(f.size)}</span>}
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

function OriginCards({ value, onChange, disabled = false }) {
  const current = ORIGINS.find((o) => o.value === value);
  return (
    <div>
      <p className={LABEL}>Origination</p>
      <div className="grid w-full max-w-xs grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Origination">
        {ORIGINS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(o.value)}
              className={`flex h-9 items-center justify-center gap-2 rounded-lg text-theme-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed ${
                active ? 'bg-white text-brand-600 shadow-theme-sm' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
              }`}
            >
              <Svg className="h-4 w-4">{o.icon}</Svg>
              {o.title}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-theme-xs text-gray-500">{current?.hint}</p>
    </div>
  );
}

const trimNumber = (n) => String(Number(n));


function sizeLabel(l) {
  if (l.length_m == null || l.width_m == null) return { main: '—', sub: '' };
  return {
    main: `${trimNumber(l.length_m)} × ${trimNumber(l.width_m)} m`,
    sub: '',
  };
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3.5 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="break-words text-theme-sm font-semibold text-gray-800" title={value || undefined}>{value || '—'}</p>
    </div>
  );
}

// Product lines of the chosen invoice: one row per item + thickness + size,
// with the defective quantity and nature of complaint for each line.
function InvoiceLines({ invoiceNo, lines, isLoading, error, defects, onChange, lineErrors }) {
  if (!invoiceNo) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-theme-sm text-gray-500">
        <Svg className="h-5 w-5 text-gray-400">
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
  const involved = lines.filter((l) => Number(defects[l.line_key]?.qty) > 0).length;
  const cell = 'px-2 py-2.5 align-top';
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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 text-theme-xs text-gray-500">
        <span className="font-medium text-gray-700">Product lines on {invoiceNo}</span>
        <span>{involved} of {lines.length} with defects</span>
      </div>
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[60rem] text-left text-theme-sm">
          <thead className="bg-gray-50 text-theme-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Product</th>
              <th className="px-2 py-2.5 font-semibold">Thick</th>
              <th className="px-2 py-2.5 font-semibold">Size</th>
              <th className="px-2 py-2.5 font-semibold">Qty Supplied</th>
              <th className="px-2 py-2.5 font-semibold">Qty Defective <span className="text-error-500">*</span></th>
              <th className="px-2 py-2.5 font-semibold">Primary Nature <span className="text-error-500">*</span></th>
              <th className="px-2 py-2.5 pr-4 font-semibold">Secondary Nature</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.map((l) => {
              const size = sizeLabel(l);
              const d = defects[l.line_key] || {};
              const on = Number(d.qty) > 0;
              const overSupplied = l.quantity != null && Number(d.qty) > Number(l.quantity);
              const err = lineErrors?.[l.line_key] || {};
              return (
                <tr key={l.line_key} className={on ? 'bg-brand-25' : ''}>
                  <td className={`${cell} min-w-[11rem] px-4`}>
                    <span className="block font-medium text-gray-800">{l.item_name || 'Item'}</span>
                    {l.brand && <span className="block text-theme-xs text-gray-500">{l.brand}</span>}
                  </td>
                  <td className={`${cell} whitespace-nowrap text-gray-700`}>{l.thickness != null ? `${trimNumber(l.thickness)} mm` : '—'}</td>
                  <td className={`${cell} whitespace-nowrap text-gray-700`}>
                    {size.main}
                    {size.sub && <span className="block text-theme-xs text-gray-400">{size.sub}</span>}
                  </td>
                  <td className={`${cell} whitespace-nowrap font-medium text-gray-800`}>
                    {l.quantity != null ? Number(l.quantity).toLocaleString('en-IN') : '—'}
                  </td>
                  <td className={`${cell} w-28`}>
                    <input
                      type="number"
                      min="0"
                      max={l.quantity != null ? Math.floor(Number(l.quantity)) : undefined}
                      step="1"
                      inputMode="numeric"
                      placeholder="0"
                      value={d.qty ?? ''}
                      onChange={(e) => onChange(l.line_key, { qty: e.target.value })}
                      aria-label={`Defective quantity for ${l.item_name}`}
                      className={`${INPUT} ${err.qty || overSupplied ? INPUT_ERROR : INPUT_OK}`}
                    />
                    {overSupplied ? (
                      <p className={HINT_ERROR}>Defective qty cannot be more than Qty Supplied ({Number(l.quantity).toLocaleString('en-IN')}).</p>
                    ) : (
                      err.qty && <p className={HINT_ERROR}>{err.qty}</p>
                    )}
                  </td>
                  <td className={`${cell} w-56`}>
                    <Select
                      value={d.primary ?? ''}
                      onChange={(e) => onChange(l.line_key, { primary: e.target.value })}
                      aria-label={`Primary nature for ${l.item_name}`}
                      className={err.primary ? '!border-error-300' : ''}
                    >
                      {natureOptions}
                    </Select>
                    {err.primary && <p className={HINT_ERROR}>{err.primary}</p>}
                    {d.primary === OTHER && (
                      <>
                        <textarea
                          rows={2}
                          placeholder="Write the other reason"
                          value={d.primaryOther ?? ''}
                          onChange={(e) => onChange(l.line_key, { primaryOther: e.target.value })}
                          aria-label={`Other primary reason for ${l.item_name}`}
                          className={`${INPUT} ${err.primaryOther ? INPUT_ERROR : INPUT_OK} mt-2 h-auto min-h-16 resize-y py-2`}
                        />
                        {err.primaryOther && <p className={HINT_ERROR}>{err.primaryOther}</p>}
                      </>
                    )}
                  </td>
                  <td className={`${cell} w-56 pr-4`}>
                    <Select
                      value={d.secondary ?? ''}
                      onChange={(e) => onChange(l.line_key, { secondary: e.target.value })}
                      aria-label={`Secondary nature for ${l.item_name}`}
                    >
                      {natureOptions}
                    </Select>
                    {d.secondary === OTHER && (
                      <>
                        <textarea
                          rows={2}
                          placeholder="Write the other reason"
                          value={d.secondaryOther ?? ''}
                          onChange={(e) => onChange(l.line_key, { secondaryOther: e.target.value })}
                          aria-label={`Other secondary reason for ${l.item_name}`}
                          className={`${INPUT} ${err.secondaryOther ? INPUT_ERROR : INPUT_OK} mt-2 h-auto min-h-16 resize-y py-2`}
                        />
                        {err.secondaryOther && <p className={HINT_ERROR}>{err.secondaryOther}</p>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-theme-xs text-gray-500">
        Nature of Complaint is captured per product line. Enter a defective quantity on at least one line.
      </p>
    </div>
  );
}

// "File Complaint" page. Once saved, it opens Complaint History with the new
// complaint number shown at the top.
function FileComplaintForm({ onReset }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  // /complaints/edit/:id opens this same form, filled in with a saved complaint.
  // Only what the filer may still change stays open; the rest is locked.
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const [editState, setEditState] = useState({ loading: isEdit, error: '', complaintNo: '', complaintDate: '' });
  const toHistory = (state) => navigate(isEdit ? '../../history' : '../history', { relative: 'path', state });
  const [done, setDone] = useState(null); // set once the complaint is saved: drives the success dialog
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  async function download() {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadComplaint(done);
    } catch {
      setDownloadError('Could not create the PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  }
  const [form, setForm] = useState(EMPTY_FORM);
  const [invoiceFile, setInvoiceFile] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [extras, setExtras] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [branches, setBranches] = useState([]);
  const [branchesState, setBranchesState] = useState({ loading: false, error: '' });
  const [dealers, setDealers] = useState([]);
  const [dealersState, setDealersState] = useState({ loading: false, error: '' });
  const [invoices, setInvoices] = useState([]);
  const [invoicesState, setInvoicesState] = useState({ loading: false, error: '' });
  const [lines, setLines] = useState([]);
  const [linesState, setLinesState] = useState({ loading: false, error: '' });
  const [defects, setDefects] = useState({});

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  // Switching between Dealer and End-Customer starts the form over: the dealer,
  // invoice, product lines, amount, files and notes are cleared. Only the
  // default selling branch (the first tagged one) is kept.
  function changeOrigin(next) {
    if (next === form.origin) return;
    setForm({ ...EMPTY_FORM, origin: next, sellingBranch: branches[0]?.name ?? '' });
    setInvoiceFile([]);
    setPhotos([]);
    setExtras([]);
    setErrors({});
    setSubmitError('');
  }

  // The selling branches come from Assign Users: the database returns only the
  // branches this person is tagged with (every branch if none are tagged). The
  // first one is picked by default, and the dealers follow the picked branch.
  useEffect(() => {
    let cancelled = false;
    if (isEdit) {
      setEditState({ loading: true, error: '', complaintNo: '', complaintDate: '' });
      Promise.all([complaintsApi.get(editId), complaintsApi.editRights(editId)])
        .then(([row, rights]) => {
          if (cancelled) return;
          if (!row) throw new Error('This complaint was not found.');
          if (!rights?.canEditComplaint) {
            throw new Error('This complaint can no longer be edited. It is locked once an approver has decided on it.');
          }
          const saved = formFromComplaint(row);
          setForm(saved.form);
          setInvoiceFile(saved.invoiceFile);
          setPhotos(saved.photos);
          setExtras(saved.extras);
          setBranches([saved.branch]);
          setDealers([saved.dealer]);
          setInvoices([saved.invoice]);
          setLines(saved.lines);
          setDefects(saved.defects);
          setEditState({
            loading: false,
            error: '',
            complaintNo: row.complaint_no,
            complaintDate: row.complaint_date || new Date(row.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
          });
          // Zone and billing branch are not saved on the complaint. Read them
          // from the same lookups the filing form uses; the form works without them.
          complaintsApi
            .branches()
            .then((list) => {
              const hit = list.find((b) => b.name === saved.branch.name);
              if (!cancelled && hit) setBranches([{ ...saved.branch, ...hit }]);
            })
            .catch(() => {});
          complaintsApi
            .invoices(row.dealer_code)
            .then((list) => {
              const hit = list.find((i) => i.document_number === row.invoice_no);
              if (!cancelled && hit) setInvoices([{ ...saved.invoice, ...hit }]);
            })
            .catch(() => {});
        })
        .catch((err) => !cancelled && setEditState({ loading: false, error: err.message || 'Could not open this complaint.', complaintNo: '', complaintDate: '' }));
      return () => {
        cancelled = true;
      };
    }
    setForm(EMPTY_FORM);
    setInvoiceFile([]);
    setPhotos([]);
    setExtras([]);
    setErrors({});
    setSubmitError('');
    setDealers([]);
    setInvoices([]);
    setLines([]);
    setDefects({});
    setBranchesState({ loading: true, error: '' });
    complaintsApi
      .branches()
      .then((rows) => {
        if (cancelled) return;
        setBranches(rows);
        setBranchesState({ loading: false, error: '' });
        if (rows.length > 0) setForm((f) => ({ ...f, sellingBranch: rows[0].name }));
      })
      .catch((err) => !cancelled && setBranchesState({ loading: false, error: err.message || 'Could not load selling branches.' }));
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId]);

  // Dealers follow the selling branch.
  useEffect(() => {
    if (isEdit) return undefined;
    setDealers([]);
    setDealersState({ loading: false, error: '' });
    if (!form.sellingBranch) return undefined;
    let cancelled = false;
    setDealersState({ loading: true, error: '' });
    complaintsApi
      .dealers(form.sellingBranch)
      .then((rows) => !cancelled && (setDealers(rows), setDealersState({ loading: false, error: '' })))
      .catch((err) => !cancelled && setDealersState({ loading: false, error: err.message || 'Could not load dealers.' }));
    return () => {
      cancelled = true;
    };
  }, [form.sellingBranch, isEdit]);

  const dealerCode = form.dealerCode;
  const sellingBranch = form.sellingBranch;
  const dealer = useMemo(() => dealers.find((d) => d.customer_code === dealerCode), [dealers, dealerCode]);

  // Invoices follow the dealer.
  useEffect(() => {
    if (isEdit) return undefined;
    setInvoices([]);
    setLines([]);
    setDefects({});
    if (!dealerCode) return undefined;
    let cancelled = false;
    setInvoicesState({ loading: true, error: '' });
    complaintsApi
      .invoices(dealerCode)
      .then((rows) => !cancelled && (setInvoices(rows), setInvoicesState({ loading: false, error: '' })))
      .catch((err) => !cancelled && setInvoicesState({ loading: false, error: err.message || 'Could not load invoices.' }));
    return () => {
      cancelled = true;
    };
  }, [dealerCode, isEdit]);

  // Product lines follow the invoice; all start ticked.
  useEffect(() => {
    if (isEdit) return undefined;
    setLines([]);
    setDefects({});
    if (!dealerCode || !form.invoiceNo) return undefined;
    let cancelled = false;
    setLinesState({ loading: true, error: '' });
    complaintsApi
      .invoiceLines(dealerCode, form.invoiceNo)
      .then((rows) => {
        if (cancelled) return;
        setLines(rows);
        setLinesState({ loading: false, error: '' });
      })
      .catch((err) => !cancelled && setLinesState({ loading: false, error: err.message || 'Could not load product lines.' }));
    return () => {
      cancelled = true;
    };
  }, [dealerCode, form.invoiceNo, isEdit]);

  const invoice = useMemo(() => invoices.find((i) => i.document_number === form.invoiceNo), [invoices, form.invoiceNo]);
  const branch = useMemo(() => branches.find((b) => b.name === sellingBranch), [branches, sellingBranch]);
  const isEndCustomer = form.origin === 'END_CUSTOMER';
  const today = todayIso();
  const complaintDate = isEdit ? editState.complaintDate : today;
  // A trading invoice has no factory: leave the field blank.
  const rawFactory = invoice?.manufacturing_factory || '';
  const factory = /trading/i.test(rawFactory) ? '' : rawFactory;

  function changeDefect(id, patch) {
    setDefects((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    setErrors((e) => ({ ...e, lines: undefined, lineErrors: undefined }));
  }

  // Lines with a defective quantity are the ones the complaint is about.
  const involvedLines = useMemo(() => lines.filter((l) => Number(defects[l.line_key]?.qty) > 0), [lines, defects]);

  function validate() {
    const e = {};
    if (!sellingBranch) e.sellingBranch = 'Select a selling branch.';
    if (!dealerCode) e.dealerCode = 'Select a dealer.';
    if (isEndCustomer) {
      if (!form.customerName.trim()) e.customerName = 'Customer name is required.';
      if (!/^[6-9]\d{9}$/.test(form.customerMobile.trim())) e.customerMobile = 'Enter a 10-digit mobile number.';
    }
    if (!form.invoiceNo) e.invoiceNo = 'Select an invoice.';
    else if (involvedLines.length === 0) e.lines = 'Enter a defective quantity on at least one product line.';
    else {
      const lineErrors = {};
      // A saved complaint keeps all its lines: each one needs a quantity.
      (isEdit ? lines : involvedLines).forEach((l) => {
        const d = defects[l.line_key] || {};
        const le = {};
        if (isEdit && !(Number(d.qty) > 0)) le.qty = 'Enter a whole number above zero.';
        else if (!Number.isInteger(Number(d.qty))) le.qty = 'Whole number only.';
        else if (l.quantity != null && Number(d.qty) > Number(l.quantity)) le.qty = `Defective qty cannot be more than Qty Supplied (${Number(l.quantity)}).`;
        if (!d.primary) le.primary = 'Select the primary nature.';
        if (d.primary === OTHER && !String(d.primaryOther ?? '').trim()) le.primaryOther = 'Write the other reason.';
        if (d.secondary === OTHER && !String(d.secondaryOther ?? '').trim()) le.secondaryOther = 'Write the other reason.';
        if (Object.keys(le).length) lineErrors[l.line_key] = le;
      });
      if (Object.keys(lineErrors).length) {
        e.lines = 'Fix the highlighted product lines.';
        e.lineErrors = lineErrors;
      }
    }
    if (form.physicalVisit === 'YES') {
      if (!form.visitDate) e.visitDate = 'Enter the physical visit date.';
      else if (form.visitDate > today) e.visitDate = 'The visit date cannot be in the future.';
    }
    if (!(Number(form.amount) > 0)) e.amount = 'Enter the complaint amount.';
    if (invoiceFile.length === 0) e.invoiceFile = 'Attach the invoice copy (Duro).';
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
    if (isEdit) {
      try {
        const result = await complaintsApi.update({
          id: editId,
          amount: Number(form.amount),
          remarks: form.remarks.trim(),
          branchRemarks: form.branchRemarks.trim(),
          factoryResponse: form.factoryResponse,
          physicalVisit: form.physicalVisit === 'YES',
          visitDate: form.visitDate,
          lineDefects: lines.map((l, idx) => ({
            idx,
            qty_defective: Number(defects[l.line_key].qty),
            primary_nature: natureText(defects[l.line_key].primary, defects[l.line_key].primaryOther),
            secondary_nature: defects[l.line_key].secondary ? natureText(defects[l.line_key].secondary, defects[l.line_key].secondaryOther) : null,
          })),
          invoice: invoiceFile[0].path ?? invoiceFile[0],
          photos: photos.map((f) => f.path ?? f),
          extras: extras.map((f) => f.path ?? f),
        });
        // A new approver has not heard of this complaint yet: mail them (best effort).
        if (result?.rerouted) complaintsApi.notifyFiled(result.complaintNo).catch(() => {});
        toHistory({
          notice: !result?.changed
            ? 'Nothing changed.'
            : result.rerouted
              ? `Complaint ${result.complaintNo} updated. It now goes to ${result.waitingOn || 'a different approver'} for approval.`
              : `Complaint ${result.complaintNo} updated.`,
        });
      } catch (err) {
        setSubmitError(err.message || 'The complaint could not be saved.');
      } finally {
        setIsSaving(false);
      }
      return;
    }
    try {
      const { complaintNo, branchRemarksError } = await complaintsApi.file({
        origin: form.origin,
        selling_branch: sellingBranch,
        dealer_code: dealerCode,
        customer_name: isEndCustomer ? form.customerName.trim() : null,
        customer_mobile: isEndCustomer ? form.customerMobile.trim() : null,
        invoice_no: form.invoiceNo,
        // The server reads the rows back from the sales records by these keys.
        line_keys: involvedLines.map((l) => l.line_key),
        line_defects: involvedLines.map((l) => ({
          line_key: l.line_key,
          qty_defective: Number(defects[l.line_key].qty),
          primary_nature: natureText(defects[l.line_key].primary, defects[l.line_key].primaryOther),
          secondary_nature: defects[l.line_key].secondary ? natureText(defects[l.line_key].secondary, defects[l.line_key].secondaryOther) : null,
        })),
        physical_visit: form.physicalVisit === 'YES',
        physical_visit_date: form.physicalVisit === 'YES' ? form.visitDate : null,
        amount: Number(form.amount),
        installation_context: form.installationContext,
        remarks: form.remarks,
        branchRemarks: form.branchRemarks,
        factoryResponse: form.factoryResponse,
        invoiceFile: invoiceFile[0],
        photoFiles: photos,
        extraFiles: extras,
      });
      // The complaint is saved and routed. Only the mail can still fail.
      let message = 'It is with the approver now.';
      try {
        const sent = await complaintsApi.notifyFiled(complaintNo);
        if (sent.waitingOn) message = `Sent to ${sent.waitingOn} for approval.`;
        if (sent.emailError) message += ` Email not sent: ${sent.emailError}`;
      } catch {
        message = 'It is with the approver now. The email could not be sent.';
      }
      if (branchRemarksError) message += ` Branch remarks not saved: ${branchRemarksError}`;
      // Keep a copy of what was filed, for the success dialog and the print.
      setDone({
        complaintNo,
        message,
        complaintDate,
        originLabel: ORIGINS.find((o) => o.value === form.origin)?.title,
        isEndCustomer,
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile.trim(),
        sellingBranch,
        zone: branch?.zone || dealer?.zone || '',
        filedBy: user?.name || '',
        dealerName: dealer?.customer_name || '',
        dealerCode,
        dealerMobile: dealer?.mobile_no || '',
        dealerEmail: dealer?.email || '',
        physicalVisit: form.physicalVisit === 'YES',
        visitDate: form.visitDate,
        invoiceNo: form.invoiceNo,
        invoiceDate: invoice?.document_date || '',
        factory,
        amount: Number(form.amount),
        lines: involvedLines.map((l) => ({
          ...l,
          supplied: l.quantity,
          qtyDefective: Number(defects[l.line_key].qty),
          primary: natureText(defects[l.line_key].primary, defects[l.line_key].primaryOther),
          secondary: defects[l.line_key].secondary ? natureText(defects[l.line_key].secondary, defects[l.line_key].secondaryOther) : '',
        })),
        invoiceFileName: invoiceFile[0]?.name || '',
        photoNames: photos.map((f) => f.name),
        extraNames: extras.map((f) => f.name),
        installation: form.installationContext.trim(),
        filedAt: '',
        status: 'Registered',
        stage: message,
        remarks: form.remarks.trim(),
        branchRemarks: form.branchRemarks.trim(),
        factoryResponse: { SATISFIED: 'Satisfied', DISSATISFIED: 'Dissatisfied' }[form.factoryResponse] || '',
        routing: message,
      });
      return;
    } catch (err) {
      setSubmitError(err.message || 'Could not register this complaint.');
    } finally {
      setIsSaving(false);
    }
  }

  const textareaClass = `${INPUT} ${INPUT_OK} h-auto min-h-20 resize-y py-2.5`;

  // Progress through the three steps, for the badges and the progress chips.
  const partiesDone =
    Boolean(sellingBranch && dealerCode) &&
    (!isEndCustomer || Boolean(form.customerName.trim() && /^[6-9]\d{9}$/.test(form.customerMobile.trim())));
  const steps = [
    { id: 'step-parties', letter: 'A', title: 'Dealer', done: partiesDone },
    { id: 'step-invoice', letter: 'B', title: 'Invoice & amount', done: Boolean(form.invoiceNo) && involvedLines.length > 0 && Number(form.amount) > 0 },
    { id: 'step-evidence', letter: 'C', title: 'Evidence', done: invoiceFile.length > 0 && photos.length > 0 },
  ];

  if (isEdit && (editState.loading || editState.error)) {
    return (
      <ModulePage title="Edit Complaint" live actions={[{ label: 'Complaint History', variant: 'secondary', onClick: () => toHistory() }]}>
        {editState.error ? <Alert variant="error">{editState.error}</Alert> : <p className="py-10 text-center text-theme-sm text-gray-500">Opening the complaint…</p>}
      </ModulePage>
    );
  }

  return (
    <ModulePage
      title={isEdit ? `Edit Complaint ${editState.complaintNo}` : 'Register Complaint'}
      live
      actions={[{ label: 'Complaint History', variant: 'secondary', onClick: () => toHistory() }]}
    >
      <form id="file-complaint-form" onSubmit={handleSubmit} noValidate className="flex w-full min-w-0 flex-col gap-4">
        <nav aria-label="Progress" className="flex flex-wrap gap-2">
          {steps.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(ev) => {
                ev.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-theme-xs font-medium transition-colors ${
                s.done ? 'border-success-200 bg-success-50 text-success-700' : 'border-gray-200 bg-white text-gray-500 hover:border-brand-200 hover:text-brand-600'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold ${s.done ? 'bg-success-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {s.done ? <Svg className="h-3 w-3">{CHECK}</Svg> : s.letter}
              </span>
              {s.title}
            </a>
          ))}
        </nav>

        <Section id="step-parties" step="A" icon={SECTION_ICONS.parties} title="Origination & dealer"  done={steps[0].done}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <OriginCards value={form.origin} onChange={changeOrigin} disabled={isEdit} />
            </div>

            <div id="complaint-sellingBranch">
              <Select
                id="complaint-branch"
                label={<Req>Selling Branch</Req>}
                value={form.sellingBranch}
                onChange={(e) => {
                  set('sellingBranch', e.target.value);
                  set('dealerCode', '');
                  set('invoiceNo', '');
                }}
                disabled={isEdit || branchesState.loading || branches.length <= 1}
                className={errors.sellingBranch ? '!border-error-300' : ''}
              >
                {branchesState.loading && <option value="">Loading branches…</option>}
                {!branchesState.loading && branches.length === 0 && <option value="">No selling branch assigned</option>}
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </Select>
              {errors.sellingBranch && <p className={HINT_ERROR}>{errors.sellingBranch}</p>}
              {branchesState.error ? (
                <Alert variant="error" className="mt-2">{branchesState.error}</Alert>
              ) : (
                <p className="mt-1.5 text-theme-xs text-gray-500">
                  {branches.length > 1 ? `${branches.length} selling branches are tagged to you.` : 'Your selling branch.'}
                </p>
              )}
            </div>

            <div id="complaint-dealerCode">
              <Select
                id="complaint-dealer"
                label={<Req>Dealer Name</Req>}
                value={form.dealerCode}
                onChange={(e) => {
                  set('dealerCode', e.target.value);
                  set('invoiceNo', '');
                }}
                disabled={isEdit || !form.sellingBranch || dealersState.loading}
                className={errors.dealerCode ? '!border-error-300' : ''}
              >
                <option value="">
                  {!form.sellingBranch ? 'Select a selling branch first' : dealersState.loading ? 'Loading dealers…' : dealers.length === 0 ? 'No dealers in this branch' : '— select —'}
                </option>
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
                <p className="mt-1.5 text-theme-xs text-gray-500">Dealers with sales in {form.sellingBranch || 'the selected branch'}.</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3 md:col-span-2">
              <TextInput
                id="complaint-date"
                label="Complaint Date"
                value={complaintDate ? formatDate(complaintDate) : ''}
                readOnly
                disabled={isEdit}
                hint={isEdit ? 'Filed date' : 'Today, automatic'}
              />
              <TextInput
                id="complaint-dealer-mobile"
                label="Dealer Mobile Number"
                placeholder="Select a dealer"
                value={dealer ? dealer.mobile_no || 'Not on file' : ''}
                readOnly
                disabled={isEdit}
              />
              <TextInput
                id="complaint-dealer-email"
                label="Dealer Email ID"
                placeholder="Select a dealer"
                value={dealer ? dealer.email || 'Not on file' : ''}
                readOnly
                disabled={isEdit}
              />
            </div>
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3 md:col-span-2">
              <Select
                id="complaint-factory-response"
                label="Factory Response"
                wrapperClassName="w-56"
                value={form.factoryResponse}
                onChange={(e) => set('factoryResponse', e.target.value)}
              >
                <option value="">— select —</option>
                <option value="SATISFIED">Satisfied</option>
                <option value="DISSATISFIED">Dissatisfied</option>
              </Select>
              <div id="complaint-visitDate" className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <div>
                  <p className={LABEL}>Physical Visit</p>
                  <div className="grid w-full max-w-[12rem] grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Physical visit">
                    {[['YES', 'Yes'], ['NO', 'No']].map(([value, text]) => {
                      const active = form.physicalVisit === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={isEdit}
                          onClick={() => {
                            set('physicalVisit', value);
                            if (value === 'NO') set('visitDate', '');
                          }}
                          className={`flex h-9 items-center justify-center rounded-lg text-theme-sm font-medium transition-all focus:outline-none focus:ring-3 focus:ring-brand-500/15 disabled:cursor-not-allowed ${
                            active ? 'bg-white text-brand-600 shadow-theme-sm' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
                          }`}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {form.physicalVisit === 'YES' && (
                  <TextInput
                    id="complaint-visit-date"
                    label={<Req>Physical Visit Date</Req>}
                    type="date"
                    max={today}
                    value={form.visitDate}
                    onChange={(e) => set('visitDate', e.target.value)}
                    disabled={isEdit}
                    error={errors.visitDate}
                  />
                )}
              </div>
            </div>

            {isEndCustomer && (
              <>
                <div id="complaint-customerName">
                  <TextInput
                    id="complaint-customer-name"
                    label={<Req>Customer Name</Req>}
                    placeholder="Name of the end-customer"
                    value={form.customerName}
                    onChange={(e) => set('customerName', e.target.value)}
                    disabled={isEdit}
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
                    disabled={isEdit}
                    error={errors.customerMobile}
                  />
                </div>
              </>
            )}
          </div>
        </Section>

        <Section id="step-invoice" step="B" icon={SECTION_ICONS.invoice} title="Invoice & product lines"  done={steps[1].done}>
          <div className="mb-4 grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div id="complaint-invoiceNo">
              <Select
                id="complaint-invoice"
                label={<Req>Invoice Number</Req>}
                value={form.invoiceNo}
                onChange={(e) => set('invoiceNo', e.target.value)}
                disabled={isEdit || !dealerCode || invoicesState.loading}
                className={errors.invoiceNo ? '!border-error-300' : ''}
              >
                <option value="">
                  {!dealerCode ? 'Select a dealer first' : invoicesState.loading ? 'Loading invoices…' : invoices.length === 0 ? 'No invoices found for this dealer' : '— select —'}
                </option>
                {invoices.map((i) => (
                  <option key={i.document_number} value={i.document_number}>
                    {[i.document_number, i.document_date ? formatDate(i.document_date) : '', i.net_amount != null ? formatRupees(i.net_amount) : ''].filter(Boolean).join(' · ')}
                  </option>
                ))}
              </Select>
              {errors.invoiceNo && <p className={HINT_ERROR}>{errors.invoiceNo}</p>}
              {invoicesState.error && <Alert variant="error" className="mt-2">{invoicesState.error}</Alert>}
            </div>
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
              <p className="-mt-3 text-theme-xs text-gray-500">The amount decides which manager level approves.</p>
            </div>
          </div>
          {form.invoiceNo && (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <InfoCard label="Invoice Date" value={invoice?.document_date ? formatDate(invoice.document_date) : ''} />
              <InfoCard label="Zone" value={branch?.zone || dealer?.zone} />
              <InfoCard label="Billing Branch" value={invoice?.billing_branch} />
              <InfoCard label="Selling Branch" value={sellingBranch} />
              <InfoCard label="Manufacturing Factory" value={factory} />
            </div>
          )}
          <div id="complaint-lines">
            <InvoiceLines
              invoiceNo={form.invoiceNo}
              lines={lines}
              isLoading={linesState.loading}
              error={linesState.error}
              defects={defects}
              onChange={changeDefect}
              lineErrors={errors.lineErrors}
            />
            {errors.lines && <p className={HINT_ERROR}>{errors.lines}</p>}
          </div>
        </Section>

        <Section id="step-evidence" step="C" icon={SECTION_ICONS.evidence} title="Evidence & remarks"  done={steps[2].done}>
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            <div id="complaint-invoiceFile">
              <FileDrop
                id="complaint-invoice-file"
                label={<Req>Invoice Copy (Duro)</Req>}
                title="Attach invoice"
                hint="PDF or image · one file only"
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
                label={<Req note="(1 to 5)">Site Photographs</Req>}
                title="Attach photo"
                hint="JPEG or PNG · up to 5 photos"
                accept="image/jpeg,image/png"
                multiple
                maxFiles={5}
                files={photos}
                onChange={(f) => (setPhotos(f), setErrors((e) => ({ ...e, photos: undefined })))}
                onReject={(m) => setErrors((e) => ({ ...e, photos: m }))}
                error={errors.photos}
              />
            </div>

            {/* <div>
              <label htmlFor="complaint-install" className={LABEL}>Installation Context</label>
              <textarea
                id="complaint-install"
                rows={2}
                placeholder="Optional notes"
                value={form.installationContext}
                onChange={(e) => set('installationContext', e.target.value)}
                className={textareaClass}
              />
            </div> */}
            <div>
              <label htmlFor="complaint-remarks" className={LABEL}>Dealer / Customer Remarks</label>
              <textarea
                id="complaint-remarks"
                rows={2}
                placeholder="Optional"
                value={form.remarks}
                onChange={(e) => set('remarks', e.target.value)}
                className={textareaClass}
              />
            </div>
            <div>
              <label htmlFor="complaint-branch-remarks" className={LABEL}>Branch Remarks</label>
              <textarea
                id="complaint-branch-remarks"
                rows={2}
                maxLength={2000}
                placeholder="Optional"
                value={form.branchRemarks}
                onChange={(e) => set('branchRemarks', e.target.value)}
                className={textareaClass}
              />
            </div>

            {/* <div className="md:col-span-2">
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
            </div> */}
          </div>
        </Section>

        <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-theme-md backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 flex-1">
            {submitError ? <Alert variant="error">{submitError}</Alert> : <p className="text-theme-sm text-gray-500">{isEdit ? 'Check the details, then save the changes.' : 'Check the details, then register the complaint.'}</p>}
          </div>
          <div className="flex shrink-0 gap-3">
            <Button type="button" variant="secondary" onClick={() => toHistory()} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {isEdit ? 'Save changes' : 'Register Complaint'}
            </Button>
          </div>
        </div>
      </form>

      <Modal
        open={Boolean(done)}
        onClose={onReset}
        title="Complaint registered"
        subtitle="The complaint was filed successfully."
        icon={<Svg className="h-5 w-5">{CHECK}</Svg>}
        footer={
          <>
            <Button variant="secondary" onClick={() => toHistory()}>Complaint History</Button>
            <Button variant="secondary" onClick={download} isLoading={downloading}>Download PDF</Button>
            <Button onClick={onReset}>Register Another</Button>
          </>
        }
      >
        {done && (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success-500 text-white shadow-theme-sm">
              <Svg className="h-7 w-7">{CHECK}</Svg>
            </span>
            <p className="text-theme-sm text-gray-600">Your complaint number is</p>
            <p className="rounded-xl border border-success-200 bg-success-50 px-5 py-2 text-xl font-semibold tracking-wide text-gray-800">{done.complaintNo}</p>
            <p className="text-theme-sm text-gray-600">{done.message}</p>
            {downloadError && <Alert variant="error">{downloadError}</Alert>}
          </div>
        )}
      </Modal>
    </ModulePage>
  );
}

export default function FileComplaintPage() {
  // A new key remounts the form, so it starts empty for the next complaint.
  const [round, setRound] = useState(0);
  return (
    <ComplaintGate need="file">
      <FileComplaintForm key={round} onReset={() => setRound((n) => n + 1)} />
    </ComplaintGate>
  );
}
