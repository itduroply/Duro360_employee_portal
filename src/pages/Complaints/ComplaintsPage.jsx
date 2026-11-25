import { Navigate } from 'react-router-dom';
import Alert from '../../components/common/Alert.jsx';
import { useComplaintRights } from './ComplaintGate.jsx';

// "Complaints" on its own opens the first page this person may use.
export default function ComplaintsPage() {
  const { access, rights } = useComplaintRights();
  if (rights.canFile) return <Navigate to="history" replace />;
  if (rights.canApprove) return <Navigate to="approvals" replace />;
  if (!access) return <p className="py-10 text-center text-theme-sm text-gray-500">Checking your access…</p>;
  return <Alert variant="info">You have no complaints to file or approve.</Alert>;
}
