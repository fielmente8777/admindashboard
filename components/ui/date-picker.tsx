"use client";

import { Popover } from "@base-ui/react/popover";
import { cn } from "cn";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const monthTitle = new Intl.DateTimeFormat("en-IN", {
  month: "long",
  year: "numeric",
});
const shown = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2027-01-16" ↔ a calendar day, with no time zone surprises. */
function parse(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) }
    : null;
}
function format(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(),
  );
}

/** A month of days, starting on Monday, with the days of the next and previous months greyed. */
function MonthGrid({
  year,
  month,
  selected,
  onPick,
}: {
  year: number;
  month: number;
  selected: string;
  onPick: (value: string) => void;
}) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const now = today();
  const cells = Array.from(
    { length: Math.ceil((lead + days) / 7) * 7 },
    (_, i) => {
      const date = new Date(Date.UTC(year, month, i - lead + 1));
      return {
        value: format(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
        ),
        day: date.getUTCDate(),
        outside: date.getUTCMonth() !== month,
      };
    },
  );
  return (
    <div className="grid grid-cols-7 gap-0.5" role="grid">
      {WEEKDAYS.map((w) => (
        <span
          key={w}
          className="py-1 text-center text-[11px] font-medium text-muted-foreground"
        >
          {w}
        </span>
      ))}
      {cells.map((cell) => (
        <button
          key={cell.value}
          type="button"
          onClick={() => onPick(cell.value)}
          aria-label={shown.format(new Date(`${cell.value}T12:00:00`))}
          aria-pressed={cell.value === selected}
          className={cn(
            "h-8 rounded-md text-sm tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            cell.outside && "text-muted-foreground/50",
            cell.value === now && "font-semibold text-brand-orange",
            cell.value === selected &&
              "bg-brand-navy text-white hover:bg-brand-navy/90",
          )}
        >
          {cell.day}
        </button>
      ))}
    </div>
  );
}

/**
 * A date field with a calendar. `value` and `onChange` use "YYYY-MM-DD", like a native
 * date input, so it drops in where one was. `shortcuts` adds one-click dates under the calendar.
 */
export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Pick a date",
  shortcuts = [],
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  shortcuts?: { label: string; value: string }[];
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const initial = parse(value) ?? parse(today())!;
  const [view, setView] = useState({ y: initial.y, m: initial.m });
  const picked = parse(value);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }
  function step(by: number) {
    setView(({ y, m }) => {
      const date = new Date(Date.UTC(y, m + by, 1));
      return { y: date.getUTCFullYear(), m: date.getUTCMonth() };
    });
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const at = parse(value) ?? parse(today())!;
          setView({ y: at.y, m: at.m });
        }
        setOpen(next);
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-8 w-40 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-popup-open:border-ring",
          className,
        )}
      >
        <CalendarDays
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span
          className={cn(
            "flex-1 tabular-nums",
            !picked && "text-muted-foreground",
          )}
        >
          {picked
            ? shown.format(new Date(Date.UTC(picked.y, picked.m, picked.d, 12)))
            : placeholder}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50">
          <Popover.Popup className="w-72 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous month"
                className="rounded-md p-1 hover:bg-muted"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="text-sm font-semibold">
                {monthTitle.format(new Date(Date.UTC(view.y, view.m, 1, 12)))}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next month"
                className="rounded-md p-1 hover:bg-muted"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
            <MonthGrid
              year={view.y}
              month={view.m}
              selected={value}
              onPick={pick}
            />
            <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
              <button
                type="button"
                onClick={() => pick(today())}
                className="rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                Today
              </button>
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => pick(s.value)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-navy hover:bg-muted"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
