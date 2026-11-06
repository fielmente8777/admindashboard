import type { Metadata } from "next";

import { OffersPage } from "@/components/billing/offers-page";

export const metadata: Metadata = { title: "Offers" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <OffersPage />;
}
