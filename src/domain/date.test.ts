import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  asIsoDate,
  daysBetween,
  isIsoDate,
  parseIsoDate,
} from "./date.ts";

const d = asIsoDate;

describe("IsoDate validation", () => {
  test("rejects impossible calendar dates the regex alone would accept", () => {
    assert.equal(isIsoDate("2026-02-30"), false);
    assert.equal(isIsoDate("2026-13-01"), false);
    assert.equal(isIsoDate("2025-02-29"), false, "2025 is not a leap year");
    assert.equal(isIsoDate("2024-02-29"), true, "2024 is");
  });

  test("rejects malformed shapes", () => {
    for (const bad of ["2026-1-1", "26-01-01", "2026/01/01", "", "today"]) {
      assert.equal(isIsoDate(bad), false, bad);
    }
  });

  test("parseIsoDate returns null rather than throwing on bad input", () => {
    assert.equal(parseIsoDate("nonsense"), null);
    assert.equal(parseIsoDate(undefined), null);
    assert.equal(parseIsoDate("2026-03-12"), "2026-03-12");
  });
});

describe("date arithmetic", () => {
  test("crosses a month boundary", () => {
    assert.equal(addDays(d("2026-01-31"), 1), "2026-02-01");
  });

  test("crosses a year boundary", () => {
    assert.equal(addDays(d("2026-12-31"), 1), "2027-01-01");
  });

  test("handles leap day", () => {
    assert.equal(addDays(d("2024-02-28"), 1), "2024-02-29");
    assert.equal(addDays(d("2025-02-28"), 1), "2025-03-01");
  });

  test("survives a DST transition without shifting the calendar date", () => {
    // Europe/Prague springs forward on 2026-03-29. Naive local-time arithmetic
    // lands on the wrong day here; UTC-based arithmetic does not.
    assert.equal(addDays(d("2026-03-28"), 1), "2026-03-29");
    assert.equal(addDays(d("2026-03-29"), 1), "2026-03-30");
  });

  test("addMonths clamps rather than rolling over", () => {
    assert.equal(addMonths(d("2026-01-31"), 1), "2026-02-28");
    assert.equal(addMonths(d("2024-01-31"), 1), "2024-02-29");
    assert.equal(addMonths(d("2026-03-15"), -1), "2026-02-15");
  });

  test("daysBetween is signed", () => {
    assert.equal(daysBetween(d("2026-01-01"), d("2026-01-31")), 30);
    assert.equal(daysBetween(d("2026-01-31"), d("2026-01-01")), -30);
    assert.equal(daysBetween(d("2026-01-01"), d("2026-01-01")), 0);
  });
});
