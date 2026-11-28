import { useOutletContext } from 'react-router-dom';
import Alert from '../../components/common/Alert.jsx';

const MESSAGES = {
  file: 'You cannot file complaints. Ask the Super Admin to give you access.',
  edit: 'You cannot edit this complaint.',
  approve: 'No complaint has come to you for approval yet.',
  superadmin: 'Only the Super Admin can open this page.',
};

// The rights the console layout worked out for Complaints, and a way to read
// them again after a change.
export function useComplaintRights() {
  const context = useOutletContext() ?? {};
  return {
    access: context.complaintAccess ?? null,
    rights: context.complaintRights ?? { canFile: false, canEdit: false, canApprove: false, isSuperAdmin: false, pending: 0 },
    refresh: context.refreshComplaintAccess ?? (() => {}),
  };
}

// Shows the page only to people with the right `need`: file, approve or superadmin.
export default function ComplaintGate({ need, children }) {
  const { access, rights } = useComplaintRights();
  const allowed = need === 'file' ? rights.canFile : need === 'edit' ? rights.canEdit : need === 'approve' ? rights.canApprove : rights.isSuperAdmin;
  if (!allowed && !access && !rights.isSuperAdmin) {
    return <p className="py-10 text-center text-theme-sm text-gray-500">Checking your access…</p>;
  }
  if (!allowed) return <Alert variant="info">{MESSAGES[need]}</Alert>;
  return children;
}
