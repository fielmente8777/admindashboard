"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

/** Where a client page was opened from (`?from=`), so "back" returns there. */
const ORIGINS: Record<string, { href: string; label: string }> = {
  subscriptions: { href: "/subscriptions", label: "All subscriptions" },
  clients: { href: "/clients", label: "All clients" },
  missing: { href: "/clients/missing-numbers", label: "Missing WhatsApp numbers" },
};

const LINK_CLASS =
  "mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground";

function Back() {
  const from = useSearchParams().get("from") ?? "clients";
  const origin = ORIGINS[from] ?? ORIGINS.clients!;
  return (
    <Link href={origin.href} className={LINK_CLASS}>
      <ArrowLeft className="size-4" aria-hidden />
      {origin.label}
    </Link>
  );
}

/** Back to the list the client was opened from: Subscriptions, Clients or Missing numbers. */
export function BackLink() {
  return (
    // the address is only known in the browser
    <Suspense
      fallback={
        <span className={LINK_CLASS}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </span>
      }
    >
      <Back />
    </Suspense>
  );
}
