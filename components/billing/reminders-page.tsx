"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LoadFailed, PageHeader, TableLoading } from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  offsetLabel,
  remindersApi,
  type ChannelResult,
  type ReminderSettings,
  type ReminderSettingsInput,
} from "@/lib/api/reminders-api";
import { formatDay } from "@/lib/api/subscriptions-api";
import { formatDateTime } from "@/lib/format";

import { BillingNav, useCan } from "./billing-nav";
import { NoBillingAccess } from "./billing-overview-page";
import { Toggle } from "./plan-dialog";

/** The template body to submit in Meta's WhatsApp Manager (Utility category, 4 values). */
const TEMPLATE_BODY =
  "Hello {{1}}, your Eazotel {{2}} {{3}}. Renew here to keep your chatbot and lead alerts running: {{4}}\n\nThank you, Team Eazotel";

const days = (list: number[]) => list.join(", ");
const withoutStamp = ({ updatedAt, updatedBy, ...settings }: ReminderSettings): ReminderSettingsInput => {
  void updatedAt;
  void updatedBy;
  return settings;
};
const parseDays = (text: string) =>
  [...new Set(text.split(/[\s,]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 60))].slice(0, 10);

function ChannelBadge({ channel }: { channel: ChannelResult }) {
  const tone =
    channel.status === "sent"
      ? "bg-emerald-50 text-emerald-700"
      : channel.status === "failed"
        ? "bg-red-50 text-red-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span title={channel.note ?? channel.to.join(", ")} className={`rounded-md px-1.5 py-0.5 text-xs ${tone}`}>
      {channel.status}
    </span>
  );
}

export function RemindersPage() {
  const canView = useCan("billing.view");
  const canManage = useCan("billing.manage");
  const queryClient = useQueryClient();
  const overview = useQuery({ queryKey: ["reminders", "overview"], queryFn: () => remindersApi.overview(), enabled: canView });
  const upcoming = useQuery({ queryKey: ["reminders", "upcoming"], queryFn: () => remindersApi.upcoming(7), enabled: canView });
  const log = useQuery({ queryKey: ["reminders", "log"], queryFn: () => remindersApi.log({ limit: 50 }), enabled: canView });

  // unsaved edits only; until the first edit the form shows what the server has
  const [draft, setDraft] = useState<ReminderSettingsInput | null>(null);
  const [beforeDraft, setBeforeText] = useState<string | null>(null);
  const [afterDraft, setAfterText] = useState<string | null>(null);
  const form = draft ?? (overview.data ? withoutStamp(overview.data.settings) : null);
  const beforeText = beforeDraft ?? (form ? days(form.daysBefore) : "");
  const afterText = afterDraft ?? (form ? days(form.daysAfter) : "");

  const save = useMutation({
    mutationFn: (input: ReminderSettingsInput) => remindersApi.save(input),
    onSuccess: (saved) => {
      setDraft(null);
      setBeforeText(null);
      setAfterText(null);
      queryClient.setQueryData(["reminders", "overview"], saved);
      void queryClient.invalidateQueries({ queryKey: ["reminders", "upcoming"] });
      toast.success(saved.settings.enabled ? "Saved. Reminders are on." : "Saved. Reminders are off.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (!canView) return <NoBillingAccess />;
  const set = <K extends keyof ReminderSettingsInput>(key: K, value: ReminderSettingsInput[K]) =>
    setDraft((f) => {
      const base = f ?? form;
      return base ? { ...base, [key]: value } : base;
    });

  return (
    <>
      <PageHeader
        title="Billing"
        description="Email and WhatsApp reminders before a plan ends, on the day, and after it for hotels that forgot to renew."
      />
      <BillingNav />

      {overview.isError ? (
        <LoadFailed error={overview.error} onRetry={() => void overview.refetch()} />
      ) : !overview.data || !form ? (
        <TableLoading />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                Schedule
                <Badge variant={overview.data.settings.enabled ? "default" : "outline"}>
                  {overview.data.settings.enabled ? "On" : "Off"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <fieldset disabled={!canManage || save.isPending} className="flex flex-col gap-4">
                <Toggle
                  label="Send reminders"
                  hint={`Every day from ${String(form.sendHourIst).padStart(2, "0")}:00 India time. Off: nothing is sent, but you can still send one by hand from Clients.`}
                  checked={form.enabled}
                  onChange={(v) => set("enabled", v)}
                />
                <Field>
                  <FieldLabel htmlFor="r-before">Days before the end</FieldLabel>
                  <Input id="r-before" value={beforeText} onChange={(e) => setBeforeText(e.target.value)} placeholder="7, 3, 1" />
                </Field>
                <Toggle label="On the end day" hint="The day the plan ends." checked={form.onEndDay} onChange={(v) => set("onEndDay", v)} />
                <Field>
                  <FieldLabel htmlFor="r-after">Days after it ended</FieldLabel>
                  <Input id="r-after" value={afterText} onChange={(e) => setAfterText(e.target.value)} placeholder="1, 3, 7" />
                  <FieldDescription>For hotels that forgot to renew. Renewing stops the rest.</FieldDescription>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Toggle
                    label="Email"
                    hint={overview.data.emailReady ? "To the hotel email and the account holder." : "No mail server on this machine: emails only go to the logs."}
                    checked={form.channels.email}
                    onChange={(v) => set("channels", { ...form.channels, email: v })}
                  />
                  <Toggle
                    label="WhatsApp"
                    hint={overview.data.whatsappReady ? "From Eazotel's number, to the hotel and owner phones." : "The server has no WhatsApp number yet (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN)."}
                    checked={form.channels.whatsapp}
                    onChange={(v) => set("channels", { ...form.channels, whatsapp: v })}
                  />
                </div>
                <Toggle label="Free trials too" hint="Remind hotels whose 14-day trial is ending." checked={form.includeTrial} onChange={(v) => set("includeTrial", v)} />
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <Field>
                    <FieldLabel htmlFor="r-template">WhatsApp template</FieldLabel>
                    <Input id="r-template" value={form.whatsappTemplate.name} onChange={(e) => set("whatsappTemplate", { ...form.whatsappTemplate, name: e.target.value.trim() })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="r-lang">Language</FieldLabel>
                    <Input id="r-lang" value={form.whatsappTemplate.language} onChange={(e) => set("whatsappTemplate", { ...form.whatsappTemplate, language: e.target.value.trim() })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="r-hour">From (hour)</FieldLabel>
                    <Input id="r-hour" type="number" min={0} max={23} value={form.sendHourIst} onChange={(e) => set("sendHourIst", Math.min(23, Math.max(0, Number(e.target.value) || 0)))} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="r-url">Renew link</FieldLabel>
                  <Input id="r-url" value={form.renewUrl} onChange={(e) => set("renewUrl", e.target.value.trim())} placeholder="https://app.eazotel.com/plans" />
                  <FieldDescription>The hotel dashboard&apos;s plans page. Empty: the message says where to find it instead.</FieldDescription>
                </Field>
                {canManage && (
                  <Button
                    className="self-start"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ ...form, daysBefore: parseDays(beforeText), daysAfter: parseDays(afterText) })}
                  >
                    {save.isPending && <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />}
                    Save schedule
                  </Button>
                )}
                {overview.data.settings.updatedBy && (
                  <p className="text-xs text-muted-foreground">
                    Last changed by {overview.data.settings.updatedBy}
                    {overview.data.settings.updatedAt ? `, ${formatDateTime(overview.data.settings.updatedAt)}` : ""}
                  </p>
                )}
              </fieldset>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>WhatsApp template to submit to Meta</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">
                  In WhatsApp Manager, create a <strong>Utility</strong> template named{" "}
                  <code className="rounded bg-muted px-1">{form.whatsappTemplate.name}</code> in{" "}
                  <code className="rounded bg-muted px-1">{form.whatsappTemplate.language}</code> with this body. WhatsApp
                  reminders work once Meta approves it.
                </p>
                <pre className="rounded-lg border bg-muted/40 p-3 text-xs whitespace-pre-wrap">{TEMPLATE_BODY}</pre>
                <p className="text-xs text-muted-foreground">
                  Example values: {"{{1}}"} Greencastle · {"{{2}}"} PRO plan · {"{{3}}"} ends on 18 November 2026, in 7 days ·{" "}
                  {"{{4}}"} the renew link.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coming up in the next 7 days</CardTitle>
              </CardHeader>
              <CardContent>
                {upcoming.isPending ? (
                  <TableLoading />
                ) : (upcoming.data ?? []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {overview.data.settings.enabled ? "No reminders due this week." : "Reminders are off; this is who would get one."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Hotel</TableHead>
                        <TableHead>Reminder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(upcoming.data ?? []).map((u) => (
                        <TableRow key={`${u.ndid}-${u.offsetDays}`}>
                          <TableCell className="text-sm whitespace-nowrap">{formatDay(u.sendOn)}</TableCell>
                          <TableCell className="text-sm">{u.hotelName ?? u.ndid}</TableCell>
                          <TableCell className="text-sm">
                            {offsetLabel(u.offsetDays)}
                            <div className="text-xs text-muted-foreground">
                              {u.trial ? "trial" : (u.planName ?? "plan")} ends {formatDay(u.endDate)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Sent</CardTitle>
            </CardHeader>
            <CardContent>
              {log.isPending ? (
                <TableLoading />
              ) : (log.data ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No reminders sent yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Hotel</TableHead>
                      <TableHead>Reminder</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>WhatsApp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(log.data ?? []).map((r) => (
                      <TableRow key={r.id || `${r.ndid}-${r.sentAt}`}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDateTime(r.sentAt)}</TableCell>
                        <TableCell className="text-sm">{r.hotelName ?? r.ndid}</TableCell>
                        <TableCell className="text-sm">
                          {offsetLabel(r.offsetDays)}
                          <div className="text-xs text-muted-foreground">
                            {r.kind === "manual" ? `sent by ${r.by}` : "scheduled"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChannelBadge channel={r.email} />
                        </TableCell>
                        <TableCell>
                          <ChannelBadge channel={r.whatsapp} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
