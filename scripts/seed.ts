/**
 * Seed data for development (§7: "Seed data must use fictional names — no real
 * colleagues in the repo").
 *
 * Dates are computed relative to today, so the seed keeps exercising the same
 * visual states — under / full / over, unallocated, past / present / future —
 * however long after writing it is run.
 *
 * Opens its own connections rather than importing the app's clients, which are
 * marked server-only.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { addDays, addMonths, asIsoDate, today, type IsoDate } from "../src/domain/date.ts";
import { applyPragmas } from "../src/db/pragmas.ts";
import { ALLOCATION_DB_PATH, PEOPLE_DB_PATH } from "../src/db/paths.ts";
import * as a from "../src/db/allocation/schema.ts";
import * as p from "../src/db/people/schema.ts";

const now = () => new Date();
/** A timestamp on the given calendar date, at a plausible working hour. */
const atDate = (d: IsoDate) => new Date(`${d}T10:30:00Z`);
const T = today();
const months = (n: number): IsoDate => addMonths(T, n);
const days = (n: number): IsoDate => addDays(T, n);

const allocSqlite = new Database(ALLOCATION_DB_PATH);
applyPragmas(allocSqlite);
const adb = drizzle(allocSqlite, { schema: a });

const peopleSqlite = new Database(PEOPLE_DB_PATH);
applyPragmas(peopleSqlite);
const pdb = drizzle(peopleSqlite, { schema: p });

console.log("Clearing existing data…");
allocSqlite.exec(`
  DELETE FROM allocation_changes; DELETE FROM allocations;
  DELETE FROM user_teams; DELETE FROM app_teams;
  DELETE FROM users; DELETE FROM teams; DELETE FROM apps;
  DELETE FROM sqlite_sequence;
`);
peopleSqlite.exec(`
  DELETE FROM goal_updates; DELETE FROM goals; DELETE FROM action_items;
  DELETE FROM feedback; DELETE FROM one_on_ones;
  DELETE FROM sqlite_sequence;
`);

// ---------------------------------------------------------------- teams
const teamRows = adb
  .insert(a.teams)
  .values([{ name: "Platform" }, { name: "Payments" }, { name: "Data" }])
  .returning()
  .all();
const [platform, payments, dataTeam] = teamRows;

// ---------------------------------------------------------------- apps
const appRows = adb
  .insert(a.apps)
  .values([
    { name: "Ratings Portal", requiredCapacity: 200, notes: "Client-facing. Peak load at quarter end." },
    { name: "Payments Gateway", requiredCapacity: 150, notes: "PCI scope. Changes need a second reviewer." },
    { name: "Risk Data Pipeline", requiredCapacity: 100, notes: "Overnight batch. On-call rotation applies." },
    { name: "Client Onboarding", requiredCapacity: 250, notes: "Largest delivery commitment this year." },
    { name: "Internal Tooling", requiredCapacity: 50, notes: "Best-effort. First to lose people when priorities move." },
  ])
  .returning()
  .all();
const [ratings, gateway, pipeline, onboarding, tooling] = appRows;

adb.insert(a.appTeams).values([
  { appId: ratings.id, teamId: platform.id },
  { appId: gateway.id, teamId: payments.id },
  { appId: pipeline.id, teamId: dataTeam.id },
  { appId: onboarding.id, teamId: platform.id },
  { appId: onboarding.id, teamId: payments.id },
  { appId: tooling.id, teamId: platform.id },
]).run();

// ---------------------------------------------------------------- users
const userRows = adb
  .insert(a.users)
  .values([
    { name: "Amara Okonkwo", title: "Senior Engineer", startDate: months(-38) },
    { name: "Bea Lindqvist", title: "Engineer", startDate: months(-19) },
    { name: "Callum Reyes", title: "Staff Engineer", startDate: months(-54) },
    { name: "Dilnoza Karimova", title: "Engineer", startDate: months(-11) },
    { name: "Emeka Adeyemi", title: "Senior Engineer", startDate: months(-26) },
    { name: "Farida Haddad", title: "Engineer", startDate: months(-7) },
    { name: "Gustav Novak", title: "Junior Engineer", startDate: months(-4) },
    { name: "Hina Matsumoto", title: "Senior Engineer", startDate: months(-31) },
    { name: "Ingrid Sørensen", title: "Engineer", startDate: months(-44), active: false },
  ])
  .returning()
  .all();
const [amara, bea, callum, dilnoza, emeka, farida, gustav, hina, ingrid] = userRows;

adb.insert(a.userTeams).values([
  { userId: amara.id, teamId: platform.id },
  { userId: bea.id, teamId: payments.id },
  { userId: bea.id, teamId: dataTeam.id },
  { userId: callum.id, teamId: platform.id },
  { userId: dilnoza.id, teamId: platform.id },
  { userId: emeka.id, teamId: payments.id },
  { userId: farida.id, teamId: platform.id },
  { userId: gustav.id, teamId: platform.id },
  { userId: hina.id, teamId: dataTeam.id },
  { userId: ingrid.id, teamId: dataTeam.id },
]).run();

// ----------------------------------------------------------- allocations
type Seed = {
  userId: number;
  appId: number;
  percentage: number;
  startDate: IsoDate;
  endDate: IsoDate | null;
  note: string;
};

const seeds: Seed[] = [
  // Amara — full at 100%, with a closed spell on Onboarding behind her.
  { userId: amara.id, appId: onboarding.id, percentage: 100, startDate: months(-14), endDate: months(-6), note: "Initial onboarding build-out" },
  { userId: amara.id, appId: ratings.id, percentage: 100, startDate: months(-6), endDate: null, note: "Moved to Ratings after onboarding MVP shipped" },

  // Bea — 120% today. Over-committed, and it started when the pipeline work landed.
  { userId: bea.id, appId: gateway.id, percentage: 60, startDate: months(-9), endDate: null, note: "Gateway maintenance and PCI remediation" },
  { userId: bea.id, appId: pipeline.id, percentage: 60, startDate: months(-2), endDate: null, note: "Pulled in to unblock the overnight batch rewrite" },

  // Callum — split exactly 50/50, staff engineer spread across two apps.
  { userId: callum.id, appId: ratings.id, percentage: 50, startDate: months(-11), endDate: null, note: "Architecture ownership" },
  { userId: callum.id, appId: onboarding.id, percentage: 50, startDate: months(-11), endDate: null, note: "Architecture ownership" },

  // Dilnoza — under-allocated at 40%, with more planned from next month.
  { userId: dilnoza.id, appId: onboarding.id, percentage: 40, startDate: months(-4), endDate: null, note: "Ramping up after joining the team" },
  { userId: dilnoza.id, appId: pipeline.id, percentage: 40, startDate: months(1), endDate: null, note: "Planned: second app once onboarding ramp completes" },

  // Emeka — UNALLOCATED today. Came off the gateway three weeks ago.
  { userId: emeka.id, appId: gateway.id, percentage: 100, startDate: months(-16), endDate: days(-21), note: "Rolled off after the gateway migration completed" },

  // Farida — full.
  { userId: farida.id, appId: onboarding.id, percentage: 100, startDate: months(-6), endDate: null, note: "Joined the onboarding delivery squad" },

  // Gustav — under at 80%, deliberately, still ramping.
  { userId: gustav.id, appId: tooling.id, percentage: 80, startDate: months(-3), endDate: null, note: "Tooling while ramping up" },

  // Hina — full today, with a planned move that starts in six weeks.
  { userId: hina.id, appId: pipeline.id, percentage: 100, startDate: months(-13), endDate: days(42), note: "Batch rewrite lead" },
  { userId: hina.id, appId: ratings.id, percentage: 100, startDate: days(42), endDate: null, note: "Planned: moves to Ratings once the rewrite ships" },

  // Ingrid — deactivated leaver; history retained for capacity analysis (§9.5).
  { userId: ingrid.id, appId: pipeline.id, percentage: 100, startDate: months(-40), endDate: months(-5), note: "Left the team" },
];

for (const seed of seeds) {
  const row = adb
    .insert(a.allocations)
    .values({
      userId: seed.userId,
      appId: seed.appId,
      percentage: seed.percentage,
      startDate: seed.startDate,
      endDate: seed.endDate,
      createdAt: now(),
    })
    .returning()
    .get();

  // Audit timestamps must match when the change actually happened, not when the
  // seed ran. Otherwise every historical allocation looks like it changed today,
  // and the §5.2 prep panel reports the entire history as "changed since the
  // last 1:1" — which is exactly the signal that panel exists to give.
  adb.insert(a.allocationChanges).values({
    allocationId: row.id,
    changedAt: atDate(seed.startDate),
    changeType: "created",
    note: seed.note,
  }).run();

  if (seed.endDate !== null) {
    adb.insert(a.allocationChanges).values({
      allocationId: row.id,
      changedAt: atDate(seed.endDate),
      changeType: "ended",
      note: "Allocation ended",
    }).run();
  }
}

// ------------------------------------------------------------- Module B
// Suitable content only, per §9.3: development goals, skill growth, project
// ownership interests, factual summaries of what was discussed.

const oneOnOneRows = pdb
  .insert(p.oneOnOnes)
  .values([
    {
      userId: bea.id,
      date: days(-7),
      managerNotes:
        "Talked through the pipeline work landing on top of gateway maintenance. Bea flagged that both are now expecting her at the same standups. Agreed I would look at the split rather than leaving her to arbitrate it.",
      theirTopics:
        "Wants more design ownership rather than only implementation. Asked what the path to senior looks like in concrete terms.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      userId: bea.id,
      date: days(-35),
      managerNotes:
        "Discussed the batch rewrite and whether it was a good fit. Bea was keen. Noted she has not had a design-led piece yet.",
      theirTopics: "Asked about conference budget for the year.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      userId: emeka.id,
      date: days(-24),
      managerNotes:
        "Gateway migration wrapped. No next assignment confirmed yet — I said I would come back within the fortnight. That deadline has now passed.",
      theirTopics:
        "Interested in the Ratings work. Would prefer something with a clear delivery date after a long migration.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      userId: gustav.id,
      date: days(-12),
      managerNotes:
        "Three months in. Ramp is going well; tooling was the right first surface. Reviewed which parts of the codebase he has not touched yet.",
      theirTopics: "Would like a mentor outside his immediate team.",
      createdAt: now(),
      updatedAt: now(),
    },
    {
      userId: amara.id,
      date: days(-16),
      managerNotes:
        "Ratings is in good shape. Amara raised that she is the only person who knows the export pipeline end to end.",
      theirTopics: "Bus-factor concern on exports. Suggested pairing with Farida to spread it.",
      createdAt: now(),
      updatedAt: now(),
    },
  ])
  .returning()
  .all();

const [beaRecent, , emekaLast, gustavLast, amaraLast] = oneOnOneRows;

pdb.insert(p.actionItems).values([
  { userId: bea.id, oneOnOneId: beaRecent.id, description: "Review Bea's split across Gateway and Pipeline — she is at 120%", owner: "manager", status: "open", dueDate: days(3), createdAt: now() },
  { userId: bea.id, oneOnOneId: beaRecent.id, description: "Write up what 'senior' looks like against the current framework", owner: "manager", status: "open", dueDate: days(10), createdAt: now() },
  { userId: bea.id, oneOnOneId: beaRecent.id, description: "Draft the design doc for the batch rewrite phase 2", owner: "report", status: "open", dueDate: days(14), createdAt: now() },
  { userId: emeka.id, oneOnOneId: emekaLast.id, description: "Confirm Emeka's next assignment — OVERDUE", owner: "manager", status: "open", dueDate: days(-10), createdAt: now() },
  { userId: gustav.id, oneOnOneId: gustavLast.id, description: "Find Gustav a mentor outside the team", owner: "manager", status: "open", dueDate: days(21), createdAt: now() },
  { userId: amara.id, oneOnOneId: amaraLast.id, description: "Set up Amara/Farida pairing on the export pipeline", owner: "manager", status: "done", createdAt: now(), closedAt: now() },
]).run();

const goalRows = pdb
  .insert(p.goals)
  .values([
    { userId: bea.id, title: "Lead a design-led piece of work end to end", detail: "Own the design, not just the implementation, for a project with real ambiguity in it.", category: "technical", status: "active", targetDate: months(4), createdAt: now(), updatedAt: now() },
    { userId: bea.id, title: "Mentor one engineer through their first quarter", category: "leadership", status: "active", targetDate: months(6), createdAt: now(), updatedAt: now() },
    { userId: amara.id, title: "Spread export-pipeline knowledge to at least two others", category: "delivery", status: "active", targetDate: months(3), createdAt: now(), updatedAt: now() },
    { userId: amara.id, title: "Run the quarter-end readiness review", category: "leadership", status: "achieved", createdAt: now(), updatedAt: now() },
    { userId: gustav.id, title: "Ship a change to every service in the platform group", detail: "A breadth exercise — the point is exposure, not the size of the changes.", category: "technical", status: "active", targetDate: months(5), createdAt: now(), updatedAt: now() },
    { userId: emeka.id, title: "Move into a delivery-facing role with a fixed end date", category: "delivery", status: "paused", createdAt: now(), updatedAt: now() },
  ])
  .returning()
  .all();

const [beaDesignGoal, , amaraExports, , gustavBreadth] = goalRows;

pdb.insert(p.goalUpdates).values([
  { goalId: beaDesignGoal.id, date: days(-35), note: "Batch rewrite identified as the candidate piece." },
  { goalId: beaDesignGoal.id, date: days(-7), note: "Started, but the 120% allocation is squeezing the design time out of it." },
  { goalId: amaraExports.id, date: days(-16), note: "Pairing with Farida agreed. Not started yet." },
  // Deliberately stale: no update in over 60 days, so §5.2 flags it as quietly stalling.
  { goalId: gustavBreadth.id, date: days(-74), note: "Covered three of the seven services so far." },
]).run();

pdb.insert(p.feedback).values([
  { userId: bea.id, date: days(-5), direction: "received", source: "Payments tech lead", category: "praise", content: "Unblocked the batch rewrite in a week after it had been stuck for a month. Clear written summary afterwards.", shared: false },
  { userId: bea.id, date: days(-40), direction: "given", category: "constructive", content: "Discussed picking up work before the current piece is finished — we agreed she would flag capacity before saying yes.", shared: true },
  { userId: amara.id, date: days(-9), direction: "received", source: "Client onboarding stakeholder", category: "praise", content: "Handover notes on the onboarding MVP were unusually thorough and saved the receiving team a lot of time.", shared: false },
  { userId: gustav.id, date: days(-14), direction: "given", category: "praise", content: "Ramp-up has been faster than expected. Said so directly in our 1:1.", shared: true },
  { userId: farida.id, date: days(-2), direction: "received", source: "Onboarding squad peer", category: "praise", content: "Picked up the export pipeline context quickly and started documenting it unprompted.", shared: false },
]).run();

const count = (db: Database.Database, table: string) =>
  (db.prepare(`select count(*) c from ${table}`).get() as { c: number }).c;

console.log("\nallocation.db");
for (const t of ["users", "teams", "apps", "allocations", "allocation_changes"]) {
  console.log(`  ${t.padEnd(20)} ${count(allocSqlite, t)}`);
}
console.log("people.db");
for (const t of ["one_on_ones", "action_items", "goals", "goal_updates", "feedback"]) {
  console.log(`  ${t.padEnd(20)} ${count(peopleSqlite, t)}`);
}
console.log(`\nSeeded relative to ${T}. Fictional names only (§7).`);

allocSqlite.close();
peopleSqlite.close();
