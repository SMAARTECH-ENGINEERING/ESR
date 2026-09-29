import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as authApi from '../api/auth.api';
import { saveSession, getToken, getStoredUser, clearSession } from '../utils/storage';
import { onUnauthorized } from '../utils/authEvents';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const storedUser = await getStoredUser();
      if (token && storedUser) {
        setUser(storedUser);
      }
      setIsBootstrapping(false);
    })();
  }, []);

  useEffect(() => onUnauthorized(() => logout()), []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email, password) => {
    setIsSigningIn(true);
    try {
      const res = await authApi.login(email, password);
      const { token, user: loggedInUser } = res.data;
      await saveSession(token, loggedInUser);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: !!user,
      isBootstrapping,
      isSigningIn,
      login,
      logout,
    }),
    [user, isBootstrapping, isSigningIn, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
