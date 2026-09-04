import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  api,
  getStoredToken,
  getActiveAccountId,
  getAccounts,
  addAccount,
  removeAccount,
  setActiveAccountId,
  finalizeActiveAccountId,
  updateAccountUser,
  MAX_ACCOUNTS,
} from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState(() => getAccounts());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Tries the active account; if its token turns out to be dead (expired,
  // revoked, the account got banned, ...) drops just that one and falls
  // through to the next signed-in account instead of logging everyone out.
  const refresh = useCallback(async () => {
    let token = getStoredToken();
    while (token) {
      try {
        const { user: freshUser } = await api.me();
        finalizeActiveAccountId(freshUser); // resolves a legacy 'pending' placeholder, keeps the cached snapshot fresh
        setUser(freshUser);
        setAccounts(getAccounts());
        setLoading(false);
        return;
      } catch {
        removeAccount(getActiveAccountId());
        token = getStoredToken();
      }
    }
    setUser(null);
    setAccounts(getAccounts());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Both the plain sign-in page and "add another account" call this same
  // method — addAccount() appends when this is a new account, or just
  // switches to it when you're logging back into one you already have
  // signed in, either way making it the active one.
  const login = async (identifier, password) => {
    setAuthError(null);
    const data = await api.login({ identifier, password });
    const result = addAccount({ token: data.token, user: data.user });
    if (!result.ok) {
      throw new Error(`You're already signed into ${MAX_ACCOUNTS} accounts on this device — log one out before adding another.`);
    }
    setUser(data.user);
    setAccounts(getAccounts());
    return data.user;
  };

  const signup = async (payload) => {
    setAuthError(null);
    const data = await api.signup(payload);
    const result = addAccount({ token: data.token, user: data.user });
    if (!result.ok) {
      throw new Error(`You're already signed into ${MAX_ACCOUNTS} accounts on this device — log one out before adding another.`);
    }
    setUser(data.user);
    setAccounts(getAccounts());
    return data.user;
  };

  // Finishes a Discord sign-in: the redirect back from the server carries a
  // ready-made app token (not a username/password), so this fetches the
  // profile it belongs to and files it into the account switcher exactly
  // like login/signup do.
  const completeOAuth = async (token) => {
    setAuthError(null);
    const { user: freshUser } = await api.meWithToken(token);
    const result = addAccount({ token, user: freshUser });
    if (!result.ok) {
      throw new Error(`You're already signed into ${MAX_ACCOUNTS} accounts on this device — log one out before adding another.`);
    }
    setUser(freshUser);
    setAccounts(getAccounts());
    return freshUser;
  };

  // Signs one account out of the switcher. If it was the active account,
  // switches to whichever one is now first in line (or clears the session
  // entirely if none are left). Returns true if at least one account is
  // still signed in afterward, so the caller knows whether to navigate to
  // "/" or all the way to "/login".
  const forgetAccount = (id) => {
    const wasActive = id === getActiveAccountId();
    const list = removeAccount(id);
    setAccounts(list);
    if (wasActive) {
      if (list.length > 0) refresh();
      else setUser(null);
    }
    return list.length > 0;
  };

  const logout = () => forgetAccount(getActiveAccountId());

  const switchAccount = async (id) => {
    if (id === getActiveAccountId()) return;
    setActiveAccountId(id);
    await refresh();
  };

  const updateUser = (patch) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
    const activeId = getActiveAccountId();
    if (activeId) {
      updateAccountUser(activeId, patch);
      setAccounts(getAccounts());
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accounts,
        maxAccounts: MAX_ACCOUNTS,
        loading,
        authError,
        setAuthError,
        login,
        signup,
        completeOAuth,
        logout,
        forgetAccount,
        switchAccount,
        refresh,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}
