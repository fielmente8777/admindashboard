import type { Metadata } from "next";

import { AiOverviewPage } from "@/components/ai-credits/ai-overview-page";

export const metadata: Metadata = { title: "AI credits overview" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiOverviewPage />;
}
