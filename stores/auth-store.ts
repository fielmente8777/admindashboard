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

type AuthStatus = "checking" | "authenticated" | "anonymous";

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

// The refresh token rotates on every use, and reusing an old one ends the session as suspected
// theft. So calls in this tab share one request, and the lock makes other tabs take turns: each
// then sends the newest cookie.
let refreshing: Promise<AdminSession> | null = null;

async function refreshWithLock(): Promise<AdminSession> {
  const refresh = () => authApi.refresh();
  return navigator.locks ? navigator.locks.request("ez-admin-refresh", refresh) : refresh();
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
      .catch(() => set({ status: "anonymous", ...SIGNED_OUT }));
  },

  refreshAccessToken: async () => {
    try {
      const session = await refreshOnce();
      set(signedIn(session));
      return session.accessToken;
    } catch (error) {
      // A network or server problem says nothing about the session, so stay signed in.
      const sessionEnded = error instanceof ApiError && error.status >= 400 && error.status < 500;
      if (sessionEnded) set({ status: "anonymous", ...SIGNED_OUT });
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
