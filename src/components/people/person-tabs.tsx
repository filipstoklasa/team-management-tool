"use client";

import { SectionTabs } from "@/components/section-tabs";

/** §6.2 — tabbed person view. Module B tabs vanish when people.db is absent. */
export function PersonTabs({
  userId,
  moduleBAvailable,
}: {
  userId: number;
  moduleBAvailable: boolean;
}) {
  const base = `/people/${userId}`;

  return (
    <SectionTabs
      tabs={[
        { href: base, label: "Overview", exact: true, moduleB: false },
        { href: `${base}/allocation`, label: "Allocation", moduleB: false },
        { href: `${base}/one-on-ones`, label: "1:1s", moduleB: true },
        { href: `${base}/goals`, label: "Goals", moduleB: true },
        { href: `${base}/feedback`, label: "Feedback", moduleB: true },
      ].filter((tab) => !tab.moduleB || moduleBAvailable)}
    />
  );
}
