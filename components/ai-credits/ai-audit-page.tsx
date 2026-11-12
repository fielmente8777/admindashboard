"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aiCreditsApi, credits, type GianAuditEntry } from "@/lib/api/ai-credits-api";
import { formatDateTime } from "@/lib/format";

import { AiCreditsNav, NoCreditsAccess } from "./ai-credits-nav";

const ACTION_LABEL: Record<string, string> = {
  "credits.add": "Added credits",
  "credits.deduct": "Removed credits",
  "wallet.status": "Wallet status",
  "pricing.create": "Priced a model",
  "pricing.update": "Changed a price",
  "package.create": "Added a package",
  "package.update": "Changed a package",
  "settings.update": "Changed settings",
};

/** One line of what changed, from gian's before/after values. */
function summary(e: GianAuditEntry): string {
  const before = (e.before ?? {}) as Record<string, unknown>;
  const after = (e.after ?? {}) as Record<string, unknown>;
  if (e.action === "credits.add" || e.action === "credits.deduct")
    return `Balance ${credits(Number(before.balance ?? 0))} → ${credits(Number(after.balance ?? 0))}`;
  if (e.action === "wallet.status") return `${String(before.status ?? "?")} → ${String(after.status ?? "?")}`;
  const keys = Object.keys(after).filter((k) => k !== "updatedBy");
  return keys.length ? keys.slice(0, 4).join(", ") + (keys.length > 4 ? "…" : "") : "";
}

/**
 * gian's AI credits audit log: every change made from this console and from the hotel
 * dashboard's owner page. Console changes are also in Activity.
 */
export function AiAuditPage() {
  const canPricing = useCan("credits.pricing");
  const audit = useInfiniteQuery({
    queryKey: ["ai-credits", "audit"],
    queryFn: ({ pageParam }) => aiCreditsApi.audit({ before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: canPricing,
  });
  if (!canPricing) return <NoCreditsAccess permission="credits.pricing" />;
  const rows = audit.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="AI credits" description="Every change to AI credits, from this console and from the hotel dashboard's owner page." />
      <AiCreditsNav />
      {audit.isError ? (
        <LoadFailed error={audit.error} onRetry={() => void audit.refetch()} />
      ) : audit.isPending ? (
        <TableLoading />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nothing changed yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Client / item</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(e.createdAt)}</TableCell>
                  <TableCell className="text-sm">{e.actor}</TableCell>
                  <TableCell className="text-sm font-medium">{ACTION_LABEL[e.action] ?? e.action}</TableCell>
                  <TableCell className="text-sm">{e.tenantId ?? e.target ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{summary(e)}</TableCell>
                  <TableCell className="text-sm">{e.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {audit.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void audit.fetchNextPage()} disabled={audit.isFetchingNextPage}>
            {audit.isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" />} Older
          </Button>
        </div>
      )}
    </>
  );
}
