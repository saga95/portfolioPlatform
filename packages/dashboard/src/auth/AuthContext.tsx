import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Plan } from '@promptdeploy/shared-types';
import {
  getCognitoConfig,
  signIn as cognitoSignIn,
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signOut as cognitoSignOut,
  getCurrentSession,
} from './cognito-service';

export interface AuthUser {
  tenantId: string;
  email: string;
  name: string;
  plan: Plan;
  idToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Sign in with email + password. Works with Cognito in prod, local state in dev. */
  login: (email: string, password: string) => Promise<void>;
  /** Register new user. Cognito only. */
  signUp: (email: string, password: string, name: string) => Promise<void>;
  /** Confirm sign-up code. Cognito only. */
  confirmSignUp: (email: string, code: string) => Promise<void>;
  /** Sign out current user. */
  logout: () => void;
  /** Whether Cognito is configured (false = dev mock mode). */
  isCognitoEnabled: boolean;
  /** Auth error message, if any. */
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Determines whether to use real Cognito or dev mock.
 * Returns true when VITE_COGNITO_USER_POOL_ID + VITE_COGNITO_CLIENT_ID are set.
 */
const cognitoEnabled = getCognitoConfig() !== null;

const DEV_USER: AuthUser = {
  tenantId: 'tenant_dev001',
  email: 'dev@promptdeploy.com',
  name: 'Developer',
  plan: 'pro' as Plan,
};

/**
 * Auth provider — wraps app with authentication state.
 * Uses Cognito when configured, otherwise falls back to dev mock.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!cognitoEnabled) {
        // Dev mode: auto-login
        if (import.meta.env.DEV) {
          setUser(DEV_USER);
        }
        setIsLoading(false);
        return;
      }

      try {
        const result = await getCurrentSession();
        if (!cancelled && result) {
          setUser({
            tenantId: result.tenantId,
            email: result.email,
            name: result.name,
            plan: (result.plan as Plan) || 'free',
            idToken: result.idToken,
          });
        }
      } catch {
        // No valid session — user must sign in
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);

    if (!cognitoEnabled) {
      // Dev mock login
      setUser({ ...DEV_USER, email });
      return;
    }

    try {
      setIsLoading(true);
      const result = await cognitoSignIn(email, password);
      setUser({
        tenantId: result.tenantId,
        email: result.email,
        name: result.name,
        plan: (result.plan as Plan) || 'free',
        idToken: result.idToken,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    setError(null);
    try {
      await cognitoSignUp(email, password, name);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      setError(message);
      throw err;
    }
  }, []);

  const confirmSignUpFn = useCallback(async (email: string, code: string) => {
    setError(null);
    try {
      await cognitoConfirmSignUp(email, code);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Confirmation failed';
      setError(message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    if (cognitoEnabled) {
      cognitoSignOut();
    }
    setUser(null);
    setError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      signUp,
      confirmSignUp: confirmSignUpFn,
      logout,
      isCognitoEnabled: cognitoEnabled,
      error,
    }),
    [user, isLoading, login, signUp, confirmSignUpFn, logout, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
