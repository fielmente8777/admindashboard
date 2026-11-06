import { cn } from "cn";

import {
  STATE_LABELS,
  type Subscription,
  type SubscriptionState,
} from "@/lib/api/subscriptions-api";

const TONES: Record<SubscriptionState, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ending: "bg-orange-50 text-orange-700 ring-orange-600/20",
  ended: "bg-slate-100 text-slate-600 ring-slate-500/20",
  stopped: "bg-red-50 text-red-700 ring-red-600/20",
};

const DOTS: Record<SubscriptionState, string> = {
  active: "bg-emerald-500",
  ending: "bg-orange-500",
  ended: "bg-slate-400",
  stopped: "bg-red-500",
};

export function StateBadge({
  state,
  staffStop,
}: {
  state: SubscriptionState;
  staffStop?: Subscription["staffStop"];
}) {
  const label =
    state === "stopped" && staffStop
      ? staffStop.kind === "paused"
        ? "Paused"
        : "Expired by staff"
      : STATE_LABELS[state];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[state],
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOTS[state])} aria-hidden />
      {label}
    </span>
  );
}
