import { DatabaseZap } from "lucide-react";

/**
 * §9.2 — Module A must be fully usable with people.db absent. This is what the
 * Module B screens render in that case: a plain statement of fact, not an
 * error. Nothing is broken; the file simply is not on this machine.
 */
export function ModuleBUnavailable() {
  return (
    <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center">
      <DatabaseZap className="mx-auto mb-2 size-5" />
      <p className="text-foreground text-sm font-medium">People records not present</p>
      <p className="mx-auto mt-1 max-w-md text-[13px]">
        <code className="text-xs">people.db</code> is not on this machine, so 1:1s,
        goals and feedback are unavailable. Allocation works normally without it.
      </p>
    </div>
  );
}
