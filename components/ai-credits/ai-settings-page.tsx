"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/billing/billing-nav";
import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { aiCreditsApi, type AiSettings, type CreditSettings } from "@/lib/api/ai-credits-api";
import { formatDateTime } from "@/lib/format";

import { AiCreditsNav, NoCreditsAccess } from "./ai-credits-nav";
import { ChargingSwitch } from "./charging-switch";

type NumericSetting = Exclude<keyof CreditSettings, "enabled">;

const CREDIT_FIELDS: { key: NumericSetting; label: string; hint: string; step?: string }[] = [
  { key: "lowThreshold", label: "Low balance at", hint: "Credits. Dashboard banner and 'Low' here." },
  { key: "criticalThreshold", label: "Critical at", hint: "Credits. Must be below the low level." },
  { key: "chatReserveCredits", label: "Held per chatbot message", hint: "Credits held while a reply runs, then settled." },
  { key: "reserveMultiplier", label: "Hold headroom", hint: "× the estimate for knowledge-base jobs.", step: "0.05" },
  { key: "reservationTtlMinutes", label: "Hold expires after", hint: "Minutes. Stuck holds are released." },
  { key: "fallbackCreditsPer1kTokens", label: "Unpriced models: per 1K tokens", hint: "Credits, for models without a price row.", step: "any" },
  { key: "fallbackCreditsPerRequest", label: "Unpriced models: per call", hint: "Credits, for calls that report no tokens.", step: "any" },
];

export function AiSettingsPage() {
  const canPricing = useCan("credits.pricing");
  const settings = useQuery({ queryKey: ["ai-credits", "settings"], queryFn: () => aiCreditsApi.settings(), enabled: canPricing });
  if (!canPricing) return <NoCreditsAccess permission="credits.pricing" />;
  return (
    <>
      <PageHeader title="AI credits" description="How gian charges credits, and when the OpenAI pool alerts the team." />
      <AiCreditsNav />
      {settings.isError ? (
        <LoadFailed error={settings.error} onRetry={() => void settings.refetch()} />
      ) : !settings.data ? (
        <TableLoading />
      ) : (
        <div className="space-y-6">
          <ChargingSwitch enabled={settings.data.credits.enabled} />
          <SettingsForm initial={settings.data} />
        </div>
      )}
    </>
  );
}

function SettingsForm({ initial }: { initial: AiSettings }) {
  const queryClient = useQueryClient();
  const [creditsForm, setCredits] = useState(initial.credits);
  const [lowPoolUsd, setLowPool] = useState(initial.pool.lowPoolUsd);
  const [lowRunwayDays, setRunway] = useState(initial.pool.lowRunwayDays);
  const [rate, setRate] = useState(initial.pool.usdInrRate === null ? "" : String(initial.pool.usdInrRate));
  const [emails, setEmails] = useState(initial.pool.alertEmails.join("\n"));
  const thresholdsBad = creditsForm.criticalThreshold >= creditsForm.lowThreshold;

  const save = useMutation({
    mutationFn: () => {
      // the on/off switch saves on its own; never resend it from this form
      const changedCredits = Object.fromEntries(
        Object.entries(creditsForm).filter(
          ([k, v]) => k !== "enabled" && initial.credits[k as keyof CreditSettings] !== v,
        ),
      );
      return aiCreditsApi.saveSettings({
        ...(Object.keys(changedCredits).length ? { credits: changedCredits } : {}),
        pool: {
          lowPoolUsd,
          lowRunwayDays,
          usdInrRate: rate.trim() ? Number(rate) : null,
          alertEmails: emails.split(/[\s,]+/).map((e) => e.trim()).filter(Boolean),
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      toast.success("Settings saved");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Credit charging (gian)</CardTitle>
          <CardDescription>Used by every AI request. Saved to gian&apos;s settings and its audit log.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CREDIT_FIELDS.map(({ key, label, hint, step }) => (
            <Field key={key}>
              <FieldLabel htmlFor={`set-${key}`}>{label}</FieldLabel>
              <Input
                id={`set-${key}`}
                type="number"
                min={0}
                step={step ?? 1}
                value={creditsForm[key]}
                aria-invalid={(key === "criticalThreshold" || key === "lowThreshold") && thresholdsBad}
                onChange={(e) => setCredits((f) => ({ ...f, [key]: Number(e.target.value) }))}
              />
              <FieldDescription>{hint}</FieldDescription>
            </Field>
          ))}
          {thresholdsBad && <p className="text-sm text-destructive sm:col-span-2 lg:col-span-3">The critical level must be below the low level.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenAI pool alerts</CardTitle>
          <CardDescription>
            Every active super admin, plus the emails below, gets one email per problem per day. Checked after each sync (every 6 hours).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="set-pool">Alert below (USD)</FieldLabel>
            <Input id="set-pool" type="number" min={0} step="any" value={lowPoolUsd} onChange={(e) => setLowPool(Number(e.target.value))} />
          </Field>
          <Field>
            <FieldLabel htmlFor="set-runway">Alert when it lasts fewer than (days)</FieldLabel>
            <Input id="set-runway" type="number" min={0} step="any" value={lowRunwayDays} onChange={(e) => setRunway(Number(e.target.value))} />
          </Field>
          <Field>
            <FieldLabel htmlFor="set-rate">USD → INR rate</FieldLabel>
            <Input id="set-rate" type="number" min={0} step="any" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="not set" />
            <FieldDescription>
              For ₹ figures and margins only; never fetched live.
              {initial.pool.usdInrRateUpdatedAt && ` Set ${formatDateTime(initial.pool.usdInrRateUpdatedAt)}.`}
            </FieldDescription>
          </Field>
          <Field className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="set-emails">Also email (one per line)</FieldLabel>
            <textarea
              id="set-emails"
              rows={3}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="finance@eazotel.com"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending || thresholdsBad}>
          {save.isPending && <LoaderCircle className="size-4 animate-spin" />} Save settings
        </Button>
      </div>
    </form>
  );
}
