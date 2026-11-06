"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDay,
  subscriptionsApi,
  toDateInput,
  type RenewBody,
  type Subscription,
  type SubscriptionView,
} from "@/lib/api/subscriptions-api";
import { useAuthStore } from "@/stores/auth-store";

export type SubscriptionAction = "pause" | "expire" | "renew" | "plan";

const TERMS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
  { value: "6", label: "6 months" },
  { value: "12", label: "12 months" },
  { value: "date", label: "Until a chosen date" },
];

/** Who may change subscriptions. The API checks this too. */
export function useCanManageSubscriptions(): boolean {
  return (
    useAuthStore((state) =>
      state.user?.permissions.includes("subscriptions.manage"),
    ) ?? false
  );
}

/**
 * Pause, resume, renew, expire and change plan for one subscription, used by the
 * subscriptions table and the client page alike. `open` shows a dialog; `resume` runs at once.
 */
export function useSubscriptionActions(
  subscription: Pick<Subscription, "ndid" | "hotelName" | "plan"> &
    Partial<Pick<Subscription, "apps" | "endDate">>,
) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<SubscriptionAction | null>(null);
  const { ndid } = subscription;

  const run = useMutation({
    mutationFn: (task: () => Promise<SubscriptionView>) => task(),
    onSuccess: (next) => {
      queryClient.setQueryData(["subscriptions", "one", ndid], next);
      void queryClient.invalidateQueries({
        queryKey: ["subscriptions", "list"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["clients", "services", ndid],
      });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      const name = subscription.hotelName ?? "this client";
      const emailed = next.emailed
        ? ` ${next.emailed} waiting lead${next.emailed === 1 ? " was" : "s were"} emailed to the hotel.`
        : "";
      const what =
        next.state === "stopped"
          ? `${name} is ${next.subscription.staffStop?.kind === "paused" ? "paused" : "expired"}.`
          : `${name} is active until ${formatDay(next.subscription.endDate)}.`;
      toast.success(`${what}${emailed}`);
      setAction(null);
    },
    onError: (error) => toast.error(error.message),
  });

  return {
    open: setAction,
    resume: () => run.mutate(() => subscriptionsApi.resume(ndid)),
    /** Every app the client has gets the subscription's end date, as paid. */
    matchApps: () =>
      run.mutate(() =>
        subscriptionsApi.setApps(
          ndid,
          (subscription.apps ?? []).map((a) => ({
            appId: a.appId,
            endDate: toDateInput(subscription.endDate ?? a.endDate),
            isTrial: false,
          })),
        ),
      ),
    pending: run.isPending,
    dialogs: action && (
      <SubscriptionDialog
        action={action}
        subscription={subscription}
        pending={run.isPending}
        onClose={() => setAction(null)}
        onRun={(task) => run.mutate(task)}
      />
    ),
  };
}

function SubscriptionDialog({
  action,
  subscription,
  pending,
  onClose,
  onRun,
}: {
  action: SubscriptionAction;
  subscription: Pick<Subscription, "ndid" | "hotelName" | "plan"> &
    Partial<Pick<Subscription, "apps">>;
  pending: boolean;
  onClose: () => void;
  onRun: (task: () => Promise<SubscriptionView>) => void;
}) {
  const { ndid } = subscription;
  const name = subscription.hotelName ?? "this client";
  const [reason, setReason] = useState("");
  const [term, setTerm] = useState("1");
  const [until, setUntil] = useState("");
  const [planId, setPlanId] = useState(subscription.plan?.id ?? "");
  const [note, setNote] = useState("");
  const [extendApps, setExtendApps] = useState(true);
  const [endApps, setEndApps] = useState(false);
  const appCount = subscription.apps?.length ?? 0;
  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: () => subscriptionsApi.plans(),
  });
  const planItems = (plans.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.name}${p.price ? ` · ₹${p.price}/month` : ""}`,
  }));

  const spinner = pending && (
    <LoaderCircle
      data-icon="inline-start"
      className="animate-spin"
      aria-hidden
    />
  );
  const planSelect = (label: string) => (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Select
        items={planItems}
        value={planId}
        onValueChange={(v) => v && setPlanId(v)}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue placeholder="Choose a plan" />
        </SelectTrigger>
        <SelectContent>
          {planItems.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  if (action === "pause" || action === "expire") {
    const pause = action === "pause";
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pause ? "Pause" : "Expire"} {name}?
            </DialogTitle>
            <DialogDescription>
              Their dashboard asks them to renew, the chatbot disappears from
              their website, and new leads are saved without being sent to them.{" "}
              {pause
                ? "Resume gives back the days they had left."
                : "The days they had left are not kept; renew to bring them back."}{" "}
              When they&apos;re active again, waiting leads arrive in one email.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="stop-reason">Reason</FieldLabel>
            <Input
              id="stop-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. invoice 1042 unpaid"
              autoFocus
            />
            <FieldDescription>
              Only staff see this, in the activity log.
            </FieldDescription>
          </Field>
          {appCount > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
              <Checkbox
                className="mt-0.5"
                checked={endApps}
                onCheckedChange={(v) => setEndApps(Boolean(v))}
              />
              <span className="text-sm">
                <span className="font-medium">
                  Also end its {appCount} app{appCount === 1 ? "" : "s"} now
                </span>
                <span className="block text-xs text-muted-foreground">
                  {pause
                    ? "They show as expired in the hotel's dashboard. Resuming gives them the subscription's new end date."
                    : "They show as expired in the hotel's dashboard. Renewing extends them again."}
                </span>
              </span>
            </label>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                onRun(() =>
                  pause
                    ? subscriptionsApi.pause(
                        ndid,
                        reason.trim() || undefined,
                        endApps,
                      )
                    : subscriptionsApi.expire(
                        ndid,
                        reason.trim() || undefined,
                        endApps,
                      ),
                )
              }
            >
              {spinner}
              {pause ? "Pause subscription" : "Expire now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (action === "plan") {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change plan for {name}</DialogTitle>
            <DialogDescription>
              Upgrade or downgrade. The dates stay as they are; use Renew to
              extend.
            </DialogDescription>
          </DialogHeader>
          {planSelect("New plan")}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={pending || !planId || planId === subscription.plan?.id}
              onClick={() =>
                onRun(() => subscriptionsApi.changePlan(ndid, planId))
              }
            >
              {spinner}
              Change plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const body = (): RenewBody => ({
    ...(term === "date" ? { until } : { months: Number(term) }),
    ...(planId && planId !== subscription.plan?.id ? { planId } : {}),
    ...(note.trim() ? { note: note.trim() } : {}),
    extendApps,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renew {name}</DialogTitle>
          <DialogDescription>
            Months are added to the current end, or to today if it has passed. A
            paused subscription gets its days back first. Services return at
            once and waiting leads are emailed in one message.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel>Renew for</FieldLabel>
            <Select
              items={TERMS}
              value={term}
              onValueChange={(v) => v && setTerm(v)}
            >
              <SelectTrigger className="w-full" aria-label="Renew for">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {term === "date" && (
            <Field>
              <FieldLabel htmlFor="renew-until">Last day</FieldLabel>
              <Input
                id="renew-until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </Field>
          )}
          {planSelect("Plan")}
          {appCount > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border p-3">
              <Checkbox
                className="mt-0.5"
                checked={extendApps}
                onCheckedChange={(v) => setExtendApps(Boolean(v))}
              />
              <span className="text-sm">
                <span className="font-medium">
                  Also extend its {appCount} app{appCount === 1 ? "" : "s"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Every app gets the new end date and stops being a trial.
                </span>
              </span>
            </label>
          )}
          <Field>
            <FieldLabel htmlFor="renew-note">Payment note</FieldLabel>
            <Input
              id="renew-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. paid by UPI, ref 8F2K"
            />
            <FieldDescription>
              Only staff see this, in the activity log.
            </FieldDescription>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || (term === "date" && !until)}
            onClick={() => onRun(() => subscriptionsApi.renew(ndid, body()))}
          >
            {spinner}
            Renew
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
