"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { ExternalLink, FilePlus2, LoaderCircle, Plug, RefreshCw, Unplug } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { billingApi, exactRupees } from "@/lib/api/billing-api";
import {
  zohoApi,
  type PaymentProvider,
  type ZohoCustomerRow,
  type ZohoInvoice,
  type ZohoInvoiceState,
  type ZohoMadeInvoice,
  type ZohoStatus,
} from "@/lib/api/zoho-api";
import { formatDateTime } from "@/lib/format";

import { BillingNav, useCan } from "./billing-nav";
import { NoBillingAccess } from "./billing-overview-page";
import { ClientPicker } from "./client-picker";

const RESULT_TEXT: Record<string, string> = {
  connected: "Zoho Books is connected.",
  denied: "Zoho sign-in was cancelled.",
  expired: "That sign-in took too long or was already used. Try Connect again.",
  no_refresh_token: "Zoho didn't give a lasting sign-in. Remove Eazotel from Zoho's connected apps and connect again.",
  no_organization: "This Zoho account has no Books organisation.",
  failed: "Connecting failed. Check the Zoho client id, secret and redirect URI on the server.",
  invalid: "Zoho sent the browser back without a code.",
};

type Client = { ndid: string; hotelName: string | null };

function useInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [["zoho"], ["billing"], ["subscriptions"], ["activity"]]) void queryClient.invalidateQueries({ queryKey: key });
  };
}

export function ZohoPage() {
  const canView = useCan("billing.view");
  const canManage = useCan("billing.manage");
  const params = useSearchParams();
  const status = useQuery({ queryKey: ["zoho", "status"], queryFn: () => zohoApi.status(), enabled: canView });

  useEffect(() => {
    const result = params.get("zoho");
    if (!result) return;
    if (result === "connected") toast.success(RESULT_TEXT.connected);
    else toast.error(RESULT_TEXT[result] ?? "Connecting Zoho Books didn't work.");
    window.history.replaceState(null, "", "/billing/zoho");
  }, [params]);

  if (!canView) return <NoBillingAccess />;
  return (
    <>
      <PageHeader
        title="Billing"
        description="Zoho Books: invoices and payments in Zoho, plans renewed here automatically. Switch where hotels pay with one click."
      />
      <BillingNav />
      {status.isError ? (
        <LoadFailed error={status.error} onRetry={() => void status.refetch()} />
      ) : !status.data ? (
        <TableLoading />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <ConnectionCard status={status.data} canManage={canManage} />
            <ProviderCard status={status.data} canManage={canManage} />
          </div>
          {status.data.connected && (
            <>
              <InvoicesCard canManage={canManage} />
              {canManage && <CustomersCard />}
            </>
          )}
        </div>
      )}
    </>
  );
}

function ConnectionCard({ status, canManage }: { status: ZohoStatus; canManage: boolean }) {
  const invalidate = useInvalidate();
  const taxes = useQuery({ queryKey: ["zoho", "taxes"], queryFn: () => zohoApi.taxes(), enabled: status.connected && canManage });
  const connect = useMutation({
    mutationFn: () => zohoApi.connect(),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => toast.error(error.message),
  });
  const disconnect = useMutation({
    mutationFn: () => zohoApi.disconnect(),
    onSuccess: (s) => {
      invalidate();
      toast.success(s.payment.provider === "razorpay" ? "Disconnected. Hotels pay by Razorpay." : "Disconnected.");
    },
    onError: (error) => toast.error(error.message),
  });
  const setTax = useMutation({
    mutationFn: (taxId: string | null) => zohoApi.setTax(taxId),
    onSuccess: () => {
      invalidate();
      toast.success("Tax saved");
    },
    onError: (error) => toast.error(error.message),
  });
  const sync = useMutation({
    mutationFn: () => zohoApi.sync(),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Checked ${r.checked} paid invoices: ${r.applied} applied, ${r.needsReview} waiting for you`);
    },
    onError: (error) => toast.error(error.message),
  });
  const webhookUrl = status.redirectUri.replace("/zoho/callback", "/webhooks/zoho?token=<ZOHO_WEBHOOK_TOKEN>");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Zoho Books
          <Badge variant={status.connected ? "default" : "outline"}>{status.connected ? "Connected" : "Not connected"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {!status.configured ? (
          <p className="text-muted-foreground">
            The server isn&apos;t set up for Zoho yet. A developer adds <code>ZOHO_CLIENT_ID</code>,{" "}
            <code>ZOHO_CLIENT_SECRET</code>, <code>ZOHO_TOKEN_KEY</code> and <code>ZOHO_WEBHOOK_TOKEN</code>, with this
            redirect URI registered in Zoho&apos;s API console: <code className="break-all">{status.redirectUri}</code>
          </p>
        ) : status.connected ? (
          <>
            <p>
              <span className="font-medium">{status.orgName}</span>, connected by {status.connectedBy}
              {status.connectedAt ? ` on ${formatDateTime(status.connectedAt)}` : ""}.
            </p>
            <p className="text-muted-foreground">
              Last check: {status.lastSyncAt ? formatDateTime(status.lastSyncAt) : "not yet"}
              {status.lastSyncError ? ` (failed: ${status.lastSyncError})` : ""}. Paid invoices are read every 30 minutes.
            </p>
            {canManage && (
              <Field>
                <FieldLabel>GST on every Zoho invoice line</FieldLabel>
                <Select
                  items={[{ value: "", label: "No tax line" }, ...(taxes.data ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.percentage}%)` }))]}
                  value={status.taxId ?? ""}
                  onValueChange={(v) => setTax.mutate(v ? String(v) : null)}
                >
                  <SelectTrigger className="w-full" aria-label="GST tax">
                    <SelectValue placeholder={status.taxName ?? "No tax line"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No tax line</SelectItem>
                    {(taxes.data ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.percentage}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Pick the 18% GST tax so Zoho&apos;s totals match the plans page.</FieldDescription>
              </Field>
            )}
            {!status.webhookReady && (
              <p className="rounded-lg bg-amber-50 p-2 text-amber-900">
                ZOHO_WEBHOOK_TOKEN isn&apos;t set, so payments are picked up by the 30-minute check only.
              </p>
            )}
            <details className="text-muted-foreground">
              <summary className="cursor-pointer">Instant updates: the Zoho webhook</summary>
              <p className="mt-2">
                In Zoho Books → Settings → Automation → Workflow rules, add a rule for Invoices &quot;when payment is
                received&quot; with a webhook POST to <code className="break-all">{webhookUrl}</code> and the body{" "}
                <code>{'{"invoice_id": "${invoice.invoice_id}"}'}</code>.
              </p>
            </details>
          </>
        ) : (
          <p className="text-muted-foreground">
            Connect Eazotel&apos;s Zoho Books once. You sign in with a Zoho admin account; Zoho sends you back here.
          </p>
        )}
        {canManage && status.configured && (
          <div className="flex flex-wrap gap-2">
            {status.connected ? (
              <>
                <Button variant="outline" size="sm" disabled={sync.isPending} onClick={() => sync.mutate()}>
                  <RefreshCw data-icon="inline-start" className={cn(sync.isPending && "animate-spin")} aria-hidden />
                  Sync now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disconnect.isPending}
                  onClick={() => {
                    if (window.confirm("Disconnect Zoho Books? If hotels pay through Zoho, payments go back to Razorpay.")) disconnect.mutate();
                  }}
                >
                  <Unplug data-icon="inline-start" aria-hidden />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={connect.isPending} onClick={() => connect.mutate()}>
                <Plug data-icon="inline-start" aria-hidden />
                Connect Zoho Books
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PROVIDERS: { value: PaymentProvider; title: string; text: string }[] = [
  {
    value: "razorpay",
    title: "Razorpay in the dashboard",
    text: "Hotels pay on the plans page and can turn on auto-renew. We issue the GST invoice.",
  },
  {
    value: "zoho",
    title: "Zoho Books invoice",
    text: "The pay button makes a Zoho invoice at the same price and opens Zoho's payment page. The plan renews as soon as Zoho says it's paid. Auto-renew can't be turned on meanwhile; existing mandates keep charging.",
  },
];

function ProviderCard({ status, canManage }: { status: ZohoStatus; canManage: boolean }) {
  const invalidate = useInvalidate();
  const [asking, setAsking] = useState<PaymentProvider | null>(null);
  const change = useMutation({
    mutationFn: (provider: PaymentProvider) => zohoApi.setProvider(provider),
    onSuccess: (s) => {
      invalidate();
      setAsking(null);
      toast.success(s.payment.provider === "zoho" ? "Hotels now pay by Zoho invoice" : "Hotels now pay by Razorpay");
    },
    onError: (error) => toast.error(error.message),
  });
  const current = status.payment.provider;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where hotels pay</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {PROVIDERS.map((p) => {
          const active = current === p.value;
          const disabled = !canManage || active || (p.value === "zoho" && !status.connected);
          return (
            <button
              key={p.value}
              type="button"
              disabled={disabled}
              onClick={() => setAsking(p.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                active ? "border-brand-orange bg-orange-50/50" : "hover:bg-muted/50",
                disabled && !active && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {p.title}
                {active && <Badge>Now</Badge>}
              </span>
              <span className="mt-1 block text-muted-foreground">{p.text}</span>
            </button>
          );
        })}
        {!status.connected && <p className="text-xs text-muted-foreground">Connect Zoho Books to switch.</p>}
        {status.payment.changedBy && (
          <p className="text-xs text-muted-foreground">
            Changed by {status.payment.changedBy}
            {status.payment.changedAt ? `, ${formatDateTime(status.payment.changedAt)}` : ""}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Whichever is on, staff can always make a Zoho invoice for a client below, and invoices the team makes in Zoho
          are picked up.
        </p>
      </CardContent>
      {asking && (
        <Dialog open onOpenChange={(open) => !open && setAsking(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Switch hotels to {asking === "zoho" ? "Zoho Books invoices" : "Razorpay"}?</DialogTitle>
              <DialogDescription>
                From the next click on a hotel&apos;s pay button. Payments already started finish the way they began. You
                can switch back at any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAsking(null)}>
                Cancel
              </Button>
              <Button disabled={change.isPending} onClick={() => change.mutate(asking)}>
                {change.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                Switch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

const STATES: { value: ZohoInvoiceState; label: string }[] = [
  { value: "review", label: "Waiting for you" },
  { value: "applied", label: "Applied" },
  { value: "open", label: "Not paid yet" },
];

function InvoicesCard({ canManage }: { canManage: boolean }) {
  const invalidate = useInvalidate();
  const [state, setState] = useState<ZohoInvoiceState>("review");
  const [applying, setApplying] = useState<ZohoInvoice | null>(null);
  const [creating, setCreating] = useState(false);
  const invoices = useQuery({ queryKey: ["zoho", "invoices", state], queryFn: () => zohoApi.invoices(state) });
  const ignore = useMutation({
    mutationFn: (id: string) => zohoApi.ignore(id),
    onSuccess: () => {
      invalidate();
      toast.success("Set aside: it won't renew anything");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Zoho invoices</CardTitle>
        {canManage && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <FilePlus2 data-icon="inline-start" aria-hidden />
            New Zoho invoice
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-1">
          {STATES.map((s) => (
            <Button key={s.value} size="sm" variant={state === s.value ? "default" : "outline"} onClick={() => setState(s.value)}>
              {s.label}
            </Button>
          ))}
        </div>
        {state === "review" && (
          <p className="mb-3 text-sm text-muted-foreground">
            Invoices the team made in Zoho Books that are paid. Say which plan each pays for, and the client&apos;s
            subscription is renewed. Invoices made from the dashboard or here renew by themselves.
          </p>
        )}
        {invoices.isPending ? (
          <TableLoading />
        ) : invoices.isError ? (
          <LoadFailed error={invoices.error} onRetry={() => void invoices.refetch()} />
        ) : invoices.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Zoho customer</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="text-right">{state === "review" ? "Action" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.data.map((inv) => (
                <TableRow key={inv.invoiceId}>
                  <TableCell className="text-sm">
                    {inv.invoiceUrl ? (
                      <a href={inv.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-navy hover:underline">
                        {inv.number} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : (
                      <span className="font-medium">{inv.number}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {inv.invoiceDate} · {inv.source === "checkout" ? "made by us" : "made in Zoho"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    {inv.contactName}
                    {inv.lines.length > 0 && <div className="text-xs text-muted-foreground">{inv.lines.join(", ")}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{inv.hotelName ?? (inv.ndid ? inv.ndid : <span className="text-muted-foreground">not linked</span>)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{exactRupees(inv.totalPaise)}</TableCell>
                  <TableCell className="text-right">
                    {state === "review" && canManage ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setApplying(inv)}>
                          Apply
                        </Button>
                        <Button size="sm" variant="ghost" disabled={ignore.isPending} onClick={() => ignore.mutate(inv.invoiceId)}>
                          Not a plan
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {inv.appliedAt ? `applied ${formatDateTime(inv.appliedAt)}` : inv.status}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {applying && <ApplyDialog invoice={applying} onClose={() => setApplying(null)} />}
      {creating && <NewInvoiceDialog onClose={() => setCreating(false)} />}
    </Card>
  );
}

/** Plan and billing period pickers, from the catalogue. */
function PlanFields({
  planId,
  months,
  onPlan,
  onMonths,
}: {
  planId: string;
  months: number;
  onPlan: (id: string) => void;
  onMonths: (m: number) => void;
}) {
  const catalogue = useQuery({ queryKey: ["billing", "catalogue"], queryFn: () => billingApi.catalogue() });
  const plans = (catalogue.data?.plans ?? []).filter((p) => p.isActive && p.code !== "TRIAL");
  const cycles = (catalogue.data?.settings.cycles ?? []).filter((c) => c.isActive);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel>Plan</FieldLabel>
        <Select items={plans.map((p) => ({ value: p.id, label: p.name }))} value={planId} onValueChange={(v) => v && onPlan(String(v))}>
          <SelectTrigger className="w-full" aria-label="Plan">
            <SelectValue placeholder="Pick a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Period</FieldLabel>
        <Select items={cycles.map((c) => ({ value: String(c.months), label: c.label }))} value={String(months)} onValueChange={(v) => v && onMonths(Number(v))}>
          <SelectTrigger className="w-full" aria-label="Billing period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {cycles.map((c) => (
              <SelectItem key={c.months} value={String(c.months)}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function ApplyDialog({ invoice, onClose }: { invoice: ZohoInvoice; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [client, setClient] = useState<Client | null>(invoice.ndid ? { ndid: invoice.ndid, hotelName: invoice.hotelName } : null);
  const [planId, setPlanId] = useState(invoice.suggestion?.planId ?? "");
  const [months, setMonths] = useState(invoice.suggestion?.cycleMonths ?? 12);
  const apply = useMutation({
    mutationFn: () => zohoApi.apply(invoice.invoiceId, { ndid: client!.ndid, planId, cycleMonths: months, addonCodes: [], seats: 0 }),
    onSuccess: () => {
      invalidate();
      toast.success(`${client?.hotelName ?? "The client"}'s plan was renewed for invoice ${invoice.number}`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply {invoice.number}</DialogTitle>
          <DialogDescription>
            {invoice.contactName} paid {exactRupees(invoice.totalPaise)}. The same plan is added after the current end; a
            different plan starts today.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Client</FieldLabel>
            <ClientPicker value={client} onChange={setClient} />
            {!invoice.ndid && <FieldDescription>This Zoho customer gets linked to the client, so the next invoice is prefilled.</FieldDescription>}
          </Field>
          <PlanFields planId={planId} months={months} onPlan={setPlanId} onMonths={setMonths} />
          {invoice.suggestion && (
            <p className="text-xs text-muted-foreground">
              Suggested from their current plan ({invoice.suggestion.planName}) and the amount: {invoice.suggestion.cycleMonths} months.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!client || !planId || apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
            Renew the plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewInvoiceDialog({ onClose }: { onClose: () => void }) {
  const invalidate = useInvalidate();
  const [client, setClient] = useState<Client | null>(null);
  const [planId, setPlanId] = useState("");
  const [months, setMonths] = useState(12);
  const [emails, setEmails] = useState("");
  const [made, setMade] = useState<ZohoMadeInvoice | null>(null);
  const create = useMutation({
    mutationFn: () =>
      zohoApi.createInvoice(client!.ndid, {
        planId,
        cycleMonths: months,
        addonCodes: [],
        seats: 0,
        offerCode: null,
        emailTo: emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean),
      }),
    onSuccess: (result) => {
      invalidate();
      setMade(result);
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Zoho invoice</DialogTitle>
          <DialogDescription>
            Priced exactly like the hotel&apos;s plans page, with GST. When it&apos;s paid in Zoho, the client&apos;s plan
            renews by itself.
          </DialogDescription>
        </DialogHeader>
        {made ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Invoice <span className="font-medium">{made.invoiceNumber}</span> for {exactRupees(made.totalPaise)} is in Zoho
              Books.
            </p>
            {made.invoiceUrl && (
              <p className="flex flex-wrap items-center gap-2">
                <a href={made.invoiceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-navy hover:underline">
                  Open the payment page <ExternalLink className="size-3" aria-hidden />
                </a>
                <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(made.invoiceUrl!).then(() => toast.success("Link copied"))}>
                  Copy link
                </Button>
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Client</FieldLabel>
              <ClientPicker value={client} onChange={setClient} />
            </Field>
            <PlanFields planId={planId} months={months} onPlan={setPlanId} onMonths={setMonths} />
            <Field>
              <FieldLabel htmlFor="zi-emails">Zoho emails it to</FieldLabel>
              <Input id="zi-emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="accounts@hotel.com" />
              <FieldDescription>Empty: share the link yourself.</FieldDescription>
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {made ? "Done" : "Cancel"}
          </Button>
          {!made && (
            <Button disabled={!client || !planId || create.isPending} onClick={() => create.mutate()}>
              {create.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
              Create invoice
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomersCard() {
  const invalidate = useInvalidate();
  const customers = useQuery({ queryKey: ["zoho", "customers"], queryFn: () => zohoApi.customers() });
  const [filter, setFilter] = useState("");
  const [linking, setLinking] = useState<ZohoCustomerRow | null>(null);
  const link = useMutation({
    mutationFn: ({ ndid, contactId }: { ndid: string; contactId: string }) => zohoApi.link(ndid, contactId),
    onSuccess: () => {
      invalidate();
      setLinking(null);
      toast.success("Linked");
    },
    onError: (error) => toast.error(error.message),
  });
  const unlink = useMutation({
    mutationFn: (ndid: string) => zohoApi.unlink(ndid),
    onSuccess: () => {
      invalidate();
      toast.success("Unlinked");
    },
    onError: (error) => toast.error(error.message),
  });

  const needle = filter.trim().toLowerCase();
  const rows = (customers.data?.items ?? []).filter(
    (r) => !needle || r.contact.name.toLowerCase().includes(needle) || (r.linked?.hotelName ?? "").toLowerCase().includes(needle),
  );
  const linkedCount = (customers.data?.items ?? []).filter((r) => r.linked).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zoho customers and clients</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Link each Zoho customer to its client once (e.g. Zoho&apos;s &quot;Green Castle Resort&quot; → Greencastle). Then
          every invoice of that customer is known to be theirs. Suggestions come from the same email or a similar name.
          {customers.data ? ` ${linkedCount} of ${customers.data.items.length} linked.` : ""}
        </p>
        <Input className="mb-3 max-w-sm" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" aria-label="Filter customers" />
        {customers.isPending ? (
          <TableLoading />
        ) : customers.isError ? (
          <LoadFailed error={customers.error} onRetry={() => void customers.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zoho customer</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.contact.contactId}>
                  <TableCell className="text-sm">
                    <span className="font-medium">{row.contact.name}</span>
                    {row.contact.email && <div className="text-xs text-muted-foreground">{row.contact.email}</div>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.linked ? (
                      (row.linked.hotelName ?? row.linked.ndid)
                    ) : row.suggestion ? (
                      <span className="text-muted-foreground">
                        Maybe <span className="font-medium text-foreground">{row.suggestion.hotelName}</span> ({row.suggestion.why})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">not linked</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {row.linked ? (
                        <Button size="sm" variant="ghost" disabled={unlink.isPending} onClick={() => unlink.mutate(row.linked!.ndid)}>
                          Unlink
                        </Button>
                      ) : (
                        <>
                          {row.suggestion && (
                            <Button size="sm" disabled={link.isPending} onClick={() => link.mutate({ ndid: row.suggestion!.ndid, contactId: row.contact.contactId })}>
                              Link
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setLinking(row)}>
                            Link to…
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {linking && (
        <LinkDialog
          row={linking}
          busy={link.isPending}
          onClose={() => setLinking(null)}
          onLink={(ndid) => link.mutate({ ndid, contactId: linking.contact.contactId })}
        />
      )}
    </Card>
  );
}

function LinkDialog({ row, busy, onClose, onLink }: { row: ZohoCustomerRow; busy: boolean; onClose: () => void; onLink: (ndid: string) => void }) {
  const [client, setClient] = useState<Client | null>(row.suggestion ? { ndid: row.suggestion.ndid, hotelName: row.suggestion.hotelName } : null);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which client is &quot;{row.contact.name}&quot;?</DialogTitle>
          <DialogDescription>Either side&apos;s earlier link is replaced.</DialogDescription>
        </DialogHeader>
        <ClientPicker value={client} onChange={setClient} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!client || busy} onClick={() => client && onLink(client.ndid)}>
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
