import type { Metadata } from "next";

import { AiPricingPage } from "@/components/ai-credits/ai-pricing-page";

export const metadata: Metadata = { title: "AI pricing & packages" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <AiPricingPage />;
}
