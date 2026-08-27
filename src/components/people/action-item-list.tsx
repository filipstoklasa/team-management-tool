"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { setActionItemStatus } from "@/actions/people.ts";
import type { ActionItem } from "@/db/people/schema.ts";
import { daysBetween, formatIsoDate, today } from "@/domain/date.ts";
import { cn } from "@/lib/utils";

export function ActionItemList({
  items,
  userId,
}: {
  items: ActionItem[];
  userId: number;
}) {
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-muted-foreground text-[13px]">No action items.</p>;
  }

  const t = today();

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const done = item.status !== "open";
        const overdue = !done && item.dueDate !== null && item.dueDate < t;
        return (
          <li key={item.id} className="flex items-start gap-2">
            <Checkbox
              checked={done}
              disabled={pending}
              className="mt-0.5"
              onCheckedChange={(checked) =>
                startTransition(async () => {
                  const result = await setActionItemStatus(
                    item.id,
                    userId,
                    checked ? "done" : "open",
                  );
                  if (!result.ok) toast.error(result.errors[0]?.message ?? "Failed");
                })
              }
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[13px]",
                  done && "text-muted-foreground line-through",
                )}
              >
                {item.description}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {item.owner === "manager" ? "me" : "them"}
                </Badge>
                {item.dueDate && (
                  <span
                    className={cn(
                      "text-[11px]",
                      overdue
                        ? "text-status-unallocated font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    {overdue
                      ? `${daysBetween(item.dueDate, t)}d late`
                      : formatIsoDate(item.dueDate)}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
