"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CircleAlert,
  Inbox,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  clientsApi,
  type ClientServiceName,
  type ClientServices,
} from "@/lib/api/clients-api";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";

const SERVICES: {
  id: ClientServiceName;
  label: string;
  icon: LucideIcon;
  on: string;
  off: string;
  turnOff: string;
}[] = [
  {
    id: "chatbot",
    label: "Website chatbot",
    icon: Bot,
    on: "Shows on the hotel's website and answers guests.",
    off: "Hidden from the hotel's website.",
    turnOff:
      "The chatbot disappears from the hotel's website within a minute. Its settings are kept.",
  },
  {
    id: "leads",
    label: "Leads",
    icon: Inbox,
    on: "New leads reach the hotel's dashboard, email and WhatsApp.",
    off: "New leads are kept by Eazotel; the hotel gets no alerts until this is back on.",
    turnOff:
      "New leads are still saved, but the hotel isn't emailed or sent a WhatsApp alert, and no auto-reply goes to the guest. Meta, Google Ads, WordPress and Webflow leads are also hidden from its dashboard (website and chatbot form leads stay visible until those move off nexon). When you turn leads back on, the hidden ones appear and the hotel gets one email listing everything that came in.",
  },
];

export function ServicesCard({
  ndid,
  hotelName,
}: {
  ndid: string;
  hotelName: string | null;
}) {
  const queryClient = useQueryClient();
  const canManage =
    useAuthStore((state) =>
      state.user?.permissions.includes("subscriptions.manage"),
    ) ?? false;
  const [confirming, setConfirming] = useState<ClientServiceName | null>(null);
  const services = useQuery({
    queryKey: ["clients", "services", ndid],
    queryFn: () => clientsApi.getServices(ndid),
  });

  const change = useMutation({
    mutationFn: ({
      service,
      enabled,
    }: {
      service: ClientServiceName;
      enabled: boolean;
    }) => clientsApi.setService(ndid, service, enabled),
    onSuccess: (view: ClientServices, { service, enabled }) => {
      queryClient.setQueryData(["clients", "services", ndid], view);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      const label = SERVICES.find((s) => s.id === service)?.label ?? service;
      const released = view.released?.leads
        ? ` ${view.released.leads} held leads are now in their dashboard.`
        : "";
      const emailed = view.emailed
        ? ` ${view.emailed} were emailed to the hotel in one message.`
        : "";
      toast.success(
        `${label} ${enabled ? "on" : "off"} for ${hotelName ?? "this client"}.${released}${emailed}`,
      );
      void queryClient.invalidateQueries({
        queryKey: ["subscriptions", "one", ndid],
      });
      setConfirming(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const pending = SERVICES.find((s) => s.id === confirming);

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Services</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.isPending && <Skeleton className="h-24 w-full" />}
        {services.error && (
          <p className="text-sm text-destructive">{services.error.message}</p>
        )}
        {services.data &&
          SERVICES.map(({ id, label, icon: Icon, on, off }) => {
            const state = services.data.switches[id];
            const running = services.data[id];
            const busy = change.isPending && change.variables?.service === id;
            return (
              <div
                key={id}
                className="flex flex-wrap items-start gap-3 rounded-lg border p-3"
              >
                <Icon className="mt-0.5 size-5 text-brand-orange" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {label}
                    <Badge variant={running ? "secondary" : "destructive"}>
                      {running ? "On" : "Off"}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {running ? on : off}
                  </p>
                  {state.enabled && !running && (
                    <p className="text-xs text-muted-foreground">
                      Switched on, but off while the subscription is stopped.
                    </p>
                  )}
                  {state.changedAt && (
                    <p className="text-xs text-muted-foreground">
                      Turned {state.enabled ? "on" : "off"} by {state.changedBy}{" "}
                      · {formatDateTime(state.changedAt)}
                    </p>
                  )}
                  {id === "leads" && services.data.heldLeads > 0 && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm">
                      <CircleAlert
                        className="size-4 text-brand-orange"
                        aria-hidden
                      />
                      {services.data.heldLeads} lead
                      {services.data.heldLeads === 1 ? "" : "s"} waiting, not
                      shown to the hotel
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    {id === "leads" &&
                      state.enabled &&
                      services.data.heldLeads > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            change.mutate({ service: id, enabled: true })
                          }
                        >
                          Release to hotel
                        </Button>
                      )}
                    <Button
                      variant={state.enabled ? "outline" : "default"}
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        state.enabled
                          ? setConfirming(id)
                          : change.mutate({ service: id, enabled: true })
                      }
                    >
                      {busy && (
                        <LoaderCircle
                          data-icon="inline-start"
                          className="animate-spin"
                          aria-hidden
                        />
                      )}
                      {state.enabled ? "Turn off" : "Turn on"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        {!canManage && services.data && (
          <p className="text-xs text-muted-foreground">
            Only staff with &quot;Manage subscriptions&quot; can turn services
            on or off.
          </p>
        )}
      </CardContent>

      {pending && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Turn off {pending.label.toLowerCase()} for{" "}
                {hotelName ?? "this client"}?
              </DialogTitle>
              <DialogDescription>{pending.turnOff}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={change.isPending}
                onClick={() =>
                  change.mutate({ service: pending.id, enabled: false })
                }
              >
                {change.isPending && (
                  <LoaderCircle
                    data-icon="inline-start"
                    className="animate-spin"
                    aria-hidden
                  />
                )}
                Turn off
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
