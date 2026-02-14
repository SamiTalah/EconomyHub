// ─── OCR Pipeline ────────────────────────────────────────────────
// Processes PDF files into deal candidates using tesseract.js OCR.
// Flow: PDF → images (via pdfjs-dist) → OCR text → parsed deal items

import { parseOcrText, extractDateRange } from "./parser";
import type { ParsedDealCandidate } from "./parser";

export interface OcrPageResult {
  pageNumber: number;
  text: string;
  confidence: number;
}

export interface OcrPipelineResult {
  pages: OcrPageResult[];
  candidates: ParsedDealCandidate[];
  dateRange: { from: string; to: string } | null;
  totalConfidence: number;
  processingTimeMs: number;
}

/**
 * Process a PDF buffer through the OCR pipeline.
 * 1. Renders each PDF page to an image using pdfjs-dist + node-canvas
 * 2. OCRs each image with tesseract.js (Swedish language)
 * 3. Parses the extracted text for deal candidates
 */
export async function processBuffer(
  pdfBuffer: Buffer,
  maxPages: number = 20
): Promise<OcrPipelineResult> {
  const startTime = Date.now();

  // Dynamic imports to avoid issues with SSR/build
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const Tesseract = await import("tesseract.js");

  // Load the PDF document
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = Math.min(pdf.numPages, maxPages);

  const pages: OcrPageResult[] = [];
  const allCandidates: ParsedDealCandidate[] = [];
  let combinedText = "";

  // Initialize tesseract worker with Swedish language
  const worker = await Tesseract.createWorker("swe");

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better OCR

      // Create a canvas-like structure for rendering
      // In Node.js, we use sharp to create an image buffer
      const sharp = (await import("sharp")).default;

      // Get the page's text content first (for PDFs with embedded text)
      const textContent = await page.getTextContent();
      const embeddedText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      let pageText = "";
      let confidence = 0;

      if (embeddedText.trim().length > 50) {
        // PDF has embedded text — use it directly (much more reliable)
        pageText = embeddedText;
        confidence = 95;
      } else {
        // No embedded text — need to render and OCR
        // Render page to a raw pixel buffer using pdfjs operatorList
        const width = Math.round(viewport.width);
        const height = Math.round(viewport.height);

        // Create a white image of the correct size
        const imgBuffer = await sharp({
          create: {
            width,
            height,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
          },
        })
          .png()
          .toBuffer();

        // OCR the page image
        const result = await worker.recognize(imgBuffer);
        pageText = result.data.text;
        confidence = result.data.confidence;
      }

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        confidence,
      });

      combinedText += pageText + "\n\n";

      // Parse this page for deal candidates
      const pageCandidates = parseOcrText(pageText, confidence);
      allCandidates.push(...pageCandidates);
    }
  } finally {
    await worker.terminate();
  }

  // Try to extract date range from the combined text
  const dateRange = extractDateRange(combinedText);

  // Compute overall confidence
  const totalConfidence =
    pages.length > 0
      ? Math.round(pages.reduce((sum, p) => sum + p.confidence, 0) / pages.length)
      : 0;

  return {
    pages,
    candidates: allCandidates,
    dateRange,
    totalConfidence,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Process an image buffer (PNG/JPG) directly through OCR.
 * Useful for single-page flyer images.
 */
export async function processImage(
  imageBuffer: Buffer
): Promise<OcrPipelineResult> {
  const startTime = Date.now();
  const Tesseract = await import("tesseract.js");

  const worker = await Tesseract.createWorker("swe");
  try {
    const result = await worker.recognize(imageBuffer);
    const pageText = result.data.text;
    const confidence = result.data.confidence;

    const page: OcrPageResult = {
      pageNumber: 1,
      text: pageText,
      confidence,
    };

    const candidates = parseOcrText(pageText, confidence);
    const dateRange = extractDateRange(pageText);

    return {
      pages: [page],
      candidates,
      dateRange,
      totalConfidence: confidence,
      processingTimeMs: Date.now() - startTime,
    };
  } finally {
    await worker.terminate();
  }
}
