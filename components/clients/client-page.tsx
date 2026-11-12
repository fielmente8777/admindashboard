"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, ExternalLink, LoaderCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useForm, type FieldNamesMarkedBoolean } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { LoadFailed, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/api-client";
import {
  clientBulkApi,
  clientsApi,
  type Client,
  type ClientChanges,
  type TrashInfo,
} from "@/lib/api/clients-api";
import { formatDay } from "@/lib/api/subscriptions-api";
import { formatDateTime } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";

import { BackLink } from "./back-link";
import { DeleteClientCard } from "./delete-client-card";
import { OpenAccountButton } from "./open-account-button";
import { PaymentsTable } from "@/components/billing/billing-overview-page";
import { useCan } from "@/components/billing/billing-nav";
import { AppsCard } from "@/components/subscriptions/apps-card";
import { SubscriptionCard } from "@/components/subscriptions/subscription-card";

import { LeadAlertsCard } from "./lead-alerts-card";
import { TeamPhonesCard } from "./team-phones-card";
import { ServicesCard } from "./services-card";

const email = z
  .string()
  .trim()
  .max(254)
  .refine(
    (value) => value === "" || z.email().safeParse(value).success,
    "Enter a valid email address",
  );

const propertySchema = z.object({
  name: z.string().trim().max(120),
  city: z.string().trim().max(80),
  state: z.string().trim().max(80),
  country: z.string().trim().max(80),
  pinCode: z.string().trim().max(20),
});

const clientSchema = z.object({
  hotelDescription: z.string().trim().max(2000),
  hotelEmail: email,
  hotelPhone: z.string().trim().max(30),
  marketingEmail: email,
  properties: z.record(z.string(), propertySchema),
});

type ClientForm = z.infer<typeof clientSchema>;

// Property ids are digits, and react-hook-form reads a digit path segment as an array index.
const formKey = (hid: string) => `h${hid}`;
const hidOf = (key: string) => key.slice(1);
type PropertyKey = keyof z.infer<typeof propertySchema>;

const PROPERTY_FIELDS: { key: PropertyKey; label: string }[] = [
  { key: "name", label: "Property name" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "pinCode", label: "PIN code" },
];

function toForm(client: Client): ClientForm {
  return {
    hotelDescription: client.hotelDescription ?? "",
    hotelEmail: client.hotelEmail ?? "",
    hotelPhone: client.hotelPhone ?? "",
    marketingEmail: client.marketingEmail ?? "",
    properties: Object.fromEntries(
      client.properties.map((p) => [
        formKey(p.hid),
        {
          name: p.name ?? "",
          city: p.city ?? "",
          state: p.state ?? "",
          country: p.country ?? "",
          pinCode: p.pinCode ?? "",
        },
      ]),
    ),
  };
}

/** Only what the person touched, so two staff editing different fields don't overwrite each other. */
function changedFields(
  values: ClientForm,
  dirty: Partial<FieldNamesMarkedBoolean<ClientForm>>,
): ClientChanges {
  const changes: ClientChanges = {};
  for (const key of [
    "hotelDescription",
    "hotelEmail",
    "hotelPhone",
    "marketingEmail",
  ] as const) {
    if (dirty[key]) changes[key] = values[key];
  }
  for (const [property, fields] of Object.entries(dirty.properties ?? {})) {
    for (const [key, isDirty] of Object.entries(fields ?? {})) {
      if (!isDirty) continue;
      changes.properties ??= {};
      (changes.properties[hidOf(property)] ??= {})[key as PropertyKey] =
        values.properties[property]?.[key as PropertyKey];
    }
  }
  return changes;
}

function ReadOnly({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value ?? "-"}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function ClientEditor({ client }: { client: Client }) {
  const queryClient = useQueryClient();
  const canEdit =
    useAuthStore((state) => state.user?.permissions.includes("clients.edit")) ??
    false;
  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: toForm(client),
  });
  const { errors, isDirty } = form.formState;

  const save = useMutation({
    mutationFn: (values: ClientForm) =>
      clientsApi.update(
        client.ndid,
        changedFields(values, form.formState.dirtyFields),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData(["clients", "one", client.ndid], saved);
      void queryClient.invalidateQueries({ queryKey: ["clients", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      form.reset(toForm(saved));
      toast.success("Saved");
    },
  });

  const text = (
    name: Parameters<typeof form.register>[0],
    label: string,
    error?: { message?: string },
    type = "text",
  ) => (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        type={type}
        disabled={!canEdit}
        aria-invalid={Boolean(error)}
        {...form.register(name)}
      />
      <FieldError errors={[error]} />
    </Field>
  );

  return (
    <form
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      noValidate
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Hotel profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text("hotelEmail", "Hotel email", errors.hotelEmail, "email")}
          {text("hotelPhone", "Hotel phone", errors.hotelPhone, "tel")}
          {text(
            "marketingEmail",
            "Marketing email",
            errors.marketingEmail,
            "email",
          )}
          <Field
            className="sm:col-span-2"
            data-invalid={Boolean(errors.hotelDescription)}
          >
            <FieldLabel htmlFor="hotelDescription">Description</FieldLabel>
            <textarea
              id="hotelDescription"
              rows={4}
              disabled={!canEdit}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              {...form.register("hotelDescription")}
            />
            <FieldError errors={[errors.hotelDescription]} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {client.properties.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This client has no properties.
            </p>
          )}
          {client.properties.map((property) => (
            <fieldset key={property.hid} className="space-y-3">
              <legend className="mb-2 text-sm font-medium">
                {property.name ?? "Unnamed property"}{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  hid {property.hid}
                </span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PROPERTY_FIELDS.map(({ key, label }) => (
                  <Field key={key}>
                    <FieldLabel htmlFor={`p-${property.hid}-${key}`}>
                      {label}
                    </FieldLabel>
                    <Input
                      id={`p-${property.hid}-${key}`}
                      disabled={!canEdit}
                      {...form.register(
                        `properties.${formKey(property.hid)}.${key}`,
                      )}
                    />
                    {key === "name" && (
                      <FieldDescription>
                        What the dashboards show for this property, not its
                        street address.
                      </FieldDescription>
                    )}
                  </Field>
                ))}
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      {save.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {save.error.message}
        </p>
      )}

      {canEdit && (
        <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || save.isPending}
            onClick={() => form.reset()}
          >
            Undo changes
          </Button>
          <Button type="submit" disabled={!isDirty || save.isPending}>
            {save.isPending && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            )}
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}

/** Shown on a client in the trash: who moved it, why, and a way back. */
function TrashBanner({ ndid, trash }: { ndid: string; trash: TrashInfo }) {
  const canTrash = useAuthStore((state) => state.user?.permissions.includes("clients.trash")) ?? false;
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: () => clientBulkApi.run("restore", [ndid]),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      const [row] = result.results;
      if (row?.ok) toast.success(row.note ? `Restored. ${row.note}` : "Restored: back in the lists, subscription resumed");
      else toast.error(row?.message ?? "Could not restore this client");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p>
        <span className="font-semibold">In the trash</span> since {formatDay(trash.trashedAt)}, moved by {trash.by}
        {trash.reason ? ` (${trash.reason})` : ""}. Hidden from every list
        {trash.pausedSubscription ? ", subscription paused" : ""}; nothing is deleted.
      </p>
      {canTrash && (
        <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate()}>
          Restore
        </Button>
      )}
    </div>
  );
}

export function ClientPage() {
  const { ndid } = useParams<{ ndid: string }>();
  const canSeeServices = useAuthStore((state) =>
    state.user?.permissions.includes("subscriptions.view"),
  );
  const client = useQuery({
    queryKey: ["clients", "one", ndid],
    queryFn: () => clientsApi.get(ndid),
  });

  const back = <BackLink />;

  if (client.isPending) return <TableLoading />;
  if (client.error) {
    const missing =
      client.error instanceof ApiError &&
      client.error.code === "CLIENT_NOT_FOUND";
    return (
      <>
        {back}
        {missing ? (
          <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            This client doesn&apos;t exist, or none of its properties are
            assigned to you.
          </p>
        ) : (
          <LoadFailed
            error={client.error}
            onRetry={() => void client.refetch()}
          />
        )}
      </>
    );
  }

  const data = client.data;
  return (
    <>
      {back}
      {data.trash && <TrashBanner ndid={data.ndid} trash={data.trash} />}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
            {data.hotelName ?? "Unnamed hotel"}
          </h1>
          {data.domain && (
            <a
              href={`https://${data.domain}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-brand-orange hover:underline"
            >
              {data.domain}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.isVerified ? "secondary" : "outline"}>
            {data.isVerified ? "Verified" : "Not verified"}
          </Badge>
          {data.owner?.isActive && (
            <OpenAccountButton ndid={data.ndid} hotelName={data.hotelName} />
          )}
        </div>
      </div>

      <Card className="mb-4">
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadOnly
              label="Account holder"
              value={
                data.owner
                  ? `${data.owner.name ?? ""} ${data.owner.email}`.trim()
                  : "No account found"
              }
              hint={
                data.owner && !data.owner.isActive
                  ? "Account is turned off"
                  : undefined
              }
            />
            <ReadOnly label="Currency" value={data.currency} />
            <ReadOnly
              label="Onboarded"
              value={data.onboardedAt ? formatDateTime(data.onboardedAt) : null}
            />
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            The hotel name, domain and login email can&apos;t be changed here
            yet; the plan is in Subscription below. ndid{" "}
            <span className="font-mono">{data.ndid}</span>
          </p>
        </CardContent>
      </Card>

      {canSeeServices && <SubscriptionCard ndid={data.ndid} />}
      {canSeeServices && <AppsCard ndid={data.ndid} />}
      <ClientPayments ndid={data.ndid} />
      {canSeeServices && (
        <ServicesCard ndid={data.ndid} hotelName={data.hotelName} />
      )}
      <TeamPhonesCard ndid={data.ndid} />
      <LeadAlertsCard ndid={data.ndid} hotelName={data.hotelName} />

      <ClientEditor key={data.ndid} client={data} />

      <DeleteClientCard ndid={data.ndid} hotelName={data.hotelName} />
    </>
  );
}

/** The hotel's payments, for staff with billing.view. */
function ClientPayments({ ndid }: { ndid: string }) {
  const canSeeBilling = useCan("billing.view");
  return canSeeBilling ? <PaymentsTable ndid={ndid} title="Plan payments" /> : null;
}
