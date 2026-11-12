"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { teamPhonesApi, type OwnerPhoneOutcome, type OwnerPhoneResult } from "@/lib/api/team-phones-api";

import { BackLink } from "./back-link";

const MAX_PER_RUN = 100;

const OUTCOME_TEXT: Record<OwnerPhoneOutcome, string> = {
  fixed: "fixed",
  has_phone: "already had a number (kept)",
  no_hotel_phone: "no usable hotel phone",
  not_found: "not found",
};

/**
 * Account holders with no WhatsApp number. Fix copies the hotel's phone to the owner and onto
 * the lead-alert lists, only where the owner's number is still empty. Hotels whose phone has
 * no country code are listed but never guessed: open the client and type the number.
 */
export function MissingNumbersPage() {
  const queryClient = useQueryClient();
  const canEdit = useCan("clients.edit");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<OwnerPhoneResult[] | null>(null);

  const owners = useQuery({
    queryKey: ["clients", "missing-owner-phones"],
    queryFn: () => teamPhonesApi.missingOwners(),
  });

  const fix = useMutation({
    mutationFn: (ndids: string[]) => teamPhonesApi.fixOwners(ndids),
    onSuccess: (results) => {
      const fixed = results.filter((r) => r.outcome === "fixed").length;
      toast.success(`${fixed} of ${results.length} account holders now have a number.`);
      setLastRun(results);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = owners.data ?? [];
  const fixable = rows.filter((r) => r.suggestedPhone);
  const manual = rows.length - fixable.length;
  const pickable = fixable.slice(0, MAX_PER_RUN).map((r) => r.ndid);
  const allPicked = pickable.length > 0 && pickable.every((id) => selected.has(id));

  const toggle = (ndid: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(ndid);
      else next.delete(ndid);
      return next;
    });

  return (
    <>
      <BackLink />
      <PageHeader
        title="Missing WhatsApp numbers"
        description="Account holders with no number. They show without one in the hotel's Team management and can't be picked for WhatsApp lead alerts."
        action={
          canEdit && fixable.length > 0 ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={selected.size === 0 || fix.isPending}
                onClick={() => fix.mutate([...selected])}
              >
                Fix selected ({selected.size})
              </Button>
              <Button disabled={fix.isPending} onClick={() => fix.mutate(pickable)}>
                {fix.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
                Fix {pickable.length === fixable.length ? "all" : `first ${pickable.length}`} with a hotel phone
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 max-w-3xl space-y-1 text-sm text-muted-foreground">
        <p>
          Fix copies the hotel&apos;s phone to the account holder and adds it to every lead source&apos;s WhatsApp
          list. A number that is already saved is never replaced, team members are never changed, and alert
          switches stay as they are. Each fix is in Activity.
        </p>
        {manual > 0 && (
          <p>
            {manual} {manual === 1 ? "hotel has" : "hotels have"} no phone with a country code, so nothing is
            guessed: open the client and add the number under Team &amp; WhatsApp numbers.
          </p>
        )}
      </div>

      {lastRun && (
        <div className="mb-4 rounded-lg border p-3 text-sm">
          <p className="mb-1 font-medium">Last run</p>
          <ul className="space-y-0.5">
            {lastRun.map((r) => (
              <li key={r.ndid}>
                {r.hotelName ?? r.ndid}: {OUTCOME_TEXT[r.outcome]}
                {r.outcome === "fixed" && r.phone ? ` → ${r.phone}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {owners.isPending && <TableLoading />}
      {owners.error && <LoadFailed error={owners.error} onRetry={() => void owners.refetch()} />}
      {owners.data && rows.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed p-10 text-sm text-muted-foreground">
          <CircleCheck className="size-5 text-brand-orange" aria-hidden />
          Every account holder you can see has a WhatsApp number.
        </div>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {canEdit && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPicked}
                      onCheckedChange={(on) => setSelected(on ? new Set(pickable) : new Set())}
                      aria-label={`Select the fixable rows (up to ${MAX_PER_RUN})`}
                    />
                  </TableHead>
                )}
                <TableHead>Hotel</TableHead>
                <TableHead>Account holder</TableHead>
                <TableHead>Hotel phone</TableHead>
                <TableHead>Fix would save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.ndid} data-state={selected.has(row.ndid) ? "selected" : undefined}>
                  {canEdit && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(row.ndid)}
                        disabled={!row.suggestedPhone || (!selected.has(row.ndid) && selected.size >= MAX_PER_RUN)}
                        onCheckedChange={(on) => toggle(row.ndid, Boolean(on))}
                        aria-label={`Select ${row.hotelName ?? row.ndid}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link
                      href={`/clients/${encodeURIComponent(row.ndid)}?from=missing`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {row.hotelName ?? "Unnamed hotel"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {row.ownerName && <div>{row.ownerName}</div>}
                    <div className="text-xs text-muted-foreground">{row.ownerEmail}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.hotelPhone ?? "-"}</TableCell>
                  <TableCell className="text-sm">
                    {row.suggestedPhone ? (
                      <span className="font-mono">{row.suggestedPhone}</span>
                    ) : (
                      <span className="text-muted-foreground">Add by hand on the client</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
