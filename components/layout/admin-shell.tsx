"use client";

import {
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/stores/auth-store";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from staff without this. The API still checks it on every call. */
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  {
    href: "/clients",
    label: "Clients",
    icon: Building2,
    permission: "clients.view",
  },
  {
    href: "/subscriptions",
    label: "Subscriptions",
    icon: CreditCard,
    permission: "subscriptions.view",
  },
  {
    href: "/billing",
    label: "Billing",
    icon: Receipt,
    permission: "billing.view",
  },
  { href: "/team", label: "Team", icon: Users, permission: "team.manage" },
  {
    href: "/activity",
    label: "Activity",
    icon: ClipboardList,
    permission: "audit.view",
  },
];

function SidebarNav() {
  const pathname = usePathname();
  const permissions = useAuthStore((state) => state.user?.permissions);
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarMenu className="flex flex-col gap-1.5" aria-label="Main navigation">
      {NAV_ITEMS.filter(
        ({ permission }) => !permission || permissions?.includes(permission),
      ).map(({ href, label, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton
            isActive={
              href === "/" ? pathname === "/" : pathname.startsWith(href)
            }
            render={<Link href={href} onClick={() => setOpenMobile(false)} />}
            className="h-9 data-active:shadow-[inset_3px_0_0_var(--sidebar-primary)]"
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function SignedInUser() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user?.name ?? user?.email}
        </p>
        <p className="truncate text-xs text-sidebar-foreground/65">
          {user?.role === "super_admin" ? "Super admin" : "Admin"}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        title="Sign out"
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        onClick={() => void logout()}
      >
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}

/** The frame around every signed-in page: navy sidebar, top bar and toasts. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="px-4 py-4">
          <Link href="/" aria-label="Eazotel Admin home">
            <Image
              src="/brand/logo-on-dark.png"
              alt="Eazotel"
              width={434}
              height={89}
              className="h-6 w-auto"
            />
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarNav />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <SignedInUser />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 items-center border-b bg-background/95 px-3 backdrop-blur">
          <SidebarTrigger />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
      <Toaster theme="light" position="top-right" />
    </SidebarProvider>
  );
}
