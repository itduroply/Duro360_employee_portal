import ModulePage from '../../components/ModulePage/ModulePage.jsx';
import ComplaintApprovalsPanel from './ComplaintApprovalsPanel.jsx';
import ComplaintGate, { useComplaintRights } from './ComplaintGate.jsx';

export default function ComplaintApprovalsPage() {
  const { refresh } = useComplaintRights();
  return (
    <ModulePage title="My Approvals"  live>
      <ComplaintGate need="approve">
        <ComplaintApprovalsPanel onChanged={refresh} />
      </ComplaintGate>
    </ModulePage>
  );
}
