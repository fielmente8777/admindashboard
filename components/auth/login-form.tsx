"use client";

import { CircleAlert, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { OtpForm } from "@/components/auth/otp-form";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { useAuthStore } from "@/stores/auth-store";

const SETUP_ERROR =
  "Google sign-in is not configured for this site. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.";
const SCRIPT_ERROR =
  "Google sign-in could not load. Check your connection or ad blocker, then reload.";

export function LoginForm() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const challenge = useAuthStore((state) => state.challenge);
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const error = useAuthStore((state) => state.error);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const showError = useAuthStore((state) => state.showError);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  const message = env.googleClientId ? error : SETUP_ERROR;

  return (
    <div className="space-y-4">
      {challenge ? (
        // A new code means a new key, which clears the typed code and restarts the resend wait.
        <OtpForm key={challenge.expiresAt} challenge={challenge} />
      ) : status === "anonymous" && env.googleClientId ? (
        <div
          aria-busy={isSigningIn}
          className={isSigningIn ? "pointer-events-none opacity-50" : undefined}
        >
          <GoogleSignInButton
            onCredential={loginWithGoogle}
            onLoadError={() => showError(SCRIPT_ERROR)}
          />
        </div>
      ) : (
        status !== "anonymous" && <Skeleton className="h-10 w-full" />
      )}

      {isSigningIn && !challenge && (
        <p
          role="status"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          Checking your account…
        </p>
      )}

      {message && (
        <p
          role="alert"
          className="flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      )}
    </div>
  );
}
