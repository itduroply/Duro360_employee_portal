import ModulePage from '../../components/ModulePage/ModulePage.jsx';
import ComplaintApprovalSettings from './ComplaintApprovalSettings.jsx';
import ComplaintGate from './ComplaintGate.jsx';

export default function ComplaintSettingsPage() {
  return (
    <ModulePage title="Approval Settings" description="The amount bands that pick the manager level, and the accounts team." live>
      <ComplaintGate need="superadmin">
        <ComplaintApprovalSettings />
      </ComplaintGate>
    </ModulePage>
  );
}
