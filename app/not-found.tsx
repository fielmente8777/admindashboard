import type { Metadata } from "next";

import { RedirectHome } from "@/components/layout/redirect-home";

export const metadata: Metadata = { title: "Redirecting" };

// No 404 page in the console: unknown addresses go to the overview (or the login page).
export default function NotFound() {
  return <RedirectHome />;
}
