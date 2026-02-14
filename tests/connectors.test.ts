import { describe, it, expect } from "vitest";
import type { ConnectorProduct, StoreConnector } from "@/lib/connectors/types";
import { icaConnector } from "@/lib/connectors/ica";
import { willysConnector } from "@/lib/connectors/willys";
import { coopConnector } from "@/lib/connectors/coop";

// ─── Interface compliance tests ────────────────────────────────

describe("StoreConnector interface", () => {
  it("icaConnector has the correct chain", () => {
    expect(icaConnector.chain).toBe("ICA");
  });

  it("icaConnector implements fetchProducts", () => {
    expect(typeof icaConnector.fetchProducts).toBe("function");
  });

  it("icaConnector implements fetchAllCategories", () => {
    expect(typeof icaConnector.fetchAllCategories).toBe("function");
  });

  it("willysConnector has the correct chain", () => {
    expect(willysConnector.chain).toBe("WILLYS");
  });

  it("willysConnector implements fetchProducts", () => {
    expect(typeof willysConnector.fetchProducts).toBe("function");
  });

  it("coopConnector has the correct chain", () => {
    expect(coopConnector.chain).toBe("COOP");
  });

  it("coopConnector implements fetchProducts", () => {
    expect(typeof coopConnector.fetchProducts).toBe("function");
  });
});

// ─── Willys stub behavior ──────────────────────────────────────

describe("willysConnector (stubbed)", () => {
  it("throws when WILLYS_API_URL is not set", async () => {
    // WILLYS_API_URL is not set in test env
    await expect(
      willysConnector.fetchProducts("store123")
    ).rejects.toThrow("not configured");
  });
});

// ─── Coop stub behavior ────────────────────────────────────────

describe("coopConnector (stubbed)", () => {
  it("throws when COOP_API_URL is not set", async () => {
    // COOP_API_URL is not set in test env
    await expect(
      coopConnector.fetchProducts("store123")
    ).rejects.toThrow("not configured");
  });
});

// ─── ConnectorProduct type validation ──────────────────────────

describe("ConnectorProduct type shape", () => {
  it("accepts a minimal product", () => {
    const product: ConnectorProduct = {
      name: "Mjölk 3%",
      priceSek: 17.9,
    };
    expect(product.name).toBe("Mjölk 3%");
    expect(product.priceSek).toBe(17.9);
  });

  it("accepts a full product", () => {
    const product: ConnectorProduct = {
      name: "Nötfärs 500g",
      brand: "Garant",
      priceSek: 55.0,
      unitPriceSek: 110.0,
      unitUnit: "KR_PER_KG",
      sizeValue: 0.5,
      sizeUnit: "kg",
      gtin: "7310865060013",
      category: "Kött",
      imageUrl: "https://example.com/img.jpg",
      inStock: true,
      promotionPrice: 39.9,
      promotionText: "Veckans erbjudande",
    };
    expect(product.name).toBe("Nötfärs 500g");
    expect(product.brand).toBe("Garant");
    expect(product.promotionPrice).toBe(39.9);
  });
});
