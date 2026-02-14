"use client";

import { CHAIN_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const MEMBERSHIP_CHAINS = ["ICA", "COOP", "HEMKOP", "CITY_GROSS"] as const;

interface ChainMembershipToggleProps {
  memberships: string[];
  onChange: (memberships: string[]) => void;
}

export function ChainMembershipToggle({
  memberships,
  onChange,
}: ChainMembershipToggleProps) {
  const toggleChain = (chain: string) => {
    if (memberships.includes(chain)) {
      onChange(memberships.filter((c) => c !== chain));
    } else {
      onChange([...memberships, chain]);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        Jag är medlem hos (för medlemspriser):
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MEMBERSHIP_CHAINS.map((chain) => (
          <button
            key={chain}
            onClick={() => toggleChain(chain)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              memberships.includes(chain)
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-accent"
            )}
          >
            {CHAIN_LABELS[chain] ?? chain}
          </button>
        ))}
      </div>
    </div>
  );
}
