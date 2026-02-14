// ─── Store Connector Interface ─────────────────────────────────
// Pluggable interface for fetching product/price data from grocery store APIs.

export interface StoreConnector {
  /** Chain identifier (ICA, WILLYS, COOP, etc.) */
  chain: string;

  /** Fetch products matching a search term from a specific store */
  fetchProducts(
    externalStoreId: string,
    query?: string
  ): Promise<ConnectorProduct[]>;

  /** Fetch all products across all categories (paginated internally) */
  fetchAllCategories?(
    externalStoreId: string
  ): Promise<ConnectorProduct[]>;
}

export interface ConnectorProduct {
  name: string;
  brand?: string;
  priceSek: number;
  unitPriceSek?: number;
  unitUnit?: string;
  sizeValue?: number;
  sizeUnit?: string;
  gtin?: string;
  category?: string;
  imageUrl?: string;
  inStock?: boolean;
  /** If the product is currently on promotion */
  promotionPrice?: number;
  promotionText?: string;
}

export interface IngestionReport {
  storeId: string;
  storeName: string;
  chain: string;
  fetched: number;
  matched: number;
  created: number;
  pricesInserted: number;
  errors: string[];
  durationMs: number;
}
