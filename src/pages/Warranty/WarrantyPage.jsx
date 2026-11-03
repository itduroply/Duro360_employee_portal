import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModulePage, { KpiStrip, StatusChip } from '../../components/ModulePage/ModulePage.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import Modal from '../../components/common/Modal.jsx';
import Button from '../../components/common/Button.jsx';
import Alert from '../../components/common/Alert.jsx';
import { INPUT, INPUT_OK, LABEL } from '../../components/common/formStyles.js';
import { NAV_ICONS } from '../../components/Sidebar/navIcons.jsx';
import { warrantyApi } from '../../api/warrantyApi';
import { daysBetween, formatCount, formatDate, formatDateTime } from '../../utils/format.js';
import { PROGRAMS, STATUS_LABEL, customerTypeLabel, formatRupees, groupByTerm, invoiceDateRange } from '../../utils/warranty.js';
import { ProgramTag, toRow } from './warrantyRows.jsx';

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-theme-xs text-gray-400">{label}</dt>
      <dd className="mt-0.5 break-words text-theme-sm font-medium text-gray-800">{children || '—'}</dd>
    </div>
  );
}

function DocButton({ label, path }) {
  const [state, setState] = useState('');
  async function open() {
    const tab = window.open('', '_blank');
    setState('loading');
    try {
      const url = await warrantyApi.documentUrl(path);
      if (tab) tab.location.href = url;
      setState('');
    } catch (err) {
      tab?.close();
      setState(err.message || 'Could not open this file.');
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-25"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
          {NAV_ICONS.documents && <NAV_ICONS.documents />}
        </span>
        <span className="flex-1">
          <span className="block text-theme-sm font-medium text-gray-800">{label}</span>
          <span className="block text-theme-xs text-gray-500">{state === 'loading' ? 'Opening…' : 'Open in a new tab'}</span>
        </span>
      </button>
      {state && state !== 'loading' && <p className="mt-1 text-theme-xs text-error-500">{state}</p>}
    </div>
  );
}

// Check one registration against its documents, then approve or reject it.
function ReviewModal({ cert, onClose, onDone }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('view');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMode('view');
    setReason('');
    setError('');
  }, [cert?.id]);

  if (!cert) return null;
  const program = PROGRAMS[cert.program];
  const pending = cert.status === STATUS_LABEL.PENDING;
  const lag = daysBetween(cert.invoice_date, cert.created_at);
  const inWindow = cert.invoice_date >= invoiceDateRange(cert.created_at.slice(0, 10)).min;
  const address = [cert.address1, cert.address2, cert.address3].filter(Boolean).join(', ');
  const hasType = cert.customer_type && cert.customer_type !== 'CONSUMER';
  const typeAddress = [cert.type_address1, cert.type_address2, cert.type_address3].filter(Boolean).join(', ');

  async function run(action) {
    setIsSaving(true);
    setError('');
    try {
      if (action === 'approve') {
        const serial = await warrantyApi.approve(cert.id);
        onDone(`Approved. Serial No. ${serial} is now on the certificate.`);
      } else {
        await warrantyApi.reject(cert.id, reason);
        onDone(`Rejected. ${cert.dealer_name} can see the reason on their portal.`);
      }
    } catch (err) {
      setError(err.message || 'Could not save this decision.');
    } finally {
      setIsSaving(false);
    }
  }

  const Icon = NAV_ICONS.warranty;
  let footer;
  if (!pending) {
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {cert.status === STATUS_LABEL.ISSUED && <Button onClick={() => navigate(`/print/warranty/${cert.id}`)}>View certificate</Button>}
      </>
    );
  } else if (mode === 'reject') {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setMode('view')} disabled={isSaving}>
          Back
        </Button>
        <Button variant="danger" onClick={() => run('reject')} isLoading={isSaving} disabled={!reason.trim()}>
          Reject registration
        </Button>
      </>
    );
  } else {
    footer = (
      <>
        <Button variant="secondary" onClick={() => setMode('reject')} disabled={isSaving}>
          Reject
        </Button>
        <Button onClick={() => run('approve')} isLoading={isSaving}>
          Approve and give serial no.
        </Button>
      </>
    );
  }

  return (
    <Modal
      open
      size="lg"
      title={`${program.certificate} · ${cert.customer_name}`}
      subtitle={`${cert.dealer_name} (${cert.dealer_code}) · submitted ${formatDateTime(cert.created_at)}`}
      icon={Icon && <Icon />}
      onClose={onClose}
      locked={isSaving}
      footer={footer}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ProgramTag program={cert.program} />
        <StatusChip status={cert.status} />
        {cert.serial_no && <span className="font-mono text-theme-sm font-semibold text-gray-800">{cert.serial_no}</span>}
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-theme-xs font-medium ${inWindow ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'}`}>
          Registered {lag} {lag === 1 ? 'day' : 'days'} after invoice
        </span>
      </div>

      {cert.reject_reason && (
        <Alert variant="error" className="mt-4">
          <span className="font-medium">Rejected:</span> {cert.reject_reason}
        </Alert>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="mb-3 text-theme-xs font-semibold uppercase tracking-wider text-gray-400">Consumer</p>
          <dl className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Customer type">{customerTypeLabel(cert.customer_type)}</Field>
            </div>
            <div className="col-span-2">
              <Field label="Name">{cert.customer_name}</Field>
            </div>
            <div className="col-span-2">
              <Field label="Address">{`${address}, ${cert.city}, ${cert.state} ${cert.pin}`}</Field>
            </div>
            <Field label="Mobile">{cert.mobile}</Field>
            <Field label="Email">{cert.email}</Field>
          </dl>
        </div>
        <div className="rounded-xl bg-gray-50 p-4">
          <p className="mb-3 text-theme-xs font-semibold uppercase tracking-wider text-gray-400">Invoice</p>
          <dl className="grid grid-cols-2 gap-3">
            <Field label="Invoice No.">{cert.invoice_no}</Field>
            <Field label="Invoice date">{formatDate(cert.invoice_date)}</Field>
            <div className="col-span-2">
              <Field label={`Invoice value${program.invoiceNote ? ` (${program.invoiceNote})` : ''}`}>{formatRupees(cert.invoice_value)}</Field>
            </div>
          </dl>
        </div>
        {hasType && (
          <div className="rounded-xl bg-gray-50 p-4 sm:col-span-2">
            <p className="mb-3 text-theme-xs font-semibold uppercase tracking-wider text-gray-400">
              {customerTypeLabel(cert.customer_type)}’s details
            </p>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="col-span-2">
                <Field label="Name">{cert.type_name}</Field>
              </div>
              <Field label="Mobile">{cert.type_mobile}</Field>
              <Field label="Email">{cert.type_email}</Field>
              <div className="col-span-2 sm:col-span-4">
                <Field label="Address">{`${typeAddress}, ${cert.type_city}, ${cert.type_state} ${cert.type_pin}`}</Field>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="mb-2.5 text-theme-xs font-semibold uppercase tracking-wider text-gray-400">Brands registered</p>
        <div className="flex flex-wrap gap-2">
          {groupByTerm(cert.items).flatMap((g) =>
            g.items.map((i) => (
              <span key={i.brand} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-theme-sm text-gray-700">
                {i.brand}
                <span className="text-theme-xs text-gray-400">· {g.label}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2.5 text-theme-xs font-semibold uppercase tracking-wider text-gray-400">Documents</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DocButton label="Invoice copy" path={cert.invoice_path} />
          {cert.id_proof_path ? (
            <DocButton label="ID proof" path={cert.id_proof_path} />
          ) : (
            <p className="flex items-center rounded-xl border border-dashed border-gray-200 px-4 py-3 text-theme-sm text-gray-400">
              No ID proof uploaded (optional)
            </p>
          )}
        </div>
        {pending && (
          <p className="mt-3 text-theme-xs text-gray-500">
            Check that the name, invoice number, date, brands and value match the uploaded invoice before you approve.
          </p>
        )}
      </div>

      {mode === 'reject' && (
        <div className="mt-5">
          <label htmlFor="reject-reason" className={LABEL}>
            Reason for the dealer
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Invoice value does not match the uploaded invoice."
            className={`${INPUT} ${INPUT_OK} h-auto resize-none`}
          />
        </div>
      )}

      {error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}
    </Modal>
  );
}

// Console: every Dealer's registrations. The Duro team checks each one and
// approves it (which gives the serial number) or rejects it with a reason.
export default function WarrantyPage() {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      setRows((await warrantyApi.list()).map(toRow));
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load certificates.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const by = (s) => rows.filter((r) => r.status === s).length;
    return {
      pending: by(STATUS_LABEL.PENDING),
      issued: by(STATUS_LABEL.ISSUED),
      rejected: by(STATUS_LABEL.REJECTED),
      duro: rows.filter((r) => r.program === 'DURO_GUARANTEE' && r.status === STATUS_LABEL.ISSUED).length,
    };
  }, [rows]);
  const has = rows.length > 0;
  const open = rows.find((r) => r.id === openId) || null;

  async function handleDone(message) {
    setOpenId(null);
    setNotice(message);
    await load();
  }

  const columns = [
    {
      key: 'customer',
      label: 'Customer',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-800">{r.customer_name}</p>
          <p className="text-theme-xs text-gray-400">
            {r.city}, {r.state}
          </p>
        </div>
      ),
    },
    { key: 'program', label: 'Program', render: (r) => <ProgramTag program={r.program} /> },
    {
      key: 'dealer',
      label: 'Dealer',
      render: (r) => (
        <div>
          <p className="max-w-[200px] truncate text-gray-700" title={r.dealer_name}>
            {r.dealer_name}
          </p>
          <p className="text-theme-xs text-gray-400">{r.dealer_code}</p>
        </div>
      ),
    },
    {
      key: 'invoice',
      label: 'Invoice',
      render: (r) => (
        <div>
          <p className="text-gray-700">{r.invoice_no}</p>
          <p className="text-theme-xs text-gray-400">{formatDate(r.invoice_date)}</p>
        </div>
      ),
    },
    { key: 'value', label: 'Value (Rs)', align: 'right', render: (r) => r.value_text },
    { key: 'submitted', label: 'Submitted', render: (r) => formatDate(r.created_at) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip status={r.status} />
          {r.serial_no && <span className="font-mono text-theme-xs text-gray-500">{r.serial_no}</span>}
        </div>
      ),
    },
  ];

  return (
    <ModulePage title="Duro Certificates" description="Check dealer registrations and issue Duro Guarantee and Tower Duro certificates." live>
      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      <KpiStrip
        items={[
          { label: 'Awaiting Approval', value: has ? formatCount(counts.pending) : undefined, icon: 'outstanding', tone: 'warning' },
          { label: 'Issued', value: has ? formatCount(counts.issued) : undefined, icon: 'warranty', tone: 'success' },
          { label: 'Duro Guarantees Issued', value: has ? formatCount(counts.duro) : undefined, icon: 'documents', tone: 'brand' },
          { label: 'Rejected', value: has ? formatCount(counts.rejected) : undefined, icon: 'queries', tone: 'error' },
        ]}
      />
      <DataTable
        title="Registrations"
        rows={rows}
        tabs={['Pending', 'Issued', 'Rejected', 'All']}
        searchPlaceholder="Search customer, dealer, invoice"
        searchFields={['customer_name', 'dealer_name', 'dealer_code', 'invoice_no', 'serial_no', 'city']}
        columns={columns}
        pageSize={10}
        onRowClick={(r) => {
          setNotice('');
          setOpenId(r.id);
        }}
        empty={{
          icon: 'warranty',
          title: isLoading ? 'Loading registrations…' : 'Nothing here',
          hint: isLoading ? undefined : 'Dealer registrations will show here as they come in.',
        }}
      />
      <ReviewModal cert={open} onClose={() => setOpenId(null)} onDone={handleDone} />
    </ModulePage>
  );
}
