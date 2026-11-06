"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { rupeesFromPaise } from "@/lib/api/billing-api";

/** Validated single-series mark colour (passes lightness, chroma and contrast on white). */
const BAR = "#3366cc";

const monthLabel = (key: string, style: "short" | "long") =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: style, year: style === "long" ? "numeric" : "2-digit", timeZone: "UTC" });

/**
 * Revenue per month: one series, so no legend (the card title names it). Columns grow from one
 * baseline, at most 24px wide with a 4px rounded top; hover or focus shows the exact value.
 * "Table" shows the same numbers as a table.
 */
export function RevenueChart({ months }: { months: { month: string; paise: number; count: number }[] }) {
  const [table, setTable] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...months.map((m) => m.paise));
  const top = niceCeil(max);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {table ? "Chart" : "Table"}
        </Button>
      </div>
      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Month</th>
              <th className="py-1 text-right font-medium">Payments</th>
              <th className="py-1 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t">
                <td className="py-1.5">{monthLabel(m.month, "long")}</td>
                <td className="py-1.5 text-right tabular-nums">{m.count}</td>
                <td className="py-1.5 text-right tabular-nums">{rupeesFromPaise(m.paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* y-axis: recessive, two ticks */}
          <div className="flex h-48 flex-col justify-between pb-5 text-right text-[11px] text-muted-foreground tabular-nums">
            <span>{rupeesFromPaise(top)}</span>
            <span>{rupeesFromPaise(top / 2)}</span>
            <span>₹0</span>
          </div>
          <div className="relative flex-1">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[calc(100%-1.25rem)] border-b border-border">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
            </div>
            <ul className="relative flex h-48 items-stretch" aria-label="Revenue per month">
              {months.map((m, i) => {
                const height = (m.paise / top) * 100;
                return (
                  <li key={m.month} className="flex flex-1 flex-col items-center">
                    <button
                      type="button"
                      className="relative flex w-full flex-1 items-end justify-center outline-none focus-visible:bg-muted/60"
                      onMouseEnter={() => setActive(i)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(i)}
                      onBlur={() => setActive(null)}
                      aria-label={`${monthLabel(m.month, "long")}: ${rupeesFromPaise(m.paise)} from ${m.count} payments`}
                    >
                      <span
                        className="block w-full max-w-6 rounded-t-[4px] transition-opacity"
                        style={{ height: `${height}%`, minHeight: m.paise > 0 ? 2 : 0, background: BAR, opacity: active === null || active === i ? 1 : 0.55 }}
                      />
                      {active === i && (
                        <span className="absolute bottom-full z-10 mb-1 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md">
                          <span className="block font-medium">{monthLabel(m.month, "long")}</span>
                          <span className="block tabular-nums">{rupeesFromPaise(m.paise)}</span>
                          <span className="block text-muted-foreground">{m.count} payments</span>
                        </span>
                      )}
                    </button>
                    <span className="h-5 pt-1 text-[11px] text-muted-foreground">{monthLabel(m.month, "short")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/** A round axis top just above the largest value. */
function niceCeil(paise: number): number {
  const rupees = paise / 100;
  const step = 10 ** Math.floor(Math.log10(rupees || 1));
  return Math.ceil(rupees / step) * step * 100;
}
