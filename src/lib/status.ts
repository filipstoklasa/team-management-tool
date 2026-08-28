import type { AppStatus, PersonStatus } from "@/domain/metrics.ts";

/**
 * Presentation for the four allocation states (§4.4).
 *
 * `over` is violet rather than red on purpose: §4.3 says exceeding 100% is
 * legitimate during crunch, so it must read as "worth knowing" and not as an
 * error. `unallocated` gets the red, because that is the state §4.4 calls the
 * most actionable signal in the app.
 */
export const personStatusMeta: Record<
  PersonStatus,
  { label: string; text: string; bg: string; bar: string; ring: string }
> = {
  unallocated: {
    label: "Unallocated",
    text: "text-status-unallocated",
    bg: "bg-status-unallocated-bg",
    bar: "bg-status-unallocated",
    ring: "ring-status-unallocated/30",
  },
  under: {
    label: "Under",
    text: "text-status-under",
    bg: "bg-status-under-bg",
    bar: "bg-status-under",
    ring: "ring-status-under/30",
  },
  full: {
    label: "Full",
    text: "text-status-full",
    bg: "bg-status-full-bg",
    bar: "bg-status-full",
    ring: "ring-status-full/30",
  },
  over: {
    label: "Over",
    text: "text-status-over",
    bg: "bg-status-over-bg",
    bar: "bg-status-over",
    ring: "ring-status-over/30",
  },
};

export const appStatusMeta: Record<
  AppStatus,
  { label: string; text: string; bg: string; bar: string }
> = {
  "under-resourced": {
    label: "Under-resourced",
    text: "text-status-under",
    bg: "bg-status-under-bg",
    bar: "bg-status-under",
  },
  staffed: {
    label: "Staffed",
    text: "text-status-full",
    bg: "bg-status-full-bg",
    bar: "bg-status-full",
  },
  "over-resourced": {
    label: "Over-resourced",
    text: "text-status-over",
    bg: "bg-status-over-bg",
    bar: "bg-status-over",
  },
};

/** Stable colour per app, so an app keeps its colour across every bar and chart. */
const APP_HUES = [
  "oklch(0.62 0.15 250)",
  "oklch(0.65 0.14 190)",
  "oklch(0.68 0.15 145)",
  "oklch(0.7 0.14 95)",
  "oklch(0.66 0.16 40)",
  "oklch(0.6 0.17 340)",
  "oklch(0.6 0.15 290)",
  "oklch(0.63 0.12 220)",
];

export function appColor(appId: number): string {
  return APP_HUES[appId % APP_HUES.length];
}

/**
 * §6.1 — a 1:1 is overdue this many days after the last one. One interval for
 * everyone; there is no per-person cadence. Lives here because the dashboard
 * count and the people-panel highlight must agree.
 */
export const OVERDUE_1ON1_DAYS = 30;

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}
