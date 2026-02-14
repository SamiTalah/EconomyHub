"use client";

import { Fuel, Zap, DropletIcon } from "lucide-react";
import type { CarProfileInput } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CarProfileCardProps {
  profile: CarProfileInput;
  onChange: (p: CarProfileInput) => void;
}

const FUEL_TYPES = [
  { value: "PETROL", label: "Bensin", icon: Fuel, unit: "L_PER_100KM", unitLabel: "l/100km", defaultConsumption: 7.5, defaultPrice: 18.5 },
  { value: "DIESEL", label: "Diesel", icon: DropletIcon, unit: "L_PER_100KM", unitLabel: "l/100km", defaultConsumption: 6.0, defaultPrice: 19.5 },
  { value: "EV", label: "Elbil", icon: Zap, unit: "KWH_PER_100KM", unitLabel: "kWh/100km", defaultConsumption: 18, defaultPrice: 2.5 },
  { value: "HYBRID", label: "Hybrid", icon: Fuel, unit: "L_PER_100KM", unitLabel: "l/100km", defaultConsumption: 5.0, defaultPrice: 18.5 },
] as const;

export function CarProfileCard({ profile, onChange }: CarProfileCardProps) {
  const currentFuelType = FUEL_TYPES.find((f) => f.value === profile.fuelType) ?? FUEL_TYPES[0];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      {/* Fuel type chips */}
      <div className="flex gap-1.5">
        {FUEL_TYPES.map((ft) => {
          const Icon = ft.icon;
          return (
            <button
              key={ft.value}
              onClick={() =>
                onChange({
                  fuelType: ft.value as CarProfileInput["fuelType"],
                  consumptionPer100km: ft.defaultConsumption,
                  energyUnit: ft.unit as CarProfileInput["energyUnit"],
                  energyPricePerUnit: ft.defaultPrice,
                })
              }
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                profile.fuelType === ft.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {ft.label}
            </button>
          );
        })}
      </div>

      {/* Consumption & price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">
            Förbrukning ({currentFuelType.unitLabel})
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={profile.consumptionPer100km}
            onChange={(e) =>
              onChange({
                ...profile,
                consumptionPer100km: parseFloat(e.target.value) || 0,
              })
            }
            className="mt-0.5 w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Pris (kr/{profile.energyUnit === "L_PER_100KM" ? "liter" : "kWh"})
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={profile.energyPricePerUnit}
            onChange={(e) =>
              onChange({
                ...profile,
                energyPricePerUnit: parseFloat(e.target.value) || 0,
              })
            }
            className="mt-0.5 w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Resekostnad = (avstånd / 100) × förbrukning × energipris. Tur och retur.
      </p>
    </div>
  );
}
