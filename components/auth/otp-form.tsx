"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OtpChallenge } from "@/lib/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";

const CODE_LENGTH = 6;

/** Step 2 of sign-in: the code emailed after Google. */
export function OtpForm({ challenge }: { challenge: OtpChallenge }) {
  const isSigningIn = useAuthStore((state) => state.isSigningIn);
  const verifyOtp = useAuthStore((state) => state.verifyOtp);
  const resendOtp = useAuthStore((state) => state.resendOtp);
  const cancelOtp = useAuthStore((state) => state.cancelOtp);

  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(challenge.resendAfterSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isComplete = code.length === CODE_LENGTH;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isComplete && !isSigningIn) void verifyOtp(code);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        We emailed a {CODE_LENGTH}-digit code to{" "}
        <span className="font-medium text-foreground">{challenge.email}</span>.
      </p>

      <div className="space-y-2">
        <Label htmlFor="otp-code">Sign-in code</Label>
        <Input
          id="otp-code"
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="000000"
          aria-label="Sign-in code"
          className="h-11 text-center font-mono text-lg tracking-[0.5em]"
        />
      </div>

      <Button
        type="submit"
        disabled={!isComplete || isSigningIn}
        className="h-10 w-full"
      >
        {isSigningIn && (
          <LoaderCircle
            data-icon="inline-start"
            className="animate-spin"
            aria-hidden
          />
        )}
        Verify and sign in
      </Button>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSigningIn}
          onClick={cancelOtp}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSigningIn || secondsLeft > 0}
          onClick={() => void resendOtp()}
        >
          {secondsLeft > 0
            ? `Send a new code in ${secondsLeft}s`
            : "Send a new code"}
        </Button>
      </div>
    </form>
  );
}
