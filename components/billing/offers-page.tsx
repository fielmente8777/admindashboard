"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { billingApi, rupees, type AdminCatalogue, type Offer, type OfferInput, type PurchaseKind } from "@/lib/api/billing-api";
import { formatDay } from "@/lib/api/subscriptions-api";

import { BillingNav, useCan } from "./billing-nav";
import { NoBillingAccess } from "./billing-overview-page";
import { Toggle } from "./plan-dialog";

const KINDS: { value: PurchaseKind; label: string }[] = [
  { value: "new", label: "New plans" },
  { value: "renew", label: "Renewals" },
  { value: "change", label: "Plan changes" },
];

const TYPES = [
  { value: "percent", label: "Percent off" },
  { value: "flat", label: "Rupees off" },
];

function offerState(o: Offer): { label: string; tone: string } {
  const now = Date.now();
  if (!o.isActive) return { label: "Off", tone: "bg-slate-100 text-slate-600" };
  if (o.endsAt && Date.parse(o.endsAt) <= now) return { label: "Ended", tone: "bg-slate-100 text-slate-600" };
  if (o.startsAt && Date.parse(o.startsAt) > now) return { label: "Scheduled", tone: "bg-sky-50 text-sky-700" };
  if (o.maxRedemptions != null && o.redemptions >= o.maxRedemptions) return { label: "Used up", tone: "bg-slate-100 text-slate-600" };
  return { label: "Live", tone: "bg-emerald-50 text-emerald-700" };
}

const discountText = (o: Pick<Offer, "type" | "value" | "maxDiscount">) =>
  o.type === "percent" ? `${o.value}% off${o.maxDiscount ? ` (max ${rupees(o.maxDiscount)})` : ""}` : `${rupees(o.value)} off`;

export function OffersPage() {
  const canView = useCan("billing.view");
  const canManage = useCan("billing.manage");
  const catalogue = useQuery({ queryKey: ["billing", "catalogue"], queryFn: () => billingApi.catalogue(), enabled: canView });
  const [editing, setEditing] = useState<Offer | "new" | null>(null);

  if (!canView) return <NoBillingAccess />;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Discount codes hotels type at checkout. The server checks every rule before it takes a payment."
        action={
          canManage && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> New offer
            </Button>
          )
        }
      />
      <BillingNav />
      {catalogue.isError ? (
        <LoadFailed error={catalogue.error} onRetry={() => void catalogue.refetch()} />
      ) : !catalogue.data ? (
        <TableLoading />
      ) : (
        <Card>
          <CardContent>
            {catalogue.data.offers.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No offers yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="text-right">Used</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogue.data.offers.map((o) => {
                    const state = offerState(o);
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <span className="block font-mono font-semibold">{o.code}</span>
                          <span className="block text-xs text-muted-foreground">{o.name}</span>
                        </TableCell>
                        <TableCell>{discountText(o)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {[
                            o.planCodes.length ? o.planCodes.join("/") : "every plan",
                            o.cycleMonths.length ? o.cycleMonths.map((m) => `${m} mo`).join("/") : null,
                            o.kinds.length ? o.kinds.join("/") : null,
                            o.firstPurchaseOnly ? "first purchase" : null,
                            o.ndids.length ? `${o.ndids.length} hotel(s) only` : null,
                            o.showOnPricing ? "on pricing page" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {o.startsAt ? formatDay(o.startsAt) : "Now"} → {o.endsAt ? formatDay(o.endsAt) : "no end"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.redemptions}
                          {o.maxRedemptions != null ? ` / ${o.maxRedemptions}` : ""}
                        </TableCell>
                        <TableCell>
                          <Badge className={state.tone}>{state.label}</Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${o.code}`} onClick={() => setEditing(o)}>
                              <Pencil className="size-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      {editing && catalogue.data && <OfferDialog offer={editing === "new" ? null : editing} catalogue={catalogue.data} onClose={() => setEditing(null)} />}
    </>
  );
}

const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

function OfferDialog({ offer, catalogue, onClose }: { offer: Offer | null; catalogue: AdminCatalogue; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OfferInput>(
    offer
      ? (Object.fromEntries(Object.entries(offer).filter(([key]) => !["id", "redemptions", "createdAt"].includes(key))) as OfferInput)
      : {
          code: "",
          name: "",
          description: "",
          type: "percent",
          value: 10,
          maxDiscount: null,
          planCodes: [],
          cycleMonths: [],
          kinds: [],
          firstPurchaseOnly: false,
          ndids: [],
          startsAt: null,
          endsAt: null,
          maxRedemptions: null,
          perClientLimit: 1,
          isActive: true,
          showOnPricing: false,
        },
  );
  const [ndids, setNdids] = useState(form.ndids.join("\n"));
  const set = <K extends keyof OfferInput>(key: K, value: OfferInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = <T,>(list: T[], item: T, on: boolean) => (on ? [...list, item] : list.filter((x) => x !== item));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, ndids: ndids.split("\n").map((l) => l.trim()).filter(Boolean) };
      return offer ? billingApi.updateOffer(offer.id, body) : billingApi.createOffer(body);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(`Saved ${saved.code}`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const plans = catalogue.plans.filter((p) => p.isActive && p.code !== "TRIAL");
  const cycles = catalogue.settings.cycles;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{offer ? `Edit ${offer.code}` : "New offer"}</DialogTitle>
          <DialogDescription>Hotels type the code on their plans page. Empty rules mean “any”.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="offer-code">Code</FieldLabel>
              <Input id="offer-code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="DIWALI25" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-name">Name</FieldLabel>
              <Input id="offer-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Diwali sale" required />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="offer-description">Shown to hotels</FieldLabel>
            <Input id="offer-description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="25% off any yearly plan until 15 November" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select items={TYPES} value={form.type} onValueChange={(v) => v && set("type", v as OfferInput["type"])}>
                <SelectTrigger className="w-full" aria-label="Type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-value">{form.type === "percent" ? "Percent" : "Rupees"}</FieldLabel>
              <Input id="offer-value" type="number" min={1} value={form.value} onChange={(e) => set("value", Number(e.target.value))} />
            </Field>
            {form.type === "percent" && (
              <Field>
                <FieldLabel htmlFor="offer-cap">Max discount ₹</FieldLabel>
                <Input id="offer-cap" type="number" min={0} value={form.maxDiscount ?? ""} placeholder="no cap" onChange={(e) => set("maxDiscount", e.target.value ? Number(e.target.value) : null)} />
              </Field>
            )}
          </div>

          <FieldSet>
            <FieldLegend variant="label">Works with</FieldLegend>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {plans.map((p) => (
                <label key={p.id} className="flex items-center gap-2">
                  <Checkbox checked={form.planCodes.includes(p.code)} onCheckedChange={(c) => set("planCodes", toggle(form.planCodes, p.code, Boolean(c)))} />
                  {p.name}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {cycles.map((c) => (
                <label key={c.months} className="flex items-center gap-2">
                  <Checkbox checked={form.cycleMonths.includes(c.months)} onCheckedChange={(on) => set("cycleMonths", toggle(form.cycleMonths, c.months, Boolean(on)))} />
                  {c.label}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {KINDS.map((k) => (
                <label key={k.value} className="flex items-center gap-2">
                  <Checkbox checked={form.kinds.includes(k.value)} onCheckedChange={(on) => set("kinds", toggle(form.kinds, k.value, Boolean(on)))} />
                  {k.label}
                </label>
              ))}
            </div>
          </FieldSet>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="offer-start">Starts</FieldLabel>
              <Input id="offer-start" type="datetime-local" value={toLocalInput(form.startsAt)} onChange={(e) => set("startsAt", fromLocalInput(e.target.value))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-end">Ends</FieldLabel>
              <Input id="offer-end" type="datetime-local" value={toLocalInput(form.endsAt)} onChange={(e) => set("endsAt", fromLocalInput(e.target.value))} />
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-max">Total uses</FieldLabel>
              <Input id="offer-max" type="number" min={1} placeholder="unlimited" value={form.maxRedemptions ?? ""} onChange={(e) => set("maxRedemptions", e.target.value ? Number(e.target.value) : null)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="offer-per">Uses per hotel</FieldLabel>
              <Input id="offer-per" type="number" min={1} placeholder="unlimited" value={form.perClientLimit ?? ""} onChange={(e) => set("perClientLimit", e.target.value ? Number(e.target.value) : null)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="On" hint="Off stops it at once" checked={form.isActive} onChange={(v) => set("isActive", v)} />
            <Toggle label="First purchase only" hint="For hotels that never paid" checked={form.firstPurchaseOnly} onChange={(v) => set("firstPurchaseOnly", v)} />
            <Toggle label="Show on pricing pages" hint="A banner on the website and plans page" checked={form.showOnPricing} onChange={(v) => set("showOnPricing", v)} />
          </div>

          <Field>
            <FieldLabel htmlFor="offer-ndids">Only for these hotels (ndid, one per line)</FieldLabel>
            <textarea id="offer-ndids" rows={2} className="w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-xs" value={ndids} onChange={(e) => setNdids(e.target.value)} />
            <FieldDescription>Empty = everyone. A private code still has to be typed by the hotel.</FieldDescription>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save offer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
