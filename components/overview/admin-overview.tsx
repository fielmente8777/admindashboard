"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { describeAction } from "@/lib/activity-text";
import { auditApi } from "@/lib/api/audit-api";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";

const PERMISSION_LABELS: Record<string, string> = {
  "clients.view": "View clients",
  "clients.edit": "Edit client profiles",
  "subscriptions.view": "View subscriptions",
  "credits.view": "View credits",
  "clients.open_account": "Open client accounts",
  "subscriptions.manage": "Manage subscriptions",
  "credits.manage": "Manage credits",
  "team.manage": "Manage the team",
  "audit.view": "See all activity",
};

function RecentActivity() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["activity", "recent"],
    queryFn: () => auditApi.list({ limit: 5 }),
  });

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent activity</CardTitle>
        <Link
          href="/activity"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-orange hover:underline"
        >
          See all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent>
        {isPending && <Skeleton className="h-24 w-full" />}
        {isError && (
          <p className="text-sm text-muted-foreground">
            Recent activity could not be loaded.
          </p>
        )}
        {data && (
          <ul className="divide-y">
            {data.items.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="font-medium">
                    {entry.actorEmail ?? "System"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {describeAction(entry)}
                  </span>
                </span>
                <time
                  dateTime={entry.at}
                  className="shrink-0 text-xs text-muted-foreground"
                >
                  {formatDateTime(entry.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** The first page after sign-in: who you are signed in as and what you can do. */
export function AdminOverview() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="space-y-4">
      <section className="login-dusk rounded-2xl px-6 py-8 text-white">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {user.email} · {user.role === "super_admin" ? "Super admin" : "Admin"}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-brand-orange" aria-hidden />
              What you can do
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {user.permissions.map((permission) => (
              <Badge key={permission} variant="secondary">
                {PERMISSION_LABELS[permission] ?? permission}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-brand-orange" aria-hidden />
              Your properties
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {user.allProperties ? (
              "You can see every property."
            ) : user.assignedProperties.length === 0 ? (
              <span className="text-muted-foreground">
                None yet. Ask a super admin to assign some.
              </span>
            ) : (
              <ul className="space-y-1 font-mono text-xs">
                {user.assignedProperties.map(({ ndid, hid }) => (
                  <li key={`${ndid}/${hid}`}>
                    {ndid} / {hid}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {user.permissions.includes("audit.view") && <RecentActivity />}
      </div>
    </div>
  );
}
