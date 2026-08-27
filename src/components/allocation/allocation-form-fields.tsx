"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-[11px]">{hint}</p>}
      {error && <p className="text-destructive text-[11px]">{error}</p>}
    </div>
  );
}

export function PercentageInput({
  value,
  onChange,
  id = "percentage",
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        min={1}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular pr-7"
      />
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
        %
      </span>
    </div>
  );
}
