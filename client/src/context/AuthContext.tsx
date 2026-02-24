import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import { authApi } from '../api/authApi';
import { setAccessToken } from '../api/http';
import { useTenant } from './TenantContext';
import type { AuthTokens, AuthUser } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

interface PersistedAuth {
  user: AuthUser;
  tokens: AuthTokens;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const buildStorageKey = (tenantSubdomain: string): string => `hrms:${tenantSubdomain}:auth`;

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { subdomain } = useTenant();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const persistSession = useCallback(
    (nextUser: AuthUser, nextTokens: AuthTokens) => {
      if (!subdomain) {
        throw new Error('Tenant subdomain is missing');
      }

      setUser(nextUser);
      setTokens(nextTokens);
      setAccessToken(nextTokens.accessToken);

      const storageKey = buildStorageKey(subdomain);
      const payload: PersistedAuth = {
        user: nextUser,
        tokens: nextTokens
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    [subdomain]
  );

  useEffect(() => {
    if (!subdomain) {
      setUser(null);
      setTokens(null);
      setAccessToken(null);
      setIsHydrated(true);
      return;
    }

    const storageKey = buildStorageKey(subdomain);
    const persisted = localStorage.getItem(storageKey);

    if (!persisted) {
      setUser(null);
      setTokens(null);
      setAccessToken(null);
      setIsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(persisted) as PersistedAuth;
      setUser(parsed.user);
      setTokens(parsed.tokens);
      setAccessToken(parsed.tokens.accessToken);
    } catch {
      localStorage.removeItem(storageKey);
      setUser(null);
      setTokens(null);
      setAccessToken(null);
    } finally {
      setIsHydrated(true);
    }
  }, [subdomain]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      if (!subdomain) {
        throw new Error('Tenant subdomain is missing');
      }

      const response = await authApi.login({ email, password });
      persistSession(response.user, response.tokens);
    },
    [persistSession, subdomain]
  );

  const loginWithGoogle = useCallback(
    async (idToken: string): Promise<void> => {
      if (!subdomain) {
        throw new Error('Tenant subdomain is missing');
      }

      const response = await authApi.googleLogin(idToken);
      persistSession(response.user, response.tokens);
    },
    [persistSession, subdomain]
  );

  const logout = useCallback(() => {
    if (subdomain) {
      localStorage.removeItem(buildStorageKey(subdomain));
    }

    setUser(null);
    setTokens(null);
    setAccessToken(null);
  }, [subdomain]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      isAuthenticated: Boolean(user && tokens),
      isHydrated,
      login,
      loginWithGoogle,
      logout
    }),
    [isHydrated, login, loginWithGoogle, logout, tokens, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
