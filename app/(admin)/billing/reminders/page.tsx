import type { Metadata } from "next";

import { RemindersPage } from "@/components/billing/reminders-page";

export const metadata: Metadata = { title: "Renewal reminders" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <RemindersPage />;
}
