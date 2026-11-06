"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CirclePause,
  CircleSlash,
  Layers,
  MoreHorizontal,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";

import {
  LoadFailed,
  PageHeader,
  TableLoading,
} from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  daysFromNow,
  daysLeft,
  formatDay,
  subscriptionsApi,
  type Subscription,
  type SubscriptionSort,
  type SubscriptionState,
} from "@/lib/api/subscriptions-api";

import { DaysLeft } from "./days-left";
import { StateBadge } from "./state-badge";
import {
  useCanManageSubscriptions,
  useSubscriptionActions,
} from "./subscription-actions";

const PAGE_SIZE = 25;

const STATS: {
  state: SubscriptionState | undefined;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    state: undefined,
    label: "All clients",
    hint: "every subscription",
    icon: Layers,
    tone: "text-brand-navy bg-brand-navy/10",
  },
  {
    state: "active",
    label: "Active",
    hint: "more than 7 days left",
    icon: CircleCheck,
    tone: "text-emerald-700 bg-emerald-50",
  },
  {
    state: "ending",
    label: "Ending soon",
    hint: "within 7 days",
    icon: CalendarClock,
    tone: "text-orange-700 bg-orange-50",
  },
  {
    state: "ended",
    label: "Ended",
    hint: "not renewed",
    icon: CircleSlash,
    tone: "text-slate-600 bg-slate-100",
  },
  {
    state: "stopped",
    label: "Paused or expired",
    hint: "stopped by staff",
    icon: CirclePause,
    tone: "text-red-700 bg-red-50",
  },
];

function SortHeader({
  label,
  column,
  sort,
  order,
  onSort,
  className,
}: {
  label: string;
  column: SubscriptionSort;
  sort: SubscriptionSort;
  order: "asc" | "desc";
  onSort: (column: SubscriptionSort) => void;
  className?: string;
}) {
  const active = sort === column;
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead
      className={className}
      aria-sort={
        active ? (order === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "-ml-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase hover:bg-muted",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </TableHead>
  );
}

/** "9 / 11 active", in orange when apps expired while the subscription still runs. */
function AppsSummary({
  subscription,
}: {
  subscription: Subscription & { state: SubscriptionState };
}) {
  const total = subscription.apps.length;
  if (total === 0)
    return <span className="text-sm text-muted-foreground">None</span>;
  const active = subscription.apps.filter(
    (a) => daysLeft(a.endDate) > 0,
  ).length;
  const stale =
    active < total &&
    (subscription.state === "active" || subscription.state === "ending");
  return (
    <span
      className={cn(
        "text-sm tabular-nums",
        stale && "font-medium text-orange-700",
      )}
      title={stale ? "Some apps expired before the subscription" : undefined}
    >
      {active} / {total} active
    </span>
  );
}

function RowActions({ subscription }: { subscription: Subscription }) {
  const actions = useSubscriptionActions(subscription);
  const stop = subscription.staffStop;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${subscription.hotelName ?? subscription.ndid}`}
            >
              <MoreHorizontal aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onClick={() => actions.open("renew")}>
            Renew…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => actions.open("plan")}>
            Change plan…
          </DropdownMenuItem>
          {subscription.apps.length > 0 && (
            <DropdownMenuItem onClick={actions.matchApps}>
              Match apps to subscription end
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {stop?.kind === "paused" ? (
            <DropdownMenuItem onClick={actions.resume}>Resume</DropdownMenuItem>
          ) : (
            !stop && (
              <DropdownMenuItem onClick={() => actions.open("pause")}>
                Pause…
              </DropdownMenuItem>
            )
          )}
          {stop?.kind !== "expired" && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => actions.open("expire")}
            >
              Expire now…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {actions.dialogs}
    </>
  );
}

export function SubscriptionsPage() {
  const canManage = useCanManageSubscriptions();
  const [state, setState] = useState<SubscriptionState | undefined>();
  const [input, setInput] = useState("");
  const search = useDeferredValue(input.trim());
  const [sort, setSort] = useState<SubscriptionSort>("endDate");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ["subscriptions", "list", { state, search, sort, order, page }],
    queryFn: () =>
      subscriptionsApi.list({
        state,
        search,
        sort,
        order,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  function sortBy(column: SubscriptionSort) {
    if (column === sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(column);
      setOrder("asc");
    }
    setPage(1);
  }

  const counts = list.data?.counts;
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Every client's plan and how long it runs. Pause, renew, expire or change a plan from the row menu."
      />

      <div
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        role="group"
        aria-label="Filter by state"
      >
        {STATS.map(({ state: value, label, hint, icon: Icon, tone }) => {
          const selected = state === value;
          const count = counts ? counts[value ?? "all"] : null;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setState(value);
                setPage(1);
              }}
              className={cn(
                "group rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-brand-navy/30 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selected && "border-brand-navy ring-1 ring-brand-navy",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  {label}
                </span>
                <span className={cn("rounded-lg p-1.5", tone)}>
                  <Icon className="size-4" aria-hidden />
                </span>
              </span>
              <span className="mt-2 block text-3xl font-bold tracking-tight text-brand-navy tabular-nums">
                {count ?? (
                  <span className="inline-block h-8 w-10 animate-pulse rounded bg-muted" />
                )}
              </span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm font-medium">
            {STATS.find((s) => s.state === state)?.label}
            {list.data && (
              <span className="ml-2 font-normal text-muted-foreground">
                {total} found
              </span>
            )}
          </p>
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setPage(1);
              }}
              placeholder="Search hotel or ndid"
              aria-label="Search subscriptions"
              className="pl-8"
            />
          </div>
        </div>

        {list.isPending && (
          <div className="p-4">
            <TableLoading />
          </div>
        )}
        {list.error && (
          <div className="p-4">
            <LoadFailed
              error={list.error}
              onRetry={() => void list.refetch()}
            />
          </div>
        )}
        {list.data && list.data.items.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No subscription matches.
          </p>
        )}

        {list.data && list.data.items.length > 0 && (
          <Table className={cn(list.isPlaceholderData && "opacity-60")}>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortHeader
                  label="Hotel"
                  column="hotel"
                  sort={sort}
                  order={order}
                  onSort={sortBy}
                  className="pl-4"
                />
                <SortHeader
                  label="Plan"
                  column="plan"
                  sort={sort}
                  order={order}
                  onSort={sortBy}
                />
                <SortHeader
                  label="Ends"
                  column="endDate"
                  sort={sort}
                  order={order}
                  onSort={sortBy}
                />
                <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Time left
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Apps
                </TableHead>
                <SortHeader
                  label="State"
                  column="state"
                  sort={sort}
                  order={order}
                  onSort={sortBy}
                />
                {canManage && (
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.items.map((s) => (
                <TableRow key={s.ndid}>
                  <TableCell className="pl-4">
                    <Link
                      href={`/clients/${encodeURIComponent(s.ndid)}?from=subscriptions`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {s.hotelName ?? "Unnamed hotel"}
                    </Link>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {s.ndid}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.plan ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                        {s.plan.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDay(s.endDate)}
                    <div className="text-xs text-muted-foreground">
                      {daysFromNow(s.endDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DaysLeft
                      endDate={s.endDate}
                      stopped={Boolean(s.staffStop)}
                    />
                  </TableCell>
                  <TableCell>
                    <AppsSummary subscription={s} />
                  </TableCell>
                  <TableCell>
                    <StateBadge state={s.state} staffStop={s.staffStop} />
                  </TableCell>
                  {canManage && (
                    <TableCell className="pr-4 text-right">
                      <RowActions subscription={s} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {list.data && total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span className="tabular-nums">
              {from}–{to} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft aria-hidden />
              </Button>
              <span className="tabular-nums">
                Page {page} of {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                aria-label="Next page"
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
