import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [sessionMessage, setSessionMessage] = useState('');

  const logout = useCallback((message = '') => {
    tokenStore.set(null);
    setToken(null);
    setUser(null);
    setSessionMessage(message);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message || 'Your session has expired. Please log in again.'));
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get('/me')
      .then((res) => !cancelled && setUser(res.user))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptSession = useCallback(({ token: t, user: u }) => {
    tokenStore.set(t);
    setSessionMessage('');
    setUser(u);
    setToken(t);
  }, []);

  const login = useCallback(async (email, password) => acceptSession(await api.post('/auth/login', { email, password })), [acceptSession]);
  const register = useCallback(async (data) => acceptSession(await api.post('/auth/register', data)), [acceptSession]);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout, setUser, sessionMessage, clearSessionMessage: () => setSessionMessage('') }),
    [user, token, loading, login, register, logout, sessionMessage]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
