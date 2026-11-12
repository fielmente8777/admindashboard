"use client";

import { cn } from "cn";
import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCan } from "@/components/billing/billing-nav";
import { Badge } from "@/components/ui/badge";
import { LEVEL_LABEL, type WalletLevel, type WalletStatus } from "@/lib/api/ai-credits-api";

const TABS = [
  { href: "/ai-credits", label: "Clients", permission: "credits.view" },
  { href: "/ai-credits/overview", label: "Overview", permission: "credits.pricing" },
  { href: "/ai-credits/openai", label: "OpenAI account", permission: "credits.pricing" },
  { href: "/ai-credits/pricing", label: "Pricing & packages", permission: "credits.pricing" },
  { href: "/ai-credits/settings", label: "Settings", permission: "credits.pricing" },
  { href: "/ai-credits/audit", label: "Audit", permission: "credits.pricing" },
];

/** The AI credits screens, as tabs under the page title. Company-wide tabs need credits.pricing. */
export function AiCreditsNav() {
  const pathname = usePathname();
  const canPricing = useCan("credits.pricing");
  const tabs = TABS.filter((t) => t.permission === "credits.view" || canPricing);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="AI credits sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {tabs.map(({ href, label }) => {
        const active =
          href === "/ai-credits" ? pathname === href || pathname.startsWith("/ai-credits/clients/") : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active
                ? "border-brand-orange text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Wallet level: text plus colour, never colour alone. */
export function LevelBadge({ level, status }: { level: WalletLevel; status?: WalletStatus }) {
  if (status === "suspended") return <Badge variant="destructive">Suspended</Badge>;
  const tone: Record<WalletLevel, string> = {
    healthy: "bg-emerald-50 text-emerald-700",
    low: "bg-amber-50 text-amber-800",
    critical: "bg-orange-100 text-orange-800",
    empty: "bg-red-50 text-red-700",
  };
  return <Badge className={tone[level]}>{LEVEL_LABEL[level]}</Badge>;
}

export function NoCreditsAccess({ permission }: { permission: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Lock className="size-6 text-muted-foreground" aria-hidden />
      <p className="font-medium">You don&apos;t have access to this page</p>
      <p className="text-sm text-muted-foreground">
        It needs the <code className="rounded bg-muted px-1">{permission}</code> permission. Ask a super admin if you need it.
      </p>
    </div>
  );
}
