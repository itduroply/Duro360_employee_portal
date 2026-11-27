import { useCallback, useEffect, useState } from 'react';
import { complaintsApi } from '../../api/complaintsApi';

// What the signed-in person may do in Complaints:
// { canFile, isAccounts, isCoordinator, pending, hasHistory }. `refresh` reads it again,
// for example after a decision changes the pending count.
export default function useComplaintAccess() {
  const [access, setAccess] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setAccess(await complaintsApi.access());
    } catch {
      setAccess({ canFile: false, isAccounts: false, isCoordinator: false, pending: 0, hasHistory: false });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { access, refresh };
}
