"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * §6.2 / §6.3 report range and export (#2).
 *
 * The range lives in the URL for the same reason the §6.1 date control does:
 * a particular view is linkable and survives a refresh. It also means the CSV
 * link and the printed page cannot disagree about what "selected range" means —
 * both read the same two search params.
 *
 * PDF is the browser's own print-to-PDF rather than a bundled generator. It
 * costs no dependency, and §7's local-only posture makes a renderer that phones
 * out for fonts or assets exactly the wrong thing to add.
 */
export function ReportToolbar({ csvBase }: { csvBase: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  function setBound(key: "from" | "to", value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    startTransition(() =>
      router.replace(qs ? `?${qs}` : "?", { scroll: false }),
    );
  }

  const csvHref = `${csvBase}${params.toString() ? `&${params.toString()}` : ""}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* The printed page loses the controls, so it has to state the range itself. */}
      <p className="hidden text-sm print:block">
        {from || to
          ? `Allocations ${from || "from the beginning"} to ${to || "ongoing"}`
          : "All allocations"}
      </p>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="report-from"
            className="text-muted-foreground text-xs"
          >
            From
          </label>
          <Input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setBound("from", e.target.value)}
            className="h-8 w-[9.5rem]"
          />
          <label htmlFor="report-to" className="text-muted-foreground text-xs">
            to
          </label>
          <Input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setBound("to", e.target.value)}
            className="h-8 w-[9.5rem]"
          />
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(params.toString());
                next.delete("from");
                next.delete("to");
                const qs = next.toString();
                startTransition(() =>
                  router.replace(qs ? `?${qs}` : "?", { scroll: false }),
                );
              }}
            >
              Clear
            </Button>
          )}
          {pending && (
            <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* A plain navigation, so the Content-Disposition header does the work. */}
            <DropdownMenuItem asChild>
              <a href={csvHref} download>
                <FileText />
                Download CSV
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => window.print()}>
              <Printer />
              Print / Save as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
