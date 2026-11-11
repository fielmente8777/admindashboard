"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { clientsApi } from "@/lib/api/clients-api";

/** Type part of a hotel name, email or an ndid, then pick the client. */
export function ClientPicker({
  value,
  onChange,
  id,
}: {
  value: { ndid: string; hotelName: string | null } | null;
  onChange: (client: { ndid: string; hotelName: string | null } | null) => void;
  id?: string;
}) {
  const [text, setText] = useState("");
  const search = text.trim();
  const found = useQuery({
    queryKey: ["clients", "pick", search],
    queryFn: () => clientsApi.list({ search, limit: 8 }),
    enabled: search.length >= 2 && !value,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
        <span>
          <span className="font-medium">{value.hotelName ?? "Unnamed hotel"}</span>{" "}
          <span className="text-xs text-muted-foreground">{value.ndid}</span>
        </span>
        <button type="button" className="text-xs text-brand-navy hover:underline" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Hotel name, email or ndid"
        autoComplete="off"
      />
      {search.length >= 2 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border text-sm">
          {found.isPending && <li className="px-3 py-2 text-muted-foreground">Searching…</li>}
          {found.data?.items.length === 0 && <li className="px-3 py-2 text-muted-foreground">No client matches.</li>}
          {found.data?.items.map((c) => (
            <li key={c.ndid}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-muted"
                onClick={() => onChange({ ndid: c.ndid, hotelName: c.hotelName })}
              >
                {c.hotelName ?? "Unnamed hotel"} <span className="text-xs text-muted-foreground">{c.hotelEmail ?? c.ndid}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
