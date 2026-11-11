"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { useCan } from "@/components/billing/billing-nav";
import {
  LoadFailed,
  PageHeader,
  TableLoading,
} from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientBulkApi, clientsApi, propertyLabel } from "@/lib/api/clients-api";
import { formatDay } from "@/lib/api/subscriptions-api";
import { useAuthStore } from "@/stores/auth-store";

import { BulkActionBar } from "./bulk-actions";

type View = "clients" | "test" | "trash";

const VIEW_LABEL: Record<View, string> = { clients: "Clients", test: "Test", trash: "Trash" };

export function ClientsPage() {
  const allProperties = useAuthStore((state) => state.user?.allProperties);
  const canTrash = useCan("clients.trash");
  const [view, setView] = useState<View>("clients");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clients = useInfiniteQuery({
    queryKey: ["clients", "list", view, search],
    queryFn: ({ pageParam }) =>
      clientsApi.list({ search, after: pageParam, kind: view === "test" ? "test" : "clients" }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: view !== "trash",
  });
  const trash = useQuery({
    queryKey: ["clients", "trash"],
    queryFn: () => clientBulkApi.trash(),
    enabled: view === "trash" && canTrash,
  });

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(input.trim());
  }

  function switchView(next: View) {
    setView(next);
    setSelected(new Set());
  }

  const rows = clients.data?.pages.flatMap((page) => page.items) ?? [];
  const trashed = trash.data ?? [];
  const visibleIds = view === "trash" ? trashed.map((t) => t.ndid) : rows.map((r) => r.ndid);
  const names = new Map<string, string | null>([
    ...rows.map((r) => [r.ndid, r.hotelName] as const),
    ...trashed.map((t) => [t.ndid, t.hotelName] as const),
  ]);
  const allPicked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (ndid: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(ndid);
      else next.delete(ndid);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(visibleIds.slice(0, 50)) : new Set());

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          allProperties
            ? "Every hotel on Eazotel. Tick clients to pause, remind, move to the trash or delete several at once."
            : "The hotels with properties assigned to you. Ask a super admin for more."
        }
      />

      <nav aria-label="Client lists" className="mb-4 flex gap-1 border-b">
          {(canTrash ? (["clients", "test", "trash"] as const) : (["clients", "test"] as const)).map((v) => (
            <button
              key={v}
              type="button"
              aria-current={view === v ? "page" : undefined}
              onClick={() => switchView(v)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                view === v
                  ? "border-brand-orange text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {VIEW_LABEL[v]}
            </button>
          ))}
        </nav>

      {view === "test" && (
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Dashboards the team made for testing: accounts whose owner logs in with an @eazotel.com or
          @fielmente.com email. A real hotel that only has an Eazotel team member or contact email stays under
          Clients. Test accounts are kept out of the Clients and Subscriptions lists.
        </p>
      )}

      {view !== "trash" && (
        <form onSubmit={applySearch} className="mb-4 flex max-w-md gap-2">
          <Input
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Hotel name, domain, login email or ndid"
            aria-label="Search clients"
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search aria-hidden />
          </Button>
        </form>
      )}

      {view === "trash" && (
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Clients here are hidden from every list and their subscription is paused. Nothing is deleted:
          restore them to bring everything back, or delete them forever.
        </p>
      )}

      <BulkActionBar
        selected={[...selected]}
        names={names}
        view={view === "trash" ? "trash" : "clients"}
        onClear={() => setSelected(new Set())}
      />

      {view !== "trash" && clients.isPending && <TableLoading />}
      {view !== "trash" && clients.error && (
        <LoadFailed error={clients.error} onRetry={() => void clients.refetch()} />
      )}
      {view === "trash" && trash.isPending && <TableLoading />}
      {view === "trash" && trash.error && (
        <LoadFailed error={trash.error} onRetry={() => void trash.refetch()} />
      )}

      {view !== "trash" && clients.data && rows.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search
            ? "No client matches this search."
            : view === "test"
              ? "No test accounts. Accounts whose owner logs in with an @eazotel.com or @fielmente.com email show here."
              : "No clients to show yet."}
        </p>
      )}
      {view === "trash" && trash.data && trashed.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          The trash is empty.
        </p>
      )}

      {view !== "trash" && rows.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPicked}
                    onCheckedChange={(on) => toggleAll(Boolean(on))}
                    aria-label="Select the clients shown (up to 50)"
                  />
                </TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Hotel email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => (
                <TableRow key={client.ndid} data-state={selected.has(client.ndid) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(client.ndid)}
                      disabled={!selected.has(client.ndid) && selected.size >= 50}
                      onCheckedChange={(on) => toggle(client.ndid, Boolean(on))}
                      aria-label={`Select ${client.hotelName ?? client.ndid}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${encodeURIComponent(client.ndid)}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {client.hotelName ?? "Unnamed hotel"}
                    </Link>
                    {client.domain && (
                      <div className="text-xs text-muted-foreground">{client.domain}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    {client.properties.length === 0
                      ? "None"
                      : client.properties
                          .map((property) => propertyLabel(property, client.hotelName))
                          .join(", ")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {client.planName ?? "-"}
                    {client.planExpiry && (
                      <div className="text-xs text-muted-foreground">
                        ends {client.planExpiry} (as recorded)
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{client.hotelEmail ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {view === "trash" && trashed.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPicked}
                    onCheckedChange={(on) => toggleAll(Boolean(on))}
                    aria-label="Select everything in the trash (up to 50)"
                  />
                </TableHead>
                <TableHead>Hotel</TableHead>
                <TableHead>Moved by</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Subscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trashed.map((t) => (
                <TableRow key={t.ndid} data-state={selected.has(t.ndid) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(t.ndid)}
                      onCheckedChange={(on) => toggle(t.ndid, Boolean(on))}
                      aria-label={`Select ${t.hotelName ?? t.ndid}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/clients/${encodeURIComponent(t.ndid)}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {t.hotelName ?? "Unnamed hotel"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{t.ndid}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.by}
                    <div className="text-xs text-muted-foreground">{formatDay(t.trashedAt)}</div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">{t.reason ?? "-"}</TableCell>
                  <TableCell className="text-sm">
                    {t.pausedSubscription ? "Paused by the trash" : "Was already stopped, or none"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {view !== "trash" && clients.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={clients.isFetchingNextPage}
            onClick={() => void clients.fetchNextPage()}
          >
            {clients.isFetchingNextPage && (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            )}
            Show more
          </Button>
        </div>
      )}
    </>
  );
}
