import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axiosClient, {
  setSimulatedAccessToken,
  clearSimulatedAccessToken,
  setSimulatorExpiredHandler,
} from '../api/axiosClient';

const SimulatorContext = createContext(null);

export function SimulatorProvider({ children }) {
  const [simulatedUser, setSimulatedUser] = useState(null);
  const [originConsole, setOriginConsole] = useState('/admin');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setSimulatorExpiredHandler(() => {
      setSimulatedUser(null);
      navigate(`${originConsole}/simulator`, { state: { simulatorExpired: true }, replace: true });
    });
  }, [navigate, originConsole]);

  const launchSimulator = useCallback(
    async (userId) => {
      const launchingConsole = location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
      const { data } = await axiosClient.post(
        '/admin/simulator/launch',
        { userId },
        { useRealToken: true }
      );
      setSimulatedAccessToken(data.accessToken);
      setSimulatedUser(data.user);
      setOriginConsole(launchingConsole);
      navigate('/dashboard');
    },
    [navigate, location.pathname]
  );


  const exitSimulator = useCallback(
    async ({ redirect = true } = {}) => {
      clearSimulatedAccessToken();
      setSimulatedUser(null);
      if (redirect) navigate(originConsole);
      try {
        await axiosClient.post('/admin/simulator/exit', null, { useRealToken: true });
      } catch (err) {
        // Best-effort audit log only — never block the UI on this.
      }
    },
    [navigate, originConsole]
  );

  return (
    <SimulatorContext.Provider
      value={{ simulatedUser, isSimulating: Boolean(simulatedUser), launchSimulator, exitSimulator }}
    >
      {children}
    </SimulatorContext.Provider>
  );
}

export function useSimulator() {
  const ctx = useContext(SimulatorContext);
  if (!ctx) throw new Error('useSimulator must be used within a SimulatorProvider');
  return ctx;
}
