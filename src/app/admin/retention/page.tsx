import {
  RetentionReview,
  type RetentionGroup,
} from "@/components/admin/retention-review";
import { getAllUsers } from "@/data/allocation.ts";
import { getRetentionCandidates } from "@/data/people.ts";
import type { Feedback, OneOnOne } from "@/db/schema/people.ts";

const DEFAULT_MONTHS = 24;

/**
 * §9.5 retention review.
 *
 * The roster join happens here rather than in the data layer: the candidate
 * records come from `people.db` and carry only a `user_id`, and the names come
 * from allocation. Keeping the two reads separate is what §10.6 requires — the
 * people data never travels through an allocation query.
 */
export default async function RetentionPage({
  searchParams,
}: PageProps<"/admin/retention">) {
  const params = await searchParams;
  const raw = Number(
    Array.isArray(params.months) ? params.months[0] : params.months,
  );
  const months =
    Number.isFinite(raw) && raw >= 1
      ? Math.min(Math.round(raw), 240)
      : DEFAULT_MONTHS;

  const candidates = await getRetentionCandidates(months);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground max-w-2xl text-sm">
        People records are a working tool, not a permanent record. Old 1:1 notes
        and feedback are deleted, not archived. Allocation history is never
        touched by this screen.
      </p>

      <RetentionReview
        months={months}
        cutoff={candidates.cutoff}
        totals={{
          sessions: candidates.sessions.length,
          feedback: candidates.feedback.length,
        }}
        groups={await groupByPerson(candidates)}
      />
    </div>
  );
}

async function groupByPerson(candidates: {
  sessions: OneOnOne[];
  feedback: Feedback[];
}): Promise<RetentionGroup[]> {
  const users = await getAllUsers(true);
  const names = new Map(users.map((user) => [user.id, user.name]));
  const groups = new Map<number, RetentionGroup>();

  const group = (userId: number) => {
    let existing = groups.get(userId);
    if (!existing) {
      existing = {
        userId,
        name: names.get(userId) ?? `Deleted person #${userId}`,
        sessions: [],
        feedback: [],
      };
      groups.set(userId, existing);
    }
    return existing;
  };

  for (const session of candidates.sessions) {
    group(session.userId).sessions.push({
      id: session.id,
      date: session.date,
      label: "1:1 notes",
    });
  }
  for (const note of candidates.feedback) {
    group(note.userId).feedback.push({
      id: note.id,
      date: note.date,
      label: `Feedback — ${note.category}`,
    });
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
