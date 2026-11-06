import type { Metadata } from "next";

import { ActivityPage } from "@/components/activity/activity-page";

export const metadata: Metadata = { title: "Activity" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <ActivityPage />;
}
