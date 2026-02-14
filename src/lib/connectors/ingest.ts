// ─── Connector Ingestion Logic ───────────────────────────────────
// Fetches products from a StoreConnector, matches to existing Products,
// creates new Products when needed, and inserts RegularPrice entries.

import { prisma } from "@/lib/db";
import { normalizeProductKey } from "@/lib/utils";
import type { StoreConnector, IngestionReport } from "./types";
import type { Category } from "@prisma/client";

const CATEGORY_MAP: Record<string, Category> = {
  mejeri: "MEJERI_AGG",
  dairy: "MEJERI_AGG",
  mjölk: "MEJERI_AGG",
  ost: "MEJERI_AGG",
  ägg: "MEJERI_AGG",
  frukt: "FRUKT_GRONT",
  grönt: "FRUKT_GRONT",
  fruit: "FRUKT_GRONT",
  vegetables: "FRUKT_GRONT",
  kött: "KOTT",
  meat: "KOTT",
  fisk: "FISK_SKALDJUR",
  fish: "FISK_SKALDJUR",
  skaldjur: "FISK_SKALDJUR",
  chark: "CHARK_PALAGG",
  pålägg: "CHARK_PALAGG",
  bröd: "BROD_BAGERI",
  bageri: "BROD_BAGERI",
  bread: "BROD_BAGERI",
  skafferi: "SKAFFERI",
  pantry: "SKAFFERI",
  fryst: "FRYST",
  frozen: "FRYST",
  dryck: "DRYCK",
  drinks: "DRYCK",
  snacks: "SNACKS_GODIS",
  godis: "SNACKS_GODIS",
  barn: "BARN_BABY",
  baby: "BARN_BABY",
  hälsa: "HALSA_SKONHET",
  hygien: "HALSA_SKONHET",
  vego: "VEGO",
  vegan: "VEGO",
  hem: "HEM_STAD",
  städ: "HEM_STAD",
  djur: "DJUR",
  pet: "DJUR",
};

function guessCategory(categoryText?: string): Category {
  if (!categoryText) return "SKAFFERI";
  const lower = categoryText.toLowerCase();
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return "SKAFFERI";
}

/**
 * Ingest products from a connector into the database.
 * Matches products by normalizedKey, creates new ones as needed.
 */
export async function ingestFromConnector(
  connector: StoreConnector,
  storeId: string,
  externalStoreId: string,
  query?: string
): Promise<IngestionReport> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Get the store
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) {
    throw new Error(`Store ${storeId} not found`);
  }

  // Fetch products from the connector
  let fetched = 0;
  let matched = 0;
  let created = 0;
  let pricesInserted = 0;

  try {
    const products = query
      ? await connector.fetchProducts(externalStoreId, query)
      : connector.fetchAllCategories
        ? await connector.fetchAllCategories(externalStoreId)
        : await connector.fetchProducts(externalStoreId);

    fetched = products.length;

    for (const cp of products) {
      try {
        const normalizedKey = normalizeProductKey(
          cp.name,
          cp.brand,
          cp.sizeValue,
          cp.sizeUnit
        );

        // Try to find existing product by GTIN first, then by normalized key
        let product = cp.gtin
          ? await prisma.product.findUnique({ where: { gtin: cp.gtin } })
          : null;

        if (!product) {
          product = await prisma.product.findUnique({
            where: { normalizedKey },
          });
        }

        if (product) {
          matched++;
        } else {
          // Create new product
          const category = guessCategory(cp.category);
          product = await prisma.product.create({
            data: {
              gtin: cp.gtin,
              nameSv: cp.name,
              brand: cp.brand,
              sizeValue: cp.sizeValue,
              sizeUnit: cp.sizeUnit,
              category,
              subcategory: cp.category ?? "OVRIGT",
              normalizedKey,
            },
          });
          created++;
        }

        // Create price entry
        const unitUnit = cp.unitUnit?.toUpperCase().includes("KG")
          ? "KR_PER_KG"
          : cp.unitUnit?.toUpperCase().includes("L")
            ? "KR_PER_L"
            : cp.unitUnit
              ? "KR_PER_ST"
              : null;

        await prisma.regularPrice.create({
          data: {
            storeId: store.id,
            productId: product.id,
            priceSek: cp.priceSek,
            unitPriceSek: cp.unitPriceSek,
            unitUnit: unitUnit as "KR_PER_KG" | "KR_PER_L" | "KR_PER_ST" | null,
            inStock: cp.inStock ?? true,
            observedAt: new Date(),
            source: "PARTNER_API",
          },
        });
        pricesInserted++;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown error";
        errors.push(`Product "${cp.name}": ${msg}`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    errors.push(`Connector fetch failed: ${msg}`);
  }

  return {
    storeId: store.id,
    storeName: store.name,
    chain: connector.chain,
    fetched,
    matched,
    created,
    pricesInserted,
    errors,
    durationMs: Date.now() - startTime,
  };
}
