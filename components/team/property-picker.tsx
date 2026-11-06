"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { Check, Plus, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clientsApi, propertyLabel } from "@/lib/api/clients-api";
import type { AssignedProperty } from "@/lib/api/team-api";

const sameProperty = (a: AssignedProperty, b: AssignedProperty) =>
  a.ndid === b.ndid && a.hid === b.hid;

/** Names for properties already assigned, looked up once per client. */
function useNames(value: AssignedProperty[]): Map<string, string> {
  const ndids = [...new Set(value.map((p) => p.ndid))];
  const results = useQueries({
    queries: ndids.map((ndid) => ({
      queryKey: ["clients", "one", ndid],
      queryFn: () => clientsApi.get(ndid),
    })),
  });
  const names = new Map<string, string>();
  for (const client of results.map((r) => r.data)) {
    for (const property of client?.properties ?? []) {
      names.set(
        `${client?.ndid}/${property.hid}`,
        `${client?.hotelName ?? "Hotel"} · ${propertyLabel(property, client?.hotelName ?? null)}`,
      );
    }
  }
  return names;
}

/** Choose properties by searching clients, instead of typing codes. */
export function PropertyPicker({
  value,
  onChange,
}: {
  value: AssignedProperty[];
  onChange: (value: AssignedProperty[]) => void;
}) {
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const names = useNames(value);
  const results = useQuery({
    queryKey: ["clients", "list", query, "picker"],
    queryFn: () => clientsApi.list({ search: query, limit: 6 }),
    enabled: query.length >= 2,
  });

  const toggle = (property: AssignedProperty) =>
    onChange(
      value.some((p) => sameProperty(p, property))
        ? value.filter((p) => !sameProperty(p, property))
        : [...value, property],
    );

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Assigned properties">
          {value.map((property) => {
            const key = `${property.ndid}/${property.hid}`;
            return (
              <li key={key}>
                <Badge
                  variant="secondary"
                  className="h-auto gap-1 py-1 pr-1 whitespace-normal"
                >
                  {names.get(key) ?? <span className="font-mono">{key}</span>}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-foreground/10"
                    aria-label={`Remove ${names.get(key) ?? key}`}
                    onClick={() => toggle(property)}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            );
          })}
        </ul>
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
          placeholder="Search hotels by name, domain or email"
          aria-label="Search properties to assign"
          className="pl-8"
        />
      </div>

      {query.length >= 2 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border">
          {results.isPending && (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          )}
          {results.error && (
            <p className="p-3 text-sm text-destructive">
              {results.error.message}
            </p>
          )}
          {results.data?.items.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              No hotel matches.
            </p>
          )}
          {results.data?.items.map((client) => (
            <div key={client.ndid} className="border-b p-2 last:border-b-0">
              <p className="px-1 text-xs font-medium text-muted-foreground">
                {client.hotelName ?? "Unnamed hotel"}
              </p>
              {client.properties.map((p) => {
                const property = { ndid: client.ndid, hid: p.hid };
                const chosen = value.some((v) => sameProperty(v, property));
                return (
                  <Button
                    key={p.hid}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={chosen}
                    className="w-full justify-start"
                    onClick={() => toggle(property)}
                  >
                    {chosen ? (
                      <Check data-icon="inline-start" aria-hidden />
                    ) : (
                      <Plus data-icon="inline-start" aria-hidden />
                    )}
                    {propertyLabel(p, client.hotelName)}
                  </Button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
