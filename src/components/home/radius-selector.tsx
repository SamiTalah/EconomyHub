"use client";

import { RADIUS_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RadiusSelectorProps {
  value: number;
  onChange: (v: number) => void;
}

export function RadiusSelector({ value, onChange }: RadiusSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Radie:</span>
      <div className="flex gap-1.5">
        {RADIUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              value === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
