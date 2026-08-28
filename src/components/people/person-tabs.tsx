"use client";

import { SectionTabs } from "@/components/section-tabs";

/** §6.2 — tabbed person view. People-records tabs vanish when people.db is absent. */
export function PersonTabs({
  userId,
  peopleRecordsAvailable,
}: {
  userId: number;
  peopleRecordsAvailable: boolean;
}) {
  const base = `/people/${userId}`;

  return (
    <SectionTabs
      tabs={[
        { href: base, label: "Overview", exact: true, peopleRecords: false },
        { href: `${base}/allocation`, label: "Allocation", peopleRecords: false },
        { href: `${base}/one-on-ones`, label: "1:1s", peopleRecords: true },
        { href: `${base}/goals`, label: "Goals", peopleRecords: true },
        { href: `${base}/feedback`, label: "Feedback", peopleRecords: true },
      ].filter((tab) => !tab.peopleRecords || peopleRecordsAvailable)}
    />
  );
}
