import type { Metadata } from "next";

import { PlansPage } from "@/components/billing/plans-page";

export const metadata: Metadata = { title: "Plans & pricing" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <PlansPage />;
}
