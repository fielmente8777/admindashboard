import type { ReactNode } from "react";

import { AuthGuard } from "@/components/auth/auth-guard";
import { AdminShell } from "@/components/layout/admin-shell";
import { QueryProvider } from "@/components/layout/query-provider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthGuard>
        <AdminShell>{children}</AdminShell>
      </AuthGuard>
    </QueryProvider>
  );
}
