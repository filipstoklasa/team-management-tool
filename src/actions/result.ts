import type { z } from "zod";

export interface FieldError {
  field?: string;
  message: string;
}

export interface Warning {
  message: string;
  detail?: string;
}

/**
 * §4.3 draws a distinction a boolean cannot express:
 *
 *   - overlapping ranges, bad date order, out-of-range percentage → BLOCKING
 *   - a user summing to more than 100%                            → WARNING
 *
 * "Real allocation legitimately exceeds 100% during crunch. Flag it visually;
 * never block the save."
 *
 * So a successful result carries warnings alongside the data. The row is
 * written; the caller renders the warnings as a non-blocking banner.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T; warnings: Warning[] }
  | { ok: false; errors: FieldError[] };

export function ok<T>(data: T, warnings: Warning[] = []): ActionResult<T> {
  return { ok: true, data, warnings };
}

export function fail(...errors: (FieldError | string)[]): ActionResult<never> {
  return {
    ok: false,
    errors: errors.map((e) => (typeof e === "string" ? { message: e } : e)),
  };
}

export function fromZod(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    errors: error.issues.map((issue) => ({
      field: issue.path.length ? String(issue.path[0]) : undefined,
      message: issue.message,
    })),
  };
}
