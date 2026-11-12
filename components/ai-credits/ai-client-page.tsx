"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CirclePause, CirclePlay, Coins, Hourglass, LoaderCircle, MinusCircle, PlusCircle, ShoppingCart, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Stat } from "@/components/billing/billing-overview-page";
import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aiCreditsApi, credits, requestKey, usd, type AiClientDetail, type UsageRow, type WalletStatus } from "@/lib/api/ai-credits-api";
import { formatDateTime } from "@/lib/format";

import { AiCreditsNav, LevelBadge, NoCreditsAccess } from "./ai-credits-nav";

const TYPE_LABEL = { purchase: "Recharge", usage: "AI usage", adjustment: "Staff change" } as const;

export function AiClientPage() {
  const { ndid } = useParams<{ ndid: string }>();
  const canView = useCan("credits.view");
  const canManage = useCan("credits.manage");
  const [adjusting, setAdjusting] = useState<"add" | "deduct" | null>(null);
  const [statusChange, setStatusChange] = useState<WalletStatus | null>(null);

  const client = useQuery({
    queryKey: ["ai-credits", "client", ndid],
    queryFn: () => aiCreditsApi.clientWallet(ndid),
    enabled: canView && Boolean(ndid),
  });

  if (!canView) return <NoCreditsAccess permission="credits.view" />;

  const c = client.data;
  const suspended = c?.wallet.status === "suspended";

  return (
    <>
      <Link href="/ai-credits" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All AI wallets
      </Link>
      <PageHeader
        title={c?.hotelName ?? ndid}
        description={`AI wallet of ${ndid}. Usage covers the last 30 days.`}
        action={
          c && canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setAdjusting("add")}>
                <PlusCircle className="size-4" aria-hidden /> Add credits
              </Button>
              <Button variant="outline" onClick={() => setAdjusting("deduct")}>
                <MinusCircle className="size-4" aria-hidden /> Remove
              </Button>
              <Button variant="outline" onClick={() => setStatusChange(suspended ? "active" : "suspended")}>
                {suspended ? <CirclePlay className="size-4" aria-hidden /> : <CirclePause className="size-4" aria-hidden />}
                {suspended ? "Resume AI" : "Suspend AI"}
              </Button>
            </div>
          ) : undefined
        }
      />
      <AiCreditsNav />

      {client.isError ? (
        <LoadFailed error={client.error} onRetry={() => void client.refetch()} />
      ) : !c ? (
        <TableLoading />
      ) : (
        <div className="space-y-6">
          {suspended && (
            <p role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              AI is suspended for this client: gian refuses its AI requests whatever the balance.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Coins} label="Available" value={credits(c.wallet.available)} hint={<LevelBadge level={c.level} status={c.wallet.status} />} />
            <Stat icon={Hourglass} label="Held by running requests" value={credits(c.wallet.reservedCredits)} hint={`balance ${credits(c.wallet.balance)}`} />
            <Stat
              icon={ShoppingCart}
              label="Bought"
              value={credits(c.wallet.totalPurchased)}
              hint={c.wallet.lastRechargeAt ? `last recharge ${formatDateTime(c.wallet.lastRechargeAt)}` : "never recharged"}
            />
            <Stat
              icon={Sparkles}
              label="Used (all time)"
              value={credits(c.wallet.totalUsed)}
              hint={`staff +${credits(c.wallet.totalAdjustedIn)} / −${credits(c.wallet.totalAdjustedOut)}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <UsageCard title="By feature" rows={c.usage.byService} usage={c.usage} />
            <UsageCard title="By model" rows={c.usage.byModel} usage={c.usage} />
          </div>

          <Ledger ndid={ndid} />
        </div>
      )}

      {c && adjusting && <AdjustDialog client={c} direction={adjusting} onClose={() => setAdjusting(null)} />}
      {c && statusChange && <StatusDialog client={c} status={statusChange} onClose={() => setStatusChange(null)} />}
    </>
  );
}

/** One magnitude per row: thin bars in one hue, credits written at the end. */
function UsageCard({ title, rows, usage }: { title: string; rows: UsageRow[]; usage: AiClientDetail["usage"] }) {
  const max = Math.max(1, ...rows.map((r) => r.credits));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {credits(usage.credits)} credits over {credits(usage.operations)} AI operations · provider cost {usd(usage.costUsd, 4)}
          {usage.uncollectedCredits > 0 && ` · ${credits(usage.uncollectedCredits)} not collected (wallet ran out)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No AI usage in the last 30 days.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="mb-1 flex justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{r.key}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {credits(r.credits)} · {usd(r.costUsd, 4)}
                  </span>
                </div>
                <div className="h-2 rounded-r-[4px] bg-muted">
                  <div className="h-full rounded-r-[4px]" style={{ width: `${(r.credits / max) * 100}%`, background: "#3366cc" }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Ledger({ ndid }: { ndid: string }) {
  const ledger = useInfiniteQuery({
    queryKey: ["ai-credits", "ledger", ndid],
    queryFn: ({ pageParam }) => aiCreditsApi.transactions(ndid, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const rows = ledger.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ledger</CardTitle>
        <CardDescription>Every change to the balance, newest first.</CardDescription>
      </CardHeader>
      <CardContent>
        {ledger.isError ? (
          <LoadFailed error={ledger.error} onRetry={() => void ledger.refetch()} />
        ) : ledger.isPending ? (
          <TableLoading />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDateTime(r.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="mr-2">
                        {TYPE_LABEL[r.type]}
                      </Badge>
                      <span className="text-sm">{r.service ?? r.description}</span>
                    </TableCell>
                    <TableCell className={`text-right font-medium tabular-nums ${r.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {r.amount > 0 ? "+" : "−"}
                      {credits(Math.abs(r.amount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{credits(r.balanceAfter)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.performedBy ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {ledger.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" onClick={() => void ledger.fetchNextPage()} disabled={ledger.isFetchingNextPage}>
              {ledger.isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" />} Older
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdjustDialog({ client, direction, onClose }: { client: AiClientDetail; direction: "add" | "deduct"; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  // one key per dialog: a retry after a network error changes the balance once
  const [key] = useState(requestKey);
  const adding = direction === "add";
  const tooMuch = !adding && amount > client.wallet.available;

  const save = useMutation({
    mutationFn: () => aiCreditsApi.adjust(client.ndid, { direction, amount, reason, idempotencyKey: key }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success(
        r.replayed ? "Already done: nothing changed again" : `${adding ? "Added" : "Removed"} ${credits(amount)} credits. Balance ${credits(r.balanceAfter)}`,
      );
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{adding ? "Add credits" : "Remove credits"}</DialogTitle>
          <DialogDescription>
            {client.hotelName ?? client.ndid} has {credits(client.wallet.available)} credits available
            {client.wallet.reservedCredits > 0 && ` (${credits(client.wallet.reservedCredits)} more are held by running requests and can't be removed)`}.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field>
            <FieldLabel htmlFor="adjust-amount">Credits</FieldLabel>
            <Input id="adjust-amount" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-invalid={tooMuch} required />
            {tooMuch && <FieldDescription className="text-destructive">More than the available credits.</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="adjust-reason">Reason</FieldLabel>
            <Input
              id="adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={adding ? "Goodwill after the chatbot outage" : "Recharge refunded"}
              minLength={3}
              required
            />
            <FieldDescription>Shown in the client&apos;s ledger and the audit log.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={adding ? "default" : "destructive"} disabled={save.isPending || amount < 1 || tooMuch || reason.trim().length < 3}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {adding ? `Add ${credits(amount || 0)}` : `Remove ${credits(amount || 0)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StatusDialog({ client, status, onClose }: { client: AiClientDetail; status: WalletStatus; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const suspending = status === "suspended";
  const save = useMutation({
    mutationFn: () => aiCreditsApi.setStatus(client.ndid, status, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success(suspending ? "AI suspended" : "AI resumed");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{suspending ? "Suspend AI" : "Resume AI"} for {client.hotelName ?? client.ndid}</DialogTitle>
          <DialogDescription>
            {suspending
              ? "The chatbot, WhatsApp replies and every other AI feature stop at once, whatever the balance. Credits stay."
              : "AI works again as long as there are credits."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field>
            <FieldLabel htmlFor="status-reason">Reason</FieldLabel>
            <Input id="status-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} required />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant={suspending ? "destructive" : "default"} disabled={save.isPending || reason.trim().length < 3}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {suspending ? "Suspend AI" : "Resume AI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
