"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ChevronDown,
  CircleAlert,
  Globe,
  Info,
  LoaderCircle,
  type LucideIcon,
  Megaphone,
  MessageCircle,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  clientsApi,
  type ClientNotifications,
  type LeadSource,
  type PropertyAlerts,
  type SourceAlerts,
} from "@/lib/api/clients-api";
import { useAuthStore } from "@/stores/auth-store";

const SOURCES: {
  id: LeadSource;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    id: "webform",
    label: "Website forms",
    hint: "Enquiry forms on the hotel's website (Eazotel, WordPress, Webflow)",
    icon: Globe,
  },
  {
    id: "eazbot",
    label: "Chatbot",
    hint: "Guests who leave their details with the website chatbot",
    icon: Bot,
  },
  {
    id: "whatsapp",
    label: "WhatsApp chats",
    hint: "Guests who message the hotel on WhatsApp",
    icon: MessageCircle,
  },
  {
    id: "facebook",
    label: "Meta ads",
    hint: "Facebook and Instagram lead forms",
    icon: Megaphone,
  },
  {
    id: "google",
    label: "Google Ads",
    hint: "Google Ads lead forms",
    icon: Search,
  },
];

type Channel = "email" | "whatsapp";

/** What the form edits: the switches, and the extra recipients as typed. */
type Draft = Record<
  LeadSource,
  { email: boolean; whatsapp: boolean; emails: string; phones: string }
>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const split = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
const digits = (phone: string) => phone.replace(/[^\d]/g, "");
const showPhone = (phone: string) => (phone ? `+${digits(phone)}` : phone);

function toDraft(property: PropertyAlerts): Draft {
  return Object.fromEntries(
    SOURCES.map(({ id }) => {
      const s = property.sources[id];
      return [
        id,
        {
          email: s.email,
          whatsapp: s.whatsapp,
          emails: s.emails.join(", "),
          phones: s.phones.map(showPhone).join(", "),
        },
      ];
    }),
  ) as Draft;
}

function fromDraft(draft: Draft): Record<LeadSource, SourceAlerts> {
  return Object.fromEntries(
    SOURCES.map(({ id }) => [
      id,
      {
        email: draft[id].email,
        whatsapp: draft[id].whatsapp,
        emails: split(draft[id].emails),
        phones: split(draft[id].phones),
      },
    ]),
  ) as Record<LeadSource, SourceAlerts>;
}

/** The first problem in a source's extra recipients, if any. */
function problemOf(row: Draft[LeadSource]): string | null {
  const bad = split(row.emails).find((e) => !EMAIL.test(e));
  if (bad) return `"${bad}" isn't an email address.`;
  const badPhone = split(row.phones).find((p) => {
    const n = digits(p).length;
    return n < 10 || n > 15;
  });
  if (badPhone)
    return `"${badPhone}" needs the full number with country code, e.g. +91 98765 43210.`;
  if (split(row.emails).length > 10 || split(row.phones).length > 10)
    return "At most 10 extra emails and 10 extra numbers.";
  return null;
}

function PropertyAlertsForm({
  ndid,
  hotelName,
  data,
  property,
  canEdit,
}: {
  ndid: string;
  hotelName: string | null;
  data: ClientNotifications;
  property: PropertyAlerts;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => toDraft(property), [property]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [open, setOpen] = useState<LeadSource | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const problems = Object.fromEntries(
    SOURCES.map(({ id }) => [id, problemOf(draft[id])]),
  ) as Record<LeadSource, string | null>;
  const invalid = Object.values(problems).some(Boolean);

  const save = useMutation({
    mutationFn: () =>
      clientsApi.saveNotifications(ndid, property.hid, fromDraft(draft)),
    onSuccess: (view) => {
      queryClient.setQueryData(["clients", "notifications", ndid], view);
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(
        `Lead alerts saved for ${property.name ?? hotelName ?? "this property"}. They apply from the next lead.`,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const set = (id: LeadSource, patch: Partial<Draft[LeadSource]>) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  const allOn = (channel: Channel) =>
    SOURCES.every(({ id }) => draft[id][channel]);
  const setAll = (channel: Channel, on: boolean) =>
    setDraft(
      (d) =>
        Object.fromEntries(
          SOURCES.map(({ id }) => [id, { ...d[id], [channel]: on }]),
        ) as Draft,
    );

  return (
    <div className="space-y-3">
      {!property.saved && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Not set up yet. Until someone saves these, the hotel gets a WhatsApp
          alert for every lead and no emails.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>Lead source</span>
          <label className="flex w-20 items-center justify-center gap-2">
            Email
            <Switch
              aria-label="Email alerts for every source"
              checked={allOn("email")}
              onCheckedChange={(on) => setAll("email", on)}
              disabled={!canEdit}
              className="scale-90"
            />
          </label>
          <label className="flex w-24 items-center justify-center gap-2">
            WhatsApp
            <Switch
              aria-label="WhatsApp alerts for every source"
              checked={allOn("whatsapp")}
              onCheckedChange={(on) => setAll("whatsapp", on)}
              disabled={!canEdit}
              className="scale-90"
            />
          </label>
        </div>

        <ul className="divide-y">
          {SOURCES.map(({ id, label, hint, icon: Icon }) => {
            const row = draft[id];
            const extras = split(row.emails).length + split(row.phones).length;
            const expanded = open === id;
            return (
              <li key={id}>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 px-3 py-2.5">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-brand-orange"
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{hint}</p>
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-brand-orange hover:underline"
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : id)}
                      >
                        {extras > 0
                          ? `${extras} extra recipient${extras === 1 ? "" : "s"}`
                          : "Add extra recipients"}
                        <ChevronDown
                          className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                          aria-hidden
                        />
                      </button>
                      {problems[id] && !expanded && (
                        <p className="mt-1 text-xs text-destructive">
                          {problems[id]}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex w-20 justify-center">
                    <Switch
                      aria-label={`${label}: email alerts`}
                      checked={row.email}
                      onCheckedChange={(on) => set(id, { email: on })}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="flex w-24 justify-center">
                    <Switch
                      aria-label={`${label}: WhatsApp alerts`}
                      checked={row.whatsapp}
                      onCheckedChange={(on) => set(id, { whatsapp: on })}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                {expanded && (
                  <div className="grid gap-3 border-t bg-muted/20 px-3 py-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`${property.hid}-${id}-emails`}>
                        Extra emails
                      </FieldLabel>
                      <Input
                        id={`${property.hid}-${id}-emails`}
                        value={row.emails}
                        onChange={(e) => set(id, { emails: e.target.value })}
                        placeholder="sales@hotel.com, owner@hotel.com"
                        disabled={!canEdit}
                        aria-invalid={split(row.emails).some(
                          (e) => !EMAIL.test(e),
                        )}
                      />
                      <FieldDescription>
                        Besides {data.hotelEmail ?? "the hotel email"}. Separate
                        with commas.
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`${property.hid}-${id}-phones`}>
                        Extra WhatsApp numbers
                      </FieldLabel>
                      <Input
                        id={`${property.hid}-${id}-phones`}
                        value={row.phones}
                        onChange={(e) => set(id, { phones: e.target.value })}
                        placeholder="+91 98765 43210"
                        inputMode="tel"
                        disabled={!canEdit}
                      />
                      <FieldDescription>
                        Besides {data.hotelPhone ?? "the hotel phone"}. With
                        country code; a 10-digit number is taken as Indian.
                      </FieldDescription>
                    </Field>
                    {problems[id] && (
                      <p className="text-xs text-destructive sm:col-span-2">
                        {problems[id]}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground">
        Emails go to {data.hotelEmail ?? "the hotel email (not set)"} and
        WhatsApp messages to {data.hotelPhone ?? "the hotel phone (not set)"},
        plus any extra recipients. The hotel sees and can change these same
        settings in its dashboard.
      </p>

      {canEdit && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={!dirty || save.isPending}
            onClick={() => setDraft(initial)}
          >
            Undo changes
          </Button>
          <Button
            disabled={(!dirty && property.saved) || invalid || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            )}
            Save alerts
          </Button>
        </div>
      )}
    </div>
  );
}

/** Email and WhatsApp alerts per lead source, for each property of the client. */
export function LeadAlertsCard({
  ndid,
  hotelName,
}: {
  ndid: string;
  hotelName: string | null;
}) {
  const canEdit =
    useAuthStore((state) => state.user?.permissions.includes("clients.edit")) ??
    false;
  const alerts = useQuery({
    queryKey: ["clients", "notifications", ndid],
    queryFn: () => clientsApi.getNotifications(ndid),
  });
  const [chosen, setChosen] = useState<string | null>(null);

  const properties = alerts.data?.properties ?? [];
  const property =
    properties.find((p) => p.hid === chosen) ?? properties[0] ?? null;
  const items = properties.map((p) => ({
    value: p.hid,
    label: p.name ?? `${hotelName ?? "Property"} (${p.hid})`,
  }));

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Lead alerts</CardTitle>
        {properties.length > 1 && property && (
          <Select
            items={items}
            value={property.hid}
            onValueChange={(v) => v && setChosen(v)}
          >
            <SelectTrigger className="w-64" aria-label="Property">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.isPending && <Skeleton className="h-64 w-full" />}
        {alerts.error && (
          <p className="text-sm text-destructive">{alerts.error.message}</p>
        )}
        {alerts.data && !alerts.data.leadsDelivered && (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <CircleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <span>
              <span className="font-medium">No alerts are sent right now</span>
              {": "}
              {alerts.data.subscriptionServing
                ? "Leads are switched off in Services above."
                : "the subscription is stopped or has ended."}{" "}
              New leads are kept, and these settings apply again once leads are
              back on.
            </span>
          </p>
        )}
        {alerts.data && properties.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This client has no properties.
          </p>
        )}
        {alerts.data && property && (
          <>
            {properties.length === 1 && (
              <p className="text-sm text-muted-foreground">
                {items[0]?.label}{" "}
                {property.saved ? null : (
                  <Badge variant="outline" className="ml-1">
                    Not set up
                  </Badge>
                )}
              </p>
            )}
            <PropertyAlertsForm
              // a fresh form per property, and after every save
              key={`${property.hid}:${JSON.stringify(property.sources)}:${property.saved}`}
              ndid={ndid}
              hotelName={hotelName}
              data={alerts.data}
              property={property}
              canEdit={canEdit}
            />
          </>
        )}
        {!canEdit && alerts.data && (
          <p className="text-xs text-muted-foreground">
            Only staff who can edit clients can change these.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
