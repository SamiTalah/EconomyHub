"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Car, ShoppingCart, Sparkles, ChevronRight } from "lucide-react";
import { LocationCard } from "./location-card";
import { RadiusSelector } from "./radius-selector";
import { CarProfileCard } from "./car-profile-card";
import { ShoppingListBuilder } from "./shopping-list-builder";
import { DealsToggle } from "./deals-toggle";
import { ChainMembershipToggle } from "./chain-membership-toggle";
import {
  DEFAULT_RADIUS,
  DEFAULT_CAR_PROFILE,
  STOCKHOLM_CENTER,
} from "@/lib/constants";
import type {
  UserLocation,
  CarProfileInput,
  ShoppingListItemInput,
} from "@/lib/types";

export function HomeFlow() {
  const router = useRouter();
  const [location, setLocation] = useState<UserLocation>(STOCKHOLM_CENTER);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS);
  const [carProfile, setCarProfile] =
    useState<CarProfileInput>(DEFAULT_CAR_PROFILE);
  const [items, setItems] = useState<ShoppingListItemInput[]>([]);
  const [includeDeals, setIncludeDeals] = useState(true);
  const [chainMemberships, setChainMemberships] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = useCallback(async () => {
    if (items.length === 0) return;
    setIsOptimizing(true);

    // Store request in sessionStorage and navigate
    const request = {
      location,
      radiusKm,
      carProfile,
      items,
      includeDeals,
      chainMemberships,
    };
    sessionStorage.setItem("cartwise_request", JSON.stringify(request));
    router.push("/results");
  }, [location, radiusKm, carProfile, items, includeDeals, chainMemberships, router]);

  return (
    <div className="space-y-4">
      {/* Step 1: Location */}
      <section className="animate-fade-in">
        <StepHeader
          icon={<MapPin className="h-4 w-4" />}
          title="Din plats"
          step={1}
        />
        <LocationCard location={location} onLocationChange={setLocation} />
        <div className="mt-3">
          <RadiusSelector value={radiusKm} onChange={setRadiusKm} />
        </div>
      </section>

      {/* Step 2: Car profile */}
      <section className="animate-fade-in" style={{ animationDelay: "50ms" }}>
        <StepHeader
          icon={<Car className="h-4 w-4" />}
          title="Bilprofil"
          step={2}
        />
        <CarProfileCard profile={carProfile} onChange={setCarProfile} />
      </section>

      {/* Step 3: Shopping list */}
      <section className="animate-fade-in" style={{ animationDelay: "100ms" }}>
        <StepHeader
          icon={<ShoppingCart className="h-4 w-4" />}
          title="Inköpslista"
          step={3}
        />
        <ShoppingListBuilder items={items} onChange={setItems} />
      </section>

      {/* Step 4: Deals & memberships */}
      <section className="animate-fade-in" style={{ animationDelay: "150ms" }}>
        <StepHeader
          icon={<Sparkles className="h-4 w-4" />}
          title="Erbjudanden"
          step={4}
        />
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
          <DealsToggle checked={includeDeals} onCheckedChange={setIncludeDeals} />
          {includeDeals && (
            <ChainMembershipToggle
              memberships={chainMemberships}
              onChange={setChainMemberships}
            />
          )}
        </div>
      </section>

      {/* Optimize button */}
      <div className="sticky-bottom py-3 -mx-4 px-4 md:static md:mx-0 md:px-0 md:py-0 md:border-0 md:backdrop-blur-none md:bg-transparent">
        <button
          onClick={handleOptimize}
          disabled={items.length === 0 || isOptimizing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:active:scale-100"
        >
          {isOptimizing ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Optimerar...
            </>
          ) : (
            <>
              Hitta billigaste korgen
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
        {items.length === 0 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Lägg till minst en vara i din inköpslista
          </p>
        )}
      </div>
    </div>
  );
}

function StepHeader({
  icon,
  title,
  step,
}: {
  icon: React.ReactNode;
  title: string;
  step: number;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {step}
      </span>
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {icon}
        {title}
      </span>
    </div>
  );
}
