import type { Metadata } from "next";

import { TeamPage } from "@/components/team/team-page";

export const metadata: Metadata = { title: "Team" };

// Shown only after the browser confirms the session, like every page behind AuthGuard.
export const instant = false;

export default function Page() {
  return <TeamPage />;
}
