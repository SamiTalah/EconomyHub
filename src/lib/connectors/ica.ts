import type { StoreConnector, ConnectorProduct } from "./types";

// ICA's e-commerce API — no auth required.
// Base URL: https://handlaprivatkund.ica.se/stores/{storeId}/api/v5

const ICA_BASE = "https://handlaprivatkund.ica.se/stores";
const PAGE_SIZE = 50;

interface IcaProduct {
  name?: string;
  brand?: string;
  price?: number;
  comparativePrice?: { amount?: number; unit?: string };
  weight?: { value?: number; unit?: string };
  ean?: string;
  category?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  promotion?: { price?: number; description?: string };
}

interface IcaSearchResponse {
  products?: IcaProduct[];
  totalCount?: number;
}

function mapProduct(p: IcaProduct): ConnectorProduct | null {
  if (!p.name || p.price == null) return null;
  return {
    name: p.name,
    brand: p.brand,
    priceSek: p.price,
    unitPriceSek: p.comparativePrice?.amount,
    unitUnit: p.comparativePrice?.unit,
    sizeValue: p.weight?.value,
    sizeUnit: p.weight?.unit,
    gtin: p.ean,
    category: p.category,
    imageUrl: p.imageUrl,
    inStock: p.isAvailable ?? true,
    promotionPrice: p.promotion?.price,
    promotionText: p.promotion?.description,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CartWise-Stockholm/1.0",
    },
  });
  if (!res.ok) {
    throw new Error(`ICA API ${res.status}: ${res.statusText} for ${url}`);
  }
  return res.json() as Promise<T>;
}

export const icaConnector: StoreConnector = {
  chain: "ICA",

  async fetchProducts(
    externalStoreId: string,
    query?: string
  ): Promise<ConnectorProduct[]> {
    const base = `${ICA_BASE}/${externalStoreId}/api/v5`;
    const url = query
      ? `${base}/products/search?term=${encodeURIComponent(query)}&limit=${PAGE_SIZE}`
      : `${base}/products?limit=${PAGE_SIZE}&offset=0`;

    const data = await fetchJson<IcaSearchResponse>(url);
    return (data.products ?? [])
      .map(mapProduct)
      .filter((p): p is ConnectorProduct => p !== null);
  },

  async fetchAllCategories(
    externalStoreId: string
  ): Promise<ConnectorProduct[]> {
    const base = `${ICA_BASE}/${externalStoreId}/api/v5`;
    const allProducts: ConnectorProduct[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const url = `${base}/products?limit=${PAGE_SIZE}&offset=${offset}`;
      const data = await fetchJson<IcaSearchResponse>(url);
      const products = (data.products ?? [])
        .map(mapProduct)
        .filter((p): p is ConnectorProduct => p !== null);

      allProducts.push(...products);
      offset += PAGE_SIZE;

      // Stop if we got fewer than a full page or if we've fetched enough
      if (products.length < PAGE_SIZE || allProducts.length >= 2000) {
        hasMore = false;
      }
    }

    return allProducts;
  },
};
