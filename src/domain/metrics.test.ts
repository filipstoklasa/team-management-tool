import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { appStatus, capacityDelta, capacityRatio, personStatus } from "./metrics.ts";

describe("personStatus (§4.4)", () => {
  test("classifies each band", () => {
    assert.equal(personStatus(0), "unallocated");
    assert.equal(personStatus(50), "under");
    assert.equal(personStatus(100), "full");
    assert.equal(personStatus(130), "over");
  });

  test("unallocated is distinct from under-allocated", () => {
    // §4.4 calls unallocated people "the most actionable signal in the app",
    // so they must not be lumped in with someone sitting at 90%.
    assert.notEqual(personStatus(0), personStatus(1));
  });
});

describe("appStatus (§4.4)", () => {
  test("compares against required capacity, not against 100", () => {
    assert.equal(appStatus(150, 200), "under-resourced");
    assert.equal(appStatus(200, 200), "staffed");
    assert.equal(appStatus(250, 200), "over-resourced");
    assert.equal(appStatus(150, 100), "over-resourced");
  });
});

describe("capacity helpers", () => {
  test("delta is signed and rounded", () => {
    assert.equal(capacityDelta(150, 200), -50);
    assert.equal(capacityDelta(250, 200), 50);
    assert.equal(capacityDelta(99.9, 100), -0.1);
  });

  test("ratio handles a zero-capacity app without dividing by zero", () => {
    assert.equal(capacityRatio(0, 0), 0);
    assert.equal(capacityRatio(50, 0), 1);
    assert.equal(capacityRatio(100, 200), 0.5);
  });
});
