import { cn } from "cn";

import { daysLeft } from "@/lib/api/subscriptions-api";

/** A small meter of the days left in the subscription, out of a 30-day month. */
export function DaysLeft({
  endDate,
  stopped,
}: {
  endDate: string;
  stopped: boolean;
}) {
  const days = daysLeft(endDate);
  if (stopped)
    return <span className="text-sm text-muted-foreground">On hold</span>;
  if (days <= 0)
    return <span className="text-sm font-medium text-destructive">Ended</span>;

  const fill = Math.min(100, Math.round((days / 30) * 100));
  const tone = days <= 7 ? "bg-brand-orange" : "bg-emerald-500";
  return (
    <span className="flex items-center gap-2">
      <span
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
        aria-hidden
      >
        <span
          className={cn("block h-full rounded-full", tone)}
          style={{ width: `${fill}%` }}
        />
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          days <= 7 && "font-medium text-brand-orange",
        )}
      >
        {days} day{days === 1 ? "" : "s"}
      </span>
    </span>
  );
}
