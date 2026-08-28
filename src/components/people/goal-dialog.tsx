"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addGoalUpdate, saveGoal } from "@/actions/people.ts";
import type { Goal } from "@/db/people/schema.ts";
import { today } from "@/domain/date.ts";

const CATEGORIES = ["technical", "leadership", "delivery", "other"] as const;
const STATUSES = ["active", "achieved", "paused", "dropped"] as const;

export function GoalDialog({
  userId,
  existing,
  trigger,
}: {
  userId: number;
  existing?: Goal;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [detail, setDetail] = useState(existing?.detail ?? "");
  const [category, setCategory] = useState<string>(existing?.category ?? "technical");
  const [status, setStatus] = useState<string>(existing?.status ?? "active");
  const [targetDate, setTargetDate] = useState<string>(existing?.targetDate ?? "");

  function submit() {
    start(async () => {
      const result = await saveGoal({
        id: existing?.id,
        userId,
        title,
        detail,
        category,
        status,
        targetDate,
      });
      if (result.ok) {
        toast.success(existing ? "Goal updated" : "Goal added");
        setOpen(false);
      } else {
        toast.error(result.errors[0]?.message ?? "Could not save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit goal" : "New goal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detail" className="text-xs">Detail</Label>
            <Textarea
              id="detail"
              rows={3}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Optional — what does good look like?"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target" className="text-xs">Target</Label>
              <Input
                id="target"
                type="date"
                className="tabular"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** §5.1 GoalUpdate — "so trajectory is visible rather than just current state". */
export function GoalUpdateDialog({
  userId,
  goalId,
  trigger,
}: {
  userId: number;
  goalId: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [date, setDate] = useState<string>(today());
  const [note, setNote] = useState("");

  function submit() {
    start(async () => {
      const result = await addGoalUpdate({ goalId, date, note }, userId);
      if (result.ok) {
        toast.success("Progress logged");
        setNote("");
        setOpen(false);
      } else {
        toast.error(result.errors[0]?.message ?? "Could not save");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Log progress</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="w-44 space-y-1.5">
            <Label htmlFor="gdate" className="text-xs">Date</Label>
            <Input
              id="gdate"
              type="date"
              className="tabular"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gnote" className="text-xs">What moved</Label>
            <Textarea
              id="gnote"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
