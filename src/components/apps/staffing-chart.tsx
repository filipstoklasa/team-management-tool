"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StaffingPoint } from "@/data/allocation.ts";
import { formatIsoDate, type IsoDate } from "@/domain/date.ts";

/**
 * §6.3 — "Staffing-over-time chart: total allocation vs. required capacity,
 * making trends visible."
 *
 * `stepAfter` rather than a smooth curve: the total genuinely jumps the day an
 * allocation starts or ends. Interpolating between boundaries would draw a
 * gradual ramp that never happened.
 */
export function StaffingChart({
  points,
  color,
}: {
  points: StaffingPoint[];
  /** The app's own colour, so the series matches its dot everywhere else. */
  color: string;
}) {
  if (points.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No allocation history to chart.
      </p>
    );
  }

  const required = points[0].required;
  const peak = Math.max(required, ...points.map((p) => p.total));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="staffing-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => v.slice(0, 7)}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={[0, Math.ceil((peak * 1.2) / 50) * 50]}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ReferenceLine
          y={required}
          stroke="var(--foreground)"
          strokeDasharray="4 4"
          label={{
            value: `required ${required}%`,
            position: "insideTopRight",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--popover-foreground)",
          }}
          labelFormatter={(v) => formatIsoDate(v as IsoDate)}
          formatter={(value) => [`${value}%`, "allocated"]}
        />
        <Area
          type="stepAfter"
          dataKey="total"
          stroke={color}
          strokeWidth={2}
          fill="url(#staffing-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
