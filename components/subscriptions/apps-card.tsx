"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { AppWindow, CalendarCheck, LoaderCircle, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  daysLeft,
  formatDay,
  subscriptionsApi,
  toDateInput,
  type App,
  type Subscription,
  type SubscriptionView,
} from "@/lib/api/subscriptions-api";

import { useCanManageSubscriptions } from "./subscription-actions";

/** One row while editing. */
interface Draft {
  on: boolean;
  endDate: string;
  isTrial: boolean;
}

function AppStatus({
  app,
  access,
}: {
  app: Subscription["apps"][number] | undefined;
  access: boolean;
}) {
  if (!app) {
    return <span className="text-sm text-muted-foreground">Not included</span>;
  }
  const left = daysLeft(app.endDate);
  const tone =
    left <= 0
      ? "bg-slate-100 text-slate-600"
      : left <= 7
        ? "bg-orange-50 text-orange-700"
        : "bg-emerald-50 text-emerald-700";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span
        className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}
      >
        {left <= 0
          ? `Expired ${formatDay(app.endDate)}`
          : `Until ${formatDay(app.endDate)}`}
      </span>
      {app.isTrial && (
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
          Trial
        </span>
      )}
      {!access && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          Access off
        </span>
      )}
    </span>
  );
}

/**
 * The add-on apps a client has, and until when. Staff pick the apps, set their end dates
 * (usually the subscription's end), and save: the hotel dashboard then shows exactly that,
 * and unticked apps are turned off there.
 */
export function AppsCard({ ndid }: { ndid: string }) {
  const queryClient = useQueryClient();
  const canManage = useCanManageSubscriptions();
  const view = useQuery({
    queryKey: ["subscriptions", "one", ndid],
    queryFn: () => subscriptionsApi.get(ndid),
    retry: false,
  });
  const catalogue = useQuery({
    queryKey: ["apps"],
    queryFn: () => subscriptionsApi.apps(),
  });
  const [drafts, setDrafts] = useState<Record<string, Draft> | null>(null);
  const [bulkDate, setBulkDate] = useState("");

  const save = useMutation({
    mutationFn: (apps: Record<string, Draft>) =>
      subscriptionsApi.setApps(
        ndid,
        Object.entries(apps)
          .filter(([, d]) => d.on)
          .map(([appId, d]) => ({
            appId,
            endDate: d.endDate,
            isTrial: d.isTrial,
          })),
      ),
    onSuccess: (next: SubscriptionView) => {
      queryClient.setQueryData(["subscriptions", "one", ndid], next);
      void queryClient.invalidateQueries({
        queryKey: ["subscriptions", "list"],
      });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(
        `Saved ${next.subscription.apps.length} app${next.subscription.apps.length === 1 ? "" : "s"}.`,
      );
      setDrafts(null);
    },
    onError: (error) => toast.error(error.message),
  });

  if (view.isPending || catalogue.isPending)
    return <Skeleton className="mb-4 h-56 w-full rounded-xl" />;
  if (view.error || catalogue.error || !view.data || !catalogue.data)
    return null;

  const s = view.data.subscription;
  const apps: App[] = catalogue.data;
  const has = new Map(s.apps.map((a) => [a.appId, a]));
  const subEnd = toDateInput(s.endDate);
  const active = s.apps.filter((a) => daysLeft(a.endDate) > 0).length;
  const expired = s.apps.length - active;

  function startEditing() {
    setBulkDate(subEnd);
    setDrafts(
      Object.fromEntries(
        apps.map((app) => {
          const current = has.get(app.id);
          return [
            app.id,
            {
              on: Boolean(current),
              endDate: current ? toDateInput(current.endDate) : subEnd,
              isTrial: current?.isTrial ?? false,
            },
          ];
        }),
      ),
    );
  }

  const update = (id: string, change: Partial<Draft>) =>
    setDrafts((d) => (d ? { ...d, [id]: { ...d[id]!, ...change } } : d));
  const selected = drafts
    ? Object.values(drafts).filter((d) => d.on).length
    : 0;
  const setAll = (change: (x: Draft) => Partial<Draft>) =>
    setDrafts((d) =>
      d
        ? Object.fromEntries(
            Object.entries(d).map(([id, x]) => [id, { ...x, ...change(x) }]),
          )
        : d,
    );
  const included = drafts ? Object.values(drafts).filter((d) => d.on) : [];
  const allOn = drafts ? included.length === apps.length : false;
  const someOn = included.length > 0 && !allOn;
  const trials = included.filter((d) => d.isTrial).length;
  const allTrial = included.length > 0 && trials === included.length;
  const someTrial = trials > 0 && !allTrial;
  const shortcuts = [
    { label: `Subscription end (${formatDay(s.endDate)})`, value: subEnd },
  ];
  const applyToSelected = (date: string) =>
    setDrafts((d) =>
      d
        ? Object.fromEntries(
            Object.entries(d).map(([id, x]) => [
              id,
              x.on ? { ...x, endDate: date } : x,
            ]),
          )
        : d,
    );

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/30">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AppWindow className="size-4 text-brand-orange" aria-hidden />
            Apps
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {s.apps.length} of {apps.length} included · {active} active
            {expired > 0 && (
              <span className="font-medium text-orange-700">
                {" "}
                · {expired} expired
              </span>
            )}
          </p>
        </div>
        {canManage && !drafts && (
          <Button size="sm" variant="outline" onClick={startEditing}>
            <Pencil data-icon="inline-start" aria-hidden />
            Edit apps
          </Button>
        )}
      </CardHeader>

      {drafts && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-brand-navy/[0.03] px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Set end date for the {selected} selected:
          </span>
          <DatePicker
            value={bulkDate}
            onChange={setBulkDate}
            shortcuts={shortcuts}
            aria-label="End date for selected apps"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!bulkDate}
            onClick={() => applyToSelected(bulkDate)}
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyToSelected(subEnd)}
          >
            <CalendarCheck data-icon="inline-start" aria-hidden />
            Match subscription end ({formatDay(s.endDate)})
          </Button>
        </div>
      )}

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {drafts && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    checked={allOn}
                    indeterminate={someOn}
                    onCheckedChange={() => setAll(() => ({ on: !allOn }))}
                    aria-label={allOn ? "Untick all apps" : "Tick all apps"}
                  />
                </TableHead>
              )}
              <TableHead className={cn(!drafts && "pl-4")}>App</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>{drafts ? "Ends on" : "Status"}</TableHead>
              {drafts && (
                <TableHead>
                  <span className="flex items-center gap-2">
                    <Checkbox
                      checked={allTrial}
                      indeterminate={someTrial}
                      disabled={included.length === 0}
                      onCheckedChange={() =>
                        setAll((x) => (x.on ? { isTrial: !allTrial } : {}))
                      }
                      aria-label={
                        allTrial
                          ? "Mark every included app as paid"
                          : "Mark every included app as a trial"
                      }
                    />
                    Trial
                  </span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => {
              const d = drafts?.[app.id];
              return (
                <TableRow
                  key={app.id}
                  className={cn(d && !d.on && "opacity-55")}
                >
                  {d && (
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={d.on}
                        onCheckedChange={(on) =>
                          update(app.id, { on: Boolean(on) })
                        }
                        aria-label={`Include ${app.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className={cn(!d && "pl-4")}>
                    <span className="font-medium">{app.name}</span>
                    {!app.isActive && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (retired)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    ₹{app.price}
                  </TableCell>
                  <TableCell>
                    {d ? (
                      <DatePicker
                        value={d.endDate}
                        disabled={!d.on}
                        onChange={(endDate) => update(app.id, { endDate })}
                        shortcuts={shortcuts}
                        aria-label={`${app.name} ends on`}
                      />
                    ) : (
                      <AppStatus
                        app={has.get(app.id)}
                        access={s.appAccess[app.code] !== false}
                      />
                    )}
                  </TableCell>
                  {d && (
                    <TableCell>
                      <Checkbox
                        checked={d.isTrial}
                        disabled={!d.on}
                        onCheckedChange={(v) =>
                          update(app.id, { isTrial: Boolean(v) })
                        }
                        aria-label={`${app.name} is a trial`}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>

      {drafts && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Unticked apps are removed and turned off in the hotel&apos;s
            dashboard. The change is logged.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setDrafts(null)}
              disabled={save.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => save.mutate(drafts)}
              disabled={
                save.isPending ||
                Object.values(drafts).some((x) => x.on && !x.endDate)
              }
            >
              {save.isPending && (
                <LoaderCircle
                  data-icon="inline-start"
                  className="animate-spin"
                  aria-hidden
                />
              )}
              Save apps
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
