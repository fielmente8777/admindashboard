import type { Metadata } from "next";

import { SubscriptionsPage } from "@/components/subscriptions/subscriptions-page";

export const metadata: Metadata = { title: "Subscriptions" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <SubscriptionsPage />;
}
