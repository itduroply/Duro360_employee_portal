import ModulePage from '../../components/ModulePage/ModulePage.jsx';
import ComplaintApprovalSettings from './ComplaintApprovalSettings.jsx';
import ComplaintGate from './ComplaintGate.jsx';

export default function ComplaintSettingsPage() {
  return (
    <ModulePage title="Approval Settings" live>
      <ComplaintGate need="superadmin">
        <ComplaintApprovalSettings />
      </ComplaintGate>
    </ModulePage>
  );
}
