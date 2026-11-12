"use client";

import { LoaderCircle, WifiOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

const RETRY_EVERY_MS = 5000;

/**
 * Shown while the session can't be checked because the server is unreachable. The person is
 * still signed in (the refresh cookie is untouched), so this retries on its own instead of
 * sending them to the login page.
 */
export function Reconnecting() {
  const status = useAuthStore((state) => state.status);
  const retryRestore = useAuthStore((state) => state.retryRestore);

  useEffect(() => {
    if (status !== "offline") return;
    const retry = () => void retryRestore();
    const timer = setInterval(retry, RETRY_EVERY_MS);
    window.addEventListener("online", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", retry);
    };
  }, [status, retryRestore]);

  return (
    <div
      role="status"
      className="mx-auto mt-16 flex w-full max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center"
    >
      <WifiOff className="size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">Can&apos;t reach the Eazotel server</p>
      <p className="text-sm text-muted-foreground">
        You&apos;re still signed in. We&apos;ll reconnect as soon as it answers.
      </p>
      <Button variant="outline" size="sm" disabled={status === "checking"} onClick={() => void retryRestore()}>
        {status === "checking" && <LoaderCircle className="animate-spin" aria-hidden />}
        Try now
      </Button>
    </div>
  );
}
