import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { tokenStore, onUnauthorized } from '../services/api';

/**
 * AuthContext owns the JWT lifecycle:
 *   boot  -> re-validate the stored token against GET /auth/me
 *   login -> store token + profile
 *   logout-> clear everything and return to the public feed
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStore.getUser());
  const [initialising, setInitialising] = useState(Boolean(tokenStore.get()));

  const persist = useCallback((payload) => {
    tokenStore.set(payload.token, payload.user);
    setUser(payload.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Re-validate the persisted session once on mount.
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) {
      setInitialising(false);
      return;
    }

    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        tokenStore.set(res.data.token, res.data.user);
        setUser(res.data.user);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Any 401 from the axios interceptor drops us back to a signed-out state.
  useEffect(() => onUnauthorized(() => setUser(null)), []);

  const login = useCallback(
    async (credentials) => {
      const res = await api.post('/auth/login', credentials);
      persist(res.data);
      return res.data.user;
    },
    [persist]
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post('/auth/register', payload);
      persist(res.data);
      return res.data.user;
    },
    [persist]
  );

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) return null;
    const res = await api.get('/auth/me');
    tokenStore.set(res.data.token, res.data.user);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const res = await api.patch('/auth/me', payload);
    tokenStore.set(res.data.token, res.data.user);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      token: tokenStore.get(),
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(user?.isAdmin || user?.role === 'hr_vip_employee' || user?.role === 'admin'),
      initialising,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
    }),
    [user, initialising, login, register, logout, refreshUser, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
