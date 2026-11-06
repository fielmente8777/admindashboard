"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { billingApi, type BillingSettings, type InvoiceSeller } from "@/lib/api/billing-api";

const FIELDS: { key: keyof InvoiceSeller; label: string; hint?: string; wide?: boolean }[] = [
  { key: "name", label: "Company name" },
  { key: "gstin", label: "GSTIN", hint: "Printed as TAX INVOICE when set" },
  { key: "state", label: "State", hint: "Same state as the hotel: CGST + SGST; otherwise IGST" },
  { key: "pan", label: "PAN" },
  { key: "email", label: "Billing email" },
  { key: "phone", label: "Phone" },
  { key: "sac", label: "SAC code", hint: "Ask your accountant; empty leaves it out" },
  { key: "prefix", label: "Number prefix", hint: "EZ gives EZ/26-27/00001" },
];

/** Eazotel's details on every invoice. New invoices use them; issued ones never change. */
export function InvoiceDetailsCard({ settings, canManage }: { settings: BillingSettings; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<InvoiceSeller>(settings.invoice);
  const missing = !settings.invoice.gstin || !settings.invoice.address || !settings.invoice.state;

  const save = useMutation({
    mutationFn: () =>
      billingApi.saveSettings({
        gstPercent: settings.gstPercent,
        seatPrice: settings.seatPrice,
        trialDays: settings.trialDays,
        cycles: settings.cycles,
        invoice: form,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Invoice details saved. New invoices will use them.");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice details</CardTitle>
        <CardDescription>Eazotel&apos;s details on every invoice hotels receive. Invoices already issued never change.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {missing && (
          <p className="flex gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Add the GSTIN, address and state before hotels start paying, so their invoices are valid GST invoices.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, hint }) => (
            <Field key={key}>
              <FieldLabel htmlFor={`seller-${key}`}>{label}</FieldLabel>
              <Input
                id={`seller-${key}`}
                disabled={!canManage}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: key === "gstin" || key === "pan" || key === "prefix" ? e.target.value.toUpperCase() : e.target.value })}
              />
              {hint && <FieldDescription>{hint}</FieldDescription>}
            </Field>
          ))}
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="seller-address">Registered address</FieldLabel>
            <textarea
              id="seller-address"
              rows={3}
              disabled={!canManage}
              className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </Field>
        </div>
        {canManage && (
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Save invoice details
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
