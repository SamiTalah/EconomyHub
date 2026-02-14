import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveUploadedFile, fetchPdfFromUrl } from "@/lib/ocr/fetcher";
import { processBuffer, processImage } from "@/lib/ocr/pipeline";
import { readFile } from "fs/promises";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let filePath: string;
    let fileName: string;
    let pdfBuffer: Buffer;
    let sourceType: "UPLOAD" | "AGGREGATOR" = "UPLOAD";
    let storeId: string | null = null;
    let chain: string | null = null;
    let title = "Flygblad";

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      storeId = (formData.get("storeId") as string) ?? null;
      chain = (formData.get("chain") as string) ?? null;
      title = (formData.get("title") as string) ?? "Flygblad";

      if (!file) {
        return NextResponse.json(
          { error: "No file uploaded" },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await saveUploadedFile(buffer, file.name);
      filePath = result.filePath;
      fileName = result.fileName;
      pdfBuffer = buffer;
    } else {
      // JSON with URL
      const body = await req.json();
      const url = body.url as string | undefined;
      storeId = body.storeId ?? null;
      chain = body.chain ?? null;
      title = body.title ?? "Flygblad";
      sourceType = "AGGREGATOR";

      if (!url) {
        return NextResponse.json(
          { error: "No URL provided" },
          { status: 400 }
        );
      }

      const result = await fetchPdfFromUrl(url);
      filePath = result.filePath;
      fileName = result.fileName;
      pdfBuffer = await readFile(result.filePath);
    }

    // Create the DealFlyer record
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Sunday

    const flyer = await prisma.dealFlyer.create({
      data: {
        storeId: storeId || null,
        sourceType: sourceType,
        title,
        weekStart,
        weekEnd,
        rawAssetPath: filePath,
        parseStatus: "PENDING",
      },
    });

    // Run OCR pipeline
    const isPdf =
      fileName.toLowerCase().endsWith(".pdf") ||
      pdfBuffer[0] === 0x25; // %PDF magic byte

    const ocrResult = isPdf
      ? await processBuffer(pdfBuffer)
      : await processImage(pdfBuffer);

    // Update date range if extracted
    if (ocrResult.dateRange) {
      await prisma.dealFlyer.update({
        where: { id: flyer.id },
        data: {
          weekStart: new Date(ocrResult.dateRange.from),
          weekEnd: new Date(ocrResult.dateRange.to),
        },
      });
    }

    // Store raw OCR text
    const rawText = ocrResult.pages.map((p) => p.text).join("\n---\n");
    await prisma.dealFlyer.update({
      where: { id: flyer.id },
      data: {
        rawText,
        parseStatus: "PARSED",
      },
    });

    // Create DealItem candidates from parsed results
    const dealItems = [];
    for (const candidate of ocrResult.candidates) {
      const item = await prisma.dealItem.create({
        data: {
          flyerId: flyer.id,
          normalizedName: candidate.name,
          dealPriceSek: candidate.priceSek,
          multiBuyType: candidate.multiBuyType,
          multiBuyX: candidate.multiBuyX ?? null,
          multiBuyY: candidate.multiBuyY ?? null,
          conditionsText: candidate.conditionsText ?? null,
          memberOnly: candidate.memberOnly,
          limitPerHousehold: candidate.limitPerHousehold ?? null,
          confidenceScore: candidate.confidenceScore,
          approved: false,
          validFrom: ocrResult.dateRange
            ? new Date(ocrResult.dateRange.from)
            : weekStart,
          validTo: ocrResult.dateRange
            ? new Date(ocrResult.dateRange.to)
            : weekEnd,
        },
      });
      dealItems.push(item);
    }

    return NextResponse.json({
      flyer: {
        id: flyer.id,
        title,
        parseStatus: "PARSED",
        rawAssetPath: filePath,
      },
      ocr: {
        pages: ocrResult.pages.length,
        totalConfidence: ocrResult.totalConfidence,
        processingTimeMs: ocrResult.processingTimeMs,
        dateRange: ocrResult.dateRange,
      },
      candidates: dealItems.length,
      items: dealItems.map((item) => ({
        id: item.id,
        name: item.normalizedName,
        price: item.dealPriceSek,
        multiBuyType: item.multiBuyType,
        confidence: item.confidenceScore,
        approved: item.approved,
      })),
    });
  } catch (err) {
    console.error("Flyer processing error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unknown error processing flyer",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const flyers = await prisma.dealFlyer.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      store: { select: { id: true, name: true, chain: true } },
      _count: { select: { dealItems: true } },
      dealItems: {
        select: {
          id: true,
          normalizedName: true,
          dealPriceSek: true,
          multiBuyType: true,
          confidenceScore: true,
          approved: true,
          memberOnly: true,
        },
        orderBy: { confidenceScore: "desc" },
      },
    },
  });

  return NextResponse.json({ flyers });
}
