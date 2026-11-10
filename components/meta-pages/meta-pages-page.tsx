"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Layers,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import {
  LoadFailed,
  PageHeader,
  TableLoading,
} from "@/components/layout/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  linkLabel,
  metaPagesApi,
  type MetaConnection,
  type MetaPage,
} from "@/lib/api/meta-pages-api";

import { LinkPageDialog } from "./link-page-dialog";

type Filter = "all" | "linked" | "unlinked" | "conflicts";

const FILTERS: {
  id: Filter;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  count: (c: {
    pages: number;
    linked: number;
    unlinked: number;
    conflicts: number;
  }) => number;
  test: (p: MetaPage) => boolean;
}[] = [
  {
    id: "all",
    label: "All pages",
    hint: "from every Meta sign-in",
    icon: Layers,
    tone: "text-brand-navy bg-brand-navy/10",
    count: (c) => c.pages,
    test: () => true,
  },
  {
    id: "linked",
    label: "Linked",
    hint: "leads reach a client",
    icon: CircleCheck,
    tone: "text-emerald-700 bg-emerald-50",
    count: (c) => c.linked,
    test: (p) => Boolean(p.link),
  },
  {
    id: "unlinked",
    label: "Not linked",
    hint: "leads reach nobody",
    icon: CircleDashed,
    tone: "text-orange-700 bg-orange-50",
    count: (c) => c.unlinked,
    test: (p) => !p.link,
  },
  {
    id: "conflicts",
    label: "Conflicts",
    hint: "copies point at different clients",
    icon: CircleAlert,
    tone: "text-red-700 bg-red-50",
    count: (c) => c.conflicts,
    test: (p) => p.conflict,
  },
];

function PageAvatar({ page }: { page: MetaPage }) {
  const [broken, setBroken] = useState(false);
  const initials = (page.name ?? "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  if (page.pictureUrl && !broken)
    return (
      // Meta's picture links expire; fall back to initials when one does
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={page.pictureUrl}
        alt=""
        className="size-9 shrink-0 rounded-full border object-cover"
        onError={() => setBroken(true)}
        referrerPolicy="no-referrer"
      />
    );
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1877f2]/10 text-xs font-semibold text-[#1877f2]"
    >
      {initials}
    </span>
  );
}

function UnlinkDialog({
  page,
  onClose,
}: {
  page: MetaPage;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const unlink = useMutation({
    mutationFn: () => metaPagesApi.unlink(page.pageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["meta-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(`${page.name ?? "Page"} unlinked`);
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unlink {page.name ?? page.pageId}?</DialogTitle>
          <DialogDescription>
            New Facebook leads from this page will reach no client until it is
            linked again.
            {page.link &&
              ` ${linkLabel(page.link)} keeps the leads it already has.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
          >
            {unlink.isPending && (
              <Loader2
                className="animate-spin"
                data-icon="inline-start"
                aria-hidden
              />
            )}
            Unlink
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkCell({ page }: { page: MetaPage }) {
  if (!page.link)
    return (
      <Badge
        variant="outline"
        className="border-orange-200 bg-orange-50 text-orange-800"
      >
        Not linked
      </Badge>
    );
  return (
    <div>
      <Link
        href={`/clients/${encodeURIComponent(page.link.ndid)}`}
        className="font-medium text-brand-navy hover:underline"
      >
        {linkLabel(page.link)}
      </Link>
      <div className="font-mono text-[11px] text-muted-foreground">
        {page.link.ndid.slice(0, 8)}… / {page.link.hid}
      </div>
      {page.conflict && (
        <p className="mt-1 text-xs font-medium text-red-700">
          Other copies point elsewhere:{" "}
          {[
            ...new Set(
              page.connections
                .map((c) => c.link)
                .filter(
                  (l) =>
                    l &&
                    (l.ndid !== page.link?.ndid || l.hid !== page.link?.hid),
                )
                .map((l) => (l ? linkLabel(l) : "")),
            ),
          ].join(", ")}
          . Link it again to fix.
        </p>
      )}
    </div>
  );
}

function SignIns({ page }: { page: MetaPage }) {
  const unlinkedCopies = page.connections.filter((c) => !c.link).length;
  return (
    <div className="text-sm">
      <span className="tabular-nums">{page.connections.length}</span>
      <span className="text-muted-foreground">
        {" "}
        sign-in{page.connections.length === 1 ? "" : "s"}
      </span>
      {page.link && unlinkedCopies > 0 && (
        <p
          className="text-xs text-orange-700"
          title="gian may read an unlinked copy first. Link the page again to write the link to every copy."
        >
          {unlinkedCopies} cop{unlinkedCopies === 1 ? "y" : "ies"} without the
          link
        </p>
      )}
    </div>
  );
}

function RowActions({ page }: { page: MetaPage }) {
  const [open, setOpen] = useState<"link" | "unlink" | null>(null);
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant={page.link ? "outline" : "default"}
          onClick={() => setOpen("link")}
        >
          {page.link ? "Change" : "Link to client"}
        </Button>
        {page.link && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`More for ${page.name ?? page.pageId}`}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuItem
                onClick={() =>
                  void navigator.clipboard
                    .writeText(page.pageId)
                    .then(() => toast.success("Page id copied"))
                }
              >
                Copy page id
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setOpen("unlink")}
              >
                Unlink…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {open === "link" && (
        <LinkPageDialog page={page} onClose={() => setOpen(null)} />
      )}
      {open === "unlink" && (
        <UnlinkDialog page={page} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

function ConnectionRow({ connection }: { connection: MetaConnection }) {
  const queryClient = useQueryClient();
  const sync = useMutation({
    mutationFn: () => metaPagesApi.sync(connection.connectionId),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["meta-pages"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      const parts = [
        `${r.returned} pages from Meta`,
        r.added.length ? `${r.added.length} new` : "none new",
        r.missing.length
          ? `${r.missing.length} no longer returned (kept)`
          : null,
      ].filter(Boolean);
      toast.success(`Synced: ${parts.join(", ")}`);
      if (r.subscribeFailed.length)
        toast.warning(
          `${r.subscribeFailed.length} page(s) could not get lead webhooks: ${r.subscribeFailed[0]?.reason}`,
        );
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {connection.accountName ?? "Meta account"}
          {connection.accountEmail && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {connection.accountEmail}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Signed in from {linkLabel(connection.owner)} ·{" "}
          <span className="tabular-nums">
            {connection.linkedCount} of {connection.pageCount}
          </span>{" "}
          pages linked
          {connection.syncedAt &&
            ` · updated ${new Date(connection.syncedAt).toLocaleString(
              "en-IN",
              {
                dateStyle: "medium",
                timeStyle: "short",
              },
            )}`}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={!connection.hasToken || sync.isPending}
        title={
          connection.hasToken
            ? "Fetch this sign-in's pages from Meta again"
            : "No Meta token saved: sign in with Meta again from the hotel dashboard"
        }
        onClick={() => sync.mutate()}
      >
        {sync.isPending ? (
          <Loader2
            className="animate-spin"
            data-icon="inline-start"
            aria-hidden
          />
        ) : (
          <RefreshCw data-icon="inline-start" aria-hidden />
        )}
        Sync from Meta
      </Button>
    </li>
  );
}

export function MetaPagesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [input, setInput] = useState("");
  const search = useDeferredValue(input.trim().toLowerCase());

  const overview = useQuery({
    queryKey: ["meta-pages"],
    queryFn: () => metaPagesApi.overview(),
  });

  const active = FILTERS.find((f) => f.id === filter) ?? FILTERS[0]!;
  const rows = (overview.data?.pages ?? [])
    .filter(active.test)
    .filter(
      (p) =>
        !search ||
        [
          p.name,
          p.pageId,
          p.link?.hotelName,
          p.link?.propertyName,
          p.link?.ndid,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(search)),
    );

  return (
    <>
      <PageHeader
        title="Meta pages"
        description="Every Facebook page from the Meta sign-ins. Link a page to a client property and its new Facebook leads go to that client's dashboard."
      />

      <div
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        role="group"
        aria-label="Filter pages"
      >
        {FILTERS.map(({ id, label, hint, icon: Icon, tone, count }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-xl border bg-card p-4 text-left shadow-xs transition hover:border-brand-navy/30 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              filter === id && "border-brand-navy ring-1 ring-brand-navy",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>
              <span className={cn("rounded-lg p-1.5", tone)}>
                <Icon className="size-4" aria-hidden />
              </span>
            </span>
            <span className="mt-2 block text-3xl font-bold tracking-tight text-brand-navy tabular-nums">
              {overview.data ? (
                count(overview.data.counts)
              ) : (
                <span className="inline-block h-8 w-10 animate-pulse rounded bg-muted" />
              )}
            </span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <p className="text-sm font-medium">
            {active.label}
            {overview.data && (
              <span className="ml-2 font-normal text-muted-foreground">
                {rows.length} shown
              </span>
            )}
          </p>
          <div className="relative w-full max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search page, hotel, page id or ndid"
              aria-label="Search Meta pages"
              className="pl-8"
            />
          </div>
        </div>

        {overview.isPending && (
          <div className="p-4">
            <TableLoading />
          </div>
        )}
        {overview.error && (
          <div className="p-4">
            <LoadFailed
              error={overview.error}
              onRetry={() => void overview.refetch()}
            />
          </div>
        )}
        {overview.data && rows.length === 0 && (
          <p className="p-10 text-center text-sm text-muted-foreground">
            {overview.data.pages.length === 0
              ? "No Meta sign-ins yet. Pages appear here once someone connects Meta from the hotel dashboard."
              : "No page matches."}
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {["Facebook page", "Leads go to", "Found in"].map((h, i) => (
                    <TableHead
                      key={h}
                      className={cn(
                        "text-xs font-semibold tracking-wide text-muted-foreground uppercase",
                        i === 0 && "pl-4",
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                  <TableHead className="pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((page) => (
                  <TableRow key={page.pageId}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <PageAvatar page={page} />
                        <div className="min-w-0">
                          <a
                            href={`https://www.facebook.com/${page.pageId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium hover:underline"
                          >
                            {page.name ?? "Unnamed page"}
                          </a>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {page.pageId}
                            {page.category && (
                              <span className="ml-2 font-sans">
                                {page.category}
                              </span>
                            )}
                            {page.instagram?.username && (
                              <span className="ml-2 font-sans">
                                IG @{page.instagram.username}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <LinkCell page={page} />
                    </TableCell>
                    <TableCell>
                      <SignIns page={page} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <RowActions page={page} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {overview.data && overview.data.connections.length > 0 && (
        <section className="mt-8" aria-labelledby="meta-signins">
          <h2
            id="meta-signins"
            className="text-lg font-semibold tracking-tight text-brand-navy"
          >
            Meta sign-ins
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Each time someone connects Meta from a hotel dashboard. Sync fetches
            that sign-in&apos;s pages again: new pages are added, links are
            kept.
          </p>
          <ul className="divide-y rounded-xl border bg-card shadow-xs">
            {overview.data.connections.map((c) => (
              <ConnectionRow key={c.connectionId} connection={c} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
