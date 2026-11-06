"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, IndianRupee, RefreshCw, Repeat, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  billingApi,
  exactRupees,
  KIND_LABELS,
  rupeesFromPaise,
  type Payment,
  type PaymentQuery,
} from "@/lib/api/billing-api";
import { formatDateTime } from "@/lib/format";

import { BillingNav, useCan } from "./billing-nav";
import { InvoiceCell } from "./invoice-actions";
import { RevenueChart } from "./revenue-chart";

const PAGE_SIZE = 25;
const STATUS_ITEMS = [
  { value: "all", label: "Every status" },
  { value: "SUCCESS", label: "Paid" },
  { value: "created", label: "Not completed" },
  { value: "FAILED", label: "Failed" },
];
const SOURCE_ITEMS = [
  { value: "all", label: "Every checkout" },
  { value: "gian-new", label: "New checkout" },
  { value: "gian", label: "Old checkout (gian)" },
];

export function Stat({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-brand-navy tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PaymentStatusBadge({ payment }: { payment: Pick<Payment, "status" | "failureReason"> }) {
  if (payment.status === "SUCCESS") return <Badge className="bg-emerald-50 text-emerald-700">Paid</Badge>;
  if (payment.status === "FAILED")
    return (
      <Badge variant="destructive" title={payment.failureReason ?? undefined}>
        Failed
      </Badge>
    );
  return <Badge variant="outline">Not completed</Badge>;
}

export function BillingOverviewPage() {
  const canView = useCan("billing.view");
  const overview = useQuery({ queryKey: ["billing", "overview"], queryFn: () => billingApi.overview(), enabled: canView });

  if (!canView) return <NoBillingAccess />;

  return (
    <>
      <PageHeader title="Billing" description="Revenue, paying hotels and every payment made for Eazotel plans." />
      <BillingNav />
      {overview.isError ? (
        <LoadFailed error={overview.error} onRetry={() => void overview.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overview.data ? (
              <>
                <Stat
                  icon={IndianRupee}
                  label="Revenue this month"
                  value={rupeesFromPaise(overview.data.revenue.thisMonthPaise)}
                  hint={`${overview.data.revenue.paymentsThisMonth} payments · last month ${rupeesFromPaise(overview.data.revenue.lastMonthPaise)}`}
                />
                <Stat
                  icon={Repeat}
                  label="Monthly recurring (est.)"
                  value={rupeesFromPaise(overview.data.subscriptions.mrrPaise)}
                  hint="from plans bought with the new checkout, before GST"
                />
                <Stat
                  icon={Users}
                  label="Paying hotels"
                  value={overview.data.subscriptions.paying}
                  hint={`${overview.data.subscriptions.trial} on trial · ${overview.data.subscriptions.ended} ended`}
                />
                <Stat
                  icon={CalendarClock}
                  label="Renewals in 30 days"
                  value={overview.data.subscriptions.renewalsDue30d}
                  hint={`${overview.data.subscriptions.autoRenewOn} with auto-renew on`}
                />
              </>
            ) : (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue per month</CardTitle>
                <CardDescription>
                  Paid payments incl. GST, India time.{" "}
                  {overview.data && `All time: ${rupeesFromPaise(overview.data.revenue.allTimePaise)}.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overview.data ? <RevenueChart months={overview.data.revenue.byMonth} /> : <Skeleton className="h-48" />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Paying hotels by plan</CardTitle>
                <CardDescription>Running paid subscriptions right now.</CardDescription>
              </CardHeader>
              <CardContent>
                {overview.data ? <PlanMix rows={overview.data.subscriptions.byPlan} /> : <Skeleton className="h-40" />}
              </CardContent>
            </Card>
          </div>

          <PaymentsTable />
        </div>
      )}
    </>
  );
}

/** One magnitude per plan: thin bars in one hue, the count written at the end. */
function PlanMix({ rows }: { rows: { planCode: string; count: number }[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">No paying hotels yet.</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.planCode}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{r.planCode}</span>
            <span className="tabular-nums text-muted-foreground">{r.count}</span>
          </div>
          <div className="h-2.5 rounded-r-[4px] bg-muted">
            <div className="h-full rounded-r-[4px]" style={{ width: `${(r.count / max) * 100}%`, background: "#3366cc" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Every payment, newest first; also used on a client's page with `ndid`. */
export function PaymentsTable({ ndid, title = "Payments" }: { ndid?: string; title?: string }) {
  const [query, setQuery] = useState<PaymentQuery>({ page: 1, pageSize: PAGE_SIZE, ndid });
  const payments = useQuery({
    queryKey: ["billing", "payments", query],
    queryFn: () => billingApi.payments(query),
    placeholderData: keepPreviousData,
  });
  const set = (changes: Partial<PaymentQuery>) => setQuery((q) => ({ ...q, page: 1, ...changes }));
  const pages = Math.max(1, Math.ceil((payments.data?.total ?? 0) / PAGE_SIZE));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{payments.data ? `${payments.data.total} in total` : " "}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select items={STATUS_ITEMS} value={query.status ?? "all"} onValueChange={(v) => set({ status: v === "all" || !v ? undefined : (v as PaymentQuery["status"]) })}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!ndid && (
            <Select items={SOURCE_ITEMS} value={query.source ?? "all"} onValueChange={(v) => set({ source: v === "all" || !v ? undefined : (v as PaymentQuery["source"]) })}>
              <SelectTrigger className="w-48" aria-label="Checkout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input type="date" className="w-38" aria-label="From" value={query.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
          <Input type="date" className="w-38" aria-label="To" value={query.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
          <Button variant="ghost" size="icon" aria-label="Refresh" onClick={() => void payments.refetch()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {payments.isError ? (
          <LoadFailed error={payments.error} onRetry={() => void payments.refetch()} />
        ) : !payments.data ? (
          <TableLoading />
        ) : payments.data.items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No payments match.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!ndid && <TableHead>Hotel</TableHead>}
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Razorpay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.data.items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(p.paidAt ?? p.createdAt)}</TableCell>
                    {!ndid && (
                      <TableCell>
                        <Link href={`/clients/${encodeURIComponent(p.ndid)}`} className="font-medium hover:underline">
                          {p.hotelName ?? p.ndid}
                        </Link>
                      </TableCell>
                    )}
                    <TableCell>
                      <span className="block">
                        {p.planCode ?? "—"}
                        {p.terms ? ` · ${p.terms.cycleMonths} mo` : ""}
                        {p.terms?.addonCodes.length ? ` · +${p.terms.addonCodes.length} apps` : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {p.kind ? KIND_LABELS[p.kind] : "Old checkout"}
                        {p.offerCode ? ` · ${p.offerCode}` : ""}
                        {p.createdBy && p.createdBy !== "auto-renew" && p.createdBy.endsWith("@eazotel.com") ? ` · by ${p.createdBy}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{exactRupees(p.amount)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge payment={p} />
                    </TableCell>
                    <TableCell>
                      <InvoiceCell payment={p} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <span className="block">{p.paymentId ?? "—"}</span>
                      <span className="block">{p.orderId}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {pages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={query.page <= 1} onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="tabular-nums text-muted-foreground">
                  Page {query.page} of {pages}
                </span>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={query.page >= pages} onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function NoBillingAccess() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Sparkles className="size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">You don&apos;t have access to billing</p>
      <p className="text-sm text-muted-foreground">A super admin can give you &quot;View billing&quot; from the Team page.</p>
    </div>
  );
}
