"use client";

import { Sparkles, Info } from "lucide-react";

interface DealsToggleProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

export function DealsToggle({ checked, onCheckedChange }: DealsToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-warning" />
        <div>
          <p className="text-sm font-medium">Inkludera veckans erbjudanden</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            Baserat på godkänd reklambladsdata
          </p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
