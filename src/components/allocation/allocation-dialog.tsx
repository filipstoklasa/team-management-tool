"use client";

import { useState, useTransition } from "react";
import { TriangleAlert } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, PercentageInput } from "./allocation-form-fields";
import {
  changeAllocation,
  correctAllocation,
  createAllocation,
} from "@/actions/allocations.ts";
import type { FieldError, Warning } from "@/actions/result.ts";
import { today } from "@/domain/date.ts";

export type DialogMode = "create" | "change" | "correct";

interface Option {
  id: number;
  name: string;
}

export interface ExistingAllocation {
  id: number;
  userId: number;
  appId: number;
  userName: string;
  appName: string;
  percentage: number;
  startDate: string;
  endDate: string | null;
}

/**
 * §6.4 — the allocation editor.
 *
 * The `change` mode implements §4.2: it ends the current row and creates a
 * successor rather than mutating in place, which is what makes time travel
 * possible. §6.4 makes it "the default action; plain edit is available but
 * visually secondary" — so `correct` exists, is reachable, and says plainly
 * that it rewrites history.
 */
export function AllocationDialog({
  open,
  onOpenChange,
  mode,
  users,
  apps,
  existing,
  defaultUserId,
  defaultAppId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DialogMode;
  users: Option[];
  apps: Option[];
  existing?: ExistingAllocation;
  defaultUserId?: number;
  defaultAppId?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);

  const [userId, setUserId] = useState(String(existing?.userId ?? defaultUserId ?? ""));
  const [appId, setAppId] = useState(String(existing?.appId ?? defaultAppId ?? ""));
  const [percentage, setPercentage] = useState(String(existing?.percentage ?? 50));
  const [startDate, setStartDate] = useState<string>(existing?.startDate ?? today());
  const [effectiveDate, setEffectiveDate] = useState<string>(today());
  const [endDate, setEndDate] = useState(existing?.endDate ?? "");
  const [note, setNote] = useState("");

  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;
  const generalErrors = errors.filter((e) => !e.field);

  function submit() {
    setErrors([]);
    setWarnings([]);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAllocation({
              userId: Number(userId),
              appId: Number(appId),
              percentage,
              startDate,
              endDate,
              note,
            })
          : mode === "change"
            ? await changeAllocation({
                allocationId: existing!.id,
                percentage,
                effectiveDate,
                endDate,
                note,
              })
            : await correctAllocation({
                allocationId: existing!.id,
                percentage,
                startDate,
                endDate,
                note,
              });

      if (!result.ok) {
        setErrors(result.errors);
        return;
      }

      // §4.3 — the save SUCCEEDED. Warnings are surfaced, never used to block.
      if (result.warnings.length > 0) {
        setWarnings(result.warnings);
        toast.warning("Saved, with over-allocation", {
          description: result.warnings[0].message,
        });
      } else {
        toast.success(
          mode === "change" ? "Allocation changed" : "Allocation saved",
        );
      }
      onOpenChange(false);
    });
  }

  const title =
    mode === "create"
      ? "New allocation"
      : mode === "change"
        ? "Change allocation"
        : "Correct a mistake";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {mode === "change" ? (
              <>
                Ends the current allocation on the effective date and creates a new
                one from that date. History is preserved.
              </>
            ) : mode === "correct" ? (
              <>
                Rewrites the existing row in place. Only for fixing a mistake such
                as a mistyped percentage — this does not preserve what was there
                before.
              </>
            ) : (
              <>Allocate someone to an app for a period.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "create" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Person" error={errorFor("userId")}>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="App" error={errorFor("appId")}>
                <Select value={appId} onValueChange={setAppId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {apps.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          ) : (
            <div className="bg-muted/50 rounded-md px-3 py-2 text-sm">
              <span className="font-medium">{existing?.userName}</span>
              <span className="text-muted-foreground"> on </span>
              <span className="font-medium">{existing?.appName}</span>
              <span className="text-muted-foreground tabular">
                {" "}
                — currently {existing?.percentage}%
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Percentage" htmlFor="percentage" error={errorFor("percentage")}>
              <PercentageInput value={percentage} onChange={setPercentage} />
            </Field>

            {mode === "change" ? (
              <Field
                label="Takes effect"
                htmlFor="effectiveDate"
                error={errorFor("effectiveDate")}
                hint="Old row ends here; new row starts here"
              >
                <Input
                  id="effectiveDate"
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="tabular"
                />
              </Field>
            ) : (
              <Field label="Start date" htmlFor="startDate" error={errorFor("startDate")}>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="tabular"
                />
              </Field>
            )}
          </div>

          <Field
            label="End date"
            htmlFor="endDate"
            error={errorFor("endDate")}
            hint="Leave empty for ongoing. Exclusive — the last active day is the day before."
          >
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="tabular"
            />
          </Field>

          <Field label="Note" htmlFor="note" hint="Why is this changing? Shows in the audit trail.">
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </Field>

          {generalErrors.length > 0 && (
            <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {generalErrors.map((e, i) => (
                <p key={i}>{e.message}</p>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-status-over-bg text-status-over rounded-md px-3 py-2 text-sm">
              <p className="flex items-center gap-1.5 font-medium">
                <TriangleAlert className="size-3.5" />
                Saved — but this person is over 100%
              </p>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending
              ? "Saving…"
              : mode === "change"
                ? "End current and create new"
                : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
