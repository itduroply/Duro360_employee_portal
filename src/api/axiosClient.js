import axios from 'axios';

// Frontend never talks to the database — only ever to this API layer (see
// docs/ARCHITECTURE.md "Core Architecture"). withCredentials is required so
// the httpOnly refresh-token cookie is sent/received on auth calls.
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

// Two independent tokens can be "live" at once: the real signed-in user's
// own token (Admin, Dealer, or Vendor), and — only while an Admin is running
// a Simulator session — a separate, short-lived token for whichever
// Dealer/Vendor they're currently viewing the portal as. Ordinary requests
// prefer the simulated token when one is set; Simulator management calls
// themselves (list/launch/exit/config) always force the real token, since
// exiting the Simulator has to be authorized as the Admin, not as whichever
// Dealer/Vendor is currently being simulated. See context/SimulatorContext.jsx.
let realAccessToken = null;
let simulatedAccessToken = null;
let onUnauthorized = null;
let onSimulatorExpired = null;

export function setAccessToken(token) {
  realAccessToken = token;
}

export function setSimulatedAccessToken(token) {
  simulatedAccessToken = token;
}

export function clearSimulatedAccessToken() {
  simulatedAccessToken = null;
}

export function isSimulating() {
  return Boolean(simulatedAccessToken);
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export function setSimulatorExpiredHandler(handler) {
  onSimulatorExpired = handler;
}

axiosClient.interceptors.request.use((config) => {
  const token = config.useRealToken ? realAccessToken : simulatedAccessToken || realAccessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      // A simulated session's token expired or was rejected. There is no
      // refresh token for a simulated session by design (see
      // simulatorController.js's `launch`), so don't attempt to refresh it —
      // just end the simulation cleanly and let the Admin relaunch.
      if (simulatedAccessToken && !originalRequest.useRealToken) {
        simulatedAccessToken = null;
        if (onSimulatorExpired) onSimulatorExpired();
        return Promise.reject(error);
      }

      // Try exactly once to refresh the real session's access token via the
      // refresh cookie before giving up and forcing a re-login. Prevents
      // every expired token from bouncing the user out for what is often
      // just a 15-minute blip.
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { data } = await axiosClient.post('/auth/refresh', null, { useRealToken: true });
          setAccessToken(data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return axiosClient(originalRequest);
        } catch (refreshError) {
          if (onUnauthorized) onUnauthorized();
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
