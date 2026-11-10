"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Check, Loader2, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { clientsApi, propertyLabel } from "@/lib/api/clients-api";
import {
  linkLabel,
  metaPagesApi,
  type MetaPage,
} from "@/lib/api/meta-pages-api";

interface Choice {
  ndid: string;
  hid: string;
  label: string;
}

/** Choose the client property that gets this page's new leads. */
export function LinkPageDialog({
  page,
  onClose,
}: {
  page: MetaPage;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  // start the search from the page's own name: it is usually the hotel's
  const [search, setSearch] = useState(page.name ?? "");
  const query = useDeferredValue(search.trim());
  const [choice, setChoice] = useState<Choice | null>(null);

  const results = useQuery({
    queryKey: ["clients", "list", query, "meta-link"],
    queryFn: () => clientsApi.list({ search: query, limit: 8 }),
    enabled: query.length >= 2,
  });

  const save = useMutation({
    mutationFn: (c: Choice) => metaPagesApi.link(page.pageId, c.ndid, c.hid),
    onSuccess: (_page, c) => {
      void queryClient.invalidateQueries({ queryKey: ["meta-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(`${page.name ?? "Page"}: new leads now go to ${c.label}`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  const copies = page.connections.length;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {page.link ? "Change" : "Link"} {page.name ?? page.pageId}
          </DialogTitle>
          <DialogDescription>
            New Facebook leads from this page will go to the property you pick.
            Leads already saved stay where they are.
            {copies > 1 &&
              ` The page is in ${copies} Meta sign-ins; all of them are updated.`}
          </DialogDescription>
        </DialogHeader>

        {page.link && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            Now: <span className="font-medium">{linkLabel(page.link)}</span>
          </p>
        )}

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hotels by name, domain, email or ndid"
            aria-label="Search clients"
            className="pl-8"
            autoFocus
          />
        </div>

        <div
          className="max-h-72 min-h-24 overflow-y-auto rounded-lg border"
          role="listbox"
          aria-label="Properties"
        >
          {query.length < 2 && (
            <p className="p-3 text-sm text-muted-foreground">
              Type at least two letters.
            </p>
          )}
          {query.length >= 2 && results.isPending && (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          )}
          {results.error && (
            <p className="p-3 text-sm text-destructive">
              {results.error.message}
            </p>
          )}
          {results.data?.items.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              No hotel matches. Try part of the name or the ndid.
            </p>
          )}
          {results.data?.items.map((client) => (
            <div key={client.ndid} className="border-b p-2 last:border-b-0">
              <p className="flex items-baseline justify-between gap-2 px-1 text-xs font-medium text-muted-foreground">
                <span>{client.hotelName ?? "Unnamed hotel"}</span>
                <span className="font-mono text-[10px]">{client.ndid}</span>
              </p>
              {client.properties.map((p) => {
                const label = `${client.hotelName ?? "Hotel"}${
                  p.name && p.name !== client.hotelName ? ` · ${p.name}` : ""
                }`;
                const chosen =
                  choice?.ndid === client.ndid && choice.hid === p.hid;
                const current =
                  page.link?.ndid === client.ndid && page.link.hid === p.hid;
                return (
                  <button
                    key={p.hid}
                    type="button"
                    role="option"
                    aria-selected={chosen}
                    disabled={current}
                    onClick={() =>
                      setChoice({ ndid: client.ndid, hid: p.hid, label })
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-default disabled:opacity-60",
                      chosen && "bg-brand-navy/10 font-medium text-brand-navy",
                    )}
                  >
                    <Check
                      className={cn("size-4 shrink-0", !chosen && "invisible")}
                      aria-hidden
                    />
                    <span className="flex-1">
                      {propertyLabel(p, client.hotelName)}
                      {current && " (now)"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {p.hid}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!choice || save.isPending}
            onClick={() => choice && save.mutate(choice)}
          >
            {save.isPending && (
              <Loader2
                className="animate-spin"
                data-icon="inline-start"
                aria-hidden
              />
            )}
            {choice ? `Send leads to ${choice.label}` : "Pick a property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
