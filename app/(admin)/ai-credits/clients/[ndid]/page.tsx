import type { Metadata } from "next";

import { AiClientPage } from "@/components/ai-credits/ai-client-page";

export const metadata: Metadata = { title: "AI wallet" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiClientPage />;
}
