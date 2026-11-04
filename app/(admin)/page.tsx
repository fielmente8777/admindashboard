import { AdminHome } from "@/components/auth/admin-home";

// AuthGuard shows this page only after the browser confirms the session, so Next.js
// can't render it while validating instant navigation.
export const instant = false;

export default function AdminHomePage() {
  return <AdminHome />;
}
