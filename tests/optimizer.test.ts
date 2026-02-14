import { describe, it, expect } from "vitest";
import {
  computeItemPrice,
  computeStoreResult,
  computeTwoStoreResult,
  optimize,
} from "@/lib/optimizer";
import type { StoreData, ProductPriceData, DealData } from "@/lib/optimizer";
import type { ShoppingListItemInput } from "@/lib/types";

// ─── Test helpers ──────────────────────────────────────────────

function recentDate(daysAgo: number = 2): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function validDealDates() {
  const from = new Date();
  from.setDate(from.getDate() - 1);
  const to = new Date();
  to.setDate(to.getDate() + 5);
  return { validFrom: from, validTo: to };
}

const storeA: StoreData = {
  id: "store-a",
  name: "Willys Hornstull",
  chain: "WILLYS",
  format: "WILLYS",
  lat: 59.3158,
  lng: 18.034,
};

const storeB: StoreData = {
  id: "store-b",
  name: "ICA Maxi Lindhagen",
  chain: "ICA",
  format: "ICA_MAXI",
  lat: 59.3355,
  lng: 18.01,
};

const userLocation = { lat: 59.3293, lng: 18.0686 };
const carProfile = {
  fuelType: "PETROL" as const,
  consumptionPer100km: 7.5,
  energyUnit: "L_PER_100KM" as const,
  energyPricePerUnit: 18.5,
};

// ─── computeItemPrice ──────────────────────────────────────────

describe("computeItemPrice", () => {
  it("returns missing when no regular price exists", () => {
    const item: ShoppingListItemInput = {
      productId: "p1",
      freeTextName: "Mjölk 3%",
      quantity: 1,
      allowSubstitutes: true,
    };

    const result = computeItemPrice(item, null, [], 1, [], true);

    expect(result.missing).toBe(true);
    expect(result.priceUsed).toBe("MISSING");
    expect(result.effectivePriceSek).toBeNull();
  });

  it("uses regular price when no deals exist", () => {
    const item: ShoppingListItemInput = {
      productId: "p1",
      freeTextName: "Mjölk 3%",
      quantity: 2,
      allowSubstitutes: true,
    };

    const price: ProductPriceData = {
      productId: "p1",
      productName: "Mjölk 3%",
      storeId: "store-a",
      regularPriceSek: 17.9,
      regularPriceObservedAt: recentDate(2),
      regularPriceSource: "SEED",
    };

    const result = computeItemPrice(item, price, [], 2, [], true);

    expect(result.missing).toBe(false);
    expect(result.priceUsed).toBe("REGULAR");
    expect(result.effectivePriceSek).toBe(17.9);
    expect(result.effectiveTotalSek).toBeCloseTo(35.8, 1);
  });

  it("applies a simple deal when cheaper than regular", () => {
    const item: ShoppingListItemInput = {
      productId: "p1",
      freeTextName: "Nötfärs 500g",
      quantity: 1,
      allowSubstitutes: true,
    };

    const price: ProductPriceData = {
      productId: "p1",
      productName: "Nötfärs 500g",
      storeId: "store-a",
      regularPriceSek: 55.0,
      regularPriceObservedAt: recentDate(3),
      regularPriceSource: "SEED",
    };

    const deal: DealData = {
      dealItemId: "d1",
      storeId: "store-a",
      productId: "p1",
      normalizedName: "Nötfärs 500g",
      dealPriceSek: 39.9,
      multiBuyType: "NONE",
      multiBuyX: null,
      multiBuyY: null,
      conditionsText: null,
      memberOnly: false,
      limitPerHousehold: null,
      ...validDealDates(),
    };

    const result = computeItemPrice(item, price, [deal], 1, [], true);

    expect(result.dealApplied).toBe(true);
    expect(result.priceUsed).toBe("DEAL");
    expect(result.effectiveTotalSek).toBeCloseTo(39.9, 1);
  });

  it("handles X_FOR_Y multi-buy correctly", () => {
    const item: ShoppingListItemInput = {
      productId: "p1",
      freeTextName: "Mjölk 3%",
      quantity: 3,
      allowSubstitutes: true,
    };

    const price: ProductPriceData = {
      productId: "p1",
      productName: "Mjölk 3%",
      storeId: "store-a",
      regularPriceSek: 17.9,
      regularPriceObservedAt: recentDate(2),
      regularPriceSource: "SEED",
    };

    // "2 för 35" deal
    const deal: DealData = {
      dealItemId: "d2",
      storeId: "store-a",
      productId: "p1",
      normalizedName: "Mjölk 3%",
      dealPriceSek: 35.0,
      multiBuyType: "X_FOR_Y",
      multiBuyX: 2,
      multiBuyY: 35.0,
      conditionsText: "2 för 35 kr",
      memberOnly: false,
      limitPerHousehold: null,
      ...validDealDates(),
    };

    const result = computeItemPrice(item, price, [deal], 3, [], true);

    // 1 bundle of 2 at 35kr + 1 at regular 17.9 = 52.9
    expect(result.dealApplied).toBe(true);
    expect(result.effectiveTotalSek).toBeCloseTo(52.9, 1);
  });

  it("skips member-only deal when user is not a member", () => {
    const item: ShoppingListItemInput = {
      productId: "p1",
      freeTextName: "Kaffe 450g",
      quantity: 1,
      allowSubstitutes: true,
    };

    const price: ProductPriceData = {
      productId: "p1",
      productName: "Kaffe 450g",
      storeId: "store-a",
      regularPriceSek: 59.9,
      regularPriceObservedAt: recentDate(2),
      regularPriceSource: "SEED",
    };

    const deal: DealData = {
      dealItemId: "d3",
      storeId: "store-a",
      productId: "p1",
      normalizedName: "Kaffe 450g",
      dealPriceSek: 34.9,
      multiBuyType: "NONE",
      multiBuyX: null,
      multiBuyY: null,
      conditionsText: "Medlemspris",
      memberOnly: true,
      limitPerHousehold: null,
      ...validDealDates(),
    };

    const resultNoMember = computeItemPrice(item, price, [deal], 1, [], true);
    expect(resultNoMember.dealApplied).toBe(false);
    expect(resultNoMember.priceUsed).toBe("REGULAR");

    const resultWithMember = computeItemPrice(
      item,
      price,
      [deal],
      1,
      ["WILLYS"],
      true
    );
    expect(resultWithMember.dealApplied).toBe(true);
    expect(resultWithMember.priceUsed).toBe("DEAL");
    expect(resultWithMember.effectiveTotalSek).toBeCloseTo(34.9, 1);
  });

  it("respects limitPerHousehold", () => {
    const item: ShoppingListItemInput = {
      productId: "p1",
      freeTextName: "Kycklingfilé 1kg",
      quantity: 4,
      allowSubstitutes: true,
    };

    const price: ProductPriceData = {
      productId: "p1",
      productName: "Kycklingfilé 1kg",
      storeId: "store-a",
      regularPriceSek: 99.9,
      regularPriceObservedAt: recentDate(2),
      regularPriceSource: "SEED",
    };

    // Deal limited to 2 per household
    const deal: DealData = {
      dealItemId: "d4",
      storeId: "store-a",
      productId: "p1",
      normalizedName: "Kycklingfilé 1kg",
      dealPriceSek: 69.9,
      multiBuyType: "NONE",
      multiBuyX: null,
      multiBuyY: null,
      conditionsText: "Max 2 per hushåll",
      memberOnly: false,
      limitPerHousehold: 2,
      ...validDealDates(),
    };

    const result = computeItemPrice(item, price, [deal], 4, [], true);

    // 2 at deal (69.9) + 2 at regular (99.9) = 339.6
    expect(result.dealApplied).toBe(true);
    expect(result.effectiveTotalSek).toBeCloseTo(339.6, 1);
  });
});

// ─── computeStoreResult ────────────────────────────────────────

describe("computeStoreResult", () => {
  it("computes correct store result with mixed priced and missing items", () => {
    const items: ShoppingListItemInput[] = [
      { productId: "p1", freeTextName: "Mjölk 3%", quantity: 2, allowSubstitutes: true },
      { productId: "p2", freeTextName: "Bröd", quantity: 1, allowSubstitutes: true },
      { productId: "p3", freeTextName: "Okänt", quantity: 1, allowSubstitutes: true },
    ];

    const priceMap = new Map<string, ProductPriceData>();
    priceMap.set("p1", {
      productId: "p1",
      productName: "Mjölk 3%",
      storeId: "store-a",
      regularPriceSek: 17.9,
      regularPriceObservedAt: recentDate(2),
      regularPriceSource: "SEED",
    });
    priceMap.set("p2", {
      productId: "p2",
      productName: "Bröd",
      storeId: "store-a",
      regularPriceSek: 32.0,
      regularPriceObservedAt: recentDate(2),
      regularPriceSource: "SEED",
    });
    // p3 has no price (missing)

    const dealMap = new Map<string, DealData[]>();

    const result = computeStoreResult(
      storeA,
      items,
      priceMap,
      dealMap,
      userLocation,
      carProfile,
      [],
      true
    );

    expect(result.storeName).toBe("Willys Hornstull");
    expect(result.pricedItemCount).toBe(2);
    expect(result.missingItemCount).toBe(1);
    expect(result.groceryCostSek).toBeCloseTo(17.9 * 2 + 32.0, 1);
    expect(result.coveragePercent).toBeCloseTo(66.67, 0);
    expect(result.travelDistanceKm).toBeGreaterThan(0);
    expect(result.totalCostSek).toBeGreaterThan(result.groceryCostSek);
  });
});

// ─── Two-store heuristic ────────────────────────────────────────

describe("computeTwoStoreResult", () => {
  it("returns null if two-store savings are less than threshold", () => {
    const items: ShoppingListItemInput[] = [
      { productId: "p1", freeTextName: "Mjölk", quantity: 1, allowSubstitutes: true },
    ];

    const priceMapA = new Map<string, ProductPriceData>();
    priceMapA.set("p1", {
      productId: "p1", productName: "Mjölk", storeId: "store-a",
      regularPriceSek: 17.9, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });

    const priceMapB = new Map<string, ProductPriceData>();
    priceMapB.set("p1", {
      productId: "p1", productName: "Mjölk", storeId: "store-b",
      regularPriceSek: 18.5, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });

    const dealMapA = new Map<string, DealData[]>();
    const dealMapB = new Map<string, DealData[]>();

    // With only 1 item and similar prices, two-store won't save enough
    const result = computeTwoStoreResult(
      storeA,
      storeB,
      items,
      priceMapA,
      priceMapB,
      dealMapA,
      dealMapB,
      userLocation,
      carProfile,
      [],
      true,
      20.0 // best single total
    );

    expect(result).toBeNull();
  });
});

// ─── Full optimization ──────────────────────────────────────────

describe("optimize", () => {
  it("returns empty response with no stores", () => {
    const result = optimize(
      [],
      [{ productId: "p1", freeTextName: "Mjölk", quantity: 1, allowSubstitutes: true }],
      new Map(),
      new Map(),
      userLocation,
      carProfile,
      [],
      true
    );

    expect(result.bestSingleStore).toBeNull();
    expect(result.allSingleStores).toHaveLength(0);
  });

  it("ranks stores correctly and picks cheapest", () => {
    const stores: StoreData[] = [storeA, storeB];

    const items: ShoppingListItemInput[] = [
      { productId: "p1", freeTextName: "Mjölk 3%", quantity: 2, allowSubstitutes: true },
      { productId: "p2", freeTextName: "Bröd", quantity: 1, allowSubstitutes: true },
    ];

    const pricesByStore = new Map<string, Map<string, ProductPriceData>>();

    // Store A: cheaper
    const mapA = new Map<string, ProductPriceData>();
    mapA.set("p1", {
      productId: "p1", productName: "Mjölk 3%", storeId: "store-a",
      regularPriceSek: 15.9, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });
    mapA.set("p2", {
      productId: "p2", productName: "Bröd", storeId: "store-a",
      regularPriceSek: 28.0, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });
    pricesByStore.set("store-a", mapA);

    // Store B: more expensive
    const mapB = new Map<string, ProductPriceData>();
    mapB.set("p1", {
      productId: "p1", productName: "Mjölk 3%", storeId: "store-b",
      regularPriceSek: 19.9, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });
    mapB.set("p2", {
      productId: "p2", productName: "Bröd", storeId: "store-b",
      regularPriceSek: 35.0, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });
    pricesByStore.set("store-b", mapB);

    const dealsByStore = new Map<string, DealData[]>();

    const result = optimize(
      stores,
      items,
      pricesByStore,
      dealsByStore,
      userLocation,
      carProfile,
      [],
      true
    );

    expect(result.allSingleStores).toHaveLength(2);
    expect(result.bestSingleStore).not.toBeNull();
    // Store A should be cheaper given lower prices
    expect(result.bestSingleStore!.groceryCostSek).toBeLessThan(
      result.allSingleStores.find((s) => s.storeId === "store-b")!.groceryCostSek
    );
  });

  it("includes pricing explanation for each item", () => {
    const stores: StoreData[] = [storeA];

    const items: ShoppingListItemInput[] = [
      { productId: "p1", freeTextName: "Mjölk 3%", quantity: 1, allowSubstitutes: true },
    ];

    const pricesByStore = new Map<string, Map<string, ProductPriceData>>();
    const mapA = new Map<string, ProductPriceData>();
    mapA.set("p1", {
      productId: "p1", productName: "Mjölk 3%", storeId: "store-a",
      regularPriceSek: 17.9, regularPriceObservedAt: recentDate(2), regularPriceSource: "SEED",
    });
    pricesByStore.set("store-a", mapA);

    const result = optimize(
      stores,
      items,
      pricesByStore,
      new Map(),
      userLocation,
      carProfile,
      [],
      true
    );

    expect(result.bestSingleStore!.items).toHaveLength(1);
    const item = result.bestSingleStore!.items[0];
    expect(item.itemName).toBe("Mjölk 3%");
    expect(item.regularPriceSek).toBe(17.9);
    expect(item.regularPriceSource).toBe("SEED");
    expect(item.regularPriceFreshness).toBe("FRESH");
  });
});
