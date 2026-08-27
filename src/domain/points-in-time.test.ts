import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { asIsoDate } from "./date.ts";
import { overlaps, type DateRange } from "./intervals.ts";
import { overAllocatedSegments, segmentize, totalAsOf } from "./points-in-time.ts";

const d = asIsoDate;

interface Alloc {
  label: string;
  range: DateRange;
  percentage: number;
}

const alloc = (
  label: string,
  start: string,
  end: string | null,
  percentage: number,
): Alloc => ({
  label,
  range: { start: d(start), end: end === null ? null : d(end) },
  percentage,
});

const getRange = (a: Alloc) => a.range;
const getWeight = (a: Alloc) => a.percentage;
const seg = (items: readonly Alloc[], threshold?: number) =>
  overAllocatedSegments(items, getRange, getWeight, threshold);

describe("segmentize", () => {
  test("a single ongoing allocation is one open-ended segment", () => {
    const result = segmentize([alloc("a", "2026-01-01", null, 50)], getRange, getWeight);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].range, { start: "2026-01-01", end: null });
    assert.equal(result[0].total, 50);
  });

  test("splits at every boundary and totals each segment independently", () => {
    const result = segmentize(
      [alloc("a", "2026-01-01", "2026-06-01", 60), alloc("b", "2026-03-01", "2026-09-01", 50)],
      getRange,
      getWeight,
    );
    assert.deepEqual(
      result.map((s) => [s.range.start, s.range.end, s.total]),
      [
        ["2026-01-01", "2026-03-01", 60],
        ["2026-03-01", "2026-06-01", 110],
        ["2026-06-01", "2026-09-01", 50],
      ],
    );
  });

  test("omits gaps where nothing is active", () => {
    const result = segmentize(
      [alloc("a", "2026-01-01", "2026-02-01", 100), alloc("b", "2026-05-01", "2026-06-01", 100)],
      getRange,
      getWeight,
    );
    assert.deepEqual(
      result.map((s) => [s.range.start, s.range.end]),
      [
        ["2026-01-01", "2026-02-01"],
        ["2026-05-01", "2026-06-01"],
      ],
      "the Feb-May gap produces no segment",
    );
  });

  test("adjacent allocations never produce a phantom overlap segment", () => {
    const result = segmentize(
      [alloc("a", "2026-01-01", "2026-02-01", 100), alloc("b", "2026-02-01", null, 100)],
      getRange,
      getWeight,
    );
    assert.deepEqual(
      result.map((s) => s.total),
      [100, 100],
      "handover on the same day is never counted as 200%",
    );
  });

  test("an empty input produces no segments", () => {
    assert.deepEqual(segmentize([], getRange, getWeight), []);
  });
});

describe("§4.3 — the 100% check evaluates per point in time", () => {
  test("catches an overlap that only begins weeks after the start date", () => {
    // This is the case the rule exists for. On 2026-01-01 the person is at 60%.
    // The breach only appears on 2026-03-01, when the second allocation starts.
    const items = [
      alloc("platform", "2026-01-01", "2026-06-01", 60),
      alloc("migration", "2026-03-01", "2026-09-01", 50),
    ];

    assert.equal(totalAsOf(items, getRange, getWeight, d("2026-01-15")), 60);
    assert.equal(totalAsOf(items, getRange, getWeight, d("2026-04-15")), 110);

    const breaches = seg(items);
    assert.equal(breaches.length, 1);
    assert.deepEqual(breaches[0].range, { start: "2026-03-01", end: "2026-06-01" });
    assert.equal(breaches[0].total, 110);
  });

  test("exactly 100% is not a breach", () => {
    const items = [
      alloc("a", "2026-01-01", null, 50),
      alloc("b", "2026-01-01", null, 50),
    ];
    assert.deepEqual(seg(items), []);
  });

  test("floating point sums do not produce a false breach", () => {
    // 33.33 * 3 = 99.99 and 0.1 + 0.2 style drift must not tip the comparison.
    const items = [
      alloc("a", "2026-01-01", null, 33.33),
      alloc("b", "2026-01-01", null, 33.33),
      alloc("c", "2026-01-01", null, 33.34),
    ];
    assert.deepEqual(seg(items), [], "sums to exactly 100");
  });

  test("reports every distinct breach window, not just the first", () => {
    const items = [
      alloc("base", "2026-01-01", null, 80),
      alloc("spike1", "2026-02-01", "2026-03-01", 40),
      alloc("spike2", "2026-06-01", "2026-07-01", 30),
    ];
    assert.deepEqual(
      seg(items).map((s) => [s.range.start, s.range.end, s.total]),
      [
        ["2026-02-01", "2026-03-01", 120],
        ["2026-06-01", "2026-07-01", 110],
      ],
    );
  });

  test("a breach extending into an open-ended future is reported", () => {
    const items = [
      alloc("a", "2026-01-01", null, 70),
      alloc("b", "2026-04-01", null, 60),
    ];
    const breaches = seg(items);
    assert.equal(breaches.length, 1);
    assert.deepEqual(breaches[0].range, { start: "2026-04-01", end: null });
    assert.equal(breaches[0].total, 130);
  });

  test("threshold is configurable for app capacity checks", () => {
    const items = [alloc("a", "2026-01-01", null, 150)];
    assert.equal(seg(items, 200).length, 0);
    assert.equal(seg(items, 100).length, 1);
  });
});

describe("totalAsOf", () => {
  test("excludes allocations that ended on the query date", () => {
    const items = [alloc("a", "2026-01-01", "2026-02-01", 100)];
    assert.equal(totalAsOf(items, getRange, getWeight, d("2026-01-31")), 100);
    assert.equal(totalAsOf(items, getRange, getWeight, d("2026-02-01")), 0);
  });

  test("excludes future-dated allocations (§4.2 planning)", () => {
    const items = [alloc("planned", "2027-01-01", null, 100)];
    assert.equal(totalAsOf(items, getRange, getWeight, d("2026-06-01")), 0);
    assert.equal(totalAsOf(items, getRange, getWeight, d("2027-06-01")), 100);
  });
});

describe("scoping breaches to the affected range", () => {
  // §4.3 says the check runs "across the affected range". Reducing today's
  // allocation must not warn about a breach that has already elapsed: that is
  // a historical fact, not something the save caused, and nothing can be done
  // about it. The actions filter segments this way before reporting them.
  const items = [
    alloc("gateway", "2026-01-01", null, 60),
    alloc("pipeline", "2026-06-01", "2026-08-27", 60),
  ];

  const breachesIn = (affected: DateRange) =>
    seg(items).filter((s) => overlaps(s.range, affected));

  test("an elapsed breach is excluded when the change starts after it", () => {
    // The 120% window ran Jun-Aug. A change taking effect 27 Aug onwards does
    // not touch it.
    const affected: DateRange = { start: d("2026-08-27"), end: null };
    assert.deepEqual(breachesIn(affected), []);
  });

  test("the same breach IS reported when the change reaches back into it", () => {
    const affected: DateRange = { start: d("2026-07-01"), end: null };
    const found = breachesIn(affected);
    assert.equal(found.length, 1);
    assert.equal(found[0].total, 120);
  });

  test("a breach starting after the affected range still counts if they overlap", () => {
    const affected: DateRange = { start: d("2026-01-01"), end: d("2026-12-31") };
    assert.equal(breachesIn(affected).length, 1);
  });
});
