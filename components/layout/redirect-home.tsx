"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * An address the console doesn't have: go to the overview instead of showing a 404. The
 * overview is behind the sign-in guard, so someone signed out lands on the login page.
 */
export function RedirectHome() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-5xl space-y-4 p-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
