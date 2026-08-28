import { DatabaseZap } from "lucide-react";

/**
 * §9.2 — allocation must be fully usable with people.db absent. This is what the
 * people screens render in that case: a plain statement of fact, not an error.
 * Nothing is broken; the records simply are not on this machine.
 *
 * The copy stays in product terms. A user meeting this state is not owed the
 * shape of the storage — but they are owed the reason and the fix, so the file
 * name survives as the closing detail rather than the opening one.
 */
export function PeopleRecordsUnavailable() {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center">
      <DatabaseZap className="mx-auto mb-2 size-5" />
      <p className="text-foreground text-sm font-medium">People records not present</p>
      <p className="mx-auto mt-1 max-w-md text-[13px]">
        1:1s, goals and feedback are not on this machine. Everything else works
        normally. To bring them across, restore{" "}
        <code className="text-xs">data/people.db</code> from a backup.
      </p>
    </div>
  );
}
