import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { asIsoDate } from "./date.ts";
import { contains, intersection, isValidRange, overlaps } from "./intervals.ts";

const d = asIsoDate;
const range = (start: string, end: string | null) => ({
  start: d(start),
  end: end === null ? null : d(end),
});

describe("half-open intervals", () => {
  test("ranges touching at a boundary do NOT overlap", () => {
    // The whole reason §7 mandates half-open intervals: one allocation ends
    // the same day the next begins, with no overlap and no gap.
    const ending = range("2026-01-01", "2026-02-01");
    const starting = range("2026-02-01", null);
    assert.equal(overlaps(ending, starting), false);
    assert.equal(overlaps(starting, ending), false);
  });

  test("ranges sharing a single day DO overlap", () => {
    const a = range("2026-01-01", "2026-02-02");
    const b = range("2026-02-01", null);
    assert.equal(overlaps(a, b), true);
  });

  test("an ongoing range overlaps anything that starts after it", () => {
    assert.equal(
      overlaps(range("2026-01-01", null), range("2030-01-01", null)),
      true,
    );
  });

  test("two ongoing ranges always overlap", () => {
    assert.equal(
      overlaps(range("2026-01-01", null), range("2026-06-01", null)),
      true,
    );
  });

  test("a range fully inside another overlaps", () => {
    assert.equal(
      overlaps(range("2026-01-01", "2026-12-01"), range("2026-03-01", "2026-04-01")),
      true,
    );
  });

  test("disjoint ranges do not overlap", () => {
    assert.equal(
      overlaps(range("2026-01-01", "2026-02-01"), range("2026-03-01", "2026-04-01")),
      false,
    );
  });
});

describe("contains — the §4.2 'as of D' test", () => {
  test("includes the start date and excludes the end date", () => {
    const r = range("2026-01-01", "2026-02-01");
    assert.equal(contains(r, d("2025-12-31")), false);
    assert.equal(contains(r, d("2026-01-01")), true, "start is inclusive");
    assert.equal(contains(r, d("2026-01-31")), true);
    assert.equal(contains(r, d("2026-02-01")), false, "end is exclusive");
  });

  test("an ongoing range contains every date from its start", () => {
    const r = range("2026-01-01", null);
    assert.equal(contains(r, d("2099-01-01")), true);
    assert.equal(contains(r, d("2025-12-31")), false);
  });
});

describe("isValidRange", () => {
  test("rejects an end date equal to the start date", () => {
    // A zero-length allocation is meaningless, and half-open makes it empty.
    assert.equal(isValidRange(range("2026-01-01", "2026-01-01")), false);
  });

  test("rejects an end date before the start date", () => {
    assert.equal(isValidRange(range("2026-02-01", "2026-01-01")), false);
  });

  test("accepts an ongoing range and a normal range", () => {
    assert.equal(isValidRange(range("2026-01-01", null)), true);
    assert.equal(isValidRange(range("2026-01-01", "2026-01-02")), true);
  });
});

describe("intersection", () => {
  test("returns the shared portion", () => {
    const result = intersection(
      range("2026-01-01", "2026-06-01"),
      range("2026-03-01", "2026-09-01"),
    );
    assert.deepEqual(result, { start: "2026-03-01", end: "2026-06-01" });
  });

  test("stays ongoing when both sides are ongoing", () => {
    const result = intersection(range("2026-01-01", null), range("2026-03-01", null));
    assert.deepEqual(result, { start: "2026-03-01", end: null });
  });

  test("returns null for ranges that merely touch", () => {
    assert.equal(
      intersection(range("2026-01-01", "2026-02-01"), range("2026-02-01", null)),
      null,
    );
  });
});
