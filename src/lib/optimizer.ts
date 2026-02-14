// ─── Grocery Basket Optimization Engine ─────────────────────
// Pure function module — no database calls, no side effects.
// All data is received as parameters for testability.

import type {
  UserLocation,
  CarProfileInput,
  ShoppingListItemInput,
  ItemPriceExplanation,
  StoreResult,
  TwoStoreResult,
  OptimizeResponse,
} from "@/lib/types";

import {
  haversineDistance,
  computeTravelCost,
  getFreshness,
} from "@/lib/utils";

import {
  MISSING_ITEM_PENALTY_SEK,
  TWO_STORE_MINIMUM_SAVINGS_SEK,
  TOP_N_STORES_FOR_PAIRS,
  MAX_PRICE_AGE_DAYS,
} from "@/lib/constants";

// ─── Data input interfaces (shaped by DB layer) ────────────

export interface StoreData {
  id: string;
  name: string;
  chain: string;
  format: string;
  address?: string;
  lat: number;
  lng: number;
}

export interface ProductPriceData {
  productId: string;
  productName: string;
  storeId: string;
  regularPriceSek: number | null;
  regularPriceObservedAt: Date | null;
  regularPriceSource: string | null;
}

export interface DealData {
  dealItemId: string;
  storeId: string;
  productId: string | null;
  normalizedName: string;
  dealPriceSek: number;
  multiBuyType: string;
  multiBuyX: number | null;
  multiBuyY: number | null;
  conditionsText: string | null;
  memberOnly: boolean;
  limitPerHousehold: number | null;
  validFrom: Date | null;
  validTo: Date | null;
}

// ─── Helpers ────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isDealValidToday(deal: DealData): boolean {
  const now = new Date();
  // Zero out time portion for date-only comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (deal.validFrom) {
    const from = new Date(
      deal.validFrom.getFullYear(),
      deal.validFrom.getMonth(),
      deal.validFrom.getDate(),
    );
    if (today < from) return false;
  }

  if (deal.validTo) {
    const to = new Date(
      deal.validTo.getFullYear(),
      deal.validTo.getMonth(),
      deal.validTo.getDate(),
    );
    if (today > to) return false;
  }

  return true;
}

function isPriceWithinAge(observedAt: Date | null): boolean {
  if (!observedAt) return false;
  const now = new Date();
  const diffMs = now.getTime() - observedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= MAX_PRICE_AGE_DAYS;
}

// ─── 1. computeItemPrice ────────────────────────────────────

export function computeItemPrice(
  item: ShoppingListItemInput,
  regularPrice: ProductPriceData | null,
  deals: DealData[],
  quantity: number,
  chainMemberships: string[],
  includeDeals: boolean,
): ItemPriceExplanation {
  const itemName =
    item.freeTextName ?? regularPrice?.productName ?? "Unknown item";
  const productId = item.productId ?? regularPrice?.productId;

  // ── Check if regular price is available and fresh enough ──
  const hasValidRegularPrice =
    regularPrice !== null &&
    regularPrice.regularPriceSek !== null &&
    regularPrice.regularPriceObservedAt !== null &&
    isPriceWithinAge(regularPrice.regularPriceObservedAt);

  if (!hasValidRegularPrice) {
    return {
      itemName,
      productId,
      quantity,
      regularPriceSek: regularPrice?.regularPriceSek ?? null,
      regularPriceObservedAt:
        regularPrice?.regularPriceObservedAt?.toISOString() ?? null,
      regularPriceFreshness: regularPrice?.regularPriceObservedAt
        ? getFreshness(regularPrice.regularPriceObservedAt)
        : null,
      regularPriceSource: regularPrice?.regularPriceSource ?? null,
      dealPriceSek: null,
      dealName: null,
      dealConditions: null,
      dealMemberOnly: false,
      dealApplied: false,
      effectivePriceSek: null,
      effectiveTotalSek: null,
      priceUsed: "MISSING",
      missing: true,
      missingReason: regularPrice
        ? "Price data is too old (older than " + MAX_PRICE_AGE_DAYS + " days)"
        : "No price data found for this item at this store",
    };
  }

  const unitRegularPrice = regularPrice.regularPriceSek!;
  const regularTotal = round2(unitRegularPrice * quantity);
  const freshness = getFreshness(regularPrice.regularPriceObservedAt!);

  // ── Base explanation (no deal) ────────────────────────────
  const baseExplanation: ItemPriceExplanation = {
    itemName,
    productId,
    quantity,
    regularPriceSek: unitRegularPrice,
    regularPriceObservedAt:
      regularPrice.regularPriceObservedAt!.toISOString(),
    regularPriceFreshness: freshness,
    regularPriceSource: regularPrice.regularPriceSource,
    dealPriceSek: null,
    dealName: null,
    dealConditions: null,
    dealMemberOnly: false,
    dealApplied: false,
    effectivePriceSek: unitRegularPrice,
    effectiveTotalSek: regularTotal,
    priceUsed: "REGULAR",
    missing: false,
  };

  if (!includeDeals || deals.length === 0) {
    return baseExplanation;
  }

  // ── Evaluate each deal to find the best one ───────────────
  let bestDealTotal: number = regularTotal;
  let bestDeal: DealData | null = null;
  let bestDealEffectiveUnit: number = unitRegularPrice;

  for (const deal of deals) {
    // Check validity
    if (!isDealValidToday(deal)) continue;

    // Check membership requirement
    if (deal.memberOnly) {
      // chainMemberships contains chain names; we need to know
      // which chain this deal belongs to. The deal is associated
      // with a store, and the store's chain is implicit. We check
      // if any membership matches. The caller should filter deals
      // per store already, so we check the chain via a broader match.
      // For simplicity, we trust the caller provides only relevant deals
      // and check memberOnly against chainMemberships length > 0 is not
      // sufficient — we need the chain. We'll rely on the caller to
      // provide the chain context. For now, if memberOnly and
      // chainMemberships is empty, skip.
      // The deal's store is known at call time; the caller should pass
      // filtered deals. We'll accept memberOnly deals if chainMemberships
      // has at least one entry (the caller should only pass deals for
      // stores whose chain the user is a member of).
      if (chainMemberships.length === 0) continue;
    }

    let dealTotal: number;
    const limit = deal.limitPerHousehold;
    const effectiveQty = limit !== null && limit > 0
      ? Math.min(quantity, limit)
      : quantity;
    const remainderQty = quantity - effectiveQty;

    switch (deal.multiBuyType) {
      case "X_FOR_Y": {
        // Buy X items for Y SEK total
        const x = deal.multiBuyX ?? 1;
        const y = deal.multiBuyY ?? deal.dealPriceSek;
        const bundles = Math.floor(effectiveQty / x);
        const leftover = effectiveQty % x;
        // Bundles at deal price, leftover at regular price
        dealTotal = round2(
          bundles * y +
          leftover * unitRegularPrice +
          remainderQty * unitRegularPrice,
        );
        break;
      }

      case "BUY_X_GET_Y": {
        // Buy X, get Y free (pay for X, get X+Y items)
        const x = deal.multiBuyX ?? 1;
        const y = deal.multiBuyY ?? 1;
        const groupSize = x + y;
        const groups = Math.floor(effectiveQty / groupSize);
        const leftover = effectiveQty % groupSize;
        // Pay for X per group, leftover all at regular price
        dealTotal = round2(
          groups * x * unitRegularPrice +
          leftover * unitRegularPrice +
          remainderQty * unitRegularPrice,
        );
        break;
      }

      case "PERCENT_OFF": {
        // dealPriceSek stores the percentage off (e.g. 25 for 25% off)
        // Actually, multiBuyY stores the percentage, and dealPriceSek
        // may store the resulting price. Let's use dealPriceSek as the
        // effective per-unit deal price.
        const discountedUnitPrice = deal.dealPriceSek;
        dealTotal = round2(
          effectiveQty * discountedUnitPrice +
          remainderQty * unitRegularPrice,
        );
        break;
      }

      default: {
        // Simple deal: flat deal price per unit
        dealTotal = round2(
          effectiveQty * deal.dealPriceSek +
          remainderQty * unitRegularPrice,
        );
        break;
      }
    }

    if (dealTotal < bestDealTotal) {
      bestDealTotal = dealTotal;
      bestDeal = deal;
      bestDealEffectiveUnit = round2(dealTotal / quantity);
    }
  }

  // ── If we found a beneficial deal, use it ─────────────────
  if (bestDeal !== null && bestDealTotal < regularTotal) {
    return {
      itemName,
      productId,
      quantity,
      regularPriceSek: unitRegularPrice,
      regularPriceObservedAt:
        regularPrice.regularPriceObservedAt!.toISOString(),
      regularPriceFreshness: freshness,
      regularPriceSource: regularPrice.regularPriceSource,
      dealPriceSek: bestDeal.dealPriceSek,
      dealName: bestDeal.normalizedName,
      dealConditions: bestDeal.conditionsText,
      dealMemberOnly: bestDeal.memberOnly,
      dealApplied: true,
      effectivePriceSek: bestDealEffectiveUnit,
      effectiveTotalSek: bestDealTotal,
      priceUsed: "DEAL",
      missing: false,
    };
  }

  // No deal was better than regular price
  return baseExplanation;
}

// ─── 2. computeStoreResult ──────────────────────────────────

export function computeStoreResult(
  store: StoreData,
  items: ShoppingListItemInput[],
  priceMap: Map<string, ProductPriceData>,
  dealMap: Map<string, DealData[]>,
  userLocation: UserLocation,
  carProfile: CarProfileInput,
  chainMemberships: string[],
  includeDeals: boolean,
): StoreResult {
  const pricedItems: ItemPriceExplanation[] = [];
  const missingItems: ItemPriceExplanation[] = [];
  let groceryCostSek = 0;
  let regularCostForDealItems = 0;
  let dealCostForDealItems = 0;
  let dealsAppliedCount = 0;

  // Determine if user is a member of this store's chain
  const storeChainMemberships = chainMemberships.includes(store.chain)
    ? chainMemberships
    : [];

  for (const item of items) {
    const lookupKey = item.productId ?? item.freeTextName ?? "";
    const regularPrice = priceMap.get(lookupKey) ?? null;
    const deals = dealMap.get(lookupKey) ?? [];

    const explanation = computeItemPrice(
      item,
      regularPrice,
      deals,
      item.quantity,
      storeChainMemberships,
      includeDeals,
    );

    if (explanation.missing) {
      missingItems.push(explanation);
    } else {
      pricedItems.push(explanation);
      groceryCostSek += explanation.effectiveTotalSek!;

      if (explanation.dealApplied) {
        dealsAppliedCount++;
        // Track what regular would have cost for these items
        regularCostForDealItems += round2(
          explanation.regularPriceSek! * explanation.quantity,
        );
        dealCostForDealItems += explanation.effectiveTotalSek!;
      }
    }
  }

  groceryCostSek = round2(groceryCostSek);
  const dealsSavingsSek = round2(regularCostForDealItems - dealCostForDealItems);

  // ── Travel ────────────────────────────────────────────────
  const distanceKm = haversineDistance(
    userLocation.lat,
    userLocation.lng,
    store.lat,
    store.lng,
  );
  const travelDistanceKm = round2(distanceKm * 2); // round trip
  const travelCostSek = round2(
    computeTravelCost(
      travelDistanceKm,
      carProfile.consumptionPer100km,
      carProfile.energyPricePerUnit,
    ),
  );

  // ── Missing item penalty ──────────────────────────────────
  const missingPenalty = missingItems.length * MISSING_ITEM_PENALTY_SEK;

  const totalCostSek = round2(groceryCostSek + travelCostSek + missingPenalty);

  const totalItems = items.length;
  const pricedItemCount = pricedItems.length;
  const coveragePercent =
    totalItems > 0 ? round2((pricedItemCount / totalItems) * 100) : 0;

  return {
    storeId: store.id,
    storeName: store.name,
    chain: store.chain,
    format: store.format,
    address: store.address,
    lat: store.lat,
    lng: store.lng,
    distanceKm: round2(distanceKm),
    groceryCostSek,
    dealsSavingsSek,
    travelCostSek,
    travelDistanceKm,
    totalCostSek,
    coveragePercent,
    itemCount: totalItems,
    pricedItemCount,
    missingItemCount: missingItems.length,
    dealsAppliedCount,
    items: pricedItems,
    missingItems,
  };
}

// ─── 3. computeTwoStoreResult ───────────────────────────────

export function computeTwoStoreResult(
  storeA: StoreData,
  storeB: StoreData,
  items: ShoppingListItemInput[],
  priceMapA: Map<string, ProductPriceData>,
  priceMapB: Map<string, ProductPriceData>,
  dealMapA: Map<string, DealData[]>,
  dealMapB: Map<string, DealData[]>,
  userLocation: UserLocation,
  carProfile: CarProfileInput,
  chainMemberships: string[],
  includeDeals: boolean,
  bestSingleTotal: number,
): TwoStoreResult | null {
  const chainMembershipsA = chainMemberships.includes(storeA.chain)
    ? chainMemberships
    : [];
  const chainMembershipsB = chainMemberships.includes(storeB.chain)
    ? chainMemberships
    : [];

  const itemAssignment: Array<{
    itemName: string;
    assignedStore: "A" | "B";
    priceSek: number;
  }> = [];
  const missingItems: ItemPriceExplanation[] = [];
  const storeAItems: ItemPriceExplanation[] = [];
  const storeBItems: ItemPriceExplanation[] = [];

  let combinedGroceryCost = 0;
  let combinedRegularCostForDeals = 0;
  let combinedDealCost = 0;

  for (const item of items) {
    const lookupKey = item.productId ?? item.freeTextName ?? "";

    const regularPriceA = priceMapA.get(lookupKey) ?? null;
    const dealsA = dealMapA.get(lookupKey) ?? [];
    const explA = computeItemPrice(
      item,
      regularPriceA,
      dealsA,
      item.quantity,
      chainMembershipsA,
      includeDeals,
    );

    const regularPriceB = priceMapB.get(lookupKey) ?? null;
    const dealsB = dealMapB.get(lookupKey) ?? [];
    const explB = computeItemPrice(
      item,
      regularPriceB,
      dealsB,
      item.quantity,
      chainMembershipsB,
      includeDeals,
    );

    // Both missing
    if (explA.missing && explB.missing) {
      missingItems.push(explA);
      continue;
    }

    // Only one available
    if (explA.missing && !explB.missing) {
      storeBItems.push(explB);
      combinedGroceryCost += explB.effectiveTotalSek!;
      if (explB.dealApplied) {
        combinedRegularCostForDeals += round2(
          explB.regularPriceSek! * explB.quantity,
        );
        combinedDealCost += explB.effectiveTotalSek!;
      }
      itemAssignment.push({
        itemName: explB.itemName,
        assignedStore: "B",
        priceSek: explB.effectiveTotalSek!,
      });
      continue;
    }

    if (!explA.missing && explB.missing) {
      storeAItems.push(explA);
      combinedGroceryCost += explA.effectiveTotalSek!;
      if (explA.dealApplied) {
        combinedRegularCostForDeals += round2(
          explA.regularPriceSek! * explA.quantity,
        );
        combinedDealCost += explA.effectiveTotalSek!;
      }
      itemAssignment.push({
        itemName: explA.itemName,
        assignedStore: "A",
        priceSek: explA.effectiveTotalSek!,
      });
      continue;
    }

    // Both available — pick cheaper
    const totalA = explA.effectiveTotalSek!;
    const totalB = explB.effectiveTotalSek!;

    if (totalA <= totalB) {
      storeAItems.push(explA);
      combinedGroceryCost += totalA;
      if (explA.dealApplied) {
        combinedRegularCostForDeals += round2(
          explA.regularPriceSek! * explA.quantity,
        );
        combinedDealCost += totalA;
      }
      itemAssignment.push({
        itemName: explA.itemName,
        assignedStore: "A",
        priceSek: totalA,
      });
    } else {
      storeBItems.push(explB);
      combinedGroceryCost += totalB;
      if (explB.dealApplied) {
        combinedRegularCostForDeals += round2(
          explB.regularPriceSek! * explB.quantity,
        );
        combinedDealCost += totalB;
      }
      itemAssignment.push({
        itemName: explB.itemName,
        assignedStore: "B",
        priceSek: totalB,
      });
    }
  }

  combinedGroceryCost = round2(combinedGroceryCost);
  const combinedDealsSavingsSek = round2(
    combinedRegularCostForDeals - combinedDealCost,
  );

  // ── Travel: evaluate both route orders ────────────────────
  const distHA = haversineDistance(
    userLocation.lat,
    userLocation.lng,
    storeA.lat,
    storeA.lng,
  );
  const distHB = haversineDistance(
    userLocation.lat,
    userLocation.lng,
    storeB.lat,
    storeB.lng,
  );
  const distAB = haversineDistance(
    storeA.lat,
    storeA.lng,
    storeB.lat,
    storeB.lng,
  );

  // Route A then B: home → A → B → home
  const routeAThenB = distHA + distAB + distHB;
  // Route B then A: home → B → A → home
  const routeBThenA = distHB + distAB + distHA;

  // Both routes are actually the same distance (H→A + A→B + B→H vs H→B + B→A + A→H)
  // but haversine is symmetric so they are equal. We still compute both for clarity
  // and in case future distance methods are asymmetric.
  let travelDistanceKm: number;
  let routeOrder: "A_THEN_B" | "B_THEN_A";

  if (routeAThenB <= routeBThenA) {
    travelDistanceKm = round2(routeAThenB);
    routeOrder = "A_THEN_B";
  } else {
    travelDistanceKm = round2(routeBThenA);
    routeOrder = "B_THEN_A";
  }

  const travelCostSek = round2(
    computeTravelCost(
      travelDistanceKm,
      carProfile.consumptionPer100km,
      carProfile.energyPricePerUnit,
    ),
  );

  // ── Missing item penalty ──────────────────────────────────
  const missingPenalty = missingItems.length * MISSING_ITEM_PENALTY_SEK;

  const totalCostSek = round2(
    combinedGroceryCost + travelCostSek + missingPenalty,
  );

  // ── Check minimum savings threshold ───────────────────────
  const netSavingsVsSingleSek = round2(bestSingleTotal - totalCostSek);

  if (netSavingsVsSingleSek < TWO_STORE_MINIMUM_SAVINGS_SEK) {
    return null;
  }

  // ── Build store result summaries for A and B ──────────────
  const storeAMissing = missingItems; // shared missing items
  const storeBMissing: ItemPriceExplanation[] = [];

  const storeAResult = buildPartialStoreResult(
    storeA,
    storeAItems,
    storeAMissing,
    items.length,
    userLocation,
    carProfile,
  );

  const storeBResult = buildPartialStoreResult(
    storeB,
    storeBItems,
    storeBMissing,
    items.length,
    userLocation,
    carProfile,
  );

  const totalItems = items.length;
  const pricedItemCount = totalItems - missingItems.length;
  const coveragePercent =
    totalItems > 0 ? round2((pricedItemCount / totalItems) * 100) : 0;

  return {
    storeA: storeAResult,
    storeB: storeBResult,
    combinedGroceryCostSek: combinedGroceryCost,
    combinedDealsSavingsSek: combinedDealsSavingsSek,
    travelDistanceKm,
    travelCostSek,
    totalCostSek,
    netSavingsVsSingleSek,
    routeOrder,
    itemAssignment,
    missingItems,
    coveragePercent,
  };
}

/** Build a partial StoreResult for use in TwoStoreResult context. */
function buildPartialStoreResult(
  store: StoreData,
  pricedItems: ItemPriceExplanation[],
  missingItems: ItemPriceExplanation[],
  totalItemCount: number,
  userLocation: UserLocation,
  carProfile: CarProfileInput,
): StoreResult {
  let groceryCostSek = 0;
  let regularCostForDealItems = 0;
  let dealCostForDealItems = 0;
  let dealsAppliedCount = 0;

  for (const item of pricedItems) {
    groceryCostSek += item.effectiveTotalSek!;
    if (item.dealApplied) {
      dealsAppliedCount++;
      regularCostForDealItems += round2(item.regularPriceSek! * item.quantity);
      dealCostForDealItems += item.effectiveTotalSek!;
    }
  }

  groceryCostSek = round2(groceryCostSek);
  const dealsSavingsSek = round2(regularCostForDealItems - dealCostForDealItems);

  const distanceKm = haversineDistance(
    userLocation.lat,
    userLocation.lng,
    store.lat,
    store.lng,
  );
  const travelDistanceKm = round2(distanceKm * 2);
  const travelCostSek = round2(
    computeTravelCost(
      travelDistanceKm,
      carProfile.consumptionPer100km,
      carProfile.energyPricePerUnit,
    ),
  );

  const pricedItemCount = pricedItems.length;
  const coveragePercent =
    totalItemCount > 0
      ? round2((pricedItemCount / totalItemCount) * 100)
      : 0;

  const missingPenalty = missingItems.length * MISSING_ITEM_PENALTY_SEK;
  const totalCostSek = round2(groceryCostSek + travelCostSek + missingPenalty);

  return {
    storeId: store.id,
    storeName: store.name,
    chain: store.chain,
    format: store.format,
    address: store.address,
    lat: store.lat,
    lng: store.lng,
    distanceKm: round2(distanceKm),
    groceryCostSek,
    dealsSavingsSek,
    travelCostSek,
    travelDistanceKm,
    totalCostSek,
    coveragePercent,
    itemCount: totalItemCount,
    pricedItemCount,
    missingItemCount: missingItems.length,
    dealsAppliedCount,
    items: pricedItems,
    missingItems,
  };
}

// ─── 4. optimize (main entry point) ─────────────────────────

export function optimize(
  stores: StoreData[],
  items: ShoppingListItemInput[],
  pricesByStore: Map<string, Map<string, ProductPriceData>>,
  dealsByStore: Map<string, Map<string, DealData[]>>,
  userLocation: UserLocation,
  carProfile: CarProfileInput,
  chainMemberships: string[],
  includeDeals: boolean,
): OptimizeResponse {
  if (items.length === 0 || stores.length === 0) {
    return {
      bestSingleStore: null,
      bestTwoStore: null,
      allSingleStores: [],
      distanceMethod: "haversine",
      distanceDisclaimer:
        "Distances are straight-line (haversine). Actual driving distance may be longer.",
      optimizedAt: new Date().toISOString(),
    };
  }

  // ── Compute all single-store results ──────────────────────
  const allSingleStores: StoreResult[] = [];

  for (const store of stores) {
    const priceMap = pricesByStore.get(store.id) ?? new Map();
    const dealMap = dealsByStore.get(store.id) ?? new Map();

    const result = computeStoreResult(
      store,
      items,
      priceMap,
      dealMap,
      userLocation,
      carProfile,
      chainMemberships,
      includeDeals,
    );

    allSingleStores.push(result);
  }

  // ── Sort by total cost ascending ──────────────────────────
  allSingleStores.sort((a, b) => a.totalCostSek - b.totalCostSek);

  const bestSingleStore = allSingleStores[0] ?? null;
  const bestSingleTotal = bestSingleStore?.totalCostSek ?? Infinity;

  // ── Two-store evaluation ──────────────────────────────────
  const topStores = allSingleStores.slice(0, TOP_N_STORES_FOR_PAIRS);
  let bestTwoStore: TwoStoreResult | null = null;

  for (let i = 0; i < topStores.length; i++) {
    for (let j = i + 1; j < topStores.length; j++) {
      const stA = stores.find((s) => s.id === topStores[i].storeId)!;
      const stB = stores.find((s) => s.id === topStores[j].storeId)!;

      const priceMapA = pricesByStore.get(stA.id) ?? new Map();
      const priceMapB = pricesByStore.get(stB.id) ?? new Map();
      const dealMapA = dealsByStore.get(stA.id) ?? new Map();
      const dealMapB = dealsByStore.get(stB.id) ?? new Map();

      const twoStoreResult = computeTwoStoreResult(
        stA,
        stB,
        items,
        priceMapA,
        priceMapB,
        dealMapA,
        dealMapB,
        userLocation,
        carProfile,
        chainMemberships,
        includeDeals,
        bestSingleTotal,
      );

      if (twoStoreResult !== null) {
        if (
          bestTwoStore === null ||
          twoStoreResult.totalCostSek < bestTwoStore.totalCostSek
        ) {
          bestTwoStore = twoStoreResult;
        }
      }
    }
  }

  return {
    bestSingleStore,
    bestTwoStore,
    allSingleStores,
    distanceMethod: "haversine",
    distanceDisclaimer:
      "Distances are straight-line (haversine). Actual driving distance may be longer.",
    optimizedAt: new Date().toISOString(),
  };
}
