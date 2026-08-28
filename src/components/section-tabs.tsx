"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTab {
  href: string;
  label: string;
  /** Match the path exactly rather than by prefix — for a section's index tab. */
  exact?: boolean;
}

/**
 * The one tab treatment used by every tabbed section (#5).
 *
 * Person view and Admin previously looked like two products because only one of
 * them had tabs at all. Sharing the markup is what keeps them looking like one
 * screen family as either gains a tab.
 */
export function SectionTabs({ tabs }: { tabs: readonly SectionTab[] }) {
  const pathname = usePathname();

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
