import { z } from "zod";
import { isIsoDate, type IsoDate } from "./date.ts";

/** Zod refinement that also narrows to the branded IsoDate type. */
const isoDate = z
  .string()
  .refine(isIsoDate, { message: "Must be a valid date (YYYY-MM-DD)" })
  .transform((v) => v as IsoDate);

const optionalIsoDate = z
  .union([isoDate, z.literal("").transform(() => null), z.null()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : (v as IsoDate | null)));

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (label: string, max = 200) =>
  trimmed(max).min(1, { message: `${label} is required` });
const optionalText = (max = 5000) =>
  z
    .union([trimmed(max), z.literal(""), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === undefined || v === null ? null : v));

/**
 * §4.3 — percentage must be > 0 and <= 100. Blocking, and also enforced by a
 * CHECK constraint on the table, so a bug here cannot corrupt the data.
 */
const percentage = z.coerce
  .number({ message: "Percentage must be a number" })
  .gt(0, { message: "Percentage must be greater than 0" })
  .lte(100, { message: "Percentage cannot exceed 100" });

const id = z.coerce.number().int().positive();

export const createAllocationSchema = z
  .object({
    userId: id,
    appId: id,
    percentage,
    startDate: isoDate,
    endDate: optionalIsoDate,
    note: optionalText(1000),
  })
  .refine((v) => v.endDate === null || v.endDate > v.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

/**
 * §6.4 — "end current and create new" is the DEFAULT action when changing an
 * allocation, because it preserves history (§4.2).
 */
export const changeAllocationSchema = z
  .object({
    allocationId: id,
    percentage,
    /** The date the change takes effect: old row ends here, new row starts here. */
    effectiveDate: isoDate,
    endDate: optionalIsoDate,
    appId: id.optional(),
    note: optionalText(1000),
  })
  .refine((v) => v.endDate === null || v.endDate > v.effectiveDate, {
    message: "End date must be after the effective date",
    path: ["endDate"],
  });

/**
 * §4.2 — in-place editing is reserved for CORRECTING MISTAKES (a mistyped
 * percentage) and still writes an AllocationChange with change_type=modified.
 */
export const correctAllocationSchema = z
  .object({
    allocationId: id,
    percentage,
    startDate: isoDate,
    endDate: optionalIsoDate,
    note: optionalText(1000),
  })
  .refine((v) => v.endDate === null || v.endDate > v.startDate, {
    message: "End date must be after the start date",
    path: ["endDate"],
  });

export const endAllocationSchema = z.object({
  allocationId: id,
  endDate: isoDate,
  note: optionalText(1000),
});

export const userSchema = z.object({
  id: id.optional(),
  name: requiredText("Name"),
  title: optionalText(120),
  startDate: optionalIsoDate,
  teamIds: z.array(id).default([]),
});

export const teamSchema = z.object({
  id: id.optional(),
  name: requiredText("Name"),
});

export const appSchema = z.object({
  id: id.optional(),
  name: requiredText("Name"),
  requiredCapacity: z.coerce
    .number({ message: "Required capacity must be a number" })
    .min(0, { message: "Required capacity cannot be negative" }),
  notes: optionalText(2000),
  teamIds: z.array(id).default([]),
});

// ------------------------------------------------------------- Module B

export const oneOnOneSchema = z.object({
  id: id.optional(),
  userId: id,
  date: isoDate,
  managerNotes: optionalText(20000),
  theirTopics: optionalText(20000),
});

export const actionItemSchema = z.object({
  id: id.optional(),
  userId: id,
  oneOnOneId: id.optional().nullable(),
  description: requiredText("Description", 500),
  owner: z.enum(["manager", "report"]),
  status: z.enum(["open", "done", "dropped"]).default("open"),
  dueDate: optionalIsoDate,
});

export const goalSchema = z.object({
  id: id.optional(),
  userId: id,
  title: requiredText("Title", 200),
  detail: optionalText(5000),
  category: z.enum(["technical", "leadership", "delivery", "other"]),
  status: z.enum(["active", "achieved", "paused", "dropped"]).default("active"),
  targetDate: optionalIsoDate,
});

export const goalUpdateSchema = z.object({
  goalId: id,
  date: isoDate,
  note: requiredText("Note", 2000),
});

export const feedbackSchema = z.object({
  id: id.optional(),
  userId: id,
  date: isoDate,
  direction: z.enum(["given", "received"]),
  source: optionalText(200),
  category: z.enum(["praise", "constructive", "other"]),
  content: requiredText("Content", 5000),
  shared: z.boolean().default(false),
});

export type CreateAllocationInput = z.input<typeof createAllocationSchema>;
export type ChangeAllocationInput = z.input<typeof changeAllocationSchema>;
export type CorrectAllocationInput = z.input<typeof correctAllocationSchema>;
