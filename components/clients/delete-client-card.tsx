"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, LoaderCircle, Trash2, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { clientsApi } from "@/lib/api/clients-api";
import { useAuthStore } from "@/stores/auth-store";

/** Plain names for the collections staff will recognise; anything else shows as stored. */
const LABELS: Record<string, string> = {
  Zucks_profile: "Hotel profile",
  Zucks_users: "Dashboard logins",
  ContactUs: "Leads",
  Contact: "Contacts",
  subscriptions: "Subscription",
  BookingEngineData: "Booking engine",
  WebsiteData: "Website",
  Rooms: "Rooms",
  Eazbot: "Chatbot",
  calls: "Calls",
  notifications: "Notifications",
  auth_credentials: "Passwords",
  auth_refresh_tokens: "Sign-in sessions",
};

const normalize = (text: string) =>
  text.trim().replace(/\s+/g, " ").toLowerCase();

function DeleteDialog({
  ndid,
  onClose,
}: {
  ndid: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const from = useSearchParams().get("from");
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const preview = useQuery({
    queryKey: ["clients", "deletion-preview", ndid],
    queryFn: () => clientsApi.deletionPreview(ndid),
    gcTime: 0,
  });

  const expected = preview.data
    ? preview.data.hotelName?.trim() || preview.data.ndid
    : "";
  const matches = Boolean(expected) && normalize(typed) === normalize(expected);

  const remove = useMutation({
    mutationFn: () =>
      clientsApi.delete(ndid, typed, reason.trim() || undefined),
    onSuccess: (result) => {
      toast.success(
        `Deleted ${expected}: ${result.total.toLocaleString("en-IN")} records archived and removed.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      router.replace(from === "subscriptions" ? "/subscriptions" : "/clients");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && !remove.isPending && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-5" aria-hidden />
            Delete {preview.data?.hotelName ?? "this client"}?
          </DialogTitle>
          <DialogDescription>
            Every record of this hotel is removed from the live database: its
            logins stop working, its website and booking engine lose their data,
            and its leads disappear from every screen. A copy of each record is
            kept in the archive, so the Eazotel team can restore it if this was
            a mistake.
          </DialogDescription>
        </DialogHeader>

        {preview.isPending && <Skeleton className="h-28 w-full" />}
        {preview.error && (
          <p className="text-sm text-destructive">{preview.error.message}</p>
        )}
        {preview.data && (
          <div className="rounded-lg border bg-muted/30">
            <p className="border-b px-3 py-2 text-sm font-medium">
              {preview.data.total.toLocaleString("en-IN")} records will be
              deleted
            </p>
            <ul className="max-h-44 divide-y overflow-y-auto text-sm">
              {preview.data.collections.map((c) => (
                <li
                  key={c.collection}
                  className="flex items-center justify-between px-3 py-1.5"
                >
                  <span>
                    {LABELS[c.collection] ?? c.collection}
                    {LABELS[c.collection] && (
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                        {c.collection}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.count.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {preview.data && (
          <div className="space-y-3">
            <Field>
              {/* the name sits outside the <label> (select-none, and a click there focuses the input) so it can be copied */}
              <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                <FieldLabel htmlFor="delete-confirm">Type</FieldLabel>
                <span className="rounded bg-muted px-1.5 py-0.5 font-semibold select-all">
                  {expected}
                </span>
                <span>to confirm</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Copy the name"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(expected)
                      .then(() => toast.success("Copied"))
                      .catch(() => toast.error("Couldn't copy. Select the name and press Ctrl+C."))
                  }
                >
                  <Copy aria-hidden />
                </Button>
              </div>
              <Input
                id="delete-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                aria-invalid={typed.length > 0 && !matches}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="delete-reason">Reason</FieldLabel>
              <Input
                id="delete-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. demo account, created by mistake"
              />
              <FieldDescription>Saved in the activity log.</FieldDescription>
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={remove.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            ) : (
              <Trash2 data-icon="inline-start" aria-hidden />
            )}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The danger zone at the bottom of a client page. Super admins only; the API checks it too. */
export function DeleteClientCard({
  ndid,
  hotelName,
}: {
  ndid: string;
  hotelName: string | null;
}) {
  const canDelete = useAuthStore((state) =>
    state.user?.permissions.includes("clients.delete"),
  );
  const [open, setOpen] = useState(false);
  if (!canDelete) return null;

  return (
    <Card className="mt-6 border-destructive/30">
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-destructive">Danger zone</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Delete {hotelName ?? "this client"} and every record it has, for
            demo or wrong accounts. Only super admins can do this.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 data-icon="inline-start" aria-hidden />
          Delete client
        </Button>
      </CardContent>
      {open && (
        <Suspense fallback={null}>
          <DeleteDialog ndid={ndid} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </Card>
  );
}
