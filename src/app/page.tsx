import { allocationDb } from "@/db/allocation/client.ts";
import { users } from "@/db/allocation/schema.ts";
import { personStatus } from "@/domain/metrics.ts";
import { today } from "@/domain/date.ts";

export default async function Probe() {
  const rows = await allocationDb.select().from(users);
  return <pre>{`${today()} · ${rows.length} users · ${personStatus(120)}`}</pre>;
}
