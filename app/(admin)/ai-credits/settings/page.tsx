import type { Metadata } from "next";

import { AiSettingsPage } from "@/components/ai-credits/ai-settings-page";

export const metadata: Metadata = { title: "AI credit settings" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiSettingsPage />;
}
