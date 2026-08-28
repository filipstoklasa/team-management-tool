import { Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoalDialog, GoalUpdateDialog } from "@/components/people/goal-dialog";
import { getGoalUpdates, getGoals } from "@/data/people.ts";
import { addDays, daysBetween, formatIsoDate, today } from "@/domain/date.ts";
import { cn } from "@/lib/utils";

/** §6.2 Goals tab — "active and past goals with their update history". */
export default async function GoalsPage({ params }: PageProps<"/people/[userId]/goals">) {
  const { userId } = await params;
  const id = Number(userId);

  const goals = await getGoals(id);
  const updates = await getGoalUpdates(goals.map((g) => g.id));
  const stallCutoff = addDays(today(), -60);

  const active = goals.filter((g) => g.status === "active");
  const past = goals.filter((g) => g.status !== "active");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {active.length} active · {past.length} closed
        </p>
        <GoalDialog
          userId={id}
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" />
              New goal
            </Button>
          }
        />
      </div>

      {goals.length === 0 && (
        <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
          No goals recorded yet.
        </div>
      )}

      {[
        { label: "Active", items: active },
        { label: "Closed", items: past },
      ].map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.label} className="space-y-3">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {group.label}
              </h2>
              <ul className="space-y-3">
                {group.items.map((goal) => {
                  const history = updates.get(goal.id) ?? [];
                  const latest = history[0];
                  const stalling =
                    goal.status === "active" &&
                    (latest === undefined || latest.date < stallCutoff);

                  return (
                    <li key={goal.id}>
                      <Card className="gap-3">
                        <CardContent className="space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <GoalDialog
                                userId={id}
                                existing={goal}
                                trigger={
                                  <button className="text-left text-sm font-medium hover:underline">
                                    {goal.title}
                                  </button>
                                }
                              />
                              {goal.detail && (
                                <p className="text-muted-foreground mt-0.5 text-[13px]">
                                  {goal.detail}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Badge variant="outline" className="text-[10px]">
                                {goal.category}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  goal.status === "achieved" &&
                                    "text-status-full bg-status-full-bg",
                                  goal.status === "active" && "text-foreground",
                                )}
                              >
                                {goal.status}
                              </Badge>
                              {stalling && (
                                <Badge
                                  variant="outline"
                                  className="text-status-under bg-status-under-bg text-[10px]"
                                  title="Active, but no progress logged in 60 days (§5.2)"
                                >
                                  stalling
                                </Badge>
                              )}
                            </div>
                          </div>

                          {goal.targetDate && (
                            <p className="text-muted-foreground text-[11px]">
                              Target {formatIsoDate(goal.targetDate)}
                            </p>
                          )}

                          {history.length > 0 && (
                            <ul className="space-y-1.5 border-l pl-3">
                              {history.map((update) => (
                                <li key={update.id} className="text-[13px]">
                                  <span className="tabular text-muted-foreground mr-2 text-[11px]">
                                    {formatIsoDate(update.date)}
                                    <span className="ml-1">
                                      ({daysBetween(update.date, today())}d ago)
                                    </span>
                                  </span>
                                  {update.note}
                                </li>
                              ))}
                            </ul>
                          )}

                          <GoalUpdateDialog
                            userId={id}
                            goalId={goal.id}
                            trigger={
                              <Button variant="outline" size="sm" className="h-7 gap-1.5">
                                <TrendingUp className="size-3.5" />
                                Log progress
                              </Button>
                            }
                          />
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
