"use server";

import { prisma } from "@/lib/db";
import { optimize } from "@/lib/optimizer";
import type { StoreData, ProductPriceData, DealData } from "@/lib/optimizer";
import type {
  OptimizeRequest,
  OptimizeResponse,
} from "@/lib/types";
import { haversineDistance } from "@/lib/utils";
import { MAX_PRICE_AGE_DAYS } from "@/lib/constants";

export async function optimizeBasket(
  request: OptimizeRequest
): Promise<OptimizeResponse> {
  const { location, radiusKm, carProfile, items, includeDeals, chainMemberships } = request;

  // 1. Get all stores within radius
  const allStores = await prisma.store.findMany({
    where: { city: "Stockholm" },
  });

  const nearbyStores: StoreData[] = allStores
    .map((s) => ({
      id: s.id,
      name: s.name,
      chain: s.chain,
      format: s.format,
      address: s.address ?? undefined,
      lat: s.lat,
      lng: s.lng,
    }))
    .filter(
      (s) =>
        haversineDistance(location.lat, location.lng, s.lat, s.lng) <= radiusKm
    );

  if (nearbyStores.length === 0) {
    return {
      bestSingleStore: null,
      bestTwoStore: null,
      allSingleStores: [],
      distanceMethod: "Haversine (rak linje)",
      distanceDisclaimer:
        "Avstånd beräknat som fågelvägen. Verklig körsträcka kan vara längre.",
      optimizedAt: new Date().toISOString(),
    };
  }

  // 2. Get product IDs from items
  const productIds = items
    .map((i) => i.productId)
    .filter((id): id is string => !!id);

  // Also try to match free text items
  const freeTextItems = items.filter((i) => !i.productId && i.freeTextName);
  const matchedFreeText: Map<string, string> = new Map();

  if (freeTextItems.length > 0) {
    for (const item of freeTextItems) {
      const match = await prisma.product.findFirst({
        where: {
          nameSv: {
            contains: item.freeTextName!,
            mode: "insensitive",
          },
        },
      });
      if (match) {
        matchedFreeText.set(item.freeTextName!, match.id);
        productIds.push(match.id);
      }
    }
  }

  const storeIds = nearbyStores.map((s) => s.id);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_PRICE_AGE_DAYS);

  // 3. Get latest prices for each store-product pair
  const prices = await prisma.regularPrice.findMany({
    where: {
      storeId: { in: storeIds },
      productId: { in: productIds },
      observedAt: { gte: cutoffDate },
    },
    orderBy: { observedAt: "desc" },
    include: { product: true },
  });

  // Build price map: storeId -> productId -> latest price
  const pricesByStore: Map<string, Map<string, ProductPriceData>> = new Map();
  for (const p of prices) {
    if (!pricesByStore.has(p.storeId)) {
      pricesByStore.set(p.storeId, new Map());
    }
    const storeMap = pricesByStore.get(p.storeId)!;
    if (!storeMap.has(p.productId)) {
      storeMap.set(p.productId, {
        productId: p.productId,
        productName: p.product.nameSv,
        storeId: p.storeId,
        regularPriceSek: p.priceSek,
        regularPriceObservedAt: p.observedAt,
        regularPriceSource: p.source,
      });
    }
  }

  // 4. Get active deals if includeDeals is true
  const dealsByStore: Map<string, Map<string, DealData[]>> = new Map();
  if (includeDeals) {
    const now = new Date();
    const activeFlyers = await prisma.dealFlyer.findMany({
      where: {
        weekStart: { lte: now },
        weekEnd: { gte: now },
        parseStatus: "APPROVED",
      },
      include: {
        dealItems: {
          where: {
            approved: true,
          },
        },
      },
    });

    for (const flyer of activeFlyers) {
      const storeId = flyer.storeId;
      if (!storeId || !storeIds.includes(storeId)) continue;

      if (!dealsByStore.has(storeId)) {
        dealsByStore.set(storeId, new Map());
      }
      const storeDealMap = dealsByStore.get(storeId)!;

      for (const deal of flyer.dealItems) {
        const dealData: DealData = {
          dealItemId: deal.id,
          storeId,
          productId: deal.productId,
          normalizedName: deal.normalizedName,
          dealPriceSek: deal.dealPriceSek,
          multiBuyType: deal.multiBuyType,
          multiBuyX: deal.multiBuyX,
          multiBuyY: deal.multiBuyY,
          conditionsText: deal.conditionsText,
          memberOnly: deal.memberOnly,
          limitPerHousehold: deal.limitPerHousehold,
          validFrom: deal.validFrom,
          validTo: deal.validTo,
        };

        // Index by productId if available, also by normalizedName
        const keys: string[] = [];
        if (deal.productId) keys.push(deal.productId);
        keys.push(deal.normalizedName);

        for (const key of keys) {
          if (!storeDealMap.has(key)) {
            storeDealMap.set(key, []);
          }
          storeDealMap.get(key)!.push(dealData);
        }
      }
    }
  }

  // 5. Map items with resolved product IDs
  const resolvedItems = items.map((item) => {
    if (item.productId) return item;
    if (item.freeTextName && matchedFreeText.has(item.freeTextName)) {
      return { ...item, productId: matchedFreeText.get(item.freeTextName) };
    }
    return item;
  });

  // 6. Run optimization
  const result = optimize(
    nearbyStores,
    resolvedItems,
    pricesByStore,
    dealsByStore,
    location,
    carProfile,
    chainMemberships,
    includeDeals
  );

  return result;
}

export async function searchProducts(query: string) {
  if (!query || query.length < 2) return [];

  const products = await prisma.product.findMany({
    where: {
      nameSv: { contains: query, mode: "insensitive" },
    },
    take: 10,
    orderBy: { nameSv: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    nameSv: p.nameSv,
    brand: p.brand,
    sizeValue: p.sizeValue,
    sizeUnit: p.sizeUnit,
    category: p.category,
    subcategory: p.subcategory,
  }));
}

export async function getStores() {
  return prisma.store.findMany({
    where: { city: "Stockholm" },
    orderBy: { name: "asc" },
  });
}

export async function getStoreWithPrices(storeId: string) {
  return prisma.store.findUnique({
    where: { id: storeId },
    include: {
      regularPrices: {
        orderBy: { observedAt: "desc" },
        take: 50,
        include: { product: true },
      },
      dealFlyers: {
        where: { parseStatus: "APPROVED" },
        include: { dealItems: true },
        orderBy: { weekStart: "desc" },
        take: 5,
      },
    },
  });
}
