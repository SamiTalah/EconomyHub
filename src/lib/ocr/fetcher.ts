// ─── Flyer PDF Fetcher ───────────────────────────────────────────
// Downloads PDF files from URLs (flyer aggregator sites)
// and saves them to the local uploads/ directory.

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export interface FetchResult {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
}

/**
 * Download a PDF from a URL and save it to uploads/.
 * Returns the local file path.
 */
export async function fetchPdfFromUrl(url: string): Promise<FetchResult> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const res = await fetch(url, {
    headers: {
      "User-Agent": "CartWise-Stockholm/1.0",
      Accept: "application/pdf,image/*",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/pdf";
  const buffer = Buffer.from(await res.arrayBuffer());

  const ext = contentType.includes("pdf") ? "pdf" : "png";
  const fileName = `flyer-${randomUUID().slice(0, 8)}-${Date.now()}.${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);

  await writeFile(filePath, buffer);

  return {
    filePath,
    fileName,
    sizeBytes: buffer.length,
    contentType,
  };
}

/**
 * Save an uploaded file buffer to the uploads directory.
 */
export async function saveUploadedFile(
  buffer: Buffer,
  originalName: string
): Promise<FetchResult> {
  await mkdir(UPLOADS_DIR, { recursive: true });

  const ext = originalName.split(".").pop() ?? "pdf";
  const fileName = `upload-${randomUUID().slice(0, 8)}-${Date.now()}.${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);

  await writeFile(filePath, buffer);

  const contentType = ext === "pdf" ? "application/pdf" : `image/${ext}`;

  return {
    filePath,
    fileName,
    sizeBytes: buffer.length,
    contentType,
  };
}
