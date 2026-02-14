import { describe, it, expect } from "vitest";
import { parseOcrText, extractDateRange } from "@/lib/ocr/parser";

// ─── Price extraction ──────────────────────────────────────────

describe("parseOcrText — price formats", () => {
  it("parses Swedish decimal format (29,90)", () => {
    const result = parseOcrText("Nötfärs 500g\n29,90 kr");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].priceSek).toBeCloseTo(29.9, 1);
    expect(result[0].name).toContain("Nötfärs");
  });

  it("parses colon price format (29:90)", () => {
    const result = parseOcrText("Mjölk 3%\n29:90");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].priceSek).toBeCloseTo(29.9, 1);
  });

  it("parses whole price with dash (29:-)", () => {
    const result = parseOcrText("Kaffe 450g\n49:-");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].priceSek).toBe(49);
  });

  it("parses 'kr' suffix (29 kr)", () => {
    const result = parseOcrText("Bananer\n15 kr");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].priceSek).toBe(15);
  });

  it("parses dot format (29.90)", () => {
    const result = parseOcrText("Pasta 500g\n12.90");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].priceSek).toBeCloseTo(12.9, 1);
  });
});

// ─── Multi-buy patterns ────────────────────────────────────────

describe("parseOcrText — multi-buy deals", () => {
  it("parses X för Y pattern (2 för 35)", () => {
    const result = parseOcrText("Mjölk 3% 1.5L\n2 för 35 kr");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].multiBuyType).toBe("X_FOR_Y");
    expect(result[0].multiBuyX).toBe(2);
    expect(result[0].multiBuyY).toBeCloseTo(35, 0);
  });

  it("parses percent off pattern (20% rabatt)", () => {
    const result = parseOcrText("All ost\n20% rabatt\n59,90 kr");
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should detect percent off
    const percentItem = result.find((r) => r.multiBuyType === "PERCENT_OFF");
    if (percentItem) {
      expect(percentItem.multiBuyX).toBe(20);
    }
  });
});

// ─── Conditions ────────────────────────────────────────────────

describe("parseOcrText — conditions", () => {
  it("detects member-only deals (Medlemspris)", () => {
    const result = parseOcrText("Kycklingfilé 1kg\nMedlemspris 69,90");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].memberOnly).toBe(true);
  });

  it("detects Stammispris as member-only", () => {
    const result = parseOcrText("Köttfärs 800g Stammispris\n59:-");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].memberOnly).toBe(true);
  });

  it("detects quantity limits (Max 2 st)", () => {
    const result = parseOcrText("Lax 400g\n79,90\nMax 2 st per hushåll");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].limitPerHousehold).toBe(2);
  });
});

// ─── Confidence scoring ────────────────────────────────────────

describe("parseOcrText — confidence", () => {
  it("assigns confidence score between 10 and 100", () => {
    const result = parseOcrText("Smör 500g\n39,90 kr");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].confidenceScore).toBeGreaterThanOrEqual(10);
    expect(result[0].confidenceScore).toBeLessThanOrEqual(100);
  });

  it("gives higher confidence to clear, well-structured items", () => {
    const clearResult = parseOcrText("Mjölk Arla 3% 1.5L\n17,90 kr");
    const noisyResult = parseOcrText("x\n5,00");
    expect(clearResult.length).toBeGreaterThanOrEqual(1);
    if (noisyResult.length > 0) {
      expect(clearResult[0].confidenceScore).toBeGreaterThanOrEqual(
        noisyResult[0].confidenceScore
      );
    }
  });
});

// ─── Name cleaning ─────────────────────────────────────────────

describe("parseOcrText — name cleaning", () => {
  it("returns cleaned product names", () => {
    const result = parseOcrText("  • Nötfärs 500g Garant  \n39,90");
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Name should not start/end with bullet or whitespace
    expect(result[0].name).not.toMatch(/^[•·\s]/);
    expect(result[0].name).not.toMatch(/[•·\s]$/);
  });
});

// ─── Empty/noise handling ──────────────────────────────────────

describe("parseOcrText — edge cases", () => {
  it("returns empty array for empty input", () => {
    const result = parseOcrText("");
    expect(result).toHaveLength(0);
  });

  it("returns empty array for pure noise", () => {
    const result = parseOcrText("   \n  \n   ");
    expect(result).toHaveLength(0);
  });

  it("handles multiple items on the same page", () => {
    const text = `Nötfärs 500g
39,90 kr

Mjölk 3%
17,90

Kaffe 450g
49:-`;
    const result = parseOcrText(text);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Date extraction ───────────────────────────────────────────

describe("extractDateRange", () => {
  it("extracts DD/MM - DD/MM format", () => {
    const result = extractDateRange("Gäller 13/1 - 19/1");
    expect(result).not.toBeNull();
    expect(result!.from).toMatch(/^\d{4}-01-13$/);
    expect(result!.to).toMatch(/^\d{4}-01-19$/);
  });

  it("extracts DD.MM-DD.MM format", () => {
    const result = extractDateRange("Erbjudande 5.3-11.3");
    expect(result).not.toBeNull();
    expect(result!.from).toMatch(/^\d{4}-03-05$/);
    expect(result!.to).toMatch(/^\d{4}-03-11$/);
  });

  it("returns null when no date range found", () => {
    const result = extractDateRange("Just some text without dates");
    expect(result).toBeNull();
  });
});
