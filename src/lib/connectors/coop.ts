import type { StoreConnector, ConnectorProduct } from "./types";

// Coop connector — stubbed.
// Coop has an official API portal at portal.api.coop.se
// and community APIs at github.com/coop-developers/coop-apis.
// Configure COOP_API_URL environment variable to enable.

const COOP_BASE = process.env.COOP_API_URL ?? "";

export const coopConnector: StoreConnector = {
  chain: "COOP",

  async fetchProducts(
    externalStoreId: string,
    query?: string
  ): Promise<ConnectorProduct[]> {
    if (!COOP_BASE) {
      throw new Error(
        "Coop connector is not configured. Set COOP_API_URL environment variable."
      );
    }

    const url = query
      ? `${COOP_BASE}/products/search?q=${encodeURIComponent(query)}&storeId=${externalStoreId}&limit=50`
      : `${COOP_BASE}/products?storeId=${externalStoreId}&limit=50`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "CartWise-Stockholm/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Coop API ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const products = Array.isArray(data?.products) ? data.products : [];

    return products
      .map((p: Record<string, unknown>): ConnectorProduct | null => {
        const name = p.name as string | undefined;
        const price = p.price as number | undefined;
        if (!name || price == null) return null;

        return {
          name,
          brand: (p.brand as string) ?? undefined,
          priceSek: price,
          unitPriceSek: (p.comparisonPrice as number) ?? undefined,
          unitUnit: (p.comparisonUnit as string) ?? undefined,
          sizeValue: (p.weight as number) ?? undefined,
          sizeUnit: (p.weightUnit as string) ?? undefined,
          gtin: (p.ean as string) ?? undefined,
          category: (p.category as string) ?? undefined,
          inStock: (p.inStock as boolean) ?? true,
          promotionPrice: (p.campaignPrice as number) ?? undefined,
          promotionText: (p.campaignText as string) ?? undefined,
        };
      })
      .filter((p: ConnectorProduct | null): p is ConnectorProduct => p !== null);
  },
};
