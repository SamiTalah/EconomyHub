import type { StoreConnector, ConnectorProduct } from "./types";

// Willys connector — stubbed.
// Willys (Axfood) does not have a documented public API.
// The `handla.willys.se` e-commerce backend has discoverable endpoints,
// but they may require authentication or change without notice.
// Configure WILLYS_API_URL environment variable to enable.

const WILLYS_BASE = process.env.WILLYS_API_URL ?? "";

export const willysConnector: StoreConnector = {
  chain: "WILLYS",

  async fetchProducts(
    externalStoreId: string,
    query?: string
  ): Promise<ConnectorProduct[]> {
    if (!WILLYS_BASE) {
      throw new Error(
        "Willys connector is not configured. Set WILLYS_API_URL environment variable."
      );
    }

    const url = query
      ? `${WILLYS_BASE}/search/clean?q=${encodeURIComponent(query)}&size=50&storeId=${externalStoreId}`
      : `${WILLYS_BASE}/product/promotions?storeId=${externalStoreId}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CartWise-Stockholm/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Willys API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const products = Array.isArray(data?.results) ? data.results : [];

    return products
      .map((p: Record<string, unknown>): ConnectorProduct | null => {
        const name = p.name as string | undefined;
        const price = p.price as number | undefined;
        if (!name || price == null) return null;

        return {
          name,
          brand: (p.brand as string) ?? undefined,
          priceSek: price,
          unitPriceSek: (p.comparePriceUnit as number) ?? undefined,
          unitUnit: (p.compareUnit as string) ?? undefined,
          sizeValue: undefined,
          sizeUnit: (p.unitOfMeasure as string) ?? undefined,
          gtin: (p.ean as string) ?? undefined,
          category: (p.category as string) ?? undefined,
          inStock: true,
          promotionPrice: (p.savingsAmount as number) ?? undefined,
          promotionText: (p.potpiDescription as string) ?? undefined,
        };
      })
      .filter((p: ConnectorProduct | null): p is ConnectorProduct => p !== null);
  },
};
