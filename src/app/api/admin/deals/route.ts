import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface DealJsonImport {
  store_name: string;
  chain: string;
  week_start: string;
  week_end: string;
  items: Array<{
    name: string;
    brand?: string;
    size_value?: number;
    size_unit?: string;
    price_sek: number;
    multi_buy_type?: string;
    multi_buy_x?: number;
    multi_buy_y?: number;
    member_only?: boolean;
    limit_per_household?: number;
    conditions?: string;
    gtin?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === "json_import") {
      return handleJsonImport(data);
    }

    if (type === "manual_entry") {
      return handleManualEntry(data);
    }

    return NextResponse.json({ error: "Okänd typ" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Serverfel";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function handleJsonImport(data: DealJsonImport) {
  const errors: string[] = [];
  let imported = 0;

  // Find or match store
  let store = await prisma.store.findFirst({
    where: { name: { contains: data.store_name } },
  });

  if (!store) {
    // Create store stub
    store = await prisma.store.create({
      data: {
        name: data.store_name,
        chain: (data.chain || "OTHER") as any,
        format: (data.chain || "OTHER") as any,
        lat: 59.3293,
        lng: 18.0686,
        city: "Stockholm",
      },
    });
  }

  // Create flyer
  const flyer = await prisma.dealFlyer.create({
    data: {
      storeId: store.id,
      sourceType: "AGGREGATOR",
      title: `${data.store_name} v.${getWeekNumber(new Date(data.week_start))}`,
      weekStart: new Date(data.week_start),
      weekEnd: new Date(data.week_end),
      parseStatus: "APPROVED",
    },
  });

  // Create deal items
  for (const item of data.items) {
    try {
      // Try to find matching product
      let product = null;
      if (item.gtin) {
        product = await prisma.product.findUnique({
          where: { gtin: item.gtin },
        });
      }
      if (!product) {
        product = await prisma.product.findFirst({
          where: { nameSv: { contains: item.name } },
        });
      }

      await prisma.dealItem.create({
        data: {
          flyerId: flyer.id,
          productId: product?.id ?? null,
          normalizedName: item.name,
          brand: item.brand ?? null,
          sizeValue: item.size_value ?? null,
          sizeUnit: item.size_unit ?? null,
          dealPriceSek: item.price_sek,
          multiBuyType: (item.multi_buy_type as any) ?? "NONE",
          multiBuyX: item.multi_buy_x ?? null,
          multiBuyY: item.multi_buy_y ?? null,
          memberOnly: item.member_only ?? false,
          limitPerHousehold: item.limit_per_household ?? null,
          conditionsText: item.conditions ?? null,
          confidenceScore: 90,
          approved: true,
        },
      });
      imported++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Fel";
      errors.push(`${item.name}: ${msg}`);
    }
  }

  return NextResponse.json({ imported, errors });
}

async function handleManualEntry(data: {
  normalizedName: string;
  dealPriceSek: number;
}) {
  // Find or create a generic manual flyer for current week
  const now = new Date();
  const weekStart = getMonday(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  let flyer = await prisma.dealFlyer.findFirst({
    where: {
      sourceType: "ADMIN",
      weekStart: { lte: now },
      weekEnd: { gte: now },
    },
  });

  if (!flyer) {
    flyer = await prisma.dealFlyer.create({
      data: {
        sourceType: "ADMIN",
        title: `Manuella erbjudanden v.${getWeekNumber(now)}`,
        weekStart,
        weekEnd,
        parseStatus: "APPROVED",
      },
    });
  }

  await prisma.dealItem.create({
    data: {
      flyerId: flyer.id,
      normalizedName: data.normalizedName,
      dealPriceSek: data.dealPriceSek,
      confidenceScore: 100,
      approved: true,
    },
  });

  return NextResponse.json({ imported: 1, errors: [] });
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekNumber(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}
