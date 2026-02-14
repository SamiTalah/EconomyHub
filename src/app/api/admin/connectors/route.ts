import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { icaConnector } from "@/lib/connectors/ica";
import { willysConnector } from "@/lib/connectors/willys";
import { coopConnector } from "@/lib/connectors/coop";
import { ingestFromConnector } from "@/lib/connectors/ingest";
import type { StoreConnector } from "@/lib/connectors/types";

const CONNECTORS: Record<string, StoreConnector> = {
  ICA: icaConnector,
  WILLYS: willysConnector,
  COOP: coopConnector,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { storeId, query } = body;

    if (!storeId) {
      return NextResponse.json(
        { error: "storeId is required" },
        { status: 400 }
      );
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return NextResponse.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    if (!store.externalStoreId) {
      return NextResponse.json(
        {
          error: `Store "${store.name}" has no external store ID configured. Set it in the connector dashboard.`,
        },
        { status: 400 }
      );
    }

    const connector = CONNECTORS[store.chain];
    if (!connector) {
      return NextResponse.json(
        { error: `No connector available for chain: ${store.chain}` },
        { status: 400 }
      );
    }

    const report = await ingestFromConnector(
      connector,
      store.id,
      store.externalStoreId,
      query
    );

    return NextResponse.json({ report });
  } catch (err) {
    console.error("Connector fetch error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unknown error during connector fetch",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Get all stores with their connector status
  const stores = await prisma.store.findMany({
    where: { chain: { in: ["ICA", "WILLYS", "COOP"] } },
    orderBy: [{ chain: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      chain: true,
      format: true,
      externalStoreId: true,
    },
  });

  // Get latest price fetch per store
  const latestPrices = await prisma.regularPrice.groupBy({
    by: ["storeId"],
    where: { source: "PARTNER_API" },
    _max: { observedAt: true },
    _count: true,
  });

  const priceMap = new Map(
    latestPrices.map((p) => [
      p.storeId,
      { lastFetch: p._max.observedAt, count: p._count },
    ])
  );

  const connectorStatus = {
    ICA: {
      name: "ICA",
      configured: true,
      description: "ICA Products API — no auth required",
    },
    WILLYS: {
      name: "Willys",
      configured: !!process.env.WILLYS_API_URL,
      description: process.env.WILLYS_API_URL
        ? "Willys API — configured"
        : "Willys API — set WILLYS_API_URL to enable",
    },
    COOP: {
      name: "Coop",
      configured: !!process.env.COOP_API_URL,
      description: process.env.COOP_API_URL
        ? "Coop API — configured"
        : "Coop API — set COOP_API_URL to enable",
    },
  };

  return NextResponse.json({
    connectors: connectorStatus,
    stores: stores.map((s) => ({
      ...s,
      lastFetch: priceMap.get(s.id)?.lastFetch ?? null,
      fetchedPriceCount: priceMap.get(s.id)?.count ?? 0,
    })),
  });
}

export async function PATCH(req: Request) {
  // Update a store's externalStoreId
  const body = await req.json();
  const { storeId, externalStoreId } = body;

  if (!storeId) {
    return NextResponse.json(
      { error: "storeId is required" },
      { status: 400 }
    );
  }

  const updated = await prisma.store.update({
    where: { id: storeId },
    data: { externalStoreId: externalStoreId || null },
  });

  return NextResponse.json({ store: updated });
}
