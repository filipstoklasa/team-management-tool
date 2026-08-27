"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Check, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Team {
  id: number;
  name: string;
}

/** §6.1 — "Team filter — multi-select, filters both panels." */
export function TeamFilter({
  teams,
  selected,
}: {
  teams: Team[];
  selected: number[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function toggle(teamId: number) {
    const next = selected.includes(teamId)
      ? selected.filter((id) => id !== teamId)
      : [...selected, teamId];
    const query = new URLSearchParams(params.toString());
    query.delete("team");
    for (const id of next) query.append("team", String(id));
    const qs = query.toString();
    startTransition(() => router.replace(qs ? `/?${qs}` : "/", { scroll: false }));
  }

  function clear() {
    const query = new URLSearchParams(params.toString());
    query.delete("team");
    const qs = query.toString();
    startTransition(() => router.replace(qs ? `/?${qs}` : "/", { scroll: false }));
  }

  const label =
    selected.length === 0
      ? "All teams"
      : selected.length === 1
        ? (teams.find((t) => t.id === selected[0])?.name ?? "1 team")
        : `${selected.length} teams`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Filter className="size-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Filter both panels</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onSelect={(e) => {
              e.preventDefault();
              toggle(team.id);
            }}
            className="justify-between"
          >
            {team.name}
            <Check
              className={cn(
                "size-4",
                selected.includes(team.id) ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={clear}>Clear filter</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
