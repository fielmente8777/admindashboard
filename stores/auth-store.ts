import { create } from "zustand";

import { ApiClient, ApiError } from "@/lib/api/api-client";
import { AuthApi, type AdminSession, type AdminUser, type OtpChallenge } from "@/lib/api/auth-api";
import { env } from "@/lib/env";

const authApi = new AuthApi(new ApiClient(env.apiUrl));

const ERROR_MESSAGES: Record<string, string> = {
  GOOGLE_TOKEN_INVALID: "Google could not verify this sign-in. Please try again.",
  GOOGLE_LOGIN_DISABLED: "Google sign-in is not set up on the server yet.",
  ADMIN_NOT_ALLOWED: "This Google account does not have access. Ask a super admin to add you.",
  OTP_SEND_FAILED: "We could not email your sign-in code. Please try again.",
  OTP_EXPIRED: "This code has expired. Please sign in again.",
  OTP_ATTEMPTS_EXCEEDED: "Too many wrong codes. Please sign in again.",
  OTP_RESEND_UNAVAILABLE: "A new code cannot be sent yet. Wait a moment, or sign in again.",
  RATE_LIMITED: "Too many sign-in attempts. Please wait a few minutes and try again.",
  NETWORK_ERROR: "Could not reach the server. Check your connection and try again.",
};

/** These end the attempt, so the person goes back to the Google button. */
const RESTART_CODES = new Set(["OTP_EXPIRED", "OTP_ATTEMPTS_EXCEEDED", "ADMIN_NOT_ALLOWED"]);

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong while signing in. Please try again.";
  // The server's own wording, because it says how many attempts are left.
  if (error.code === "OTP_INVALID") return error.message;
  return ERROR_MESSAGES[error.code] ?? "Something went wrong while signing in. Please try again.";
}

/**
 * offline: the server could not be reached (or answered 5xx) while checking the session. The
 * refresh cookie is still there, so this is NOT signed out: the guard keeps retrying.
 */
type AuthStatus = "checking" | "authenticated" | "anonymous" | "offline";

interface AuthState {
  status: AuthStatus;
  user: AdminUser | null;
  /** Kept in memory only: a page reload gets a new one through the refresh cookie. */
  accessToken: string | null;
  expiresAt: string | null;
  /** Set between Google and the email code. */
  challenge: OtpChallenge | null;
  isSigningIn: boolean;
  error: string | null;
  restoreSession: () => Promise<void>;
  /** Checks the session again after "offline". */
  retryRestore: () => Promise<void>;
  /** The new access token, or null when it could not be renewed. */
  refreshAccessToken: () => Promise<string | null>;
  endSession: () => void;
  updateName: (name: string | null) => void;
  loginWithGoogle: (idToken: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  cancelOtp: () => void;
  showError: (message: string) => void;
  logout: () => Promise<void>;
}

const SIGNED_OUT = { user: null, accessToken: null, expiresAt: null, challenge: null };

function signedIn(session: AdminSession) {
  return {
    status: "authenticated" as const,
    user: session.admin,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    challenge: null,
  };
}

/** Only the server saying so ends a session: 401 (expired, logged out) or 403 (access removed). */
function sessionEnded(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One refresh, tried again when the answer says nothing about the session: 409 (another tab
 * or an earlier page load is renewing it this very moment), the server unreachable, or 5xx
 * (e.g. the API restarting).
 */
async function refreshWithRetry(): Promise<AdminSession> {
  const waits = [400, 1000, 2500];
  for (let attempt = 0; ; attempt++) {
    try {
      return await authApi.refresh();
    } catch (error) {
      const wait = waits[attempt];
      if (sessionEnded(error) || wait === undefined) throw error;
      await sleep(wait);
    }
  }
}

// The refresh token rotates on every use. Calls in this tab share one request, and the lock
// makes other tabs take turns, so each sends the newest cookie. (The server also forgives a
// cookie whose renewal never reached the browser, e.g. a reload mid-refresh.)
let refreshing: Promise<AdminSession> | null = null;

async function refreshWithLock(): Promise<AdminSession> {
  return navigator.locks ? navigator.locks.request("ez-admin-refresh", refreshWithRetry) : refreshWithRetry();
}

function refreshOnce(): Promise<AdminSession> {
  const current =
    refreshing ??
    refreshWithLock().finally(() => {
      refreshing = null;
    });
  refreshing = current;
  return current;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  ...SIGNED_OUT,
  isSigningIn: false,
  error: null,

  restoreSession: () => {
    if (get().status !== "checking") return Promise.resolve();

    return refreshOnce()
      .then((session) => set(signedIn(session)))
      // a server that can't be reached says nothing about the session: keep the cookie, retry
      .catch((error) => set({ status: sessionEnded(error) ? "anonymous" : "offline", ...SIGNED_OUT }));
  },

  retryRestore: () => {
    if (get().status !== "offline") return Promise.resolve();
    set({ status: "checking" });
    return get().restoreSession();
  },

  refreshAccessToken: async () => {
    try {
      const session = await refreshOnce();
      set(signedIn(session));
      return session.accessToken;
    } catch (error) {
      // A network or server problem says nothing about the session, so stay signed in.
      if (sessionEnded(error)) set({ status: "anonymous", ...SIGNED_OUT });
      return null;
    }
  },

  endSession: () => set({ status: "anonymous", ...SIGNED_OUT }),

  updateName: (name) => {
    const { user } = get();
    if (user) set({ user: { ...user, name } });
  },

  loginWithGoogle: async (idToken) => {
    set({ isSigningIn: true, error: null });
    try {
      const challenge = await authApi.loginWithGoogle(idToken);
      set({ challenge, isSigningIn: false });
    } catch (error) {
      set({ isSigningIn: false, error: messageFor(error) });
    }
  },

  verifyOtp: async (code) => {
    const { challenge } = get();
    if (!challenge) return;

    set({ isSigningIn: true, error: null });
    try {
      const session = await authApi.verifyOtp(challenge.challengeId, code);
      set({ ...signedIn(session), isSigningIn: false });
    } catch (error) {
      const restart = error instanceof ApiError && RESTART_CODES.has(error.code);
      set({ isSigningIn: false, error: messageFor(error), ...(restart ? { challenge: null } : {}) });
    }
  },

  resendOtp: async () => {
    const { challenge } = get();
    if (!challenge) return;

    set({ isSigningIn: true, error: null });
    try {
      set({ challenge: await authApi.resendOtp(challenge.challengeId), isSigningIn: false });
    } catch (error) {
      const restart = error instanceof ApiError && RESTART_CODES.has(error.code);
      set({ isSigningIn: false, error: messageFor(error), ...(restart ? { challenge: null } : {}) });
    }
  },

  cancelOtp: () => set({ challenge: null, error: null }),

  showError: (message) => set({ error: message }),

  logout: async () => {
    // Sign out on this screen even if the server can't be reached.
    await authApi.logout().catch(() => undefined);
    set({ status: "anonymous", ...SIGNED_OUT, error: null });
  },
}));
