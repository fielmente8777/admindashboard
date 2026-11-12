import type { Metadata } from "next";

import { MissingNumbersPage } from "@/components/clients/missing-numbers-page";

export const metadata: Metadata = { title: "Missing WhatsApp numbers" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <MissingNumbersPage />;
}
