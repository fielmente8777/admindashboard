import type { Metadata } from "next";

import { BillingOverviewPage } from "@/components/billing/billing-overview-page";

export const metadata: Metadata = { title: "Billing" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <BillingOverviewPage />;
}
