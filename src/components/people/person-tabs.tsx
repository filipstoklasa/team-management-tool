"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** §6.2 — tabbed person view. Module B tabs vanish when people.db is absent. */
export function PersonTabs({
  userId,
  moduleBAvailable,
}: {
  userId: number;
  moduleBAvailable: boolean;
}) {
  const pathname = usePathname();
  const base = `/people/${userId}`;

  const tabs = [
    { href: base, label: "Overview", exact: true, moduleB: false },
    { href: `${base}/allocation`, label: "Allocation", moduleB: false },
    { href: `${base}/one-on-ones`, label: "1:1s", moduleB: true },
    { href: `${base}/goals`, label: "Goals", moduleB: true },
    { href: `${base}/feedback`, label: "Feedback", moduleB: true },
  ].filter((tab) => !tab.moduleB || moduleBAvailable);

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-foreground text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
