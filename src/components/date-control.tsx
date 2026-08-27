"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDays, addMonths, asIsoDate, today, type IsoDate } from "@/domain/date.ts";
import { cn } from "@/lib/utils";

/**
 * §6.1 — "Date picker / timeline slider — defaults to today". This control is
 * the thing that drives every allocation panel below it.
 *
 * The date lives in the URL rather than in component state, so a particular
 * view of the world is linkable, survives a refresh, and lands in browser
 * history. `useTransition` keeps the old figures on screen while the new ones
 * load, rather than flashing a skeleton on every step.
 */
export function DateControl({ date }: { date: IsoDate }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function goTo(next: IsoDate) {
    const query = new URLSearchParams(params.toString());
    if (next === today()) query.delete("date");
    else query.set("date", next);
    const qs = query.toString();
    startTransition(() => router.replace(qs ? `/?${qs}` : "/", { scroll: false }));
  }

  const isToday = date === today();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          aria-label="Back one month"
          onClick={() => goTo(addMonths(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => goTo(addDays(date, -7))}>
          −1w
        </Button>
      </div>

      <div className="relative">
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            const value = e.target.value;
            if (value) goTo(asIsoDate(value));
          }}
          className={cn("tabular w-[10.5rem]", pending && "opacity-60")}
          aria-label="View allocation as of date"
        />
        {pending && (
          <Loader2 className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin" />
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => goTo(addDays(date, 7))}>
          +1w
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Forward one month"
          onClick={() => goTo(addMonths(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Button
        variant={isToday ? "secondary" : "default"}
        size="sm"
        disabled={isToday}
        onClick={() => goTo(today())}
      >
        Today
      </Button>

      {!isToday && (
        <span className="text-muted-foreground text-xs">
          Viewing a {date > today() ? "planned" : "historical"} state
        </span>
      )}
    </div>
  );
}
