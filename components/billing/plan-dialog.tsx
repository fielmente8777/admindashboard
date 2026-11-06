"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { billingApi, type CatalogueApp, type CataloguePlan, type PlanInput, type SupportLevel } from "@/lib/api/billing-api";

const SUPPORT = [
  { value: "none", label: "No support" },
  { value: "standard", label: "Standard (email)" },
  { value: "premium", label: "Priority" },
  { value: "enterprise", label: "Dedicated manager" },
];

const EMPTY: PlanInput = {
  code: "",
  name: "",
  tagline: "",
  price: 0,
  includedApps: [],
  highlights: [],
  limits: { teamMembers: 3, properties: 1, aiCreditsMonthly: 100, maxLeadsPerMonth: -1 },
  support: "standard",
  isPublic: true,
  isCustom: false,
  customPriceLabel: "Let's talk",
  customPriceNote: "A quote built around your properties",
  customCtaLabel: "Talk to sales",
  visibleTo: [],
  isActive: true,
  featured: false,
  sortOrder: 100,
};

const LIMITS: { key: keyof PlanInput["limits"]; label: string }[] = [
  { key: "teamMembers", label: "Team members" },
  { key: "properties", label: "Properties" },
  { key: "aiCreditsMonthly", label: "AI credits / month" },
  { key: "maxLeadsPerMonth", label: "Leads / month" },
];

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

/** Creates a plan when `plan` is null, otherwise edits it. */
export function PlanDialog({ plan, apps, onClose }: { plan: CataloguePlan | null; apps: CatalogueApp[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PlanInput>(() => {
    if (!plan) return EMPTY;
    return Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "id" && key !== "updatedAt")) as PlanInput;
  });
  const [highlights, setHighlights] = useState(form.highlights.join("\n"));
  const [visibleTo, setVisibleTo] = useState(form.visibleTo.join("\n"));
  const set = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, highlights: lines(highlights), visibleTo: lines(visibleTo) };
      return plan ? billingApi.updatePlan(plan.id, body) : billingApi.createPlan(body);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success(`Saved the ${saved.name} plan`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const includedTotal = apps.filter((a) => form.includedApps.includes(a.code)).reduce((sum, a) => sum + a.price, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? `Edit ${plan.name}` : "New plan"}</DialogTitle>
          <DialogDescription>
            Applies to every purchase and renewal from now on. Hotels keep what they already paid for.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="plan-code">Code</FieldLabel>
              <Input id="plan-code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="PRO" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-name">Name</FieldLabel>
              <Input id="plan-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Pro" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="plan-price">Price (₹ / month)</FieldLabel>
              <Input id="plan-price" type="number" min={0} value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
              <FieldDescription>Before GST. 0 + custom = contact sales.</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="plan-tagline">Tagline</FieldLabel>
            <Input id="plan-tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Included apps</FieldLegend>
            <FieldDescription>
              Hotels on this plan get these without paying extra; the rest can be added on. Worth{" "}
              {includedTotal.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} / month as add-ons.
            </FieldDescription>
            <div className="grid gap-2 sm:grid-cols-2">
              {apps.map((app) => (
                <label key={app.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
                  <Checkbox
                    checked={form.includedApps.includes(app.code)}
                    onCheckedChange={(checked) =>
                      set("includedApps", checked ? [...form.includedApps, app.code] : form.includedApps.filter((c) => c !== app.code))
                    }
                  />
                  <span className="flex-1">{app.name}</span>
                  <span className="text-xs text-muted-foreground">₹{app.price}</span>
                </label>
              ))}
            </div>
          </FieldSet>

          <FieldSet>
            <FieldLegend variant="label">Limits</FieldLegend>
            <FieldDescription>-1 means unlimited. Extra team seats can be bought on top.</FieldDescription>
            <div className="grid gap-3 sm:grid-cols-4">
              {LIMITS.map(({ key, label }) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`limit-${key}`} className="text-xs">
                    {label}
                  </FieldLabel>
                  <Input
                    id={`limit-${key}`}
                    type="number"
                    min={-1}
                    value={form.limits[key]}
                    onChange={(e) => set("limits", { ...form.limits, [key]: Number(e.target.value) })}
                  />
                </Field>
              ))}
            </div>
          </FieldSet>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="plan-highlights">Bullet points (one per line)</FieldLabel>
              <textarea
                id="plan-highlights"
                rows={5}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                value={highlights}
                onChange={(e) => setHighlights(e.target.value)}
              />
            </Field>
            <div className="space-y-4">
              <Field>
                <FieldLabel>Support</FieldLabel>
                <Select items={SUPPORT} value={form.support} onValueChange={(v) => v && set("support", v as SupportLevel)}>
                  <SelectTrigger className="w-full" aria-label="Support">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="plan-order">Order on the pricing page</FieldLabel>
                <Input id="plan-order" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="Public" hint="On the website and every hotel's plans page" checked={form.isPublic} onChange={(v) => set("isPublic", v)} />
            <Toggle label="Custom pricing" hint="“Contact sales”, unless the hotel is listed below" checked={form.isCustom} onChange={(v) => set("isCustom", v)} />
            <Toggle label="Most popular" hint="Highlighted on the pricing page" checked={form.featured} onChange={(v) => set("featured", v)} />
            <Toggle label="Available" hint="Off = archived: nobody can buy it any more" checked={form.isActive} onChange={(v) => set("isActive", v)} />
          </div>

          {form.isCustom && (
            <FieldSet>
              <FieldLegend variant="label">Shown instead of a price</FieldLegend>
              <FieldDescription>On the website and every hotel&apos;s plans page. Leave a box empty for the default wording.</FieldDescription>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="plan-custom-label">Heading</FieldLabel>
                  <Input id="plan-custom-label" maxLength={30} placeholder="Let's talk" value={form.customPriceLabel} onChange={(e) => set("customPriceLabel", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="plan-custom-cta">Button</FieldLabel>
                  <Input id="plan-custom-cta" maxLength={30} placeholder="Talk to sales" value={form.customCtaLabel} onChange={(e) => set("customCtaLabel", e.target.value)} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="plan-custom-note">Line under the heading</FieldLabel>
                  <Input id="plan-custom-note" maxLength={80} placeholder="A quote built around your properties" value={form.customPriceNote} onChange={(e) => set("customPriceNote", e.target.value)} />
                </Field>
              </div>
            </FieldSet>
          )}

          <Field>
            <FieldLabel htmlFor="plan-visible">Only for these hotels (ndid, one per line)</FieldLabel>
            <textarea
              id="plan-visible"
              rows={2}
              className="w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-xs"
              value={visibleTo}
              onChange={(e) => setVisibleTo(e.target.value)}
            />
            <FieldDescription>
              For an enterprise deal: turn Public off, set the agreed price, list the hotel. It then sees and pays for this plan in its dashboard.
            </FieldDescription>
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border px-3 py-2.5">
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
