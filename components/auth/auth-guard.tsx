"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Reconnecting } from "@/components/auth/reconnecting";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Sends signed-out visitors to /login. This only controls what is shown: the API must still
 * check the access token on every call. It runs in the browser because the refresh cookie
 * belongs to the API's origin, so this Next.js app's server cannot see it.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status === "offline") return <Reconnecting />;

  if (status !== "authenticated") {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="mx-auto w-full max-w-5xl space-y-4 p-6"
      >
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return children;
}
