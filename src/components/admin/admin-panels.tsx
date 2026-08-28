"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import {
  saveApp,
  saveTeam,
  saveUser,
  setAppActive,
  setTeamActive,
  setUserActive,
} from "@/actions/entities.ts";
import { hardDeletePersonRecords } from "@/actions/people.ts";
import type { App, Team, User } from "@/db/allocation/schema.ts";
import { cn } from "@/lib/utils";

interface UserWithTeams extends User {
  teamIds: number[];
}
interface AppWithTeams extends App {
  teamIds: number[];
}

/**
 * §6.6 — "CRUD for Users, Teams, Apps. DEACTIVATE rather than delete in Module
 * A to preserve historical allocation integrity."
 *
 * There is deliberately no delete control anywhere in this file. Deleting a
 * user would orphan or destroy allocation history, which is the one thing the
 * §4.2 temporal model exists to protect.
 */
export function AdminPanels({
  users,
  teams,
  apps,
}: {
  users: UserWithTeams[];
  teams: Team[];
  apps: AppWithTeams[];
}) {
  return (
    <div className="space-y-8">
      <UsersPanel users={users} teams={teams} />
      <AppsPanel apps={apps} teams={teams} />
      <TeamsPanel teams={teams} />
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint: string;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="text-muted-foreground text-xs">{hint}</p>
        </div>
        {action}
      </div>
      <div className="divide-y overflow-hidden rounded-lg border">{children}</div>
    </section>
  );
}

function Row({
  name,
  detail,
  active,
  badges,
  onToggle,
  onEdit,
}: {
  name: string;
  detail?: string;
  active: boolean;
  badges?: string[];
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5",
        !active && "bg-muted/30 opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {!active && <Badge variant="outline" className="text-[10px]">inactive</Badge>}
        </div>
        {detail && <div className="text-muted-foreground truncate text-xs">{detail}</div>}
      </div>
      {badges && badges.length > 0 && (
        <div className="hidden gap-1 sm:flex">
          {badges.map((b) => (
            <span key={b} className="bg-secondary rounded px-1.5 py-0.5 text-[10px]">
              {b}
            </span>
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" className="h-7" onClick={onEdit}>
        <Pencil className="size-3.5" />
      </Button>
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onToggle}>
        {active ? "Deactivate" : "Reactivate"}
      </Button>
    </div>
  );
}

function TeamPicker({
  teams,
  selected,
  onChange,
}: {
  teams: Team[];
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Teams</Label>
      <div className="flex flex-wrap gap-3">
        {teams.map((team) => (
          <label key={team.id} className="flex items-center gap-1.5 text-sm">
            <Checkbox
              checked={selected.includes(team.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, team.id]
                    : selected.filter((id) => id !== team.id),
                )
              }
            />
            {team.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function UsersPanel({ users, teams }: { users: UserWithTeams[]; teams: Team[] }) {
  const [editing, setEditing] = useState<UserWithTeams | "new" | null>(null);
  const [leaver, setLeaver] = useState<{ id: number; name: string } | null>(null);
  const [, start] = useTransition();

  return (
    <>
      <Section
        title="People"
        hint="Deactivate rather than delete — allocation history depends on these rows"
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add person
          </Button>
        }
      >
        {users.map((user) => (
          <Row
            key={user.id}
            name={user.name}
            detail={user.title ?? undefined}
            active={user.active}
            badges={teams.filter((t) => user.teamIds.includes(t.id)).map((t) => t.name)}
            onEdit={() => setEditing(user)}
            onToggle={() =>
              start(async () => {
                const result = await setUserActive(user.id, !user.active);
                if (!result.ok) {
                  toast.error(result.errors[0]?.message ?? "Failed");
                  return;
                }
                toast.success(user.active ? "Deactivated" : "Reactivated");
                // §9.5 — prompt, never cascade.
                if (result.data.promptModuleBDeletion) {
                  setLeaver({ id: user.id, name: user.name });
                }
              })
            }
          />
        ))}
      </Section>

      {editing && (
        <UserDialog
          teams={teams}
          existing={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {leaver && <LeaverDialog leaver={leaver} onClose={() => setLeaver(null)} />}
    </>
  );
}

/** §9.5 leavers — the prompt that follows deactivation. */
function LeaverDialog({
  leaver,
  onClose,
}: {
  leaver: { id: number; name: string };
  onClose: () => void;
}) {
  const [pending, start] = useTransition();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {leaver.name}&rsquo;s people records?</DialogTitle>
          <DialogDescription>
            They have been deactivated. Their <strong>allocation history stays</strong>{" "}
            either way — it is needed for capacity analysis. Their 1:1 notes, goals,
            action items and feedback do not need to be kept.
            <br />
            <br />
            This is a permanent delete, not an archive. There is no undo.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep for now
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await hardDeletePersonRecords(leaver.id);
                if (result.ok) {
                  const t = result.data;
                  toast.success(
                    `Deleted ${t.oneOnOnes} 1:1s, ${t.goals} goals, ${t.actionItems} action items, ${t.feedback} feedback notes`,
                  );
                  onClose();
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
  );
}

function UserDialog({
  teams,
  existing,
  onClose,
}: {
  teams: Team[];
  existing?: UserWithTeams;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(existing?.name ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [startDate, setStartDate] = useState<string>(existing?.startDate ?? "");
  const [teamIds, setTeamIds] = useState<number[]>(existing?.teamIds ?? []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit person" : "Add person"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="uname" className="text-xs">Name</Label>
            <Input id="uname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="utitle" className="text-xs">Title</Label>
              <Input id="utitle" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ustart" className="text-xs">Joined</Label>
              <Input
                id="ustart"
                type="date"
                className="tabular"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <TeamPicker teams={teams} selected={teamIds} onChange={setTeamIds} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await saveUser({
                  id: existing?.id,
                  name,
                  title,
                  startDate,
                  teamIds,
                });
                if (result.ok) {
                  toast.success("Saved");
                  onClose();
                } else {
                  toast.error(result.errors[0]?.message ?? "Failed");
                }
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppsPanel({ apps, teams }: { apps: AppWithTeams[]; teams: Team[] }) {
  const [editing, setEditing] = useState<AppWithTeams | "new" | null>(null);
  const [, start] = useTransition();

  return (
    <>
      <Section
        title="Apps"
        hint="Required capacity is the target total allocation, e.g. 200 = 2 FTE"
        action={
          <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
            <Plus className="size-4" />
            Add app
          </Button>
        }
      >
        {apps.map((app) => (
          <Row
            key={app.id}
            name={app.name}
            detail={`${app.requiredCapacity}% required${app.notes ? ` · ${app.notes}` : ""}`}
            active={app.active}
            badges={teams.filter((t) => app.teamIds.includes(t.id)).map((t) => t.name)}
            onEdit={() => setEditing(app)}
            onToggle={() =>
              start(async () => {
                const result = await setAppActive(app.id, !app.active);
                if (result.ok) toast.success(app.active ? "Deactivated" : "Reactivated");
                else toast.error("Failed");
              })
            }
          />
        ))}
      </Section>

      {editing && (
        <AppDialog
          teams={teams}
          existing={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function AppDialog({
  teams,
  existing,
  onClose,
}: {
  teams: Team[];
  existing?: AppWithTeams;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [name, setName] = useState(existing?.name ?? "");
  const [requiredCapacity, setRequiredCapacity] = useState(
    String(existing?.requiredCapacity ?? 100),
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [teamIds, setTeamIds] = useState<number[]>(existing?.teamIds ?? []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit app" : "Add app"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aname" className="text-xs">Name</Label>
              <Input id="aname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acap" className="text-xs">Required %</Label>
              <Input
                id="acap"
                type="number"
                min={0}
                step={10}
                className="tabular"
                value={requiredCapacity}
                onChange={(e) => setRequiredCapacity(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="anotes" className="text-xs">Notes</Label>
            <Textarea
              id="anotes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <TeamPicker teams={teams} selected={teamIds} onChange={setTeamIds} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await saveApp({
                  id: existing?.id,
                  name,
                  requiredCapacity,
                  notes,
                  teamIds,
                });
                if (result.ok) {
                  toast.success("Saved");
                  onClose();
                } else {
                  toast.error(result.errors[0]?.message ?? "Failed");
                }
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeamsPanel({ teams }: { teams: Team[] }) {
  const [editing, setEditing] = useState<Team | "new" | null>(null);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function open(team: Team | "new") {
    setName(team === "new" ? "" : team.name);
    setEditing(team);
  }

  return (
    <>
      <Section
        title="Teams"
        hint="Grouping and navigation only — teams do not constrain allocation"
        action={
          <Button size="sm" className="gap-1.5" onClick={() => open("new")}>
            <Plus className="size-4" />
            Add team
          </Button>
        }
      >
        {teams.map((team) => (
          <Row
            key={team.id}
            name={team.name}
            active={team.active}
            onEdit={() => open(team)}
            onToggle={() =>
              start(async () => {
                const result = await setTeamActive(team.id, !team.active);
                if (result.ok) toast.success(team.active ? "Deactivated" : "Reactivated");
                else toast.error("Failed");
              })
            }
          />
        ))}
      </Section>

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "Add team" : "Edit team"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="tname" className="text-xs">Name</Label>
              <Input id="tname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await saveTeam({
                      id: editing === "new" ? undefined : editing.id,
                      name,
                    });
                    if (result.ok) {
                      toast.success("Saved");
                      setEditing(null);
                    } else {
                      toast.error(result.errors[0]?.message ?? "Failed");
                    }
                  })
                }
              >
                {pending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
