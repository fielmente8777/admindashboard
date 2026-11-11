import type { Metadata } from "next";
import { Suspense } from "react";

import { ZohoPage } from "@/components/billing/zoho-page";

export const metadata: Metadata = { title: "Zoho Books" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  // useSearchParams (Zoho's ?zoho=connected) needs a Suspense boundary
  return (
    <Suspense>
      <ZohoPage />
    </Suspense>
  );
}
