"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Toggle } from "@/components/billing/plan-dialog";
import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  aiCreditsApi,
  credits,
  inr,
  usd,
  type CreditPackage,
  type PackageInput,
  type PricingInput,
  type PricingRow,
} from "@/lib/api/ai-credits-api";

import { AiCreditsNav, NoCreditsAccess } from "./ai-credits-nav";

/** Model prices (what a call costs in credits) and the recharge packs hotels buy. */
export function AiPricingPage() {
  const canPricing = useCan("credits.pricing");
  const [pricing, setPricing] = useState<PricingRow | "new" | null>(null);
  const [pack, setPack] = useState<CreditPackage | "new" | null>(null);
  const prices = useQuery({ queryKey: ["ai-credits", "pricing"], queryFn: () => aiCreditsApi.pricing(), enabled: canPricing });
  const packages = useQuery({ queryKey: ["ai-credits", "packages"], queryFn: () => aiCreditsApi.packages(), enabled: canPricing });

  if (!canPricing) return <NoCreditsAccess permission="credits.pricing" />;

  return (
    <>
      <PageHeader title="AI credits" description="Credits charged per call come from the model's price; what a hotel pays per credit comes from the packages." />
      <AiCreditsNav />
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Model prices</CardTitle>
              <CardDescription>
                Provider prices per 1M tokens. Credits per call = cost × credits per $ (min 1).
                {prices.data && ` Changes reach AI requests within ${prices.data.appliesWithinSeconds} seconds.`}
                {prices.data?.salePerCreditInr &&
                  ` Packages sell a credit for ${inr(prices.data.salePerCreditInr.min, 3)}–${inr(prices.data.salePerCreditInr.max, 3)}; margin is shown at the cheapest.`}
              </CardDescription>
            </div>
            <Button onClick={() => setPricing("new")}>
              <Plus className="size-4" aria-hidden /> Price a model
            </Button>
          </CardHeader>
          <CardContent>
            {prices.isError ? (
              <LoadFailed error={prices.error} onRetry={() => void prices.refetch()} />
            ) : !prices.data ? (
              <TableLoading />
            ) : prices.data.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No model is priced: every AI call is charged at the fallback rate in Settings.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Embedding</TableHead>
                      <TableHead className="text-right">Credits per $</TableHead>
                      <TableHead className="text-right">1 credit costs us</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Edit</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prices.data.items.map((p) => (
                      <TableRow key={p.id} className={p.status === "inactive" ? "opacity-60" : undefined}>
                        <TableCell>
                          <span className="font-medium">{p.model}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{p.provider}</span>
                          {p.status === "inactive" && (
                            <Badge variant="outline" className="ml-2">
                              Off
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.inputPrice}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.outputPrice}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.embeddingPrice}</TableCell>
                        <TableCell className="text-right tabular-nums">{credits(p.creditConversionRate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.costPerCreditInr !== null ? inr(p.costPerCreditInr, 4) : usd(p.costPerCreditUsd, 5)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.marginPct === null ? "—" : `${p.marginPct}%`}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.model}`} onClick={() => setPricing(p)}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-muted-foreground">Prices in USD unless the row says otherwise. Set the USD→INR rate in Settings to see ₹ and margins.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Recharge packages</CardTitle>
              <CardDescription>What hotels can buy on their dashboard&apos;s AI wallet page (Razorpay).</CardDescription>
            </div>
            <Button onClick={() => setPack("new")}>
              <Plus className="size-4" aria-hidden /> Add package
            </Button>
          </CardHeader>
          <CardContent>
            {packages.isError ? (
              <LoadFailed error={packages.error} onRetry={() => void packages.refetch()} />
            ) : !packages.data ? (
              <TableLoading />
            ) : packages.data.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No packages: hotels have nothing to buy.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Per credit</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Edit</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {packages.data.map((p) => (
                      <TableRow key={p.id} className={p.status === "inactive" ? "opacity-60" : undefined}>
                        <TableCell>
                          <span className="font-medium">{p.name}</span>
                          {p.popular && <Badge className="ml-2 bg-brand-orange/10 text-brand-orange">Popular</Badge>}
                          {p.status === "inactive" && (
                            <Badge variant="outline" className="ml-2">
                              Off
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{credits(p.credits)}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.currency === "INR" ? inr(p.price, 0) : `${p.price} ${p.currency}`}</TableCell>
                        <TableCell className="text-right tabular-nums">{p.currency === "INR" ? inr(p.price / p.credits, 3) : "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => setPack(p)}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pricing && <PricingDialog row={pricing === "new" ? null : pricing} onClose={() => setPricing(null)} />}
      {pack && <PackageDialog pack={pack === "new" ? null : pack} onClose={() => setPack(null)} />}
    </>
  );
}

const EMPTY_PRICING: PricingInput = {
  provider: "openai",
  model: "",
  inputPrice: 0,
  outputPrice: 0,
  embeddingPrice: 0,
  requestPrice: 0,
  currency: "USD",
  creditConversionRate: 1000,
  status: "active",
};

const PRICE_FIELDS: { key: "inputPrice" | "outputPrice" | "embeddingPrice" | "requestPrice"; label: string }[] = [
  { key: "inputPrice", label: "Input / 1M tokens" },
  { key: "outputPrice", label: "Output / 1M tokens" },
  { key: "embeddingPrice", label: "Embedding / 1M tokens" },
  { key: "requestPrice", label: "Per call (speech-to-text)" },
];

function PricingDialog({ row, onClose }: { row: PricingRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PricingInput>(() => (row ? { ...EMPTY_PRICING, ...pick(row) } : EMPTY_PRICING));
  const set = <K extends keyof PricingInput>(key: K, value: PricingInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const save = useMutation({
    mutationFn: () => (row ? aiCreditsApi.updatePricing(row.id, form) : aiCreditsApi.createPricing(form)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success(`Saved ${saved.provider}/${saved.model}. AI requests use it within 30 seconds.`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.model}` : "Price a model"}</DialogTitle>
          <DialogDescription>Use the provider&apos;s list price. The margin comes from credits per $ and the package prices.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="price-provider">Provider</FieldLabel>
              <Input id="price-provider" value={form.provider} onChange={(e) => set("provider", e.target.value.toLowerCase())} required />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="price-model">Model</FieldLabel>
              <Input id="price-model" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="gpt-5-mini" required />
              <FieldDescription>Exactly as gian sends it to the provider.</FieldDescription>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRICE_FIELDS.map(({ key, label }) => (
              <Field key={key}>
                <FieldLabel htmlFor={`price-${key}`} className="text-xs">
                  {label} ({form.currency})
                </FieldLabel>
                <Input id={`price-${key}`} type="number" min={0} step="any" value={form[key]} onChange={(e) => set(key, Number(e.target.value))} />
              </Field>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="price-rate">Credits per 1 {form.currency} of cost</FieldLabel>
              <Input id="price-rate" type="number" min={0.0001} step="any" value={form.creditConversionRate} onChange={(e) => set("creditConversionRate", Number(e.target.value))} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="price-currency">Currency</FieldLabel>
              <Input id="price-currency" value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} required />
            </Field>
          </div>
          <Toggle label="Active" hint="Off = the model is charged at the fallback rate" checked={form.status === "active"} onChange={(v) => set("status", v ? "active" : "inactive")} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !form.model.trim() || form.creditConversionRate <= 0}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />} Save price
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function pick(row: PricingRow): PricingInput {
  const { provider, model, inputPrice, outputPrice, embeddingPrice, requestPrice, currency, creditConversionRate, status } = row;
  return { provider, model, inputPrice, outputPrice, embeddingPrice, requestPrice, currency, creditConversionRate, status };
}

const EMPTY_PACKAGE: PackageInput = { name: "", credits: 1000, price: 199, currency: "INR", status: "active", popular: false, sortOrder: 0 };

function PackageDialog({ pack, onClose }: { pack: CreditPackage | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PackageInput>(() => {
    if (!pack) return EMPTY_PACKAGE;
    const { name, credits: c, price, currency, status, popular, sortOrder } = pack;
    return { name, credits: c, price, currency, status, popular, sortOrder };
  });
  const set = <K extends keyof PackageInput>(key: K, value: PackageInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const save = useMutation({
    mutationFn: () => (pack ? aiCreditsApi.updatePackage(pack.id, form) : aiCreditsApi.createPackage(form)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success(`Saved the ${form.name} package`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pack ? `Edit ${pack.name}` : "New package"}</DialogTitle>
          <DialogDescription>Hotels see active packages on their AI wallet page. Price includes GST.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field>
            <FieldLabel htmlFor="pack-name">Name</FieldLabel>
            <Input id="pack-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={60} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="pack-credits">Credits</FieldLabel>
              <Input id="pack-credits" type="number" min={1} step={1} value={form.credits} onChange={(e) => set("credits", Number(e.target.value))} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="pack-price">Price (₹)</FieldLabel>
              <Input id="pack-price" type="number" min={1} step={1} value={form.price} onChange={(e) => set("price", Number(e.target.value))} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="pack-order">Order</FieldLabel>
              <Input id="pack-order" type="number" min={0} step={1} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} />
            </Field>
          </div>
          {form.credits > 0 && <p className="text-sm text-muted-foreground">{inr(form.price / form.credits, 3)} per credit.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle label="On sale" hint="Off = hidden from hotels" checked={form.status === "active"} onChange={(v) => set("status", v ? "active" : "inactive")} />
            <Toggle label="Most popular" hint="Highlighted; unmarks the others" checked={form.popular} onChange={(v) => set("popular", v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim() || form.credits < 1 || form.price < 1}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />} Save package
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
