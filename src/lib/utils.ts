import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSEK(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function normalizeProductKey(
  name: string,
  brand?: string | null,
  sizeValue?: number | null,
  sizeUnit?: string | null
): string {
  const parts = [
    name.toLowerCase().trim(),
    brand?.toLowerCase().trim() ?? "",
    sizeValue?.toString() ?? "",
    sizeUnit?.toLowerCase().trim() ?? "",
  ];
  return parts
    .filter(Boolean)
    .join("_")
    .replace(/\s+/g, "_")
    .replace(/[^a-zåäö0-9_]/g, "");
}

export function daysSince(date: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function getFreshness(observedAt: Date): "FRESH" | "AGING" | "STALE" {
  const days = daysSince(observedAt);
  if (days <= 7) return "FRESH";
  if (days <= 14) return "AGING";
  return "STALE";
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeTravelCost(
  distanceKm: number,
  consumptionPer100km: number,
  energyPricePerUnit: number
): number {
  return (distanceKm / 100) * consumptionPer100km * energyPricePerUnit;
}
