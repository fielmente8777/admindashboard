import { create } from "zustand";

import { ApiClient, ApiError } from "@/lib/api/api-client";
import { AuthApi, type AuthSession, type AuthUser } from "@/lib/api/auth-api";
import { StaffEmail } from "@/lib/auth/staff-email";
import { env } from "@/lib/env";

const authApi = new AuthApi(new ApiClient(env.apiUrl));
const staffEmail = new StaffEmail(env.staffEmailDomains);

const NOT_STAFF_MESSAGE = `This console is for the Eazotel team. Sign in with your ${staffEmail.describeDomains()} Google account.`;

const ERROR_MESSAGES: Record<string, string> = {
  GOOGLE_TOKEN_INVALID: "Google could not verify this sign-in. Please try again.",
  GOOGLE_LOGIN_DISABLED: "Google sign-in is not set up on the server yet.",
  ACCOUNT_INACTIVE: "This account is inactive. Please contact your administrator.",
  ACCOUNT_NOT_READY: "This account is not set up yet. Please contact your administrator.",
  RATE_LIMITED: "Too many sign-in attempts. Please wait a few minutes and try again.",
  NETWORK_ERROR: "Could not reach the server. Check your connection and try again.",
};

function messageFor(error: unknown): string {
  const code = error instanceof ApiError ? error.code : "";
  return ERROR_MESSAGES[code] ?? "Something went wrong while signing in. Please try again.";
}

type AuthStatus = "checking" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Kept in memory only: a page reload gets a new one through the refresh cookie. */
  accessToken: string | null;
  expiresAt: string | null;
  isSigningIn: boolean;
  error: string | null;
  restoreSession: () => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  showError: (message: string) => void;
  logout: () => Promise<void>;
}

const SIGNED_OUT = { user: null, accessToken: null, expiresAt: null };

function signedIn(session: AuthSession) {
  return {
    status: "authenticated" as const,
    user: session.user,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
  };
}

// The refresh token rotates on every use, so two calls at once must share one request.
let restoring: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "checking",
  ...SIGNED_OUT,
  isSigningIn: false,
  error: null,

  restoreSession: () => {
    if (get().status !== "checking") return Promise.resolve();

    restoring ??= authApi
      .refresh()
      .then((session) => {
        // A non-staff cookie can belong to the client dashboard on the same API,
        // so leave that session alone and just don't use it here.
        set(session.isStaff ? signedIn(session) : { status: "anonymous", ...SIGNED_OUT });
      })
      .catch(() => set({ status: "anonymous", ...SIGNED_OUT }))
      .finally(() => {
        restoring = null;
      });
    return restoring;
  },

  loginWithGoogle: async (idToken) => {
    if (!staffEmail.matchesIdToken(idToken)) {
      set({ error: NOT_STAFF_MESSAGE });
      return;
    }

    set({ isSigningIn: true, error: null });
    try {
      const session = await authApi.loginWithGoogle(idToken);
      if (session.isStaff) {
        set({ ...signedIn(session), isSigningIn: false });
        return;
      }
      // The server has the final say. End the session it just started.
      await authApi.logout().catch(() => undefined);
      set({ isSigningIn: false, error: NOT_STAFF_MESSAGE });
    } catch (error) {
      set({ isSigningIn: false, error: messageFor(error) });
    }
  },

  showError: (message) => set({ error: message }),

  logout: async () => {
    // Sign out on this screen even if the server can't be reached.
    await authApi.logout().catch(() => undefined);
    set({ status: "anonymous", ...SIGNED_OUT, error: null });
  },
}));
