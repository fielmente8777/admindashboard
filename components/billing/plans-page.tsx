"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  billingApi,
  limitText,
  rupees,
  type BillingCycle,
  type BillingSettings,
  type CatalogueApp,
  type CataloguePlan,
} from "@/lib/api/billing-api";
import { formatDateTime } from "@/lib/format";

import { BillingNav, useCan } from "./billing-nav";
import { NoBillingAccess } from "./billing-overview-page";
import { InvoiceDetailsCard } from "./invoice-details-card";
import { PlanDialog, Toggle } from "./plan-dialog";

export function PlansPage() {
  const canView = useCan("billing.view");
  const canManage = useCan("billing.manage");
  const catalogue = useQuery({ queryKey: ["billing", "catalogue"], queryFn: () => billingApi.catalogue(), enabled: canView });
  const [editingPlan, setEditingPlan] = useState<CataloguePlan | "new" | null>(null);
  const [editingApp, setEditingApp] = useState<CatalogueApp | "new" | null>(null);

  if (!canView) return <NoBillingAccess />;

  return (
    <>
      <PageHeader
        title="Billing"
        description="What each plan includes and costs. Changes apply to purchases and renewals from now on."
        action={
          canManage && (
            <Button onClick={() => setEditingPlan("new")}>
              <Plus className="size-4" /> New plan
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
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {catalogue.data.plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} apps={catalogue.data.apps} onEdit={canManage ? () => setEditingPlan(plan) : undefined} />
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle>Add-on apps</CardTitle>
                <CardDescription>Bought on top of a plan that doesn&apos;t include them. Prices are per month before GST.</CardDescription>
              </div>
              {canManage && (
                <Button variant="outline" onClick={() => setEditingApp("new")}>
                  <Plus className="size-4" /> New app
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Included in</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catalogue.data.apps.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <span className="block font-medium">{app.name}</span>
                        <span className="block max-w-sm truncate text-xs text-muted-foreground">{app.description}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{app.code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {catalogue.data.plans.filter((p) => p.isActive && p.includedApps.includes(app.code)).map((p) => p.name).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{rupees(app.price)}</TableCell>
                      <TableCell>{app.isActive ? <Badge className="bg-emerald-50 text-emerald-700">Available</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                      {canManage && (
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${app.name}`} onClick={() => setEditingApp(app)}>
                            <Pencil className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* a fresh form whenever the saved settings change */}
          <SettingsCard key={catalogue.data.settings.updatedAt ?? "default"} settings={catalogue.data.settings} canManage={canManage} />
          <InvoiceDetailsCard key={`invoice-${catalogue.data.settings.updatedAt ?? "default"}`} settings={catalogue.data.settings} canManage={canManage} />
        </div>
      )}

      {editingPlan && catalogue.data && (
        <PlanDialog plan={editingPlan === "new" ? null : editingPlan} apps={catalogue.data.apps} onClose={() => setEditingPlan(null)} />
      )}
      {editingApp && <AppDialog app={editingApp === "new" ? null : editingApp} onClose={() => setEditingApp(null)} />}
    </>
  );
}

function PlanCard({ plan, apps, onEdit }: { plan: CataloguePlan; apps: CatalogueApp[]; onEdit?: () => void }) {
  const included = apps.filter((a) => plan.includedApps.includes(a.code));
  return (
    <Card className={cn(!plan.isActive && "opacity-60", plan.featured && "ring-2 ring-brand-orange/40")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{plan.code}</p>
            <CardTitle className="mt-0.5 text-lg">{plan.name}</CardTitle>
          </div>
          {onEdit && (
            <Button variant="ghost" size="icon" aria-label={`Edit ${plan.name}`} onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
          )}
        </div>
        <p className="text-2xl font-bold text-brand-navy">
          {plan.isCustom && plan.price === 0 ? plan.customPriceLabel : rupees(plan.price)}
          {!(plan.isCustom && plan.price === 0) && <span className="text-sm font-normal text-muted-foreground"> / month</span>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {plan.featured && <Badge className="bg-orange-50 text-orange-700">Most popular</Badge>}
          {!plan.isPublic && <Badge variant="outline">Private{plan.visibleTo.length ? ` · ${plan.visibleTo.length} hotel(s)` : ""}</Badge>}
          {plan.isCustom && <Badge variant="outline">Contact sales</Badge>}
          {!plan.isActive && <Badge variant="destructive">Archived</Badge>}
          {plan.code === "TRIAL" && <Badge variant="secondary">Trial only</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {plan.tagline && <p className="text-muted-foreground">{plan.tagline}</p>}
        <div>
          <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Includes {included.length} apps</p>
          <ul className="space-y-1">
            {included.map((a) => (
              <li key={a.id} className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-600" aria-hidden /> {a.name}
              </li>
            ))}
            {included.length === 0 && <li className="text-muted-foreground">No apps; everything is an add-on</li>}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Team members</dt>
          <dd className="text-right">{limitText(plan.limits.teamMembers)}</dd>
          <dt className="text-muted-foreground">Properties</dt>
          <dd className="text-right">{limitText(plan.limits.properties)}</dd>
          <dt className="text-muted-foreground">AI credits / mo</dt>
          <dd className="text-right">{limitText(plan.limits.aiCreditsMonthly)}</dd>
          <dt className="text-muted-foreground">Support</dt>
          <dd className="text-right capitalize">{plan.support}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function AppDialog({ app, onClose }: { app: CatalogueApp | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    code: app?.code ?? "",
    name: app?.name ?? "",
    description: app?.description ?? "",
    price: app?.price ?? 500,
    isActive: app?.isActive ?? true,
    sortOrder: app?.sortOrder ?? 100,
  });
  const save = useMutation({
    mutationFn: () => {
      const { name, description, price, isActive, sortOrder } = form;
      return app ? billingApi.updateApp(app.id, { name, description, price, isActive, sortOrder }) : billingApi.createApp(form);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(`Saved ${saved.name}`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{app ? `Edit ${app.name}` : "New add-on app"}</DialogTitle>
          <DialogDescription>A new price applies to purchases and renewals from now on.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field>
            <FieldLabel htmlFor="app-code">Code</FieldLabel>
            <Input id="app-code" value={form.code} disabled={Boolean(app)} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} required />
            <FieldDescription>
              {app ? "The code can't change: the dashboard unlocks the app by it." : "The dashboard must know this code to lock and unlock the app."}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="app-name">Name</FieldLabel>
            <Input id="app-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="app-description">Description</FieldLabel>
            <Input id="app-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="app-price">Price (₹ / month)</FieldLabel>
              <Input id="app-price" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="app-order">Order</FieldLabel>
              <Input id="app-order" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </Field>
          </div>
          <Toggle label="Available" hint="Off: hotels can't add it any more" checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettingsCard({ settings, canManage }: { settings: BillingSettings; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(settings);
  const setCycle = (index: number, changes: Partial<BillingCycle>) =>
    setForm((f) => ({ ...f, cycles: f.cycles.map((c, i) => (i === index ? { ...c, ...changes } : c)) }));

  const save = useMutation({
    mutationFn: () =>
      billingApi.saveSettings({ gstPercent: form.gstPercent, seatPrice: form.seatPrice, trialDays: form.trialDays, cycles: form.cycles }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Billing settings saved");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing cycles, GST and seats</CardTitle>
        <CardDescription>
          A longer cycle earns its discount on the whole amount.
          {settings.updatedAt && ` Last saved ${formatDateTime(settings.updatedAt)}${settings.updatedBy ? ` by ${settings.updatedBy}` : ""}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="gst">GST %</FieldLabel>
            <Input id="gst" type="number" min={0} max={50} disabled={!canManage} value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="seat">Extra team seat (₹ / month)</FieldLabel>
            <Input id="seat" type="number" min={0} disabled={!canManage} value={form.seatPrice} onChange={(e) => setForm({ ...form, seatPrice: Number(e.target.value) })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="trial">Free trial (days)</FieldLabel>
            <Input id="trial" type="number" min={0} max={90} disabled={!canManage} value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: Number(e.target.value) })} />
            <FieldDescription>Shown on the pricing page.</FieldDescription>
          </Field>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Months</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Discount %</TableHead>
              <TableHead>Offered</TableHead>
              {canManage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {form.cycles.map((cycle, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input type="number" min={1} max={36} className="w-20" disabled={!canManage} value={cycle.months} aria-label="Months" onChange={(e) => setCycle(i, { months: Number(e.target.value) })} />
                </TableCell>
                <TableCell>
                  <Input className="w-40" disabled={!canManage} value={cycle.label} aria-label="Label" onChange={(e) => setCycle(i, { label: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input type="number" min={0} max={90} className="w-24" disabled={!canManage} value={cycle.discountPercent} aria-label="Discount" onChange={(e) => setCycle(i, { discountPercent: Number(e.target.value) })} />
                </TableCell>
                <TableCell>
                  <Switch checked={cycle.isActive} disabled={!canManage} onCheckedChange={(v) => setCycle(i, { isActive: v })} aria-label="Offered" />
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label="Remove cycle" onClick={() => setForm((f) => ({ ...f, cycles: f.cycles.filter((_, j) => j !== i) }))}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canManage && (
          <div className="flex justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setForm((f) => ({ ...f, cycles: [...f.cycles, { months: 24, label: "2 years", discountPercent: 35, isActive: true }] }))}
            >
              <Plus className="size-4" /> Add cycle
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save settings
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
