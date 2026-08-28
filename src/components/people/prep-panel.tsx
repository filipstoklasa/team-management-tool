import { CircleDot, MessageSquareQuote, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AllocationRow } from "@/data/allocation.ts";
import type { PrepPanelData } from "@/data/people.ts";
import { daysBetween, formatIsoDate, today } from "@/domain/date.ts";
import { appColor, formatPercent } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

/**
 * §5.2 — the agenda carry-over prep panel. "The mechanism that makes 1:1s
 * continuous rather than a series of disconnected conversations."
 *
 * Note the shape of the props: the allocation half (`allocations`, `changedSince`)
 * and the people records half (`data`) arrive as SEPARATE inputs, fetched by separate
 * functions against separate databases and joined here in the component tree.
 * §10.6 forbids one function that reads both — such a function could not
 * survive people.db being absent, and would drag note content into anything
 * that cached it.
 */
export function PrepPanel({
  data,
  allocations,
  recentAllocationChanges,
}: {
  data: PrepPanelData;
  allocations: AllocationRow[];
  recentAllocationChanges: { appName: string; changeType: string; changedAt: Date }[];
}) {
  const t = today();
  const empty =
    data.openActionItems.length === 0 &&
    data.unsharedFeedback.length === 0 &&
    data.stallingGoals.length === 0 &&
    recentAllocationChanges.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Prep</h2>
        <p className="text-muted-foreground text-xs">
          {data.lastOneOnOne
            ? `Carried over from ${formatIsoDate(data.lastOneOnOne.date)} — ${daysBetween(data.lastOneOnOne.date, t)} days ago`
            : "No previous 1:1 recorded"}
        </p>
      </div>

      {/* Allocation reality is usually half the substance of a 1:1. */}
      <Section icon={TrendingUp} title="Currently allocated">
        {allocations.length === 0 ? (
          <p className="text-status-unallocated text-[13px]">
            Not allocated to anything. Worth leading with.
          </p>
        ) : (
          <ul className="space-y-1">
            {allocations.map((row) => (
              <li key={row.id} className="flex items-center gap-2 text-[13px]">
                <span
                  className="size-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: appColor(row.appId) }}
                />
                <span className="flex-1 truncate">{row.appName}</span>
                <span className="tabular text-muted-foreground">
                  {formatPercent(row.percentage)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {recentAllocationChanges.length > 0 && (
          <p className="text-muted-foreground mt-2 text-[12px]">
            Changed since the last 1:1:{" "}
            {recentAllocationChanges
              .map((c) => `${c.appName} (${c.changeType})`)
              .join(", ")}
            . A better opening than &ldquo;so, how are things?&rdquo;
          </p>
        )}
      </Section>

      {/* People records — uncached, and absent entirely when people.db is missing. */}
      {data.openActionItems.length > 0 && (
        <Section icon={CircleDot} title={`Open action items (${data.openActionItems.length})`}>
          <ul className="space-y-1.5">
            {data.openActionItems.map((item) => {
              const overdue = item.dueDate !== null && item.dueDate < t;
              return (
                <li key={item.id} className="flex items-start gap-2 text-[13px]">
                  <span className="flex-1">{item.description}</span>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {item.owner}
                  </Badge>
                  {overdue && (
                    <span className="text-status-unallocated shrink-0 text-[11px] font-medium">
                      late
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {data.unsharedFeedback.length > 0 && (
        <Section
          icon={MessageSquareQuote}
          title={`Feedback to pass on (${data.unsharedFeedback.length})`}
        >
          <ul className="space-y-1.5">
            {data.unsharedFeedback.map((item) => (
              <li key={item.id} className="text-[13px]">
                <span
                  className={cn(
                    "mr-1.5 text-[10px] uppercase",
                    item.category === "praise" ? "text-status-full" : "text-status-under",
                  )}
                >
                  {item.category}
                </span>
                {item.content}
                {item.source && (
                  <span className="text-muted-foreground"> — {item.source}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.stallingGoals.length > 0 && (
        <Section icon={Target} title={`Quietly stalling (${data.stallingGoals.length})`}>
          <p className="text-muted-foreground mb-1.5 text-[12px]">
            Active, but no progress logged in 60 days.
          </p>
          <ul className="space-y-1">
            {data.stallingGoals.map((goal) => (
              <li key={goal.id} className="text-[13px]">
                {goal.title}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {empty && (
        <p className="text-muted-foreground text-[13px]">
          Nothing carried over. Clean slate.
        </p>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium">
        <Icon className="text-muted-foreground size-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}
