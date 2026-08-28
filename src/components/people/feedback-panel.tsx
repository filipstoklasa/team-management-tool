"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { markFeedbackShared, saveFeedback } from "@/actions/people.ts";
import type { Feedback } from "@/db/schema/people.ts";
import { formatIsoDate, today } from "@/domain/date.ts";
import { cn } from "@/lib/utils";

type DirectionFilter = "all" | "given" | "received";
type CategoryFilter = "all" | "praise" | "constructive" | "other";

/** §6.2 Feedback tab — "filterable by direction and category, with unshared items highlighted". */
export function FeedbackPanel({
  userId,
  items,
}: {
  userId: number;
  items: Feedback[];
}) {
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (direction === "all" || item.direction === direction) &&
          (category === "all" || item.category === category),
      ),
    [items, direction, category],
  );

  const unsharedCount = items.filter((i) => !i.shared).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={direction} onValueChange={(v) => setDirection(v as DirectionFilter)}>
          <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="given">Given</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
          <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="praise">Praise</SelectItem>
            <SelectItem value="constructive">Constructive</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        {unsharedCount > 0 && (
          <span className="text-status-under text-xs">
            {unsharedCount} not yet passed on
          </span>
        )}

        <div className="ml-auto">
          <FeedbackDialog
            userId={userId}
            trigger={
              <Button size="sm" className="gap-1.5">
                <Plus className="size-4" />
                Log feedback
              </Button>
            }
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
          {items.length === 0 ? "No feedback recorded yet." : "Nothing matches that filter."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li key={item.id}>
              <Card
                className={cn(
                  "gap-2",
                  !item.shared && "border-status-under/40 bg-status-under-bg/30",
                )}
              >
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {item.direction}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        item.category === "praise" && "text-status-full bg-status-full-bg",
                        item.category === "constructive" &&
                          "text-status-under bg-status-under-bg",
                      )}
                    >
                      {item.category}
                    </Badge>
                    <span className="text-muted-foreground tabular text-[11px]">
                      {formatIsoDate(item.date)}
                    </span>
                    {item.source && (
                      <span className="text-muted-foreground text-[11px]">
                        from {item.source}
                      </span>
                    )}
                    {!item.shared && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-6 gap-1 text-[11px]"
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            const result = await markFeedbackShared(item.id, userId, true);
                            if (result.ok) toast.success("Marked as passed on");
                            else toast.error("Could not update");
                          })
                        }
                      >
                        <Send className="size-3" />
                        Mark passed on
                      </Button>
                    )}
                  </div>
                  <p className="text-[13px]">{item.content}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FeedbackDialog({
  userId,
  trigger,
}: {
  userId: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [date, setDate] = useState<string>(today());
  const [direction, setDirection] = useState("received");
  const [category, setCategory] = useState("praise");
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");

  function submit() {
    start(async () => {
      const result = await saveFeedback({
        userId,
        date,
        direction,
        category,
        source,
        content,
        shared: false,
      });
      if (result.ok) {
        toast.success("Feedback logged");
        setContent("");
        setSource("");
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
        <DialogHeader><DialogTitle>Log feedback</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fdate" className="text-xs">Date</Label>
              <Input
                id="fdate"
                type="date"
                className="tabular"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Direction</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="given">Given</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="praise">Praise</SelectItem>
                  <SelectItem value="constructive">Constructive</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {direction === "received" && (
            <div className="space-y-1.5">
              <Label htmlFor="fsource" className="text-xs">Source</Label>
              <Input
                id="fsource"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Who it came from"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fcontent" className="text-xs">Content</Label>
            <Textarea
              id="fcontent"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
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
