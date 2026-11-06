"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle, Search } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  LoadFailed,
  PageHeader,
  TableLoading,
} from "@/components/layout/page-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientsApi, propertyLabel } from "@/lib/api/clients-api";
import { useAuthStore } from "@/stores/auth-store";

export function ClientsPage() {
  const allProperties = useAuthStore((state) => state.user?.allProperties);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const clients = useInfiniteQuery({
    queryKey: ["clients", "list", search],
    queryFn: ({ pageParam }) => clientsApi.list({ search, after: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  function applySearch(event: FormEvent) {
    event.preventDefault();
    setSearch(input.trim());
  }

  const rows = clients.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <PageHeader
        title="Clients"
        description={
          allProperties
            ? "Every hotel on Eazotel."
            : "The hotels with properties assigned to you. Ask a super admin for more."
        }
      />

      <form onSubmit={applySearch} className="mb-4 flex max-w-md gap-2">
        <Input
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Hotel name, domain, email or ndid"
          aria-label="Search clients"
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Search">
          <Search aria-hidden />
        </Button>
      </form>

      {clients.isPending && <TableLoading />}
      {clients.error && (
        <LoadFailed
          error={clients.error}
          onRetry={() => void clients.refetch()}
        />
      )}

      {clients.data && rows.length === 0 && (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {search
            ? "No client matches this search."
            : "No clients to show yet."}
        </p>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Hotel email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => (
                <TableRow key={client.ndid}>
                  <TableCell>
                    <Link
                      href={`/clients/${encodeURIComponent(client.ndid)}`}
                      className="font-medium text-brand-navy hover:underline"
                    >
                      {client.hotelName ?? "Unnamed hotel"}
                    </Link>
                    {client.domain && (
                      <div className="text-xs text-muted-foreground">
                        {client.domain}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-normal">
                    {client.properties.length === 0
                      ? "None"
                      : client.properties
                          .map((property) =>
                            propertyLabel(property, client.hotelName),
                          )
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
                  <TableCell className="text-sm">
                    {client.hotelEmail ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {clients.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            disabled={clients.isFetchingNextPage}
            onClick={() => void clients.fetchNextPage()}
          >
            {clients.isFetchingNextPage && (
              <LoaderCircle
                data-icon="inline-start"
                className="animate-spin"
                aria-hidden
              />
            )}
            Show more
          </Button>
        </div>
      )}
    </>
  );
}
