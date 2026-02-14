import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeProductKey } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Ingen fil bifogad" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV måste ha minst en rubrikrad och en datarad" },
        { status: 400 }
      );
    }

    // Detect delimiter
    const header = lines[0];
    const delimiter = header.includes(";") ? ";" : ",";
    const headers = header.split(delimiter).map((h) => h.trim().toLowerCase());

    const requiredCols = [
      "store_name",
      "chain",
      "product_name_sv",
      "category",
      "subcategory",
      "price_sek",
    ];
    for (const col of requiredCols) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          { error: `Saknar obligatorisk kolumn: ${col}` },
          { status: 400 }
        );
      }
    }

    let inserted = 0;
    let updated = 0;
    let storesCreated = 0;
    let productsCreated = 0;
    const errors: string[] = [];

    // Cache stores and products by key
    const storeCache = new Map<string, string>();
    const productCache = new Map<string, string>();

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
      if (values.length < headers.length) {
        errors.push(`Rad ${i + 1}: Felaktigt antal kolumner`);
        continue;
      }

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });

      try {
        // Upsert store
        const storeKey = `${row.store_name}_${row.city || "Stockholm"}`;
        let storeId = storeCache.get(storeKey);

        if (!storeId) {
          const existing = await prisma.store.findFirst({
            where: {
              name: row.store_name,
              city: row.city || "Stockholm",
            },
          });

          if (existing) {
            storeId = existing.id;
          } else {
            const store = await prisma.store.create({
              data: {
                name: row.store_name,
                chain: (row.chain || "OTHER") as any,
                format: (row.format || row.chain || "OTHER") as any,
                lat: parseFloat(row.lat) || 59.3293,
                lng: parseFloat(row.lng) || 18.0686,
                city: row.city || "Stockholm",
              },
            });
            storeId = store.id;
            storesCreated++;
          }
          storeCache.set(storeKey, storeId);
        }

        // Upsert product
        const normalizedKey = normalizeProductKey(
          row.product_name_sv,
          row.brand,
          row.size_value ? parseFloat(row.size_value) : null,
          row.size_unit
        );

        let productId = productCache.get(normalizedKey);

        if (!productId) {
          // Try gtin first
          let product = row.gtin
            ? await prisma.product.findUnique({ where: { gtin: row.gtin } })
            : null;

          if (!product) {
            product = await prisma.product.findUnique({
              where: { normalizedKey },
            });
          }

          if (!product) {
            product = await prisma.product.create({
              data: {
                gtin: row.gtin || null,
                nameSv: row.product_name_sv,
                brand: row.brand || null,
                sizeValue: row.size_value ? parseFloat(row.size_value) : null,
                sizeUnit: row.size_unit || null,
                category: row.category as any,
                subcategory: row.subcategory,
                normalizedKey,
              },
            });
            productsCreated++;
          }
          productId = product.id;
          productCache.set(normalizedKey, productId);
        }

        // Insert price (always insert new row for history)
        await prisma.regularPrice.create({
          data: {
            storeId,
            productId,
            priceSek: parseFloat(row.price_sek),
            unitPriceSek: row.unit_price_sek
              ? parseFloat(row.unit_price_sek)
              : null,
            unitUnit: row.unit_unit ? (row.unit_unit as any) : null,
            inStock:
              row.in_stock === undefined ||
              row.in_stock === "" ||
              row.in_stock === "true" ||
              row.in_stock === "1",
            observedAt: row.observed_at
              ? new Date(row.observed_at)
              : new Date(),
            source: "CSV_UPLOAD",
          },
        });
        inserted++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Okänt fel";
        errors.push(`Rad ${i + 1}: ${msg}`);
      }
    }

    return NextResponse.json({
      inserted,
      updated,
      storesCreated,
      productsCreated,
      errors: errors.slice(0, 50),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
