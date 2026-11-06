"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import {
  LoadFailed,
  NoAccess,
  PageHeader,
  TableLoading,
} from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { describeAction, describeChanges } from "@/lib/activity-text";
import {
  AUDIT_ACTIONS,
  auditApi,
  type AuditAction,
  type AuditFilters,
} from "@/lib/api/audit-api";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";

const ALL_ACTIONS = "all";
const ACTION_ITEMS = [
  { value: ALL_ACTIONS, label: "All activity" },
  ...AUDIT_ACTIONS.map(({ id, label }) => ({ value: id, label })),
];

export function ActivityPage() {
  const canView = useAuthStore((state) =>
    state.user?.permissions.includes("audit.view"),
  );
  const [filters, setFilters] = useState<AuditFilters>({});
  const [email, setEmail] = useState("");

  const activity = useInfiniteQuery({
    queryKey: ["activity", "list", filters],
    queryFn: ({ pageParam }) =>
      auditApi.list({ ...filters, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: canView,
  });

  if (!canView) return <NoAccess />;

  function applyEmail(event: FormEvent) {
    event.preventDefault();
    setFilters((current) => ({ ...current, email: email.trim() || undefined }));
  }

  const entries = activity.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        description="Everything staff do here, newest first. This log can't be edited."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          items={ACTION_ITEMS}
          value={filters.action ?? ALL_ACTIONS}
          onValueChange={(value) =>
            setFilters((current) => ({
              ...current,
              action:
                value && value !== ALL_ACTIONS
                  ? (value as AuditAction)
                  : undefined,
            }))
          }
        >
          <SelectTrigger className="w-52" aria-label="Filter by activity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_ITEMS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <form
          onSubmit={applyEmail}
          className="flex min-w-60 flex-1 gap-2 sm:max-w-sm"
        >
          <Input
            type="search"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Exact email address"
            aria-label="Filter by person's email"
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Search"
          >
            <Search aria-hidden />
          </Button>
        </form>
      </div>

      {activity.isPending && <TableLoading />}
      {activity.error && (
        <LoadFailed
          error={activity.error}
          onRetry={() => void activity.refetch()}
        />
      )}

      {activity.data && entries.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing matches these filters.
        </p>
      )}

      {entries.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>IP address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="align-top text-sm whitespace-nowrap">
                    <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {entry.actorEmail ?? "System"}
                  </TableCell>
                  <TableCell className="align-top text-sm whitespace-normal">
                    {describeAction(entry)}
                    {describeChanges(entry).map((change) => (
                      <div
                        key={change}
                        className="mt-0.5 text-xs text-muted-foreground"
                      >
                        {change}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="align-top font-mono text-xs">
                    {entry.ip ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activity.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={activity.isFetchingNextPage}
            onClick={() => void activity.fetchNextPage()}
          >
            {activity.isFetchingNextPage && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            )}
            Show older
          </Button>
        </div>
      )}
    </>
  );
}
