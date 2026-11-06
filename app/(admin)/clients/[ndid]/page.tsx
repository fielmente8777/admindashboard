import type { Metadata } from "next";

import { ClientPage } from "@/components/clients/client-page";

export const metadata: Metadata = { title: "Client" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <ClientPage />;
}
