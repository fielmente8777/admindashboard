"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aiCreditsApi, usd, utcDay, type TopUp } from "@/lib/api/ai-credits-api";
import { formatDateTime } from "@/lib/format";

import { AiCreditsNav, NoCreditsAccess } from "./ai-credits-nav";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

/** Money put into the OpenAI account, and OpenAI's daily bill next to what gian recorded. */
export function AiOpenAiPage() {
  const canPricing = useCan("credits.pricing");
  const queryClient = useQueryClient();
  const [days, setDays] = useState("30");
  const [editing, setEditing] = useState<TopUp | "new" | null>(null);

  const topUps = useQuery({ queryKey: ["ai-credits", "topups"], queryFn: () => aiCreditsApi.topUps(), enabled: canPricing });
  const costs = useQuery({ queryKey: ["ai-credits", "costs", days], queryFn: () => aiCreditsApi.costs(Number(days)), enabled: canPricing });
  const sync = useMutation({
    mutationFn: () => aiCreditsApi.sync(),
    onSuccess: (s) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success(`OpenAI costs synced (${s.from && utcDay(s.from)} – ${s.to && utcDay(s.to)})`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (!canPricing) return <NoCreditsAccess permission="credits.pricing" />;

  return (
    <>
      <PageHeader
        title="AI credits"
        description="OpenAI has no balance API: record every top-up here, and the console subtracts OpenAI's reported cost."
        action={
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
            {sync.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" aria-hidden />}
            Sync OpenAI costs now
          </Button>
        }
      />
      <AiCreditsNav />

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Top-ups</CardTitle>
              <CardDescription>
                First entry: the balance OpenAI shows on the day you start (note it as &ldquo;opening balance&rdquo;). Spend is counted from that day.
              </CardDescription>
            </div>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden /> Add top-up
            </Button>
          </CardHeader>
          <CardContent>
            {topUps.isError ? (
              <LoadFailed error={topUps.error} onRetry={() => void topUps.refetch()} />
            ) : !topUps.data ? (
              <TableLoading />
            ) : topUps.data.items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No top-ups recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paid on (UTC)</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Recorded by</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Edit</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topUps.data.items.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{utcDay(t.paidOn)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{usd(t.amountUsd)}</TableCell>
                        <TableCell className="text-sm">{t.note ?? "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {t.createdBy}
                          {t.updatedAt && ` · edited ${formatDateTime(t.updatedAt)}`}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" aria-label={`Edit the top-up of ${utcDay(t.paidOn)}`} onClick={() => setEditing(t)}>
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-right text-sm">
                  Total <span className="font-semibold tabular-nums">{usd(topUps.data.totalUsd)}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>OpenAI&apos;s bill vs what gian recorded</CardTitle>
              <CardDescription>
                Gap = OpenAI&apos;s cost − gian&apos;s tracked cost: calls gian didn&apos;t record, or models without a price row.
              </CardDescription>
            </div>
            <Select items={RANGES} value={days} onValueChange={(v) => v && setDays(v)}>
              <SelectTrigger className="w-40" aria-label="Range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {costs.isError ? (
              <LoadFailed error={costs.error} onRetry={() => void costs.refetch()} />
            ) : !costs.data ? (
              <TableLoading />
            ) : (
              <Reconciliation data={costs.data} />
            )}
          </CardContent>
        </Card>
      </div>

      {editing && <TopUpDialog topUp={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Reconciliation({ data }: { data: NonNullable<Awaited<ReturnType<typeof aiCreditsApi.costs>>> }) {
  const max = Math.max(0.0001, ...data.days.map((d) => d.openaiUsd));
  const days = [...data.days].reverse();
  return (
    <div className="space-y-5">
      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <Total label="OpenAI cost" value={usd(data.totals.openaiUsd)} />
        <Total label="gian tracked" value={usd(data.totals.trackedUsd)} />
        <Total label="Billed to hotels" value={usd(data.totals.billedUsd)} />
        <Total label="Gap" value={usd(data.totals.gapUsd)} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day (UTC)</TableHead>
              <TableHead className="w-[30%]">OpenAI cost</TableHead>
              <TableHead className="text-right">gian tracked</TableHead>
              <TableHead className="text-right">Billed</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-right">Calls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d) => (
              <TableRow key={d.date}>
                <TableCell className="whitespace-nowrap">{utcDay(d.date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2" title={`${utcDay(d.date)}: ${usd(d.openaiUsd, 4)}`}>
                    <div className="h-2 flex-1 rounded-r-[4px] bg-muted">
                      <div className="h-full rounded-r-[4px]" style={{ width: `${(d.openaiUsd / max) * 100}%`, background: "#3366cc" }} />
                    </div>
                    <span className="w-16 text-right tabular-nums">{usd(d.openaiUsd)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{usd(d.trackedUsd)}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(d.billedUsd)}</TableCell>
                <TableCell className={`text-right tabular-nums ${Math.abs(d.gapUsd) >= 0.01 ? "font-medium" : "text-muted-foreground"}`}>
                  {usd(d.gapUsd)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.calls}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.lineItems.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">By OpenAI line item</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {data.lineItems.map((l) => (
              <li key={l.lineItem} className="flex justify-between gap-3 rounded-md border px-3 py-1.5">
                <span className="truncate">{l.lineItem}</span>
                <span className="tabular-nums">{usd(l.amountUsd)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

function TopUpDialog({ topUp, onClose }: { topUp: TopUp | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amountUsd, setAmount] = useState(topUp?.amountUsd ?? 0);
  const [paidOn, setPaidOn] = useState(topUp?.paidOn ?? todayUtc());
  const [note, setNote] = useState(topUp?.note ?? "");
  const save = useMutation({
    mutationFn: () => {
      const body = { amountUsd, paidOn, note: note.trim() || null };
      return topUp ? aiCreditsApi.editTopUp(topUp.id, body) : aiCreditsApi.addTopUp(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success(topUp ? "Top-up corrected" : "Top-up recorded");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{topUp ? "Correct a top-up" : "Record a top-up"}</DialogTitle>
          <DialogDescription>Top-ups are never deleted; a correction is logged with the old and new values.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="topup-amount">Amount (USD)</FieldLabel>
              <Input id="topup-amount" type="number" min={0.01} step={0.01} value={amountUsd} onChange={(e) => setAmount(Number(e.target.value))} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="topup-date">Paid on</FieldLabel>
              <Input id="topup-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
              <FieldDescription>The day it reached OpenAI (UTC).</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="topup-note">Note</FieldLabel>
            <Input id="topup-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Opening balance / invoice number" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || amountUsd <= 0 || !paidOn}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
