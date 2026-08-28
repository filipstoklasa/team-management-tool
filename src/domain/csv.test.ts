import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.ts";

describe("CSV serialisation", () => {
  test("plain values are written unquoted", () => {
    assert.equal(toCsv(["a", "b"], [["1", "2"]]), "a,b\r\n1,2");
  });

  test("a field containing a comma is quoted", () => {
    // The realistic case: an app named "Payments, Core".
    assert.equal(toCsv(["app"], [["Payments, Core"]]), 'app\r\n"Payments, Core"');
  });

  test("embedded quotes are doubled, not escaped with a backslash", () => {
    assert.equal(toCsv(["note"], [['He said "no"']]), 'note\r\n"He said ""no"""');
  });

  test("a newline inside a field keeps the field on one logical row", () => {
    assert.equal(toCsv(["note"], [["line1\nline2"]]), 'note\r\n"line1\nline2"');
  });

  test("null and undefined render as an empty field, not the string null", () => {
    // An open-ended allocation has no end date; the cell must be blank.
    assert.equal(toCsv(["start", "end"], [["2026-01-01", null]]), "start,end\r\n2026-01-01,");
    assert.equal(toCsv(["a"], [[undefined]]), "a\r\n");
  });

  test("numbers are written without quoting", () => {
    assert.equal(toCsv(["pct"], [[50]]), "pct\r\n50");
  });

  test("a header with no rows is still valid output", () => {
    assert.equal(toCsv(["a", "b"], []), "a,b");
  });
});
