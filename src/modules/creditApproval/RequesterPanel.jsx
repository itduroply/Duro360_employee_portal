import { useMemo, useState } from 'react';
import Alert from '../../components/common/Alert.jsx';
import Button from '../../components/common/Button.jsx';
import Modal from '../../components/common/Modal.jsx';
import DataTable from '../../components/ModulePage/DataTable.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { creditApi } from './api/creditApi.js';
import { formatDateTime, rupees, shortId } from './lib/format.js';
import { NoteBadge, QueryThread, RequestDetails, StatusPill, TypePill, useList } from './components.jsx';
import RequisitionForm from './RequisitionForm.jsx';

const TABS = ['All', 'Pending', 'Approved', 'Rejected'];

export default function RequesterPanel({ tab, onTab }) {
  const { user } = useAuth();
  const { data, error, loading, reload } = useList(creditApi.getRequesterRequisitions, 0, user?.id ? [`credit:user:${user.id}`] : []);
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);

  const rows = data?.requisitions ?? [];
  const sellingBranches = data?.sellingBranches ?? [];
  // Keep the open request fresh after a reply.
  const open = useMemo(() => rows.find((r) => r.id === selected) ?? null, [rows, selected]);

  const columns = [
    { key: 'dealerName', label: 'Dealer', render: (r) => (
      <div>
        <p>{r.dealerName}</p>
        <p className="text-theme-xs font-normal text-gray-500">{r.ref} · {r.dealerCode}</p>
      </div>
    ) },
    { key: 'branchName', label: 'Branch' },
    { key: 'requestType', label: 'Type', render: (r) => <TypePill value={r.requestType} /> },
    { key: 'tempCreditAmount', label: 'Proposed limit', align: 'right', render: (r) => rupees(r.tempCreditAmount) },
    { key: 'status', label: 'Status', render: (r) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill status={r.status} />
        {r.totalLevels > 1 && r.status === 'Pending' && <NoteBadge tone="brand">Level {r.approvalStage} of {r.totalLevels}</NoteBadge>}
        {r.awaitingMyReply && <NoteBadge>Reply needed</NoteBadge>}
      </div>
    ) },
    { key: 'assignedToName', label: 'With approver' },    { key: 'sentAt', label: 'Sent', render: (r) => formatDateTime(r.sentAt) },
  ];

  if (tab === 'Add Request') {
    return (
      <RequisitionForm
        sellingBranches={sellingBranches}
        onCancel={() => onTab('All Requests')}
        onSubmitted={(result) => {
          setNotice(
            `Request ${shortId(result.requisitionId)} sent to ${result.assignedToName}.` +
              (result.approverNotified === false ? ` The email to the approver could not be sent (${result.emailError || 'unknown reason'}). The request is still in their inbox.` : '')
          );
          reload(true);
          onTab('All Requests');
        }}
      />
    );
  }

  return (
    <div>
      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <DataTable
        title="My requests"
        rows={rows}
        tabs={TABS}
        searchPlaceholder="Search dealer or request"
        searchFields={['dealerName', 'dealerCode', 'ref']}
        columns={columns}
        onRowClick={(r) => setSelected(r.id)}
        empty={{
          icon: 'dealers',
          title: loading ? 'Loading…' : 'You have not sent any request yet',
          hint: loading ? '' : 'Open Add Request to ask for a credit limit.',
          action: loading ? null : <Button size="sm" onClick={() => onTab('Add Request')}>Add request</Button>,
        }}
      />

      <Modal open={Boolean(open)} size="lg" title={open ? `${open.dealerName}` : ''} subtitle={open ? `Request ${open.ref}` : ''} onClose={() => setSelected(null)}>
        {open && (
          <>
            <RequestDetails request={open} />
            {open.awaitingMyReply && (
              <Alert variant="warning" className="mt-6">
                {open.assignedToName} has asked a question about this request. Write your reply below. The same request then goes back to them.
              </Alert>
            )}
            <h4 className="mb-2.5 mt-6 text-theme-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Questions from the approver</h4>
            <QueryThread
              requisitionId={open.id}
              canReply={open.awaitingMyReply}
              onChanged={() => {
                setNotice(`Reply sent. The request is back with ${open.assignedToName} for review.`);
                setSelected(null);
                reload(true);
              }}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
