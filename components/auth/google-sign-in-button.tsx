"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

import { env } from "@/lib/env";

const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
// Google draws its button at a fixed pixel width, up to 400.
const MAX_BUTTON_WIDTH = 400;

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  onLoadError: () => void;
}

export function GoogleSignInButton({
  onCredential,
  onLoadError,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScriptReady, setIsScriptReady] = useState(false);

  useEffect(() => {
    const googleId = window.google?.accounts.id;
    const container = containerRef.current;
    if (!isScriptReady || !googleId || !container) return;

    googleId.initialize({
      client_id: env.googleClientId,
      callback: ({ credential }) => onCredential(credential),
    });

    // Draw it again whenever the space changes, or it overflows after a resize or rotation.
    let drawnWidth = 0;
    const observer = new ResizeObserver(() => {
      const width = Math.min(container.clientWidth, MAX_BUTTON_WIDTH);
      if (width === drawnWidth) return;
      drawnWidth = width;
      container.replaceChildren();
      googleId.renderButton(container, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "center",
        width,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [isScriptReady, onCredential]);

  return (
    <>
      <Script
        src={GOOGLE_SCRIPT_URL}
        onReady={() => setIsScriptReady(true)}
        onError={onLoadError}
      />
      <div
        ref={containerRef}
        className="flex h-10 w-full justify-center overflow-hidden"
      />
    </>
  );
}
