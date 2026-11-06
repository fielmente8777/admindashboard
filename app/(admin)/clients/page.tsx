import type { Metadata } from "next";

import { ClientsPage } from "@/components/clients/clients-page";

export const metadata: Metadata = { title: "Clients" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <ClientsPage />;
}
