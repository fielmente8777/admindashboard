"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuthStore } from "@/stores/auth-store";

/** True when the signed-in staff member has this permission (super admins have all). */
export function useCan(permission: string): boolean {
  return useAuthStore((state) => state.user?.permissions.includes(permission) ?? false);
}

const TABS = [
  { href: "/billing", label: "Overview & payments" },
  { href: "/billing/plans", label: "Plans & pricing" },
  { href: "/billing/offers", label: "Offers" },
];

/** The three Billing screens, as tabs under the page title. */
export function BillingNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Billing sections" className="mb-6 flex gap-1 overflow-x-auto border-b">
      {TABS.map(({ href, label }) => {
        const active = pathname === href;
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
