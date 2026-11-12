import type { Metadata } from "next";

import { AiClientsPage } from "@/components/ai-credits/ai-clients-page";

export const metadata: Metadata = { title: "AI credits" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiClientsPage />;
}
