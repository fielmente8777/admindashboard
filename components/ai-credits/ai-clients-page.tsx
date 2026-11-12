"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { aiCreditsApi, credits, requestKey, type AiClientRow } from "@/lib/api/ai-credits-api";

import { AiCreditsNav, LevelBadge, NoCreditsAccess } from "./ai-credits-nav";

/** Every client the staff member can see, with its AI wallet. Bulk grant for credits.manage. */
export function AiClientsPage() {
  const canView = useCan("credits.view");
  const canManage = useCan("credits.manage");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, AiClientRow>>(new Map());
  const [granting, setGranting] = useState(false);

  const clients = useInfiniteQuery({
    queryKey: ["ai-credits", "clients", search],
    queryFn: ({ pageParam }) => aiCreditsApi.clients({ search, after: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: canView,
  });
  const rows = clients.data?.pages.flatMap((p) => p.items) ?? [];

  if (!canView) return <NoCreditsAccess permission="credits.view" />;

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(input.trim());
  }
  function toggle(row: AiClientRow, on: boolean) {
    setSelected((current) => {
      const next = new Map(current);
      if (on) next.set(row.ndid, row);
      else next.delete(row.ndid);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="AI credits"
        description="Each hotel's AI wallet: what it can still use, what it bought and used. AI pauses when a wallet is empty."
        action={
          canManage && selected.size > 0 ? (
            <Button onClick={() => setGranting(true)}>
              <Gift className="size-4" aria-hidden /> Give credits to {selected.size}
            </Button>
          ) : undefined
        }
      />
      <AiCreditsNav />

      <form onSubmit={applySearch} className="mb-4 flex max-w-md gap-2" role="search">
        <Input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hotel name, domain, email or ndid"
          aria-label="Search clients"
        />
        <Button type="submit" variant="outline">
          <Search className="size-4" aria-hidden /> Search
        </Button>
      </form>

      {clients.isError ? (
        <LoadFailed error={clients.error} onRetry={() => void clients.refetch()} />
      ) : clients.isPending ? (
        <TableLoading />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search ? "No client matches this search." : "No clients are assigned to you yet."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>}
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">In use now</TableHead>
                <TableHead className="text-right">Bought</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Level</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ndid}>
                  {canManage && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.ndid)}
                        onCheckedChange={(on) => toggle(row, Boolean(on))}
                        aria-label={`Select ${row.hotelName ?? row.ndid}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link href={`/ai-credits/clients/${encodeURIComponent(row.ndid)}`} className="font-medium hover:underline">
                      {row.hotelName ?? row.ndid}
                    </Link>
                    <p className="text-xs text-muted-foreground">{row.wallet.exists ? row.hotelEmail ?? row.ndid : "No wallet yet"}</p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{credits(row.wallet.available)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{credits(row.wallet.reservedCredits)}</TableCell>
                  <TableCell className="text-right tabular-nums">{credits(row.wallet.totalPurchased)}</TableCell>
                  <TableCell className="text-right tabular-nums">{credits(row.wallet.totalUsed)}</TableCell>
                  <TableCell>
                    <LevelBadge level={row.level} status={row.wallet.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {clients.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => void clients.fetchNextPage()} disabled={clients.isFetchingNextPage}>
            {clients.isFetchingNextPage && <LoaderCircle className="size-4 animate-spin" />} Load more
          </Button>
        </div>
      )}

      {granting && (
        <BulkGrantDialog
          clients={[...selected.values()]}
          onClose={(done) => {
            setGranting(false);
            if (done) setSelected(new Map());
          }}
        />
      )}
    </>
  );
}

function BulkGrantDialog({ clients: targets, onClose }: { clients: AiClientRow[]; onClose: (done: boolean) => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(500);
  const [reason, setReason] = useState("");
  // one batch id per dialog: pressing Give again (e.g. after a network error) gives nothing twice
  const [batchId] = useState(requestKey);

  const grant = useMutation({
    mutationFn: () => aiCreditsApi.bulkGrant({ ndids: targets.map((t) => t.ndid), amount, reason, batchId }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      if (result.failed) toast.warning(`Gave ${credits(amount)} credits to ${result.granted}; ${result.failed} could not be changed`);
      else toast.success(`Gave ${credits(amount)} credits to ${result.granted} clients`);
      onClose(true);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give credits to {targets.length} clients</DialogTitle>
          <DialogDescription>
            Each client gets the same credits, as its own line in its ledger. Logged with your name and the reason.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            grant.mutate();
          }}
        >
          <p className="text-sm text-muted-foreground">{targets.map((t) => t.hotelName ?? t.ndid).join(", ")}</p>
          <Field>
            <FieldLabel htmlFor="bulk-amount">Credits each</FieldLabel>
            <Input id="bulk-amount" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="bulk-reason">Reason</FieldLabel>
            <Input id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Diwali offer" minLength={3} required />
            <FieldDescription>Shown in each client&apos;s ledger.</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={grant.isPending || amount < 1 || reason.trim().length < 3}>
              {grant.isPending && <LoaderCircle className="size-4 animate-spin" />} Give credits
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
