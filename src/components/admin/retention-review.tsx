"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOlderThan } from "@/actions/people.ts";
import { formatIsoDate, type IsoDate } from "@/domain/date.ts";

export interface RetentionRecord {
  id: number;
  date: IsoDate;
  label: string;
}

export interface RetentionGroup {
  userId: number;
  name: string;
  sessions: RetentionRecord[];
  feedback: RetentionRecord[];
}

/**
 * §9.5 — "a screen listing records older than a configurable window (default 24
 * months) with bulk delete. The default posture is that old 1:1 notes get
 * deleted, not archived."
 *
 * The window is a URL parameter so a different window is a navigation, and the
 * list below always shows exactly what the button will remove.
 */
export function RetentionReview({
  months,
  cutoff,
  groups,
  totals,
}: {
  months: number;
  cutoff: IsoDate;
  groups: RetentionGroup[];
  totals: { sessions: number; feedback: number };
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(String(months));
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const nothingToDelete = totals.sessions + totals.feedback === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="months" className="text-xs">
            Keep records from the last
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="months"
              type="number"
              min={1}
              max={240}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-8 w-24"
            />
            <span className="text-muted-foreground text-sm">months</span>
            <Button
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => {
                const value = Number(draft);
                if (!Number.isFinite(value) || value < 1) {
                  toast.error("Retention window must be at least one month.");
                  return;
                }
                router.push(`/retention?months=${Math.round(value)}`);
              }}
            >
              Review
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Anything dated before {formatIsoDate(cutoff)} is listed below.
          </p>
        </div>

        <Button
          variant="destructive"
          disabled={nothingToDelete || pending}
          onClick={() => setConfirming(true)}
        >
          Delete {totals.sessions} 1:1{totals.sessions === 1 ? "" : "s"} and{" "}
          {totals.feedback} feedback note{totals.feedback === 1 ? "" : "s"}
        </Button>
      </div>

      {nothingToDelete ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
          Nothing is older than {months} month{months === 1 ? "" : "s"}. There is nothing to review.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.userId} className="overflow-hidden rounded-lg border">
              <header className="bg-muted/40 flex items-center justify-between px-4 py-2">
                <h2 className="text-sm font-medium">{group.name}</h2>
                <span className="text-muted-foreground text-xs">
                  {group.sessions.length + group.feedback.length} records
                </span>
              </header>
              <ul className="divide-y">
                {[...group.sessions, ...group.feedback]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((record) => (
                    <li
                      key={record.label + record.id}
                      className="flex items-center gap-3 px-4 py-2 text-sm"
                    >
                      <span className="text-muted-foreground w-28 shrink-0 text-xs tabular-nums">
                        {formatIsoDate(record.date)}
                      </span>
                      <span className="truncate">{record.label}</span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete {totals.sessions + totals.feedback} records?</DialogTitle>
              <DialogDescription>
                Every 1:1 note and feedback entry dated before {formatIsoDate(cutoff)} will
                be removed permanently. They are not archived and there is no undo.
                <br />
                <br />
                Goals, action items and all allocation history are left alone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await deleteOlderThan(months);
                    if (result.ok) {
                      const { oneOnOnes, feedback } = result.data;
                      toast.success(
                        `Deleted ${oneOnOnes} 1:1${oneOnOnes === 1 ? "" : "s"} and ` +
                          `${feedback} feedback note${feedback === 1 ? "" : "s"}`,
                      );
                      setConfirming(false);
                      router.refresh();
                    } else {
                      toast.error(result.errors[0]?.message ?? "Failed");
                    }
                  })
                }
              >
                {pending ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
