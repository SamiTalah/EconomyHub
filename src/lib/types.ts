// ─── Optimization types ─────────────────────────────────────

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface CarProfileInput {
  fuelType: "PETROL" | "DIESEL" | "EV" | "HYBRID";
  consumptionPer100km: number;
  energyUnit: "L_PER_100KM" | "KWH_PER_100KM";
  energyPricePerUnit: number;
}

export interface ShoppingListItemInput {
  productId?: string;
  freeTextName?: string;
  quantity: number;
  allowSubstitutes: boolean;
}

export interface OptimizeRequest {
  location: UserLocation;
  radiusKm: number;
  carProfile: CarProfileInput;
  items: ShoppingListItemInput[];
  includeDeals: boolean;
  chainMemberships: string[]; // chain names user is member of
}

export interface ItemPriceExplanation {
  itemName: string;
  productId?: string;
  quantity: number;
  regularPriceSek: number | null;
  regularPriceObservedAt: string | null;
  regularPriceFreshness: "FRESH" | "AGING" | "STALE" | null;
  regularPriceSource: string | null;
  dealPriceSek: number | null;
  dealName: string | null;
  dealConditions: string | null;
  dealMemberOnly: boolean;
  dealApplied: boolean;
  effectivePriceSek: number | null;
  effectiveTotalSek: number | null;
  priceUsed: "REGULAR" | "DEAL" | "MISSING";
  missing: boolean;
  missingReason?: string;
}

export interface StoreResult {
  storeId: string;
  storeName: string;
  chain: string;
  format: string;
  address?: string;
  lat: number;
  lng: number;
  distanceKm: number;
  groceryCostSek: number;
  dealsSavingsSek: number;
  travelCostSek: number;
  travelDistanceKm: number;
  totalCostSek: number;
  coveragePercent: number;
  itemCount: number;
  pricedItemCount: number;
  missingItemCount: number;
  dealsAppliedCount: number;
  items: ItemPriceExplanation[];
  missingItems: ItemPriceExplanation[];
}

export interface TwoStoreResult {
  storeA: StoreResult;
  storeB: StoreResult;
  combinedGroceryCostSek: number;
  combinedDealsSavingsSek: number;
  travelDistanceKm: number;
  travelCostSek: number;
  totalCostSek: number;
  netSavingsVsSingleSek: number;
  routeOrder: "A_THEN_B" | "B_THEN_A";
  itemAssignment: Array<{
    itemName: string;
    assignedStore: "A" | "B";
    priceSek: number;
  }>;
  missingItems: ItemPriceExplanation[];
  coveragePercent: number;
}

export interface OptimizeResponse {
  bestSingleStore: StoreResult | null;
  bestTwoStore: TwoStoreResult | null;
  allSingleStores: StoreResult[];
  distanceMethod: string;
  distanceDisclaimer: string;
  optimizedAt: string;
}
