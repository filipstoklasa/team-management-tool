"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AllocationDialog, type DialogMode } from "./allocation-dialog";
import { endAllocation } from "@/actions/allocations.ts";
import type { AllocationRow } from "@/data/allocation.ts";
import { today } from "@/domain/date.ts";

export function AllocationRowActions({ row }: { row: AllocationRow }) {
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [, startTransition] = useTransition();

  const existing = {
    id: row.id,
    userId: row.userId,
    appId: row.appId,
    userName: row.userName,
    appName: row.appName,
    percentage: row.percentage,
    startDate: row.startDate,
    endDate: row.endDate,
  };

  function endNow() {
    startTransition(async () => {
      const result = await endAllocation({
        allocationId: row.id,
        endDate: today(),
        note: "Ended from the allocation list",
      });
      if (result.ok) toast.success("Allocation ended today");
      else toast.error(result.errors[0]?.message ?? "Could not end that allocation");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* §6.4: "end current and create new" is the DEFAULT action. */}
          <DropdownMenuItem onSelect={() => setMode("change")}>
            Change percentage…
            <span className="text-muted-foreground ml-auto text-[10px]">keeps history</span>
          </DropdownMenuItem>
          {row.endDate === null && (
            <DropdownMenuItem onSelect={endNow}>End today</DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {/* Visually secondary, per §6.4. */}
          <DropdownMenuItem
            onSelect={() => setMode("correct")}
            className="text-muted-foreground text-xs"
          >
            Correct a mistake…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {mode && (
        <AllocationDialog
          open
          onOpenChange={(open) => !open && setMode(null)}
          mode={mode}
          users={[]}
          apps={[]}
          existing={existing}
        />
      )}
    </>
  );
}
