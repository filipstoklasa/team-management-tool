/**
 * §4.4 — derived metrics. Computed at query time, never stored.
 */

export type PersonStatus = "unallocated" | "under" | "full" | "over";

/**
 * §4.4: "< 100% underallocated · = 100% full · > 100% overcommitted."
 *
 * `unallocated` is split out from `under` because §4.4 calls it "the most
 * actionable signal in the app" and it warrants its own visual treatment.
 */
export function personStatus(totalPercentage: number): PersonStatus {
  if (totalPercentage <= 0) return "unallocated";
  if (totalPercentage < 100) return "under";
  if (totalPercentage > 100) return "over";
  return "full";
}

export type AppStatus = "under-resourced" | "staffed" | "over-resourced";

/** §4.4: total allocation compared against `App.required_capacity`. */
export function appStatus(
  totalPercentage: number,
  requiredCapacity: number,
): AppStatus {
  if (totalPercentage < requiredCapacity) return "under-resourced";
  if (totalPercentage > requiredCapacity) return "over-resourced";
  return "staffed";
}

/** Signed distance from target: negative is a shortfall. Drives §6.1 sorting. */
export function capacityDelta(
  totalPercentage: number,
  requiredCapacity: number,
): number {
  return Math.round((totalPercentage - requiredCapacity) * 100) / 100;
}

/**
 * Fraction of the target met, clamped for display so an app at 400% of a tiny
 * capacity does not render a bar ten screens wide.
 */
export function capacityRatio(
  totalPercentage: number,
  requiredCapacity: number,
): number {
  if (requiredCapacity <= 0) return totalPercentage > 0 ? 1 : 0;
  return totalPercentage / requiredCapacity;
}
