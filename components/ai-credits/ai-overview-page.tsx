"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Coins, DollarSign, ShieldCheck, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";

import { Stat } from "@/components/billing/billing-overview-page";
import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader } from "@/components/layout/page-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { aiCreditsApi, credits, inr, usd, utcDay, type Overview } from "@/lib/api/ai-credits-api";
import { formatDateTime } from "@/lib/format";

import { AiCreditsNav, LevelBadge, NoCreditsAccess } from "./ai-credits-nav";

/** The company OpenAI account and every client's credits, in one screen (credits.pricing). */
export function AiOverviewPage() {
  const canPricing = useCan("credits.pricing");
  const overview = useQuery({ queryKey: ["ai-credits", "overview"], queryFn: () => aiCreditsApi.overview(), enabled: canPricing });

  if (!canPricing) return <NoCreditsAccess permission="credits.pricing" />;
  const o = overview.data;

  return (
    <>
      <PageHeader title="AI credits" description="The company OpenAI account, and the credits hotels hold. Days are UTC, as OpenAI counts them." />
      <AiCreditsNav />
      {overview.isError ? (
        <LoadFailed error={overview.error} onRetry={() => void overview.refetch()} />
      ) : !o ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {!o.chargingEnabled && (
            <div role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>AI credits are off: AI is free for every hotel and nothing is charged.</span>
              <Link href="/ai-credits/settings" className="font-medium underline">
                Change in Settings
              </Link>
            </div>
          )}
          <PoolNotices o={o} />

          <section aria-labelledby="pool-heading" className="space-y-3">
            <h2 id="pool-heading" className="text-sm font-semibold text-muted-foreground">
              OpenAI account
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                icon={Wallet}
                label="Remaining (estimated)"
                value={usd(o.openai.remainingUsd)}
                hint={o.openai.trackedSince ? `${usd(o.openai.topUpsUsd)} topped up − ${usd(o.openai.spentUsd)} spent since ${utcDay(o.openai.trackedSince)}` : "record a top-up to start"}
              />
              <Stat
                icon={CalendarClock}
                label="Runway"
                value={o.openai.runwayDays === null ? "—" : `${o.openai.runwayDays} days`}
                hint={`at ${usd(o.openai.avgDailyUsd)} a day (last 7 days)`}
              />
              <Stat
                icon={DollarSign}
                label="Spent, last 30 days"
                value={usd(o.openai.spend.last30Usd)}
                hint={`today ${usd(o.openai.spend.todayUsd)} · 7 days ${usd(o.openai.spend.last7Usd)}`}
              />
              <Stat
                icon={ShieldCheck}
                label="Coverage"
                value={o.coverage.ratio === null ? "—" : `${o.coverage.ratio}×`}
                hint={
                  o.coverage.liabilityUsd === null
                    ? "needs active USD prices"
                    : `unused credits would cost ${usd(o.coverage.liabilityUsd)} at OpenAI`
                }
              />
            </div>
            {o.settings.usdInrRate && o.openai.remainingUsd !== null && (
              <p className="text-xs text-muted-foreground">
                ≈ {inr(o.openai.remainingUsd * o.settings.usdInrRate, 0)} remaining at ₹{o.settings.usdInrRate}/$.
              </p>
            )}
          </section>

          <section aria-labelledby="credits-heading" className="space-y-3">
            <h2 id="credits-heading" className="text-sm font-semibold text-muted-foreground">
              Hotel credits
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat icon={Coins} label="Unused credits" value={credits(o.credits.available)} hint={`${credits(o.credits.reserved)} held by running requests`} />
              <Stat icon={Coins} label="Bought, all time" value={credits(o.credits.totalPurchased)} />
              <Stat icon={Coins} label="Used, all time" value={credits(o.credits.totalUsed)} />
              <Stat icon={Wallet} label="Wallets" value={credits(o.credits.wallets)} hint={`${o.credits.suspended} suspended`} />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Lowest wallets</CardTitle>
              <CardDescription>Below the low-balance level. Their AI stops when they reach zero.</CardDescription>
            </CardHeader>
            <CardContent>
              {o.lowWallets.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Every wallet is above the low level.</p>
              ) : (
                <ul className="divide-y">
                  {o.lowWallets.map((w) => (
                    <li key={w.ndid} className="flex items-center justify-between gap-3 py-2.5">
                      <Link href={`/ai-credits/clients/${encodeURIComponent(w.ndid)}`} className="truncate font-medium hover:underline">
                        {w.hotelName ?? w.ndid}
                      </Link>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="tabular-nums text-sm">{credits(w.wallet.available)}</span>
                        <LevelBadge level={w.level} status={w.wallet.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function PoolNotices({ o }: { o: Overview }) {
  const notices: string[] = [];
  if (!o.openai.configured) notices.push("The OpenAI admin key is not set on the server (OPENAI_ADMIN_KEY), so no cost data comes in.");
  else if (o.openai.lastSync && !o.openai.lastSync.ok)
    notices.push(`The last OpenAI sync failed (${o.openai.lastSync.error}) at ${formatDateTime(o.openai.lastSync.at)}.`);
  if (o.openai.configured && !o.openai.trackedSince) notices.push("No top-up recorded yet: add the balance OpenAI shows today as the first top-up (OpenAI account tab).");
  if (o.alerts.includes("low_pool")) notices.push(`The pool is below the ${usd(o.settings.lowPoolUsd)} alert level. Top up OpenAI.`);
  if (o.alerts.includes("low_runway")) notices.push(`At the current spend the pool lasts fewer than ${o.settings.lowRunwayDays} days.`);
  if (o.coverage.ratio !== null && o.coverage.ratio < 1) notices.push("The pool can't cover every credit hotels already hold.");
  if (!notices.length) return null;
  return (
    <div role="status" className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {notices.map((n) => (
        <p key={n} className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {n}
        </p>
      ))}
    </div>
  );
}
