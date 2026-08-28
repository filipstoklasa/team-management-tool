"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, LayoutGrid, Settings, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutGrid, exact: true },
  { href: "/people", label: "People", icon: Users },
  { href: "/apps", label: "Apps", icon: CalendarClock },
  // Retention lives inside Admin (§9.5 is a records-keeping job, not a separate
  // product area), so it is reached by its tab rather than a fifth nav entry.
  { href: "/admin", label: "Admin", icon: Settings },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-1 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="mr-4 flex items-center gap-2 py-3">
          <span className="bg-foreground text-background grid size-6 place-items-center rounded text-[11px] font-bold">
            TM
          </span>
          <span className="text-sm font-semibold tracking-tight">Team Management</span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {links.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="text-muted-foreground ml-auto flex items-center gap-1.5 text-xs">
          <span className="bg-status-full size-1.5 rounded-full" />
          Local only
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
