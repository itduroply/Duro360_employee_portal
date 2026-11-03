import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usersApi } from '../../api/usersApi';
import Button from '../../components/common/Button.jsx';
import TextInput from '../../components/common/TextInput.jsx';
import Alert from '../../components/common/Alert.jsx';
import StatCard from '../../components/common/StatCard.jsx';
import PageHeader from '../../components/common/PageHeader.jsx';
import Pagination from '../../components/common/Pagination.jsx';
import { SearchIcon } from '../../components/common/icons.jsx';
import { normalizeDealerCode } from '../../utils/dealerLogin';
import { INPUT, INPUT_OK } from '../../components/common/formStyles.js';
import {
  TABLE_WRAPPER, TABLE, TABLE_HEAD, TH, TABLE_ROW, TD, TD_PRIMARY, TABLE_EMPTY, CHIP_ACTIVE, CHIP_INACTIVE, CHIP_NEUTRAL,
} from '../../components/common/tableStyles.js';

const PAGE_SIZE = 20;
const BULK_CHUNK = 20;
const DEFAULT_PASSWORD = 'Test@123';
const EMPTY_FORM = { dealerCode: '', password: DEFAULT_PASSWORD };

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}


function normalizeRow(row) {
  const get = (...keys) => {
    for (const key of Object.keys(row)) {
      if (keys.includes(key.trim().toLowerCase())) return String(row[key]).trim();
    }
    return '';
  };
  // Name and mobile come from the Dealer Directory on the server, so the
  // sheet only needs the code (and optionally a password).
  return {
    dealerCode: normalizeDealerCode(get('dealer code', 'code', 'customer code', 'customer_code')),
    password: get('password') || DEFAULT_PASSWORD,
  };
}

function ManageDealerLogins() {
  const [dealers, setDealers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addedNotice, setAddedNotice] = useState('');

  const fileInputRef = useRef(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);

  async function loadDealers() {
    setIsLoading(true);
    setListError('');
    try {
      const { users } = await usersApi.listDealers();
      setDealers(users);
    } catch (err) {
      setListError(err.message || 'Could not load Dealer logins.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDealers();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    setAddedNotice('');
    setIsAdding(true);
    try {
      const { user: created } = await usersApi.createDealer(form);
      setAddedNotice(`Dealer login created for ${created.name}: ${created.dealerCode} / ${form.password}`);
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      await loadDealers();
    } catch (err) {
      setAddError(err.message || 'Could not add this Dealer.');
    } finally {
      setIsAdding(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    setUploadResults(null);
    setParseError('');
    setParsedRows([]);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        const rows = rawRows.map(normalizeRow).filter((r) => r.dealerCode);
        if (rows.length === 0) {
          setParseError('No rows with a Dealer Code were found in this sheet.');
        }
        setParsedRows(rows);
      } catch (err) {
        setParseError('Could not read this file. Make sure it is a valid .xlsx/.xls/.csv file.');
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleBulkUpload() {
    setIsUploading(true);
    setUploadResults(null);
    try {
      const { results } = await usersApi.bulkCreateDealers(parsedRows);
      setUploadResults(results);
      setParsedRows([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDealers();
    } catch (err) {
      setParseError(err.message || 'Could not upload this sheet.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Dealer Logins</h3>
          <p className="text-theme-sm text-gray-500">Add Dealers one at a time, or upload a spreadsheet of them.</p>
        </div>
        <Button onClick={() => setShowAddForm((v) => !v)}>{showAddForm ? 'Cancel' : '+ Add Dealer'}</Button>
      </div>

      {addedNotice && (
        <Alert variant="success" className="mb-4">
          {addedNotice}
        </Alert>
      )}

      {showAddForm && (
        <form onSubmit={handleAdd} className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              id="dealer-code"
              label="Dealer Code"
              placeholder="e.g. C30001"
              value={form.dealerCode}
              onChange={(e) => setForm((f) => ({ ...f, dealerCode: e.target.value }))}
              required
            />
            <TextInput
              id="dealer-password"
              label="Password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          {addError && (
            <Alert variant="error" className="mb-4">
              {addError}
            </Alert>
          )}

          <Button type="submit" isLoading={isAdding}>
            Add Dealer
          </Button>
        </form>
      )}


      {listError && (
        <Alert variant="error" className="mb-4">
          {listError}
        </Alert>
      )}

      <div className={TABLE_WRAPPER}>
        <table className={TABLE}>
          <thead className={TABLE_HEAD}>
            <tr>
              <th className={TH}>Code</th>
              <th className={TH}>Name</th>
              <th className={TH}>Mobile</th>
              <th className={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className={TABLE_EMPTY}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && dealers.length === 0 && (
              <tr>
                <td colSpan={4} className={TABLE_EMPTY}>
                  No Dealer logins yet.
                </td>
              </tr>
            )}
            {!isLoading &&
              dealers.map((dealer) => (
                <tr key={dealer.id} className={TABLE_ROW}>
                  <td className={`${TD} whitespace-nowrap`}>{dealer.dealer_code || '—'}</td>
                  <td className={`${TD} ${TD_PRIMARY}`}>{dealer.name}</td>
                  <td className={TD}>{dealer.mobile_number || '—'}</td>
                  <td className={TD}>
                    <span
                      className={dealer.status === 'ACTIVE' ? CHIP_ACTIVE : CHIP_INACTIVE}
                    >
                      {dealer.status}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DealersDirectory() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles?.includes('SUPERADMIN');

  const [dealers, setDealers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [page, setPage] = useState(1);

  // Super Admin only: which Dealer Codes already have a portal login, so
  // each directory row can show its login status or a "Create login" action.
  const [loginsByCode, setLoginsByCode] = useState({});
  const [creatingCode, setCreatingCode] = useState('');
  const [loginNotice, setLoginNotice] = useState('');

  async function loadLogins() {
    const { users } = await usersApi.listDealers();
    setLoginsByCode(Object.fromEntries(users.filter((u) => u.dealer_code).map((u) => [u.dealer_code, u])));
  }

  useEffect(() => {
    if (!isSuperAdmin) return;
    loadLogins().catch((err) => setError(err.message || 'Could not load Dealer logins.'));
  }, [isSuperAdmin]);

  const [togglingId, setTogglingId] = useState('');

  // Turns one Dealer's login on or off. An inactive login cannot sign in.
  async function toggleStatus(login) {
    const next = login.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setError('');
    setLoginNotice('');
    setTogglingId(login.id);
    try {
      await usersApi.updateStatus(login.id, next);
      setLoginsByCode((all) => ({ ...all, [login.dealer_code]: { ...login, status: next } }));
      setLoginNotice(`${login.name} (${login.dealer_code}) is now ${next === 'ACTIVE' ? 'active' : 'inactive'}.`);
    } catch (err) {
      setError(err.message || 'Could not change this login.');
    } finally {
      setTogglingId('');
    }
  }

  async function createLogin(dealer) {
    setError('');
    setLoginNotice('');
    setCreatingCode(dealer.customer_code);
    try {
      await usersApi.createDealer({ dealerCode: dealer.customer_code, password: DEFAULT_PASSWORD });
      setLoginNotice(`Login created for ${dealer.customer_name}: ${dealer.customer_code} / ${DEFAULT_PASSWORD}`);
      await loadLogins();
    } catch (err) {
      setError(err.message || 'Could not create this login.');
      // The list may be out of date. Reload it so a login that exists shows its status.
      await loadLogins().catch(() => {});
    } finally {
      setCreatingCode('');
    }
  }

  // Dealers in the selected zone (or all zones) that still have no login.
  const pendingInZone = useMemo(
    () => dealers.filter((d) => (!zoneFilter || d.zone === zoneFilter) && !loginsByCode[d.customer_code]),
    [dealers, zoneFilter, loginsByCode]
  );
  const [bulkProgress, setBulkProgress] = useState(null);

  async function createLoginsForZone() {
    const targets = pendingInZone;
    if (targets.length === 0) return;
    const scope = zoneFilter || 'all zones';
    if (!window.confirm(`Create ${targets.length} Dealer logins for ${scope}? Password will be ${DEFAULT_PASSWORD}.`)) return;

    setError('');
    setLoginNotice('');
    let created = 0;
    const failed = [];
    try {
      for (let i = 0; i < targets.length; i += BULK_CHUNK) {
        const chunk = targets.slice(i, i + BULK_CHUNK);
        setBulkProgress({ done: i, total: targets.length });
        // One failed batch must not stop the rest. Its dealers are listed as
        // failed and stay without a login, so a second click retries them.
        try {
          const { results } = await usersApi.bulkCreateDealers(
            chunk.map((d) => ({ dealerCode: d.customer_code, password: DEFAULT_PASSWORD }))
          );
          results.forEach((r) => (r.ok ? (created += 1) : failed.push(`${r.dealerCode}: ${r.message}`)));
          setBulkProgress({ done: Math.min(i + chunk.length, targets.length), total: targets.length });
        } catch (err) {
          failed.push(`${chunk[0].customer_code} to ${chunk[chunk.length - 1].customer_code}: ${err.message || 'batch failed'}`);
        }
      }
    } finally {
      setBulkProgress(null);
      await loadLogins().catch(() => {});
    }
    setLoginNotice(`${created} logins created for ${scope}. Password: ${DEFAULT_PASSWORD}.`);
    if (failed.length) {
      setError(`${failed.length} failed. ${failed.slice(0, 3).join(' | ')}${failed.length > 3 ? ' …' : ''}`);
    }
  }

  const columnCount = isSuperAdmin ? 8 : 7;

  useEffect(() => {
    let cancelled = false;
    usersApi
      .listDealerDirectory()
      .then(({ dealers: rows }) => {
        if (!cancelled) setDealers(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load the Dealer Directory.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const zones = useMemo(
    () => Array.from(new Set(dealers.map((d) => d.zone).filter(Boolean))).sort(),
    [dealers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dealers.filter((d) => {
      if (zoneFilter && d.zone !== zoneFilter) return false;
      if (!q) return true;
      return (
        d.customer_name?.toLowerCase().includes(q) ||
        d.customer_code?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.mobile_no?.includes(q)
      );
    });
  }, [dealers, search, zoneFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function updateFilter(setter) {
    return (value) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
      <PageHeader title="Dealers" />
      {/* <p className="mb-6 text-sm text-slate-500">
        {isSuperAdmin
          ? 'Create Dealer logins, and browse the Dealer master data synced from App Launcher.'
          : 'Dealer master data, synced from App Launcher.'}
      </p> */}

      {/* {isSuperAdmin && <ManageDealerLogins />} */}

      {/* <h2 className="mb-4 text-sm font-semibold text-slate-900">Dealer Directory</h2>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Dealers" value={dealers.length.toLocaleString('en-IN')} />
        <StatCard label="Zones" value={zones.length} />
        <StatCard label="Showing" value={filtered.length.toLocaleString('en-IN')} />
      </div> */}

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {loginNotice && (
        <Alert variant="success" className="mb-4">
          {loginNotice}
        </Alert>
      )}

      <div className={TABLE_WRAPPER}>
        {/* Card header: search on the left, zone filter on the right. */}
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:w-[320px]">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-500">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Search by name, code, email, or mobile…"
              value={search}
              onChange={(e) => updateFilter(setSearch)(e.target.value)}
              className={`${INPUT} ${INPUT_OK} pl-12`}
            />
          </div>
          {isSuperAdmin && (
            <Button
              onClick={createLoginsForZone}
              disabled={Boolean(bulkProgress) || Boolean(creatingCode) || pendingInZone.length === 0}
            >
              {bulkProgress
                ? `Creating ${bulkProgress.done} of ${bulkProgress.total}… keep this page open`
                : pendingInZone.length === 0
                  ? 'All logins active'
                  : `Activate ${zoneFilter || 'all zones'} (${pendingInZone.length})`}
            </Button>
          )}
        </div>

        {/* Zone tabs: pick one zone, or All to work across every zone. */}
        <div className="custom-scrollbar flex gap-2 overflow-x-auto border-t border-gray-100 px-5 py-3 sm:px-6">
          {['', ...zones].map((zone) => {
            const selected = zoneFilter === zone;
            return (
              <button
                key={zone || 'all'}
                type="button"
                onClick={() => updateFilter(setZoneFilter)(zone)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-theme-sm font-medium transition-colors ${
                  selected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {zone || 'All Zones'}
              </button>
            );
          })}
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className={TABLE}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th className={TH}>Code</th>
                <th className={TH}>Dealer Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Mobile</th>
                <th className={TH}>Zone</th>
                <th className={TH}>Branch</th>
                <th className={`${TH} text-right`}>Credit Limit</th>
                {isSuperAdmin && <th className={`${TH} text-right`}>Login</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={columnCount} className={TABLE_EMPTY}>
                    Loading dealers…
                  </td>
                </tr>
              )}
              {!isLoading && pageRows.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className={TABLE_EMPTY}>
                    No dealers match your search.
                  </td>
                </tr>
              )}
              {!isLoading &&
                pageRows.map((d) => (
                  <tr key={d.customer_code} className={TABLE_ROW}>
                    <td className={`${TD} whitespace-nowrap`}>{d.customer_code}</td>
                    <td className={`${TD} ${TD_PRIMARY}`}>{d.customer_name}</td>
                    <td className={TD}>{d.email || '—'}</td>
                    <td className={`${TD} whitespace-nowrap`}>{d.mobile_no || '—'}</td>
                    <td className={TD}>{d.zone ? <span className={CHIP_NEUTRAL}>{d.zone}</span> : '—'}</td>
                    <td className={TD}>{d.selling_branch || '—'}</td>
                    <td className={`${TD} whitespace-nowrap text-right font-medium text-gray-800`}>
                      {formatCurrency(d.credit_limit)}
                    </td>
                    {isSuperAdmin && (
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        {loginsByCode[d.customer_code] ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className={loginsByCode[d.customer_code].status === 'ACTIVE' ? CHIP_ACTIVE : CHIP_INACTIVE}>
                              {loginsByCode[d.customer_code].status === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleStatus(loginsByCode[d.customer_code])}
                              disabled={togglingId === loginsByCode[d.customer_code].id}
                              className="text-theme-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
                            >
                              {togglingId === loginsByCode[d.customer_code].id
                                ? 'Saving…'
                                : loginsByCode[d.customer_code].status === 'ACTIVE'
                                  ? 'Deactivate'
                                  : 'Activate'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => createLogin(d)}
                            disabled={Boolean(creatingCode)}
                            className="text-theme-sm font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
                          >
                            {creatingCode === d.customer_code ? 'Creating…' : 'Create login'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:px-6">
            <p className="text-theme-sm text-gray-500">
              Showing <span className="font-medium text-gray-800">{rangeStart}</span>–
              <span className="font-medium text-gray-800">{rangeEnd}</span> of{' '}
              <span className="font-medium text-gray-800">{filtered.length.toLocaleString('en-IN')}</span> dealers
            </p>
            <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
