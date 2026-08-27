import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModuleBUnavailable } from "@/components/people/module-b-unavailable";
import { getOneOnOnes, moduleBAvailable } from "@/data/people.ts";
import { daysBetween, formatIsoDate, today } from "@/domain/date.ts";

/** §6.2 — "reverse-chronological session list". */
export default async function OneOnOnesPage({
  params,
}: PageProps<"/people/[userId]/one-on-ones">) {
  const { userId } = await params;
  const id = Number(userId);

  if (!moduleBAvailable()) return <ModuleBUnavailable />;

  const sessions = await getOneOnOnes(id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {sessions.length} {sessions.length === 1 ? "session" : "sessions"} recorded
        </p>
        <Button asChild size="sm" className="gap-1.5">
          <Link href={`/people/${id}/one-on-ones/new`}>
            <Plus className="size-4" />
            New 1:1
          </Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
          No 1:1s recorded yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link href={`/people/${id}/one-on-ones/${session.id}`}>
                <Card className="hover:border-foreground/25 gap-2 transition-colors">
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {formatIsoDate(session.date)}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {daysBetween(session.date, today())} days ago
                      </span>
                    </div>
                    {session.theirTopics && (
                      <p className="text-[13px]">
                        <span className="text-muted-foreground">They raised: </span>
                        <span className="line-clamp-2">{session.theirTopics}</span>
                      </p>
                    )}
                    {session.managerNotes && (
                      <p className="text-muted-foreground line-clamp-2 text-[13px]">
                        {session.managerNotes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
