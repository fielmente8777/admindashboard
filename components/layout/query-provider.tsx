"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/lib/api/api-client";

/** A refused request gives the same answer every time, so only network and server failures retry. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const refused =
    error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !refused && failureCount < 2;
}

/**
 * Holds fetched data while staff move between pages. It lives inside the signed-in layout, so
 * signing out discards the data and the next person in this browser starts empty.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetry, refetchOnWindowFocus: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
