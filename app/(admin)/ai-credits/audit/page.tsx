import type { Metadata } from "next";

import { AiAuditPage } from "@/components/ai-credits/ai-audit-page";

export const metadata: Metadata = { title: "AI credits audit" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiAuditPage />;
}
