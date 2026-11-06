"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  CircleAlert,
  CreditCard,
  Pause,
  Play,
  RefreshCw,
  TimerOff,
} from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/api-client";
import {
  daysFromNow,
  formatDay,
  subscriptionsApi,
} from "@/lib/api/subscriptions-api";

import { DaysLeft } from "./days-left";
import { StateBadge } from "./state-badge";
import {
  useCanManageSubscriptions,
  useSubscriptionActions,
} from "./subscription-actions";

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

/** A client's subscription on the client page, with pause, resume, renew, expire and change plan. */
export function SubscriptionCard({ ndid }: { ndid: string }) {
  const canManage = useCanManageSubscriptions();
  const view = useQuery({
    queryKey: ["subscriptions", "one", ndid],
    queryFn: () => subscriptionsApi.get(ndid),
    retry: false,
  });
  const actions = useSubscriptionActions(
    view.data?.subscription ?? { ndid, hotelName: null, plan: null },
  );

  if (view.isPending)
    return <Skeleton className="mb-4 h-44 w-full rounded-xl" />;
  if (view.error) {
    const none =
      view.error instanceof ApiError &&
      view.error.code === "SUBSCRIPTION_NOT_FOUND";
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {none
            ? "This client has no subscription record."
            : view.error.message}
        </CardContent>
      </Card>
    );
  }

  const { subscription: s, state, services, heldLeads } = view.data;
  const stop = s.staffStop;

  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 border-b bg-muted/30">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-4 text-brand-orange" aria-hidden />
          Subscription
          <StateBadge state={state} staffStop={stop} />
        </CardTitle>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => actions.open("renew")}>
              <RefreshCw data-icon="inline-start" aria-hidden />
              Renew
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => actions.open("plan")}
            >
              Change plan
            </Button>
            {stop?.kind === "paused" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={actions.pending}
                onClick={actions.resume}
              >
                <Play data-icon="inline-start" aria-hidden />
                Resume
              </Button>
            ) : (
              !stop && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => actions.open("pause")}
                >
                  <Pause data-icon="inline-start" aria-hidden />
                  Pause
                </Button>
              )
            )}
            {stop?.kind !== "expired" && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => actions.open("expire")}
              >
                <TimerOff data-icon="inline-start" aria-hidden />
                Expire now
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Line label="Plan">
            {s.plan
              ? `${s.plan.name}${s.plan.price ? ` · ₹${s.plan.price}/month` : ""}`
              : "-"}
          </Line>
          <Line label="Started">{formatDay(s.startDate)}</Line>
          <Line label="Ends">
            <span className="flex items-center gap-1.5">
              <CalendarClock
                className="size-3.5 text-muted-foreground"
                aria-hidden
              />
              {formatDay(s.endDate)}
              <span className="font-normal text-muted-foreground">
                ({daysFromNow(s.endDate)})
              </span>
            </span>
          </Line>
          <Line label="Time left">
            <DaysLeft endDate={s.endDate} stopped={Boolean(stop)} />
          </Line>
        </dl>

        {stop && (
          <p className="mt-5 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm">
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <span>
              <strong className="font-semibold">
                {stop.kind === "paused" ? "Paused" : "Expired"} by {stop.by}
              </strong>{" "}
              on {formatDay(stop.at)}
              {stop.reason ? `: “${stop.reason}”` : ""}.
              {stop.kind === "paused" &&
                stop.daysLeftWhenPaused !== null &&
                ` Resuming gives back ${stop.daysLeftWhenPaused} days.`}
              {stop.appsEnded &&
                (stop.kind === "paused"
                  ? " Its apps were ended too; resuming gives them the new end date."
                  : " Its apps were ended too; renewing extends them.")}{" "}
              The hotel sees its renew page, its chatbot is hidden, and new
              leads are kept without alerting it
              {heldLeads > 0 ? ` (${heldLeads} waiting)` : ""}.
            </span>
          </p>
        )}
        {!stop && !services.subscriptionServing && (
          <p className="mt-5 text-sm text-muted-foreground">
            This subscription has ended, so the chatbot and lead alerts are off
            until it is renewed.
          </p>
        )}
      </CardContent>
      {actions.dialogs}
    </Card>
  );
}
