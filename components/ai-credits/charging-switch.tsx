"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { aiCreditsApi } from "@/lib/api/ai-credits-api";

/**
 * The master switch for AI credits. Off: gian runs AI for every hotel without holding or
 * charging credits and never answers "not enough credits"; calls are still logged. On: every AI
 * request is charged, and hotels with an empty wallet are blocked. Takes effect on the next
 * request. Saved on its own (with a confirmation), separate from the settings form below.
 */
export function ChargingSwitch({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const next = !enabled;

  const save = useMutation({
    mutationFn: () => aiCreditsApi.saveSettings({ credits: { enabled: next } }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["ai-credits", "settings"], saved);
      void queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      toast.success(saved.credits.enabled ? "AI credits are on. AI requests are now charged." : "AI credits are off. AI is free for every hotel.");
      setAsking(false);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className={enabled ? undefined : "border-amber-300"}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Charge AI credits</CardTitle>
          <CardDescription>
            {enabled
              ? "On. Every AI request (chatbot, knowledge base, SEO, email templates, transcription) is charged to the hotel's wallet. Hotels with no credits get AI paused."
              : "Off (testing). AI works for every hotel and nothing is charged or blocked. Usage is still logged, so costs per hotel stay visible."}
          </CardDescription>
        </div>
        <Switch
          checked={enabled}
          disabled={save.isPending}
          onCheckedChange={() => setAsking(true)}
          aria-label="Charge AI credits"
        />
      </CardHeader>

      <Dialog open={asking} onOpenChange={(open) => !save.isPending && setAsking(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{next ? "Turn AI credits on?" : "Turn AI credits off?"}</DialogTitle>
            <DialogDescription>
              {next
                ? "From the next request, gian charges every AI call to the hotel's wallet. Hotels with no credits stop getting chatbot replies and other AI features until they top up."
                : "From the next request, AI is free for every hotel: nothing is held or charged, and no hotel is blocked for credits. Wallet balances stay as they are."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={save.isPending} onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button variant={next ? "default" : "destructive"} disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              {next ? "Turn on" : "Turn off"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
