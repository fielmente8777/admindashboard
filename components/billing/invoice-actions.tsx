"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FilePlus2, LoaderCircle, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { billingApi, exactRupees, type Payment } from "@/lib/api/billing-api";
import { formatDateTime } from "@/lib/format";

import { useCan } from "./billing-nav";

/** The invoice column of a payments table: download and email it, or create it for an older payment. */
export function InvoiceCell({ payment }: { payment: Payment }) {
  const queryClient = useQueryClient();
  const canManage = useCan("billing.manage");
  const [emailing, setEmailing] = useState(false);

  const download = useMutation({
    mutationFn: (id: string) => billingApi.downloadInvoice(id),
    onError: (error) => toast.error(error.message),
  });
  const create = useMutation({
    mutationFn: () => billingApi.createInvoice(payment.orderId),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["billing", "payments"] });
      toast.success(`Invoice ${invoice.number} created`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (payment.invoice) {
    const invoice = payment.invoice;
    return (
      <div className="flex items-center gap-1">
        <span className="mr-1 font-mono text-xs">{invoice.number}</span>
        <Button variant="ghost" size="icon" aria-label={`Download invoice ${invoice.number}`} disabled={download.isPending} onClick={() => download.mutate(invoice.id)}>
          {download.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label={`Email invoice ${invoice.number}`} onClick={() => setEmailing(true)}>
          <Mail className="size-4" />
        </Button>
        {emailing && <EmailInvoiceDialog invoiceId={invoice.id} onClose={() => setEmailing(false)} />}
      </div>
    );
  }
  if (payment.status === "SUCCESS" && payment.amount > 0 && canManage) {
    return (
      <Button variant="outline" size="sm" disabled={create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <FilePlus2 className="size-3.5" />}
        Create invoice
      </Button>
    );
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}

function EmailInvoiceDialog({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const invoice = useQuery({ queryKey: ["billing", "invoice", invoiceId], queryFn: () => billingApi.invoice(invoiceId) });
  const [picked, setPicked] = useState<string[] | null>(null);
  const [other, setOther] = useState("");
  const suggested = invoice.data?.suggestedRecipients ?? [];
  const selected = picked ?? suggested;
  const extra = other
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const recipients = [...new Set([...selected, ...extra])];

  const send = useMutation({
    mutationFn: () => billingApi.emailInvoice(invoiceId, recipients),
    onSuccess: (sent) => {
      void queryClient.invalidateQueries({ queryKey: ["billing", "invoice", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(`Invoice ${sent.number} sent to ${recipients.join(", ")}`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email invoice{invoice.data ? ` ${invoice.data.number}` : ""}</DialogTitle>
          <DialogDescription>
            {invoice.data
              ? `${invoice.data.buyerName} · ${exactRupees(invoice.data.totalPaise)} · the PDF is attached.`
              : "The PDF is attached to the email."}
          </DialogDescription>
        </DialogHeader>
        {!invoice.data ? (
          <Skeleton className="h-24" />
        ) : (
          <div className="space-y-4">
            {suggested.length > 0 && (
              <div className="space-y-2">
                {suggested.map((email) => (
                  <label key={email} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={selected.includes(email)}
                      onCheckedChange={(on) => setPicked(on ? [...selected, email] : selected.filter((e) => e !== email))}
                    />
                    {email}
                  </label>
                ))}
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="invoice-other">Other addresses</FieldLabel>
              <Input id="invoice-other" placeholder="accounts@hotel.com" value={other} onChange={(e) => setOther(e.target.value)} />
              <FieldDescription>Separate several with commas. Up to 5 in total.</FieldDescription>
            </Field>
            {invoice.data.lastEmailedAt && (
              <p className="text-xs text-muted-foreground">
                Last sent {formatDateTime(invoice.data.lastEmailedAt)} to {invoice.data.emailedTo.join(", ")}.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!recipients.length || recipients.length > 5 || send.isPending} onClick={() => send.mutate()}>
            {send.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Send invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
