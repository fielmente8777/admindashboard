"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, LoaderCircle, Pause, Play, Trash2, Undo2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCan } from "@/components/billing/billing-nav";
import { Button } from "@/components/ui/button";
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
import { clientBulkApi, type BulkAction, type BulkResult } from "@/lib/api/clients-api";
import { remindersApi } from "@/lib/api/reminders-api";

type Action = BulkAction | "remind";

const WORDS: Record<Action, { title: string; verb: string; done: string }> = {
  pause: { title: "Pause subscriptions", verb: "Pause", done: "paused" },
  resume: { title: "Resume subscriptions", verb: "Resume", done: "resumed" },
  trash: { title: "Move to the trash", verb: "Move to trash", done: "moved to the trash" },
  restore: { title: "Restore from the trash", verb: "Restore", done: "restored" },
  delete: { title: "Delete forever", verb: "Delete forever", done: "deleted" },
  remind: { title: "Send a renewal reminder", verb: "Send reminder", done: "reminded" },
};

const EXPLAIN: Record<Action, string> = {
  pause:
    "Their time stops: the chatbot and lead alerts switch off, and the days left are kept for when you resume.",
  resume: "Their paused time starts again, with the days that were left.",
  trash:
    "A temporary delete. They disappear from every list and their subscription is paused, but nothing is deleted. Restore them from the Trash at any time.",
  restore: "They come back to the lists, and the pause the trash made is undone.",
  delete:
    "Every record of these clients, in every collection, is copied to the archive and then deleted. Their dashboards stop working. Use the trash instead unless you are sure.",
  remind:
    "An email and a WhatsApp message now, whatever the schedule, with words that match how close each plan is to its end.",
};

/**
 * The bar shown over the client list once clients are picked, and its confirm dialog. Every
 * button appears only for staff who may use it. Each client is done on its own, so the result
 * lists what worked and what didn't.
 */
export function BulkActionBar({
  selected,
  names,
  view,
  onClear,
}: {
  selected: string[];
  names: Map<string, string | null>;
  view: "clients" | "trash";
  onClear: () => void;
}) {
  const canManageSubscriptions = useCan("subscriptions.manage");
  const canTrash = useCan("clients.trash");
  const canDelete = useCan("clients.delete");
  const [action, setAction] = useState<Action | null>(null);

  if (selected.length === 0) return null;
  const buttons: { action: Action; icon: typeof Pause; show: boolean; destructive?: boolean }[] =
    view === "trash"
      ? [
          { action: "restore", icon: Undo2, show: canTrash },
          { action: "delete", icon: Trash2, show: canDelete, destructive: true },
        ]
      : [
          { action: "remind", icon: BellRing, show: canManageSubscriptions },
          { action: "pause", icon: Pause, show: canManageSubscriptions },
          { action: "resume", icon: Play, show: canManageSubscriptions },
          { action: "trash", icon: Trash2, show: canTrash },
          { action: "delete", icon: Trash2, show: canDelete, destructive: true },
        ];

  return (
    <>
      <div
        role="toolbar"
        aria-label="Actions for the selected clients"
        className="sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur"
      >
        <span className="px-2 text-sm font-medium">
          {selected.length} selected
        </span>
        {buttons
          .filter((b) => b.show)
          .map(({ action: a, icon: Icon, destructive }) => (
            <Button
              key={a}
              size="sm"
              variant={destructive ? "destructive" : "outline"}
              onClick={() => setAction(a)}
            >
              <Icon data-icon="inline-start" aria-hidden />
              {WORDS[a].verb}
            </Button>
          ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onClear}>
          <X data-icon="inline-start" aria-hidden />
          Clear
        </Button>
      </div>
      {action && (
        <ConfirmBulk
          action={action}
          ndids={selected}
          names={names}
          onClose={() => setAction(null)}
          onDone={onClear}
        />
      )}
    </>
  );
}

function ConfirmBulk({
  action,
  ndids,
  names,
  onClose,
  onDone,
}: {
  action: Action;
  ndids: string[];
  names: Map<string, string | null>;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);
  const phrase = `DELETE ${ndids.length}`;
  const words = WORDS[action];

  const run = useMutation({
    mutationFn: async (): Promise<BulkResult> => {
      if (action === "remind") {
        const sent = await remindersApi.send(ndids);
        return {
          done: sent.sent,
          failed: sent.results.length - sent.sent,
          results: sent.results.map((r) => ({
            ndid: r.ndid,
            hotelName: r.entry?.hotelName ?? null,
            ok: r.ok,
            note: null,
            error: r.error,
            message: r.message,
          })),
        };
      }
      return clientBulkApi.run(action, ndids, {
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(action === "delete" ? { confirm } : {}),
      });
    },
    onSuccess: (outcome) => {
      for (const key of [["clients"], ["subscriptions"], ["activity"], ["reminders"]]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (outcome.failed === 0) {
        toast.success(`${outcome.done} client${outcome.done === 1 ? "" : "s"} ${words.done}`);
        onDone();
        onClose();
      } else {
        setResult(outcome);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const blocked = action === "delete" && confirm.trim().toUpperCase() !== phrase;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {words.title}: {ndids.length} client{ndids.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>{EXPLAIN[action]}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {result.done} done, {result.failed} not done:
            </p>
            <ul className="max-h-60 overflow-y-auto rounded-lg border p-2">
              {result.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.ndid} className="py-1">
                    <span className="font-medium">
                      {r.hotelName ?? names.get(r.ndid) ?? r.ndid}
                    </span>
                    : {r.message ?? r.error}
                  </li>
                ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="max-h-40 overflow-y-auto rounded-lg border p-2 text-sm">
              {ndids.map((ndid) => (
                <li key={ndid} className="py-0.5">
                  {names.get(ndid) ?? "Unnamed hotel"}{" "}
                  <span className="text-xs text-muted-foreground">{ndid}</span>
                </li>
              ))}
            </ul>
            {(action === "pause" || action === "trash" || action === "delete") && (
              <Field>
                <FieldLabel htmlFor="bulk-reason">Reason (for the activity log)</FieldLabel>
                <Input
                  id="bulk-reason"
                  value={reason}
                  maxLength={500}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Duplicate accounts, unpaid since March"
                />
              </Field>
            )}
            {action === "delete" && (
              <Field>
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  <FieldLabel htmlFor="bulk-confirm">Type</FieldLabel>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono select-all">{phrase}</span>
                  <span>to confirm</span>
                </div>
                <Input
                  id="bulk-confirm"
                  value={confirm}
                  autoComplete="off"
                  onChange={(event) => setConfirm(event.target.value)}
                />
                <FieldDescription>
                  A copy of every record is kept in the archive, but the hotels lose their dashboards.
                </FieldDescription>
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result && (
            <Button
              variant={action === "delete" ? "destructive" : "default"}
              disabled={run.isPending || blocked}
              onClick={() => run.mutate()}
            >
              {run.isPending && (
                <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
              )}
              {words.verb}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
