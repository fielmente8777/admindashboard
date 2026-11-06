"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { clientsApi } from "@/lib/api/clients-api";
import { env } from "@/lib/env";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Opens the hotel dashboard in a new tab, signed in as this client for one hour. The token
 * goes in the # part of the address, which browsers never send to a server, and the hotel
 * dashboard removes it from the address bar straight away.
 */
export function OpenAccountButton({
  ndid,
  hotelName,
}: {
  ndid: string;
  hotelName: string | null;
}) {
  const queryClient = useQueryClient();
  const canOpen = useAuthStore((state) =>
    state.user?.permissions.includes("clients.open_account"),
  );

  const open = useMutation({
    // the tab must open during the click, or the browser blocks it as a pop-up
    mutationFn: async (tab: Window) => ({
      tab,
      opened: await clientsApi.openAccount(ndid),
    }),
    onSuccess: ({ tab, opened }) => {
      const handoff = new URLSearchParams({
        token: opened.token,
        ndid: opened.ndid,
        ...(opened.hid ? { hid: opened.hid } : {}),
      });
      tab.location.href = `${env.hotelDashboardUrl}/staff-access#${handoff}`;
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(
        `Opened ${hotelName ?? "the client"}'s dashboard for one hour`,
      );
    },
    onError: (error, tab) => {
      tab.close();
      toast.error(error.message);
    },
  });

  if (!canOpen) return null;
  if (!env.hotelDashboardUrl) {
    return (
      <Button
        variant="outline"
        disabled
        title="Set NEXT_PUBLIC_HOTEL_DASHBOARD_URL to open client accounts"
      >
        <LogIn data-icon="inline-start" aria-hidden />
        Open account
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      disabled={open.isPending}
      onClick={() => {
        const tab = window.open("about:blank", "_blank");
        if (!tab) {
          toast.error(
            "Your browser blocked the new tab. Allow pop-ups for this site and try again.",
          );
          return;
        }
        tab.opener = null;
        open.mutate(tab);
      }}
    >
      {open.isPending ? (
        <LoaderCircle
          data-icon="inline-start"
          className="animate-spin"
          aria-hidden
        />
      ) : (
        <LogIn data-icon="inline-start" aria-hidden />
      )}
      Open account
    </Button>
  );
}
