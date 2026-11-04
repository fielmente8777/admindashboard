"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

// Where sign-in lands until the dashboard pages are built.
export function AdminHome() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Image src="/brand/logo-on-light.png" alt="Eazotel" width={434} height={89} className="h-6 w-auto" />
        <Button variant="outline" onClick={() => void logout()}>
          <LogOut data-icon="inline-start" aria-hidden />
          Sign out
        </Button>
      </header>

      <main className="mx-auto w-full max-w-5xl p-6">
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
          Welcome, {user?.name ?? user?.email}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>
      </main>
    </div>
  );
}
