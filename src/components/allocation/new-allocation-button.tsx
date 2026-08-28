"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AllocationDialog } from "./allocation-dialog";

interface Option {
  id: number;
  name: string;
}

/**
 * §6.4 — the create entry point, reachable from both sides of the relationship.
 *
 * Whichever side the screen fixes is passed as a default and locked in the
 * dialog: opening this from the Ratings Portal page cannot end up creating an
 * allocation against a different app.
 */
export function NewAllocationButton({
  label,
  users,
  apps,
  defaultUserId,
  defaultAppId,
}: {
  label: string;
  users: Option[];
  apps: Option[];
  defaultUserId?: number;
  defaultAppId?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label}
      </Button>

      {open && (
        <AllocationDialog
          open
          onOpenChange={setOpen}
          mode="create"
          users={users}
          apps={apps}
          defaultUserId={defaultUserId}
          defaultAppId={defaultAppId}
        />
      )}
    </>
  );
}
