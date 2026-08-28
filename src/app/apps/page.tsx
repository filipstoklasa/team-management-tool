import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CapacityBar } from "@/components/allocation-bar";
import { getAppsAllocation } from "@/data/allocation.ts";
import { today } from "@/domain/date.ts";
import { appStatusMeta, formatPercent } from "@/lib/status.ts";
import { cn } from "@/lib/utils";

export default async function AppsIndexPage() {
  const apps = await getAppsAllocation(today());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <p className="text-muted-foreground text-sm">
          {apps.length} active {apps.length === 1 ? "app" : "apps"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map((entry) => {
          const meta = appStatusMeta[entry.status];
          return (
            <Link key={entry.app.id} href={`/apps/${entry.app.id}`}>
              <Card className="hover:border-foreground/25 h-full gap-3 transition-colors">
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{entry.app.name}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {entry.allocations.length}{" "}
                        {entry.allocations.length === 1 ? "person" : "people"}
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(meta.text, meta.bg)}>
                      {entry.delta > 0 ? "+" : ""}
                      {entry.delta}%
                    </Badge>
                  </div>
                  <CapacityBar
                    total={entry.total}
                    required={entry.app.requiredCapacity}
                    status={entry.status}
                  />
                  <div className="tabular text-muted-foreground text-[11px]">
                    {formatPercent(entry.total)} of {entry.app.requiredCapacity}% required
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
