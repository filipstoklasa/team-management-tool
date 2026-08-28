"use client";

import { SectionTabs } from "@/components/section-tabs";

/** §6.2 — tabbed person view. */
export function PersonTabs({ userId }: { userId: number }) {
  const base = `/people/${userId}`;

  return (
    <SectionTabs
      tabs={[
        { href: base, label: "Overview", exact: true },
        { href: `${base}/allocation`, label: "Allocation" },
        { href: `${base}/one-on-ones`, label: "1:1s" },
        { href: `${base}/goals`, label: "Goals" },
        { href: `${base}/feedback`, label: "Feedback" },
      ]}
    />
  );
}
