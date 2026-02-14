// ─── Swedish Grocery Flyer OCR Parser ────────────────────────────
// Parses raw OCR text from Swedish grocery flyers and extracts
// product names, prices, multi-buy deals, and conditions.

export interface ParsedDealCandidate {
  name: string;
  priceSek: number;
  multiBuyType: "NONE" | "X_FOR_Y" | "BUY_X_GET_Y" | "PERCENT_OFF";
  multiBuyX?: number;
  multiBuyY?: number;
  conditionsText?: string;
  memberOnly: boolean;
  limitPerHousehold?: number;
  confidenceScore: number;
  rawText: string;
}

// ─── Price Patterns ──────────────────────────────────────────────

// "29,90" or "29.90" or "29:90" optionally followed by "kr"
const PRICE_PATTERN = /(\d+)[,.:]\s*(\d{2})\s*(kr)?/;

// "29:-" or "29 :-"
const WHOLE_PRICE_PATTERN = /(\d+)\s*:-/;

// "29 kr" (whole number with kr suffix)
const SIMPLE_KR_PATTERN = /(\d+)\s*kr\b/;

// ─── Multi-buy Patterns ─────────────────────────────────────────

// "2 för 35" or "2 för 35,00" or "3 för 100 kr"
const X_FOR_Y_PATTERN = /(\d+)\s+för\s+(\d+)[,.]?(\d{0,2})\s*(kr)?/i;

// "Köp 3 betala för 2" / "3 för 2"
const BUY_X_GET_Y_PATTERN = /(?:köp\s+)?(\d+)\s+(?:betala\s+för|för)\s+(\d+)/i;

// "20%" or "30% rabatt"
const PERCENT_OFF_PATTERN = /(\d+)\s*%\s*(rabatt|off)?/i;

// ─── Condition Patterns ─────────────────────────────────────────

// "Medlemspris" / "Stammispris" / "Stammis"
const MEMBER_PATTERN = /(?:medlems?pris|stammis(?:pris)?|kundpris)/i;

// "Max 2 st" / "Max 2 per hushåll" / "Begränsat till 3"
const LIMIT_PATTERN = /(?:max|begr[äa]nsa[dt]?\s+till?)\s+(\d+)\s*(?:st|per|förp)?/i;

// ─── Date Patterns ──────────────────────────────────────────────

// "v.3" or "vecka 3" or "v 3"
const WEEK_PATTERN = /(?:v\.?|vecka)\s*(\d{1,2})/i;

// "13/1 - 19/1" or "13.1-19.1" or "13 jan - 19 jan"
const DATE_RANGE_PATTERN =
  /(\d{1,2})[./]\s*(\d{1,2})\s*[-–]\s*(\d{1,2})[./]\s*(\d{1,2})/;

// ─── Main Parser ────────────────────────────────────────────────

/**
 * Parse a block of OCR text (from one flyer page) into deal candidates.
 * The algorithm works line-by-line, trying to associate product names with prices.
 */
export function parseOcrText(
  rawText: string,
  ocrConfidence: number = 85
): ParsedDealCandidate[] {
  const candidates: ParsedDealCandidate[] = [];
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip very short lines (likely noise)
    if (line.length < 3) {
      i++;
      continue;
    }

    // Try to extract a deal from this line + nearby lines
    const result = tryExtractDeal(lines, i, ocrConfidence);
    if (result) {
      candidates.push(result.candidate);
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  return candidates;
}

function tryExtractDeal(
  lines: string[],
  startIdx: number,
  ocrConfidence: number
): { candidate: ParsedDealCandidate; nextIndex: number } | null {
  // Look at current line and up to 3 following lines as context
  const window = lines.slice(startIdx, startIdx + 4);
  const combinedText = window.join(" ");

  // Try to find a price in the window
  const priceInfo = extractPrice(combinedText);
  if (!priceInfo) return null;

  // Try to find a product name (non-price text before or above the price)
  const name = extractProductName(window, priceInfo.matchedText);
  if (!name || name.length < 2) return null;

  // Check for multi-buy
  const multiBuy = extractMultiBuy(combinedText);

  // Check for member-only
  const memberOnly = MEMBER_PATTERN.test(combinedText);

  // Check for quantity limit
  const limitMatch = combinedText.match(LIMIT_PATTERN);
  const limitPerHousehold = limitMatch ? parseInt(limitMatch[1], 10) : undefined;

  // Build conditions text
  const conditions: string[] = [];
  if (multiBuy.type !== "NONE" && multiBuy.conditionText) {
    conditions.push(multiBuy.conditionText);
  }
  if (memberOnly) conditions.push("Medlemspris");
  if (limitPerHousehold) conditions.push(`Max ${limitPerHousehold} st`);

  // Compute confidence
  let confidence = Math.round(ocrConfidence * 0.7 + 30); // base from OCR confidence
  if (name.length > 5) confidence += 5;
  if (priceInfo.price > 0 && priceInfo.price < 1000) confidence += 10;
  if (multiBuy.type !== "NONE") confidence -= 5; // multi-buy parsing is trickier
  confidence = Math.max(10, Math.min(100, confidence));

  const effectivePrice =
    multiBuy.type === "X_FOR_Y" && multiBuy.y != null
      ? multiBuy.y
      : priceInfo.price;

  const candidate: ParsedDealCandidate = {
    name: cleanProductName(name),
    priceSek: effectivePrice,
    multiBuyType: multiBuy.type,
    multiBuyX: multiBuy.x,
    multiBuyY: multiBuy.y,
    conditionsText: conditions.length > 0 ? conditions.join(", ") : undefined,
    memberOnly,
    limitPerHousehold,
    confidenceScore: confidence,
    rawText: window.slice(0, 3).join("\n"),
  };

  // Skip the lines we consumed
  const linesConsumed = priceInfo.lineOffset + 1;
  return { candidate, nextIndex: startIdx + Math.max(linesConsumed, 2) };
}

function extractPrice(
  text: string
): { price: number; matchedText: string; lineOffset: number } | null {
  // Try X_FOR_Y first (it contains a price)
  const xForY = text.match(X_FOR_Y_PATTERN);
  if (xForY) {
    const decimal = xForY[3] ? `.${xForY[3]}` : "";
    return {
      price: parseFloat(`${xForY[2]}${decimal}`),
      matchedText: xForY[0],
      lineOffset: 0,
    };
  }

  // Try decimal price "29,90" etc.
  const decimal = text.match(PRICE_PATTERN);
  if (decimal) {
    return {
      price: parseFloat(`${decimal[1]}.${decimal[2]}`),
      matchedText: decimal[0],
      lineOffset: 0,
    };
  }

  // Try whole price "29:-"
  const whole = text.match(WHOLE_PRICE_PATTERN);
  if (whole) {
    return {
      price: parseInt(whole[1], 10),
      matchedText: whole[0],
      lineOffset: 0,
    };
  }

  // Try "29 kr"
  const simpleKr = text.match(SIMPLE_KR_PATTERN);
  if (simpleKr) {
    return {
      price: parseInt(simpleKr[1], 10),
      matchedText: simpleKr[0],
      lineOffset: 0,
    };
  }

  return null;
}

function extractMultiBuy(text: string): {
  type: "NONE" | "X_FOR_Y" | "BUY_X_GET_Y" | "PERCENT_OFF";
  x?: number;
  y?: number;
  conditionText?: string;
} {
  // "2 för 35"
  const xForY = text.match(X_FOR_Y_PATTERN);
  if (xForY) {
    const x = parseInt(xForY[1], 10);
    const decimal = xForY[3] ? `.${xForY[3]}` : "";
    const y = parseFloat(`${xForY[2]}${decimal}`);
    return {
      type: "X_FOR_Y",
      x,
      y,
      conditionText: `${x} för ${y} kr`,
    };
  }

  // "Köp 3 betala för 2"
  const buyXGetY = text.match(BUY_X_GET_Y_PATTERN);
  if (buyXGetY) {
    const x = parseInt(buyXGetY[1], 10);
    const y = parseInt(buyXGetY[2], 10);
    return {
      type: "BUY_X_GET_Y",
      x,
      y,
      conditionText: `Köp ${x} betala för ${y}`,
    };
  }

  // "20% rabatt"
  const percent = text.match(PERCENT_OFF_PATTERN);
  if (percent) {
    const pct = parseInt(percent[1], 10);
    if (pct > 0 && pct <= 90) {
      return {
        type: "PERCENT_OFF",
        x: pct,
        conditionText: `${pct}% rabatt`,
      };
    }
  }

  return { type: "NONE" };
}

function extractProductName(
  lines: string[],
  priceMatch: string
): string | null {
  // Look through lines for text that isn't a price
  for (const line of lines) {
    // Remove the price portion
    const cleaned = line.replace(priceMatch, "").trim();
    // Remove common non-product text
    const stripped = cleaned
      .replace(MEMBER_PATTERN, "")
      .replace(LIMIT_PATTERN, "")
      .replace(X_FOR_Y_PATTERN, "")
      .replace(PRICE_PATTERN, "")
      .replace(WHOLE_PRICE_PATTERN, "")
      .replace(SIMPLE_KR_PATTERN, "")
      .replace(/^[-–•*·]+/, "")
      .trim();

    if (stripped.length >= 2 && !/^\d+$/.test(stripped)) {
      return stripped;
    }
  }
  return null;
}

function cleanProductName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/^[-–•*·,.\s]+/, "")
    .replace(/[-–•*·,.\s]+$/, "")
    .trim();
}

/**
 * Extract validity date range from text (best-effort).
 * Returns ISO date strings or null.
 */
export function extractDateRange(
  text: string
): { from: string; to: string } | null {
  const match = text.match(DATE_RANGE_PATTERN);
  if (match) {
    const year = new Date().getFullYear();
    const fromMonth = parseInt(match[2], 10);
    const fromDay = parseInt(match[1], 10);
    const toMonth = parseInt(match[4], 10);
    const toDay = parseInt(match[3], 10);

    const from = `${year}-${String(fromMonth).padStart(2, "0")}-${String(fromDay).padStart(2, "0")}`;
    const to = `${year}-${String(toMonth).padStart(2, "0")}-${String(toDay).padStart(2, "0")}`;
    return { from, to };
  }

  return null;
}
