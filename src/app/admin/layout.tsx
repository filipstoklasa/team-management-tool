import { SectionTabs } from "@/components/section-tabs";
import { moduleBAvailable } from "@/data/people.ts";

/**
 * §6.6 Admin and §9.5 retention, presented as one section (#5).
 *
 * They were previously two top-level nav entries with a one-way link between
 * them, which read as two tools sharing a window. They are the same job —
 * looking after the records rather than using them — so they share a heading
 * and a tab strip.
 *
 * This groups them in the navigation only. They remain separate routes with
 * separate reads, which is what §9.2 means by separate screens: /admin touches
 * allocation.db alone, and the retention tab simply is not offered when
 * people.db is absent.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          The records behind the app: who exists, what they work on, and what gets
          kept.
        </p>
      </div>

      <SectionTabs
        tabs={[
          { href: "/admin", label: "People, apps and teams", exact: true },
          ...(moduleBAvailable()
            ? [{ href: "/admin/retention", label: "Retention review" }]
            : []),
        ]}
      />

      {children}
    </div>
  );
}
