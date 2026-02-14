// ─── Scheduled Job Runner ────────────────────────────────────────
// Optional cron scheduling for automatic price ingestion.
// Enable by setting ENABLE_CRON=true environment variable.
// Default schedule: daily at 06:00 Stockholm time.

import cron from "node-cron";
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

const CRON_SCHEDULE = process.env.CRON_SCHEDULE ?? "0 6 * * *";

/**
 * Run ingestion for all configured stores.
 */
export async function runIngestionJob(): Promise<void> {
  console.log("[cron] Starting price ingestion job...");

  const stores = await prisma.store.findMany({
    where: {
      externalStoreId: { not: null },
      chain: { in: ["ICA", "WILLYS", "COOP"] },
    },
  });

  console.log(`[cron] Found ${stores.length} stores with external IDs`);

  for (const store of stores) {
    const connector = CONNECTORS[store.chain];
    if (!connector) {
      console.log(`[cron] No connector for chain: ${store.chain}`);
      continue;
    }

    try {
      const report = await ingestFromConnector(
        connector,
        store.id,
        store.externalStoreId!
      );
      console.log(
        `[cron] ${store.name}: fetched=${report.fetched} matched=${report.matched} created=${report.created} prices=${report.pricesInserted} errors=${report.errors.length} (${report.durationMs}ms)`
      );
    } catch (err) {
      console.error(
        `[cron] Error ingesting for ${store.name}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("[cron] Price ingestion job complete.");
}

/**
 * Start the cron scheduler if ENABLE_CRON is set.
 * Call this from the app entry point or a standalone script.
 */
export function startCronScheduler(): void {
  if (process.env.ENABLE_CRON !== "true") {
    console.log("[cron] Cron disabled. Set ENABLE_CRON=true to enable.");
    return;
  }

  console.log(`[cron] Starting scheduler with schedule: ${CRON_SCHEDULE}`);

  cron.schedule(CRON_SCHEDULE, () => {
    runIngestionJob().catch((err) =>
      console.error("[cron] Job failed:", err)
    );
  });
}
