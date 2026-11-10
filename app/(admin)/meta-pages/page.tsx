import type { Metadata } from "next";

import { MetaPagesPage } from "@/components/meta-pages/meta-pages-page";

export const metadata: Metadata = { title: "Meta pages" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <MetaPagesPage />;
}
