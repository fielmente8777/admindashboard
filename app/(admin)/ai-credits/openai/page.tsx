import type { Metadata } from "next";

import { AiOpenAiPage } from "@/components/ai-credits/ai-openai-page";

export const metadata: Metadata = { title: "OpenAI account" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiOpenAiPage />;
}
