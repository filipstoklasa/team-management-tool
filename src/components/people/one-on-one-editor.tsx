"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { saveActionItem, saveOneOnOne } from "@/actions/people.ts";
import type { FieldError } from "@/actions/result.ts";
import { today } from "@/domain/date.ts";

interface DraftItem {
  key: string;
  description: string;
  owner: "manager" | "report";
}

/**
 * §6.5 — the 1:1 editor. Date, manager notes, their topics, and inline action
 * item creation with owner assignment.
 *
 * Action items are drafted locally and written after the session saves, so a
 * new 1:1 and its commitments land together rather than leaving orphaned items
 * behind if the session is abandoned.
 */
export function OneOnOneEditor({
  userId,
  existing,
}: {
  userId: number;
  existing?: {
    id: number;
    date: string;
    managerNotes: string | null;
    theirTopics: string | null;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldError[]>([]);

  const [date, setDate] = useState<string>(existing?.date ?? today());
  const [managerNotes, setManagerNotes] = useState(existing?.managerNotes ?? "");
  const [theirTopics, setTheirTopics] = useState(existing?.theirTopics ?? "");
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;

  function addDraft() {
    setDrafts((d) => [
      ...d,
      { key: crypto.randomUUID(), description: "", owner: "manager" },
    ]);
  }

  function save() {
    setErrors([]);
    startTransition(async () => {
      const result = await saveOneOnOne({
        id: existing?.id,
        userId,
        date,
        managerNotes,
        theirTopics,
      });

      if (!result.ok) {
        setErrors(result.errors);
        toast.error(result.errors[0]?.message ?? "Could not save");
        return;
      }

      const session = result.data as { id: number };
      const pendingItems = drafts.filter((d) => d.description.trim().length > 0);
      for (const item of pendingItems) {
        await saveActionItem({
          userId,
          oneOnOneId: session.id,
          description: item.description,
          owner: item.owner,
          status: "open",
        });
      }

      toast.success(
        pendingItems.length > 0
          ? `1:1 saved with ${pendingItems.length} action ${pendingItems.length === 1 ? "item" : "items"}`
          : "1:1 saved",
      );
      router.push(`/people/${userId}/one-on-ones`);
    });
  }

  return (
    <div className="space-y-4">
      <div className="w-44 space-y-1.5">
        <Label htmlFor="date" className="text-xs">
          Date
        </Label>
        <Input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="tabular"
        />
        {errorFor("date") && (
          <p className="text-destructive text-[11px]">{errorFor("date")}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="theirTopics" className="text-xs">
          What they raised
        </Label>
        <Textarea
          id="theirTopics"
          value={theirTopics}
          onChange={(e) => setTheirTopics(e.target.value)}
          rows={5}
          placeholder="Their agenda — what they wanted to talk about"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="managerNotes" className="text-xs">
          What I recorded
        </Label>
        <Textarea
          id="managerNotes"
          value={managerNotes}
          onChange={(e) => setManagerNotes(e.target.value)}
          rows={7}
          placeholder="Factual summary of what was discussed"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Action items</Label>
          <Button variant="outline" size="sm" onClick={addDraft} className="h-7 gap-1">
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>

        {drafts.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">
            Anything either of you committed to.
          </p>
        ) : (
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li key={draft.key} className="flex items-center gap-2">
                <Input
                  value={draft.description}
                  placeholder="What was committed to"
                  onChange={(e) =>
                    setDrafts((d) =>
                      d.map((x) =>
                        x.key === draft.key ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Select
                  value={draft.owner}
                  onValueChange={(owner) =>
                    setDrafts((d) =>
                      d.map((x) =>
                        x.key === draft.key
                          ? { ...x, owner: owner as DraftItem["owner"] }
                          : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="w-28 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Me</SelectItem>
                    <SelectItem value="report">Them</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setDrafts((d) => d.filter((x) => x.key !== draft.key))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : existing ? "Save changes" : "Save 1:1"}
        </Button>
      </div>
    </div>
  );
}
