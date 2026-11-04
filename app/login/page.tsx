import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

import { HotelSkyline } from "@/components/auth/hotel-skyline";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="login-dusk relative isolate flex min-h-dvh flex-1 flex-col overflow-hidden text-white">
      <HotelSkyline className="absolute inset-x-0 bottom-0 -z-10 h-[62dvh] w-full" />

      <header className="mx-auto w-full max-w-7xl px-6 pt-8 sm:px-12">
        {/* <Image
          src="/brand/logo-on-dark.png"
          alt="Eazotel"
          width={360}
          height={73}
          className="-ml-3 h-7 w-auto"
        /> */}
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[minmax(0,1fr)] content-center items-center gap-10 px-6 py-10 sm:px-12 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-16 lg:pb-32">
        <div>
          <div className="relative w-70 aspect-[4/.7] mb-3">
            <Image 
              src="/brand/logo-on-dark.png"
              alt="Eazotel"
              fill
              className="-ml-6 h-7 w-auto object-cover"
            />
          </div>
          <p className="text-xs font-semibold tracking-[0.25em] text-brand-orange uppercase">
            Admin console
          </p>
          <h1 className="mt-4 max-w-xl text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">
            Keeping every hotel&apos;s{" "}
            <span className="text-brand-orange">lights on.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-white/70">
            The internal console for the Eazotel and Fielmente team.
          </p>
        </div>

        <section className="rounded-2xl bg-white p-8 text-foreground shadow-2xl shadow-black/50 sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-brand-navy">
            Sign in to Admin
          </h2>
          <p className="mt-2 mb-8 text-sm text-muted-foreground">
            Use your Eazotel or Fielmente Google account to continue.
          </p>

          <LoginForm />

          <p className="mt-8 flex gap-2 border-t pt-5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck
              className="size-4 shrink-0 text-brand-orange"
              aria-hidden
            />
            Restricted to authorized staff. Hotel clients should sign in through
            the Eazotel dashboard.
          </p>
        </section>
      </main>
    </div>
  );
}
