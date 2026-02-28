import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
}

/**
 * Reads Cognito config from Vite environment variables.
 * Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID in .env
 */
export function getCognitoConfig(): CognitoConfig | null {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) return null;
  return { userPoolId, clientId };
}

// ─── Pool Singleton ─────────────────────────────────────────────────────────

let pool: CognitoUserPool | null = null;

function getUserPool(): CognitoUserPool {
  if (!pool) {
    const config = getCognitoConfig();
    if (!config) throw new Error('Cognito is not configured. Set VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID.');
    pool = new CognitoUserPool({
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    });
  }
  return pool;
}

// ─── Auth Result ────────────────────────────────────────────────────────────

export interface AuthResult {
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  plan: string;
  idToken: string;
  accessToken: string;
}

function sessionToAuthResult(session: CognitoUserSession): AuthResult {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();
  return {
    tenantId: payload['custom:tenantId'] ?? '',
    userId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    plan: payload['custom:plan'] ?? 'free',
    idToken: idToken.getJwtToken(),
    accessToken: session.getAccessToken().getJwtToken(),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Sign in with email + password (SRP flow).
 */
export function signIn(email: string, password: string): Promise<AuthResult> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess(session) {
        resolve(sessionToAuthResult(session));
      },
      onFailure(err) {
        reject(err);
      },
    });
  });
}

/**
 * Sign up a new user with email, password, and name.
 */
export function signUp(email: string, password: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();
    const attributes = [
      new CognitoUserAttribute({ Name: 'email', Value: email }),
      new CognitoUserAttribute({ Name: 'name', Value: name }),
    ];

    userPool.signUp(email, password, attributes, [], (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Confirm sign up with verification code.
 */
export function confirmSignUp(email: string, code: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const userPool = getUserPool();
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });

    cognitoUser.confirmRegistration(code, true, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

/**
 * Get currently authenticated user session (from local storage).
 * Returns null if no valid session exists.
 */
export function getCurrentSession(): Promise<AuthResult | null> {
  return new Promise((resolve) => {
    try {
      const userPool = getUserPool();
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(sessionToAuthResult(session));
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Sign out the current user (local sign out).
 */
export function signOut(): void {
  try {
    const userPool = getUserPool();
    const cognitoUser = userPool.getCurrentUser();
    cognitoUser?.signOut();
  } catch {
    // Ignore errors during sign out
  }
}

/**
 * Get the current valid ID token (refreshes automatically if expired).
 * Returns null if not authenticated.
 */
export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const userPool = getUserPool();
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      });
    } catch {
      resolve(null);
    }
  });
}
