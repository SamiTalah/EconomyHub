import { describe, it, expect } from "vitest";
import {
  normalizeProductKey,
  haversineDistance,
  computeTravelCost,
  getFreshness,
  formatSEK,
  formatKm,
} from "@/lib/utils";

describe("normalizeProductKey", () => {
  it("normalizes product key correctly", () => {
    const key = normalizeProductKey("Mjölk 3%", "Arla", 1.5, "L");
    expect(key).toBe("mjölk_3_arla_15_l");
  });

  it("handles missing optional fields", () => {
    const key = normalizeProductKey("Bananer");
    expect(key).toBe("bananer");
  });

  it("handles null fields", () => {
    const key = normalizeProductKey("Bröd", null, null, null);
    expect(key).toBe("bröd");
  });
});

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    expect(haversineDistance(59.33, 18.07, 59.33, 18.07)).toBe(0);
  });

  it("computes reasonable distance within Stockholm", () => {
    // Södermalm to Kungsholmen: ~3-4 km
    const d = haversineDistance(59.315, 18.072, 59.335, 18.01);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(6);
  });
});

describe("computeTravelCost", () => {
  it("computes travel cost for petrol car", () => {
    // 10 km round trip, 7.5L/100km, 18.50 kr/L
    const cost = computeTravelCost(10, 7.5, 18.5);
    expect(cost).toBeCloseTo(13.875, 2);
  });

  it("computes travel cost for EV", () => {
    // 10 km, 18 kWh/100km, 2.50 kr/kWh
    const cost = computeTravelCost(10, 18, 2.5);
    expect(cost).toBeCloseTo(4.5, 2);
  });
});

describe("getFreshness", () => {
  it("returns FRESH for recent dates", () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(getFreshness(d)).toBe("FRESH");
  });

  it("returns AGING for 10 days old", () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    expect(getFreshness(d)).toBe("AGING");
  });

  it("returns STALE for 20 days old", () => {
    const d = new Date();
    d.setDate(d.getDate() - 20);
    expect(getFreshness(d)).toBe("STALE");
  });
});

describe("formatSEK", () => {
  it("formats currency in Swedish style", () => {
    const formatted = formatSEK(123.5);
    // Should contain the number somehow
    expect(formatted).toContain("123");
  });
});

describe("formatKm", () => {
  it("formats small distances in meters", () => {
    expect(formatKm(0.5)).toBe("500 m");
  });

  it("formats larger distances in km", () => {
    expect(formatKm(3.456)).toBe("3.5 km");
  });
});
